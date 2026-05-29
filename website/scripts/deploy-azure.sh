#!/usr/bin/env bash
# Find My Bay - Marketing landing page deploy to Azure Static Web Apps
#
# Mirrors deploy-azure.ps1 for hosts without PowerShell. Ships index.html +
# download.html + assets/ via the swa CLI to the existing Static Web App.
#
# Usage:
#   ./deploy-azure.sh
#
# Pre-flight:
#   - `az login` done, on the right subscription
#   - npm available (we'll auto-install the swa CLI globally if missing)

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-fmb-prod-rg}"
STATIC_APP_NAME="${STATIC_APP_NAME:-fmb-marketing}"
LOCATION="${LOCATION:-westeurope}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cyan()  { printf '\033[0;36m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }

# ---- 1. Ensure the Static Web App exists ----------------------------------
cyan "==> Ensuring Static Web App '$STATIC_APP_NAME' exists in '$RESOURCE_GROUP'"
EXISTING=$(az staticwebapp list \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='$STATIC_APP_NAME'] | [0].name" -o tsv 2>/dev/null || echo "")

JUST_CREATED=0
if [[ -z "$EXISTING" ]]; then
  echo "    Not found. Creating..."
  az staticwebapp create \
    --name "$STATIC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Free \
    --output none
  JUST_CREATED=1
  green "    Created."
else
  green "    Already exists."
fi

if (( JUST_CREATED )); then
  cyan "==> Waiting 30s for new Static Web App to finish provisioning"
  sleep 30
fi

# ---- 2. swa CLI -----------------------------------------------------------
if ! command -v swa >/dev/null 2>&1; then
  cyan "==> Installing @azure/static-web-apps-cli globally"
  npm install -g @azure/static-web-apps-cli
fi

# ---- 3. Deployment token --------------------------------------------------
cyan "==> Fetching deployment token"
DEPLOY_TOKEN=$(az staticwebapp secrets list \
  --name "$STATIC_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" -o tsv)
if [[ -z "$DEPLOY_TOKEN" ]]; then
  red "Could not get deployment token for '$STATIC_APP_NAME'."
  exit 1
fi

# ---- 4. Stage in /tmp/fmb-marketing-deploy-XXXX/app -----------------------
# Two-level layout to satisfy the swa CLI (cwd cannot equal app folder, and
# cwd recursive scan must not be /tmp root).
STAGING_ROOT=$(mktemp -d -t fmb-marketing-deploy)
STAGING="$STAGING_ROOT/app"
mkdir -p "$STAGING"
cp "$SITE_DIR/index.html" "$STAGING/"
[[ -f "$SITE_DIR/download.html" ]] && cp "$SITE_DIR/download.html" "$STAGING/"
[[ -d "$SITE_DIR/assets" ]] && cp -R "$SITE_DIR/assets" "$STAGING/"
cyan "==> Staged to $STAGING"
ls -la "$STAGING"

# ---- 5. Deploy ------------------------------------------------------------
cyan "==> swa deploy"
( cd "$STAGING_ROOT" && \
  swa deploy ./app \
    --deployment-token "$DEPLOY_TOKEN" \
    --env production )

# ---- 6. Health check ------------------------------------------------------
HOSTNAME=$(az staticwebapp show \
  --name "$STATIC_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "defaultHostname" -o tsv)
green ""
green "==> Done. https://$HOSTNAME"
green "    Verify: https://$HOSTNAME/download.html"

# Cleanup staging.
rm -rf "$STAGING_ROOT"
