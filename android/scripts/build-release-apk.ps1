# Find My Bay - Build a SIGNED release APK (and AAB) for Play Store / sideload
#
# Differs from build-prod-apk.ps1 (which just rebuilds the debug variant under
# a friendly name) - this one runs :app:assembleRelease + :app:bundleRelease
# using the keystore wired in by setup-release-signing.ps1.
#
# Outputs:
#   Desktop\fmb-app-release.apk   <- universal APK for direct sideload
#   Desktop\fmb-app-release.aab   <- Android App Bundle for Play Console upload
#
# Run this AFTER setup-release-signing.ps1 has been run once.

[CmdletBinding()]
param(
    [string]$OutDir = "$env:USERPROFILE\OneDrive\Desktop"
)

$ErrorActionPreference = 'Stop'

$androidDir = Resolve-Path "$PSScriptRoot\.."
$localProps = Join-Path $androidDir 'local.properties'

# 1. Pre-flight: confirm signing is wired up.
$keystoreLine = Get-Content $localProps | Where-Object { $_ -match '^\s*RELEASE_KEYSTORE_FILE\s*=\s*(.+)\s*$' }
if (-not $keystoreLine) {
    throw "RELEASE_KEYSTORE_FILE not found in local.properties. Run android/scripts/setup-release-signing.ps1 first."
}
$keystoreFile = ($keystoreLine -replace '^\s*RELEASE_KEYSTORE_FILE\s*=\s*', '').Trim()
if (-not (Test-Path $keystoreFile)) {
    throw "Keystore at '$keystoreFile' not found on disk. Run setup-release-signing.ps1 again or restore from your backup."
}
Write-Host "==> Using keystore: $keystoreFile" -ForegroundColor Cyan

# 2. Run gradle. assembleRelease produces the universal APK; bundleRelease
#    produces the AAB for Play Store upload. Building both is cheap because
#    they share the same compiled artifacts.
Push-Location $androidDir
try {
    Write-Host "==> .\gradlew :app:assembleRelease :app:bundleRelease" -ForegroundColor Cyan
    & .\gradlew :app:assembleRelease :app:bundleRelease
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle release build failed."
    }
} finally {
    Pop-Location
}

# 3. Locate the outputs and copy to Desktop.
$apkSource = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
$aabSource = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $apkSource)) {
    throw "Expected APK at $apkSource but it was not produced. (Did the signing config silently fail?)"
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$apkOut = Join-Path $OutDir 'fmb-app-release.apk'
$aabOut = Join-Path $OutDir 'fmb-app-release.aab'
Copy-Item $apkSource $apkOut -Force
if (Test-Path $aabSource) { Copy-Item $aabSource $aabOut -Force }

# 4. Print the signing fingerprint of the produced APK so the user can
#    confirm it matches what's whitelisted on the Maps API key.
$buildTools = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$apksigner = Join-Path $buildTools.FullName 'apksigner.bat'
$certs = & $apksigner verify --print-certs $apkOut 2>&1 | Out-String -Stream
$sha1Hex = ($certs | Where-Object { $_ -match 'SHA-1 digest:?\s*([0-9a-fA-F]{40})' } | Select-Object -First 1) `
    -replace '.*?([0-9a-fA-F]{40}).*', '$1'
$sha1Pretty = if ($sha1Hex) { ($sha1Hex -replace '..(?!$)', '$&:').ToUpper() } else { '?' }

Write-Host ''
Write-Host '== Build outputs ==' -ForegroundColor Green
$apkInfo = Get-Item $apkOut
Write-Host ('  APK : {0}  ({1:N2} MB)' -f $apkOut, ($apkInfo.Length / 1MB))
if (Test-Path $aabOut) {
    $aabInfo = Get-Item $aabOut
    Write-Host ('  AAB : {0}  ({1:N2} MB)' -f $aabOut, ($aabInfo.Length / 1MB))
}
Write-Host ''
Write-Host '== Release certificate ==' -ForegroundColor Yellow
Write-Host ('  Package : ae.findmybay')
Write-Host ('  SHA-1   : {0}' -f $sha1Pretty)
Write-Host ''
Write-Host '== Next steps ==' -ForegroundColor Yellow
Write-Host '  - Add the SHA-1 above (with package ae.findmybay) to the Maps API key restrictions in GCP Console.'
Write-Host '  - For Play Store: upload the .aab to Play Console -> Production -> Create release.'
Write-Host '  - For direct sideload: transfer the .apk to the device and install.'
