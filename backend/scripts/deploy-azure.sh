#!/usr/bin/env bash
# Find My Bay - Backend deploy to Azure Container Apps (Mac / Linux).
#
# Mirrors `deploy-azure.ps1` for hosts without PowerShell. Builds the image
# locally, pushes to ACR, then rolls the Container App revision so the new
# image starts serving traffic.
#
# Usage:
#   ./deploy-azure.sh                  # auto-bumps tag (v3 -> v4)
#   ./deploy-azure.sh v5               # explicit tag
#   ./deploy-azure.sh --skip-build v5  # only roll the app to an existing tag
#
# Assumes you have already `az login` and `az account set` to the right
# subscription, and that Docker is running. Run from anywhere in the repo.

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-fmb-prod-rg}"
CONTAINER_APP="${CONTAINER_APP:-fmb-backend}"
SKIP_BUILD=0
TAG=""

# ---- arg parsing -----------------------------------------------------------
while (( "$#" )); do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift ;;
    -h|--help)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*) echo "Unknown flag: $1" >&2; exit 2 ;;
    *)  TAG="$1"; shift ;;
  esac
done

# Resolve backend directory from this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cyan()  { printf '\033[0;36m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }

# ---- 1. Discover ACR + current tag ----------------------------------------
cyan "==> Discovering ACR for container app '$CONTAINER_APP' in '$RESOURCE_GROUP'"
CURRENT_IMAGE=$(az containerapp show \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.template.containers[0].image" -o tsv)

if [[ -z "$CURRENT_IMAGE" ]]; then
  red "Could not read current image. Is 'az login' done? Right subscription?"
  exit 1
fi
echo "    Current image: $CURRENT_IMAGE"

# Image format: <registry>.azurecr.io/<repo>:<tag>
if [[ ! "$CURRENT_IMAGE" =~ ^([^.]+)\.azurecr\.io/([^:]+):(.+)$ ]]; then
  red "Unexpected image string '$CURRENT_IMAGE'. Cannot parse registry/repo/tag."
  exit 1
fi
ACR_NAME="${BASH_REMATCH[1]}"
ACR_REPO="${BASH_REMATCH[2]}"
CURRENT_TAG="${BASH_REMATCH[3]}"
ACR_SERVER="${ACR_NAME}.azurecr.io"
green "    ACR=$ACR_NAME  Repo=$ACR_REPO  CurrentTag=$CURRENT_TAG"

# ---- 2. Compute the next tag if not supplied ------------------------------
if [[ -z "$TAG" ]]; then
  if [[ "$CURRENT_TAG" =~ ^v([0-9]+)$ ]]; then
    TAG="v$((${BASH_REMATCH[1]} + 1))"
  else
    TAG="v$(date +%s)"
  fi
fi
IMAGE="${ACR_SERVER}/${ACR_REPO}:${TAG}"
cyan "==> New image will be: $IMAGE"

# ---- 3. Build + push -------------------------------------------------------
if (( SKIP_BUILD )); then
  echo "==> Skipping build (--skip-build). Will roll to existing tag $TAG."
else
  if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
    red "Docker daemon not reachable. Start Docker Desktop or 'colima start'."
    exit 1
  fi

  cyan "==> az acr login --name $ACR_NAME"
  az acr login --name "$ACR_NAME"

  cyan "==> docker build -t $IMAGE $BACKEND_DIR"
  ( cd "$BACKEND_DIR" && docker build --platform linux/amd64 -t "$IMAGE" . )

  cyan "==> docker push $IMAGE"
  docker push "$IMAGE"
  green "    Build + push succeeded."
fi

# ---- 4. Roll the container app to the new image ---------------------------
cyan "==> Updating container app to point at $IMAGE"
az containerapp update \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$IMAGE" \
  --output none
green "    Update issued."

# ---- 5. Wait + verify the new revision is active --------------------------
cyan "==> Waiting for revision rollout..."
for ATTEMPT in $(seq 1 20); do
  sleep 6
  ACTIVE=$(az containerapp revision list \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?properties.active && properties.trafficWeight==\`100\`].{name:name, image:properties.template.containers[0].image}" \
    -o json)
  ACTIVE_IMAGE=$(echo "$ACTIVE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['image'] if d else '')")
  if [[ "$ACTIVE_IMAGE" == "$IMAGE" ]]; then
    green "    Active revision now serving: $IMAGE"
    break
  fi
  echo "    Still waiting... (attempt $ATTEMPT/20)"
done

# ---- 6. Health check ------------------------------------------------------
cyan "==> Hitting /health on the public URL"
FQDN=$(az containerapp show \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

if [[ -n "$FQDN" ]]; then
  HEALTH=$(curl -sS "https://${FQDN}/health" || echo "[curl failed]")
  echo "    https://${FQDN}/health -> $HEALTH"
fi

echo
green "==> Done. Tag $TAG is live on $CONTAINER_APP."
