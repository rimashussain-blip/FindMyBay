# Find My Bay - Generate the release keystore and wire it into local.properties
#
# Run once. Idempotent: re-running will refuse to overwrite an existing
# keystore unless -Force is passed (we never want to silently invalidate a
# keystore that's already been used to sign an uploaded build).
#
# What it does:
#   1. Prompts (securely) for a keystore password.
#   2. Generates android/keystores/fmb-release.jks via keytool.
#   3. Appends the keystore path + passwords + alias to android/local.properties.
#   4. Prints the SHA-1 / SHA-256 fingerprints to add to the Maps API key
#      whitelist in GCP Console (and to upload to Play Console for Play App
#      Signing later).
#
# Notes:
#   - The keystore is gitignored (*.jks). Back it up off-machine - losing it
#     locks you out of updating the app on Play Store forever (or forces a
#     full key reset, which signs out all existing users).
#   - Use the SAME password for store + key (Android Studio recommends this
#     and our build.gradle.kts assumes it). Pass -SeparateKeyPassword to
#     prompt for two different passwords if you really want them split.

[CmdletBinding()]
param(
    [string]$Alias = 'fmb-upload',
    [int]$ValidityDays = 10000,
    [switch]$SeparateKeyPassword,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$androidDir       = Resolve-Path "$PSScriptRoot\.."
$keystoreDir      = Join-Path $androidDir 'keystores'
$keystorePath     = Join-Path $keystoreDir 'fmb-release.jks'
$localPropsPath   = Join-Path $androidDir 'local.properties'
$keytool          = "C:\Program Files\Java\jdk-17\bin\keytool.exe"

if (-not (Test-Path $keytool)) {
    throw "keytool not found at $keytool - install JDK 17 or adjust the path."
}

# 1. Refuse to clobber an existing keystore.
if ((Test-Path $keystorePath) -and -not $Force) {
    throw "Keystore already exists at $keystorePath. Pass -Force to overwrite (DANGEROUS - invalidates any previously signed APK)."
}

# 2. Prompt for password(s).
$storePassSecure = Read-Host -AsSecureString 'Keystore password (8+ chars; remember this!)'
$storePassConfirm = Read-Host -AsSecureString 'Confirm keystore password'
$storePass = [System.Net.NetworkCredential]::new('', $storePassSecure).Password
$storePassConfirmPlain = [System.Net.NetworkCredential]::new('', $storePassConfirm).Password
if ($storePass -ne $storePassConfirmPlain) {
    throw 'Passwords do not match.'
}
if ($storePass.Length -lt 8) {
    throw 'Password must be at least 8 characters.'
}

if ($SeparateKeyPassword) {
    $keyPassSecure = Read-Host -AsSecureString 'Key password (different from keystore password)'
    $keyPass = [System.Net.NetworkCredential]::new('', $keyPassSecure).Password
    if ($keyPass.Length -lt 8) { throw 'Key password must be at least 8 characters.' }
} else {
    $keyPass = $storePass
}

# 3. Make sure the directory exists.
New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null

# 4. Run keytool. -dname is auto-filled so we don't need 6 follow-up prompts.
Write-Host "==> Generating keystore at $keystorePath" -ForegroundColor Cyan
$dname = 'CN=Find My Bay, O=Find My Bay FZE, L=Dubai, S=Dubai, C=AE'
& $keytool -genkeypair `
    -v `
    -keystore $keystorePath `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity $ValidityDays `
    -storepass $storePass `
    -keypass $keyPass `
    -dname $dname
if ($LASTEXITCODE -ne 0) {
    throw "keytool -genkeypair failed."
}
Write-Host '    Keystore generated.' -ForegroundColor Green

# 5. Append (or update) the signing properties in android/local.properties.
Write-Host "==> Updating $localPropsPath" -ForegroundColor Cyan
$lines = if (Test-Path $localPropsPath) { Get-Content $localPropsPath } else { @() }
# Strip any pre-existing RELEASE_* keys so re-running is idempotent.
$filtered = $lines | Where-Object { $_ -notmatch '^\s*RELEASE_(KEYSTORE_FILE|KEYSTORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD)\s*=' -and $_ -notmatch '^\s*# Release signing' }

# Use forward slashes so Gradle on Windows reads the path correctly without escaping.
$keystorePosix = $keystorePath.Replace('\', '/')

$append = @(
    ''
    '# Release signing - set up by android/scripts/setup-release-signing.ps1.'
    "RELEASE_KEYSTORE_FILE=$keystorePosix"
    "RELEASE_KEYSTORE_PASSWORD=$storePass"
    "RELEASE_KEY_ALIAS=$Alias"
    "RELEASE_KEY_PASSWORD=$keyPass"
)
($filtered + $append) | Set-Content -Path $localPropsPath -Encoding ascii
Write-Host '    local.properties updated.' -ForegroundColor Green

# 6. Print fingerprints for GCP / Play Console.
Write-Host ''
Write-Host '== Keystore fingerprints (whitelist these) ==' -ForegroundColor Yellow
& $keytool -list -v -keystore $keystorePath -alias $Alias -storepass $storePass `
    | Select-String -Pattern 'SHA(1|256)' `
    | ForEach-Object { Write-Host ('  {0}' -f $_.Line.Trim()) }

Write-Host ''
Write-Host '== Next steps ==' -ForegroundColor Yellow
Write-Host '  1. GCP Console -> APIs & Services -> Credentials -> click your Maps API key.'
Write-Host "     Add an Android app entry: package 'ae.findmybay' + the SHA-1 above."
Write-Host '  2. Back up the keystore file off-machine. If you lose it, you cannot ship updates.'
Write-Host "     File: $keystorePath"
Write-Host '  3. Run .\android\scripts\build-release-apk.ps1 to produce a signed release APK.'
