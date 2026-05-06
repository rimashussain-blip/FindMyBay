# Find My Bay - Backend deploy to Azure Container Apps
#
# Builds a new image cloud-side via 'az acr build' (no local Docker daemon
# required), pushes it to the project's Azure Container Registry, then rolls
# the Container App revision so the new image starts serving traffic.
#
# Usage:
#   .\backend\scripts\deploy-azure.ps1                # auto-bumps tag (v3 -> v4)
#   .\backend\scripts\deploy-azure.ps1 -Tag v5        # explicit tag
#   .\backend\scripts\deploy-azure.ps1 -SkipBuild     # only roll the app to the existing tag
#
# Assumes you have already 'az login' and 'az account set' to the right
# subscription. Run from anywhere in the repo.

[CmdletBinding()]
param(
    [string]$Tag,
    [string]$ResourceGroup = 'fmb-prod-rg',
    [string]$ContainerApp  = 'fmb-backend',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$backendDir = Resolve-Path "$PSScriptRoot\.."

# 1. Discover the ACR name + login server from the currently-running container app.
Write-Host "==> Discovering ACR for container app '$ContainerApp' in '$ResourceGroup'" -ForegroundColor Cyan
$currentImage = az containerapp show --name $ContainerApp --resource-group $ResourceGroup --query "properties.template.containers[0].image" -o tsv
if (-not $currentImage) {
    throw "Could not read current image from container app '$ContainerApp'. Is 'az login' done? Right subscription set?"
}
Write-Host "    Current image: $currentImage"

# Image format: <registry>.azurecr.io/<repo>:<tag>
if ($currentImage -notmatch '^([^.]+)\.azurecr\.io/([^:]+):(.+)$') {
    throw "Unexpected image string '$currentImage'. Cannot parse registry/repo/tag."
}
$acrName    = $Matches[1]
$acrRepo    = $Matches[2]
$currentTag = $Matches[3]
$acrServer  = "$acrName.azurecr.io"
Write-Host "    ACR=$acrName  Repo=$acrRepo  CurrentTag=$currentTag" -ForegroundColor Green

# 2. Compute the next tag if not supplied.
if (-not $Tag) {
    if ($currentTag -match '^v(\d+)$') {
        $next = [int]$Matches[1] + 1
        $Tag = "v$next"
    } else {
        $Tag = "v$([int](Get-Date -UFormat %s))"
    }
}
$image = "${acrServer}/${acrRepo}:${Tag}"
Write-Host "==> New image will be: $image" -ForegroundColor Cyan

# 3. Build + push the image. Local Docker build, then push to ACR.
#    (Cloud-side 'az acr build' is unavailable on subscriptions where ACR
#    Tasks is disabled, e.g. Azure for Students. Local build is also
#    typically faster anyway.)
if ($SkipBuild) {
    Write-Host "==> Skipping build (-SkipBuild). Will roll to existing tag $Tag." -ForegroundColor DarkGray
} else {
    # Verify Docker is reachable.
    & docker version --format '{{.Server.Version}}' *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not reachable. Open Docker Desktop and try again."
    }

    Write-Host "==> az acr login --name $acrName" -ForegroundColor Cyan
    az acr login --name $acrName
    if ($LASTEXITCODE -ne 0) {
        throw "az acr login failed with exit code $LASTEXITCODE"
    }

    Write-Host "==> docker build -t $image $backendDir" -ForegroundColor Cyan
    Push-Location $backendDir
    try {
        & docker build -t $image .
        if ($LASTEXITCODE -ne 0) {
            throw "docker build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    Write-Host "==> docker push $image" -ForegroundColor Cyan
    & docker push $image
    if ($LASTEXITCODE -ne 0) {
        throw "docker push failed with exit code $LASTEXITCODE"
    }

    Write-Host "    Build + push succeeded." -ForegroundColor Green
}

# 4. Roll the container app to the new image.
Write-Host "==> Updating container app to point at $image" -ForegroundColor Cyan
az containerapp update `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --image $image `
    --output none
if ($LASTEXITCODE -ne 0) {
    throw "az containerapp update failed with exit code $LASTEXITCODE"
}
Write-Host "    Update issued." -ForegroundColor Green

# 5. Wait + verify the new revision is the active one and is serving traffic.
Write-Host "==> Waiting for revision rollout..." -ForegroundColor Cyan
$attempts = 0
while ($true) {
    $attempts++
    Start-Sleep -Seconds 6
    $active = az containerapp revision list `
        --name $ContainerApp `
        --resource-group $ResourceGroup `
        --query "[?properties.active && properties.trafficWeight==``100``].{name:name, image:properties.template.containers[0].image, replicas:properties.replicas, healthState:properties.healthState}" `
        -o json | ConvertFrom-Json

    if ($active -and $active.Count -ge 1 -and $active[0].image -eq $image) {
        Write-Host ""
        Write-Host "==> Active revision serving traffic:" -ForegroundColor Green
        $active | Format-Table -AutoSize
        break
    }
    if ($attempts -ge 20) {
        Write-Warning "Timed out waiting for revision rollout. Check 'az containerapp revision list ...' manually."
        break
    }
    Write-Host "    Still waiting... (attempt $attempts/20)"
}

# 6. Health check.
Write-Host "==> Hitting /health on the public URL" -ForegroundColor Cyan
$fqdn = az containerapp show --name $ContainerApp --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
if ($fqdn) {
    try {
        $health = curl.exe -sS "https://$fqdn/health"
        Write-Host "    https://$fqdn/health -> $health" -ForegroundColor Green
    } catch {
        Write-Warning "Health check failed: $_"
    }
} else {
    Write-Warning "Could not read public FQDN."
}

Write-Host ""
Write-Host "==> Done. Tag $Tag is live on $ContainerApp." -ForegroundColor Yellow
