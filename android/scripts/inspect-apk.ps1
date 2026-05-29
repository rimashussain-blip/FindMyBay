# Find My Bay - Inspect APK signing certificate + package name
#
# Reads an APK file and prints:
#   - applicationId (package name)
#   - SHA-1 fingerprint of the signing certificate
#   - The exact Application restriction entry to add to your Google Maps API
#     key in GCP Console.
#
# Usage:
#   .\android\scripts\inspect-apk.ps1                       # defaults to Desktop\fmb-app-prod.apk
#   .\android\scripts\inspect-apk.ps1 -Apk "C:\path\to\app.apk"

[CmdletBinding()]
param(
    [string]$Apk = "$env:USERPROFILE\OneDrive\Desktop\fmb-app-prod.apk"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Apk)) {
    throw "APK not found at $Apk. Pass -Apk <path>."
}

# Locate the latest build-tools dir (apksigner + aapt live in there).
$buildToolsRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools'
if (-not (Test-Path $buildToolsRoot)) {
    throw "Android SDK build-tools not found at $buildToolsRoot. Install build-tools via SDK Manager."
}
$buildTools = Get-ChildItem $buildToolsRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
$apksigner = Join-Path $buildTools.FullName 'apksigner.bat'
$aapt = Join-Path $buildTools.FullName 'aapt.exe'

if (-not (Test-Path $apksigner)) { throw "apksigner not found at $apksigner" }
if (-not (Test-Path $aapt))      { throw "aapt not found at $aapt" }

Write-Host "==> Inspecting $Apk" -ForegroundColor Cyan
Write-Host "    Using build-tools $($buildTools.Name)" -ForegroundColor DarkGray

# Package name via aapt.
$badging = & $aapt dump badging $Apk 2>$null
$packageLine = $badging | Select-String -Pattern "^package: name='" | Select-Object -First 1
if (-not $packageLine) {
    throw "Could not read package name from APK."
}
$packageName = if ($packageLine.Line -match "name='([^']+)'") { $Matches[1] } else { '?' }

# Signing fingerprints via apksigner.
$certs = & $apksigner verify --print-certs $Apk 2>&1 | Out-String -Stream

# apksigner output looks like:
#   Signer #1 certificate SHA-1 digest: c84fad5e9926fd9d6460d4fa9ad3df2eb722c066
# We grab the 40-char hex string from the SHA-1 line, regardless of label format.
$sha1Match   = $certs | Where-Object { $_ -match 'SHA-1 digest:?\s*([0-9a-fA-F]{40})' } | Select-Object -First 1
$sha256Match = $certs | Where-Object { $_ -match 'SHA-256 digest:?\s*([0-9a-fA-F]{64})' } | Select-Object -First 1

if (-not $sha1Match) {
    Write-Host "    apksigner output:" -ForegroundColor Red
    $certs | ForEach-Object { Write-Host "      $_" }
    throw "Could not read SHA-1 from apksigner."
}

if ($sha1Match -match '([0-9a-fA-F]{40})')   { $sha1Raw   = $Matches[1] }
if ($sha256Match -match '([0-9a-fA-F]{64})') { $sha256Raw = $Matches[1] } else { $sha256Raw = '?' }

# apksigner prints hex without colons; Google Cloud Console wants colons every 2 chars.
$sha1Pretty   = ($sha1Raw   -replace '..(?!$)', '$&:').ToUpper()
$sha256Pretty = if ($sha256Raw -ne '?') { ($sha256Raw -replace '..(?!$)', '$&:').ToUpper() } else { '?' }

Write-Host ''
Write-Host '== APK details ==' -ForegroundColor Yellow
Write-Host ('  Package name : {0}' -f $packageName)
Write-Host ('  SHA-1        : {0}' -f $sha1Pretty)
Write-Host ('  SHA-256      : {0}' -f $sha256Pretty)
Write-Host ''
Write-Host '== Add this to your Maps API key in GCP Console ==' -ForegroundColor Green
Write-Host '  https://console.cloud.google.com/apis/credentials' -ForegroundColor DarkGray
Write-Host '  -> click your key (AIzaSyDhzI...)'
Write-Host '  -> Application restrictions -> Android apps -> + Add an item'
Write-Host ''
Write-Host ('     Package name : {0}' -f $packageName) -ForegroundColor Yellow
Write-Host ('     SHA-1        : {0}' -f $sha1Pretty) -ForegroundColor Yellow
Write-Host ''
Write-Host '  -> Save -> wait 3-5 minutes for propagation'
Write-Host '  -> reinstall the APK on your phone, reopen the app, map should load.'
