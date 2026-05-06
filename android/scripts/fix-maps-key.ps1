# Find My Bay — Maps API key fix
#
# Writes the Firebase Android key into android/local.properties (gitignored),
# rebuilds the debug APK, reinstalls it on the connected emulator, and force-
# stops the running process so the next launch picks up the new BuildConfig.
#
# Run from anywhere:  pwsh android\scripts\fix-maps-key.ps1
# Or:                 .\android\scripts\fix-maps-key.ps1

$ErrorActionPreference = 'Stop'

$mapsApiKey = 'AIzaSyDt0w7eQVNeQ9oJ-zJ01mkwTmgvSrpzNpU'
$packageName = 'ae.findmybay.debug'
$androidDir = Resolve-Path "$PSScriptRoot\.."
$localPropsPath = Join-Path $androidDir 'local.properties'
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "==> Patching $localPropsPath" -ForegroundColor Cyan

if (-not (Test-Path $localPropsPath)) {
    throw "local.properties not found at $localPropsPath"
}

$lines = Get-Content $localPropsPath
$found = $false
$updated = foreach ($line in $lines) {
    if ($line -match '^\s*MAPS_API_KEY\s*=') {
        $found = $true
        "MAPS_API_KEY=$mapsApiKey"
    } else {
        $line
    }
}
if (-not $found) {
    $updated += ''
    $updated += '# Google Maps SDK for Android key (Firebase project Android key).'
    $updated += "MAPS_API_KEY=$mapsApiKey"
}
$updated | Set-Content -Path $localPropsPath -Encoding utf8
Write-Host "    MAPS_API_KEY set." -ForegroundColor Green

Write-Host "==> Rebuilding + reinstalling debug APK" -ForegroundColor Cyan
Push-Location $androidDir
try {
    .\gradlew :app:installDebug
    if ($LASTEXITCODE -ne 0) {
        throw "gradlew :app:installDebug failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
Write-Host "    Build + install succeeded." -ForegroundColor Green

Write-Host "==> Force-stopping $packageName so new BuildConfig takes effect" -ForegroundColor Cyan
& $adb shell am force-stop $packageName
Write-Host "    Done." -ForegroundColor Green

Write-Host ''
Write-Host '==> All done. Reopen the app on the emulator and check the map.' -ForegroundColor Yellow
Write-Host '   If tiles still gray:' -ForegroundColor Yellow
Write-Host '   1. Confirm the key has Maps SDK for Android enabled in GCP Console.' -ForegroundColor Yellow
Write-Host '   2. Confirm the Application restriction lists package'  -ForegroundColor Yellow
Write-Host "      $packageName + SHA1 C8:4F:AD:5E:99:26:FD:9D:64:60:D4:FA:9A:D3:DF:2E:B7:22:C0:66" -ForegroundColor Yellow
