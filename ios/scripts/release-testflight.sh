#!/usr/bin/env bash
# Find My Bay — Archive the Release build and upload it to TestFlight.
#
# What it does:
#   1. Bumps CFBundleVersion (CI-style monotonic build number).
#   2. `xcodegen` + `xcodebuild archive` (Release, manual / automatic signing).
#   3. `xcodebuild -exportArchive` with App Store distribution options.
#   4. `xcrun altool --upload-app` using an App Store Connect API key.
#
# Requirements (one-time setup):
#   - Apple Developer Program membership (paid).
#   - App record created in App Store Connect for bundle id ae.findmybay.
#     (TestFlight requires this — create at
#      https://appstoreconnect.apple.com/apps before running.)
#   - App Store Connect API Key (Issuer ID + Key ID + .p8 file) exported as
#     env vars:
#       export APP_STORE_KEY_ID="ABCD1234EF"
#       export APP_STORE_ISSUER_ID="69a6de70-..."
#       export APP_STORE_KEY_PATH="$HOME/.appstoreconnect/keys/AuthKey_ABCD1234EF.p8"
#     Generate at https://appstoreconnect.apple.com/access/integrations/api
#     (role: "App Manager" or "Admin"). Keep the .p8 outside the repo.
#   - Xcode signed-in with an Apple ID on the same team (42WB7VFUTD).
#
# Usage:
#   ./scripts/release-testflight.sh                       # auto-bumps build number
#   ./scripts/release-testflight.sh --build 23            # explicit build number
#   ./scripts/release-testflight.sh --skip-upload         # archive + export only
#   ./scripts/release-testflight.sh --skip-archive 23     # reupload existing build

set -euo pipefail

# ---- args ------------------------------------------------------------------
BUILD=""
SKIP_UPLOAD=0
SKIP_ARCHIVE=0

while (( "$#" )); do
  case "$1" in
    --build) BUILD="$2"; shift 2 ;;
    --skip-upload) SKIP_UPLOAD=1; shift ;;
    --skip-archive) SKIP_ARCHIVE=1; shift ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

cyan()  { printf '\033[0;36m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT="$IOS_DIR/FindMyBay.xcodeproj"
SCHEME="FindMyBay"
BUILD_DIR="$IOS_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/FindMyBay.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
EXPORT_OPTIONS="$BUILD_DIR/ExportOptions.plist"

mkdir -p "$BUILD_DIR"

# ---- 1. Compute build number ----------------------------------------------
if [[ -z "$BUILD" ]]; then
  # Read current CFBundleVersion from project.yml and increment.
  CURRENT=$(grep -E '^[[:space:]]+CFBundleVersion:' "$IOS_DIR/project.yml" \
            | awk '{print $2}' | tr -d '"')
  if [[ "$CURRENT" =~ ^[0-9]+$ ]]; then
    BUILD=$((CURRENT + 1))
  else
    BUILD=1
  fi
fi
cyan "==> Build number: $BUILD"

# ---- 2. Update project.yml + regenerate ----------------------------------
# Sed in place; the BSD sed on macOS needs an empty arg for -i.
sed -i '' -E "s/(CFBundleVersion:[[:space:]]+)\"?[0-9]+\"?/\1\"$BUILD\"/" "$IOS_DIR/project.yml"

cyan "==> xcodegen generate"
( cd "$IOS_DIR" && xcodegen generate >/dev/null )

# ---- 3. Archive -----------------------------------------------------------
# FindMyBay's Release config uses MANUAL signing with the pre-fetched
# "FindMyBay App Store" profile (see project.yml). SPM packages continue
# using automatic Development signing — they're not standalone apps so
# they don't need a device-tied profile. `-allowProvisioningUpdates` lets
# Xcode refresh the locally-installed profile from the developer portal if
# it's stale.
if (( SKIP_ARCHIVE == 0 )); then
  cyan "==> xcodebuild archive (Release, generic iOS device, manual Distribution signing)"
  xcodebuild archive \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    || (red "Archive failed"; exit 1)
  green "    Archive at $ARCHIVE_PATH"
else
  cyan "==> Skipping archive (--skip-archive). Using existing $ARCHIVE_PATH"
  [[ -d "$ARCHIVE_PATH" ]] || { red "No archive at $ARCHIVE_PATH"; exit 1; }
fi

# ---- 4. Export IPA for App Store --------------------------------------------
# `app-store-connect` method = TestFlight + App Store. We use automatic
# signing so Xcode resolves the Distribution profile against the team.
cat > "$EXPORT_OPTIONS" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>42WB7VFUTD</string>
  <!-- Matches the project.yml Release config: manual signing with the
       pre-fetched "FindMyBay App Store" profile. The provisioningProfiles
       map keys bundle ids to profile names. -->
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>ae.findmybay</key>
    <string>FindMyBay App Store</string>
  </dict>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>uploadSymbols</key>
  <true/>
  <key>destination</key>
  <string>export</string>
</dict>
</plist>
EOF

cyan "==> xcodebuild -exportArchive"
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates \
  || (red "Export failed"; exit 1)

IPA="$(find "$EXPORT_DIR" -name '*.ipa' | head -n1)"
[[ -n "$IPA" ]] || { red "No IPA produced"; exit 1; }
green "    IPA at $IPA"

# ---- 5. Upload to TestFlight ----------------------------------------------
if (( SKIP_UPLOAD == 1 )); then
  green "==> Skipping upload. IPA ready at $IPA"
  exit 0
fi

: "${APP_STORE_KEY_ID:?Set APP_STORE_KEY_ID env var}"
: "${APP_STORE_ISSUER_ID:?Set APP_STORE_ISSUER_ID env var}"
: "${APP_STORE_KEY_PATH:?Set APP_STORE_KEY_PATH env var to your AuthKey_*.p8}"

# altool wants the key file in a fixed directory: ~/.appstoreconnect/private_keys/
# We accept either that path or a custom one; copy in if needed.
PRIVATE_KEYS_DIR="$HOME/.appstoreconnect/private_keys"
mkdir -p "$PRIVATE_KEYS_DIR"
EXPECTED="$PRIVATE_KEYS_DIR/AuthKey_${APP_STORE_KEY_ID}.p8"
if [[ "$APP_STORE_KEY_PATH" != "$EXPECTED" ]]; then
  cp -f "$APP_STORE_KEY_PATH" "$EXPECTED"
fi

cyan "==> altool --upload-app (TestFlight)"
xcrun altool --upload-app \
  -t ios \
  -f "$IPA" \
  --apiKey "$APP_STORE_KEY_ID" \
  --apiIssuer "$APP_STORE_ISSUER_ID" \
  --output-format json

green "==> Build $BUILD uploaded. Apple's processor takes ~10-30 min before TestFlight shows it."
echo
echo "Watch progress: https://appstoreconnect.apple.com/apps -> Find My Bay -> TestFlight"
