# Find My Bay - Marketing landing page deploy to Azure Static Web Apps
#
# Static HTML site (no build step). Creates a Static Web App resource if it
# doesn't exist yet, then ships index.html + assets/ via the swa CLI.
#
# Usage:
#   .\website\scripts\deploy-azure.ps1
#   .\website\scripts\deploy-azure.ps1 -StaticAppName fmb-marketing
#
# Pre-flight:
#   - 'az login' done, on the right subscription
#   - swa CLI available globally (auto-installed below if missing)

[CmdletBinding()]
param(
    [string]$ResourceGroup = 'fmb-prod-rg',
    [string]$StaticAppName = 'fmb-marketing',
    [string]$Location      = 'westeurope'
)

$ErrorActionPreference = 'Stop'

$siteDir = Resolve-Path "$PSScriptRoot\.."

# 1. Make sure the Static Web App exists. Free SKU, no GitHub link (we use
#    swa deploy with a token instead). Idempotent: 'az staticwebapp create'
#    on an existing resource just returns it.
Write-Host "==> Ensuring Static Web App '$StaticAppName' exists in '$ResourceGroup'" -ForegroundColor Cyan
$existing = az staticwebapp list --resource-group $ResourceGroup --query "[?name=='$StaticAppName'] | [0].name" -o tsv
$justCreated = $false
if (-not $existing) {
    # Static Web Apps Free is not available in every region. uaecentral is
    # not supported as of writing; westeurope is the closest reliable one.
    Write-Host "    Not found. Creating..." -ForegroundColor DarkGray
    az staticwebapp create `
        --name $StaticAppName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Free `
        --output none
    if ($LASTEXITCODE -ne 0) {
        throw "az staticwebapp create failed."
    }
    $justCreated = $true
    Write-Host "    Created." -ForegroundColor Green
} else {
    Write-Host "    Already exists." -ForegroundColor Green
}

if ($justCreated) {
    # Newly created SWAs need ~30s for the deployment endpoint to come online.
    # Without this wait, swa deploy fails with a misleading "minimal container
    # image" error.
    Write-Host "==> Waiting 30s for new Static Web App to finish provisioning" -ForegroundColor Cyan
    Start-Sleep -Seconds 30
}

# 2. Make sure the swa CLI is installed.
$swa = Get-Command swa -ErrorAction SilentlyContinue
if (-not $swa) {
    Write-Host "==> Installing @azure/static-web-apps-cli globally" -ForegroundColor Cyan
    npm install -g @azure/static-web-apps-cli
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install swa CLI."
    }
}

# 3. Get the deployment token.
Write-Host "==> Fetching deployment token" -ForegroundColor Cyan
$deployToken = az staticwebapp secrets list `
    --name $StaticAppName `
    --resource-group $ResourceGroup `
    --query "properties.apiKey" `
    -o tsv
if (-not $deployToken) {
    throw "Could not get deployment token for '$StaticAppName'."
}

# 4. Stage in our own clean parent dir, with the actual artifacts inside an
#    'app/' subfolder. We need this two-level layout because:
#      (a) cwd cannot equal the app folder (StaticSitesClient.exe rejects).
#      (b) swa CLI also scans cwd recursively for staticwebapp.config.json,
#          so cwd must NOT be %TEMP% (it would crawl WinSAT etc. and EPERM).
$stagingRoot = Join-Path $env:TEMP ("fmb-marketing-deploy-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$staging     = Join-Path $stagingRoot 'app'
Write-Host "==> Staging to $staging" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item (Join-Path $siteDir '*.html') $staging
if (Test-Path (Join-Path $siteDir 'assets')) {
    Copy-Item (Join-Path $siteDir 'assets') $staging -Recurse
}

# 5. Deploy from the clean parent dir, pointing at the app subfolder.
Write-Host "==> Deploying $staging to $StaticAppName" -ForegroundColor Cyan
Push-Location $stagingRoot
try {
    swa deploy 'app' --deployment-token $deployToken --env production
    if ($LASTEXITCODE -ne 0) {
        throw "swa deploy failed."
    }
} finally {
    Pop-Location
    Remove-Item $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}

# 5. Print the live URL.
$hostname = az staticwebapp show `
    --name $StaticAppName `
    --resource-group $ResourceGroup `
    --query "defaultHostname" `
    -o tsv

Write-Host ''
Write-Host "==> Marketing site deployed." -ForegroundColor Green
if ($hostname) {
    Write-Host "    https://$hostname/" -ForegroundColor Yellow
}
Write-Host ''
Write-Host '    Want a custom domain (findmybay.ae)?' -ForegroundColor DarkGray
Write-Host "      az staticwebapp hostname set --name $StaticAppName -g $ResourceGroup --hostname findmybay.ae" -ForegroundColor DarkGray
