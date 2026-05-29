# Find My Bay - Vendor admin SPA deploy to Azure Static Web Apps
#
# Builds the Vite SPA with VITE_API_BASE_URL pointing at the prod backend,
# then ships the dist/ folder to the Azure Static Web App via the swa CLI.
#
# Usage:
#   .\vendor-admin\scripts\deploy-azure.ps1
#   .\vendor-admin\scripts\deploy-azure.ps1 -SkipBuild
#
# Pre-flight:
#   - 'az login' done, on the right subscription
#   - swa CLI available globally (auto-installed below if missing)

[CmdletBinding()]
param(
    [string]$ResourceGroup = 'fmb-prod-rg',
    [string]$BackendApp    = 'fmb-backend',
    [string]$StaticAppName,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$adminDir = Resolve-Path "$PSScriptRoot\.."

# 1. Discover the backend FQDN so the SPA bundle hard-codes the right API base.
Write-Host "==> Discovering backend FQDN" -ForegroundColor Cyan
$backendFqdn = az containerapp show `
    --name $BackendApp `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" `
    -o tsv
if (-not $backendFqdn) {
    throw "Could not read FQDN from container app '$BackendApp'."
}
$apiUrl = "https://$backendFqdn"
Write-Host "    API base = $apiUrl" -ForegroundColor Green

# 2. Discover the Static Web App if not supplied.
if (-not $StaticAppName) {
    Write-Host "==> Locating Static Web App in $ResourceGroup" -ForegroundColor Cyan
    $StaticAppName = az staticwebapp list `
        --resource-group $ResourceGroup `
        --query "[0].name" `
        -o tsv
    if (-not $StaticAppName) {
        throw "No Static Web App found in '$ResourceGroup'. Pass -StaticAppName <name>."
    }
    Write-Host "    Static Web App = $StaticAppName" -ForegroundColor Green
}

# 3. Build the SPA against prod API.
if ($SkipBuild) {
    Write-Host "==> Skipping build (-SkipBuild)." -ForegroundColor DarkGray
} else {
    Write-Host "==> Building SPA with VITE_API_BASE_URL=$apiUrl" -ForegroundColor Cyan
    Push-Location $adminDir
    try {
        $env:VITE_API_BASE_URL = $apiUrl
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
        Pop-Location
    }
    Write-Host "    Build OK -> $($adminDir)\dist" -ForegroundColor Green
}

# 4. Make sure swa CLI is installed.
$swa = Get-Command swa -ErrorAction SilentlyContinue
if (-not $swa) {
    Write-Host "==> Installing @azure/static-web-apps-cli globally" -ForegroundColor Cyan
    npm install -g @azure/static-web-apps-cli
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install swa CLI."
    }
}

# 5. Get the deployment token from the Static Web App.
Write-Host "==> Fetching SWA deployment token" -ForegroundColor Cyan
$deployToken = az staticwebapp secrets list `
    --name $StaticAppName `
    --resource-group $ResourceGroup `
    --query "properties.apiKey" `
    -o tsv
if (-not $deployToken) {
    throw "Could not get deployment token for Static Web App '$StaticAppName'."
}

# 6. Deploy.
Write-Host "==> Deploying $($adminDir)\dist to Static Web App $StaticAppName" -ForegroundColor Cyan
Push-Location $adminDir
try {
    swa deploy "./dist" --deployment-token $deployToken --env production
    if ($LASTEXITCODE -ne 0) {
        throw "swa deploy failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# 7. Print the public URL.
$hostname = az staticwebapp show `
    --name $StaticAppName `
    --resource-group $ResourceGroup `
    --query "defaultHostname" `
    -o tsv

Write-Host ''
Write-Host "==> SPA deployed." -ForegroundColor Green
if ($hostname) {
    Write-Host "    https://$hostname/platform/users" -ForegroundColor Yellow
}
Write-Host '    Sign in with admin@findmybay.ae / fmb-admin-2026 to verify.' -ForegroundColor Yellow
