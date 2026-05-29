# Find My Bay - Build APK and copy it to Desktop for sideload
#
# Builds the debug-variant APK (which is what your "production" sideload is
# signed as right now), then copies the resulting file to your Desktop with
# the name you've been transferring to your phone.
#
# Usage:
#   .\android\scripts\build-prod-apk.ps1
#   .\android\scripts\build-prod-apk.ps1 -Out "C:\path\to\custom-name.apk"

[CmdletBinding()]
param(
    [string]$Out = "$env:USERPROFILE\OneDrive\Desktop\fmb-app-prod.apk"
)

$ErrorActionPreference = 'Stop'

$androidDir = Resolve-Path "$PSScriptRoot\.."
$apkSource  = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'

# 1. Confirm local.properties has the new Maps key (not the dead one).
$localProps = Join-Path $androidDir 'local.properties'
$mapsKey = (Get-Content $localProps | Where-Object { $_ -match '^\s*MAPS_API_KEY\s*=' } | Select-Object -First 1) -replace '^\s*MAPS_API_KEY\s*=\s*', ''
if (-not $mapsKey) {
    Write-Warning "MAPS_API_KEY not found in local.properties. The APK will use the placeholder/dead key from gradle.properties."
} elseif ($mapsKey -eq 'AIzaSyCikUz4b5IUZ3RDsjAXWsvHwsHsN01xFvM') {
    throw "local.properties still has the dead key (AIzaSyCikUz4...). Run set-maps-key.ps1 first with the new Firebase key."
} else {
    Write-Host ("==> Building with MAPS_API_KEY = {0}..." -f $mapsKey.Substring(0, 12)) -ForegroundColor Cyan
}

# 2. Build.
Push-Location $androidDir
try {
    & .\gradlew :app:assembleDebug
    if ($LASTEXITCODE -ne 0) {
        throw "gradlew :app:assembleDebug failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $apkSource)) {
    throw "Expected APK at $apkSource but it wasn't produced."
}

# 3. Copy to Desktop with the sideload filename.
Copy-Item $apkSource $Out -Force
$built = Get-Item $Out

Write-Host ''
Write-Host '==> APK built and copied.' -ForegroundColor Green
Write-Host ('    {0}' -f $built.FullName)
Write-Host ('    Size: {0:N2} MB   Built: {1}' -f ($built.Length / 1MB), $built.LastWriteTime)
Write-Host ''
Write-Host '==> Next steps:' -ForegroundColor Yellow
Write-Host '    1. Transfer this APK to your phone (USB / cloud / whatever).'
Write-Host '    2. UNINSTALL the previous version on the phone first (Settings -> Apps -> FMB Dev -> Uninstall).'
Write-Host '       Skipping uninstall causes signature-mismatch install errors when the cert differs.'
Write-Host '    3. Install the new APK.'
Write-Host '    4. Open the app, sign in, navigate to the map. Tiles should load.'
