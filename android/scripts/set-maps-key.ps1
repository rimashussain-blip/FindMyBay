# Find My Bay - Set Google Maps API key
#
# Updates android/local.properties with a Maps API key, rebuilds the debug
# APK, reinstalls on the connected emulator, and force-stops the running
# process so the next launch picks up the new BuildConfig.
#
# Usage:
#   .\android\scripts\set-maps-key.ps1 -Key "AIzaSy..."
# Or run with no -Key and it will prompt.
#
# Optional flags:
#   -SkipBuild     # only update local.properties, do not rebuild
#   -SkipInstall   # rebuild but do not reinstall (no emulator needed)

[CmdletBinding()]
param(
    [string]$Key,
    [switch]$SkipBuild,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

if (-not $Key) {
    $Key = Read-Host -Prompt 'Paste your Maps API key (AIzaSy...)'
}

$Key = $Key.Trim()
if ($Key -notmatch '^AIza[0-9A-Za-z_-]{35}$') {
    Write-Warning "That does not look like a Google API key (expected 'AIza' + 35 chars)."
    $confirm = Read-Host 'Use it anyway? (y/N)'
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host 'Aborted.' -ForegroundColor Red
        exit 1
    }
}

$packageName = 'ae.findmybay.debug'
$androidDir = Resolve-Path "$PSScriptRoot\.."
$localPropsPath = Join-Path $androidDir 'local.properties'
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

# 1. Patch local.properties (idempotent)
Write-Host "==> Patching $localPropsPath" -ForegroundColor Cyan
if (-not (Test-Path $localPropsPath)) {
    throw "local.properties not found at $localPropsPath"
}

$lines = Get-Content $localPropsPath
$found = $false
$updated = foreach ($line in $lines) {
    if ($line -match '^\s*MAPS_API_KEY\s*=') {
        $found = $true
        "MAPS_API_KEY=$Key"
    } else {
        $line
    }
}
if (-not $found) {
    $updated += ''
    $updated += '# Google Maps SDK for Android'
    $updated += "MAPS_API_KEY=$Key"
}
$updated | Set-Content -Path $localPropsPath -Encoding ascii
Write-Host ("    MAPS_API_KEY set ({0}...)." -f $Key.Substring(0, 10)) -ForegroundColor Green

# 2. Rebuild + install
if ($SkipBuild) {
    Write-Host '==> Skipping build (-SkipBuild).' -ForegroundColor DarkGray
    exit 0
}

if ($SkipInstall) {
    $gradleTask = ':app:assembleDebug'
} else {
    $gradleTask = ':app:installDebug'
}
Write-Host "==> Running .\gradlew $gradleTask" -ForegroundColor Cyan
Push-Location $androidDir
try {
    & .\gradlew $gradleTask
    if ($LASTEXITCODE -ne 0) {
        throw "gradlew $gradleTask failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
Write-Host '    Build succeeded.' -ForegroundColor Green

# 3. Force-stop the app so it picks up new BuildConfig
if (-not $SkipInstall) {
    Write-Host "==> Force-stopping $packageName" -ForegroundColor Cyan
    if (Test-Path $adb) {
        & $adb shell am force-stop $packageName
        Write-Host '    Done.' -ForegroundColor Green
    } else {
        Write-Warning "adb not found at $adb. Skip force-stop and reopen the app manually."
    }
}

Write-Host ''
Write-Host '==> Reopen the app on the emulator and check the map.' -ForegroundColor Yellow
Write-Host '    Still gray? Verify in GCP Console:' -ForegroundColor Yellow
Write-Host '    1. Maps SDK for Android is enabled.' -ForegroundColor Yellow
Write-Host ('    2. Application restriction lists package {0} + SHA1' -f $packageName) -ForegroundColor Yellow
Write-Host '       C8:4F:AD:5E:99:26:FD:9D:64:60:D4:FA:9A:D3:DF:2E:B7:22:C0:66' -ForegroundColor Yellow
