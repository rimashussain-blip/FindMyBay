# Find My Bay — Azure Deployment Runbook

UAE-resident deployment to Microsoft Azure UAE Central (Dubai). About 60–90
minutes end-to-end if everything goes smoothly. We'll use:

| Component | Azure service | MVP tier | Monthly cost (USD) |
|---|---|---|---|
| Backend API | Azure Container Apps | Consumption + 1 min replica | $30–50 |
| Postgres + PostGIS | Database for PostgreSQL Flexible Server | Burstable B1ms | $25–35 |
| Redis | Azure Cache for Redis | Basic C0 (250 MB) | $16 |
| Vendor admin SPA | Static Web Apps | Free tier | $0 |
| Container registry | Azure Container Registry | Basic | $5 |
| Secrets | Key Vault | Standard | ~$1 |
| **Total** | | | **~$80–110/mo** |

When you outgrow MVP scale, the same stack moves up to Premium tiers without
a re-architect.

---

## Phase 1 — Prerequisites (one-time)

### 1.1 Install Azure CLI

```powershell
winget install --id Microsoft.AzureCLI --silent
# OR if winget isn't available:
# https://aka.ms/installazurecliwindowsx64
```

Reopen PowerShell after install. Verify:

```powershell
az --version
```

### 1.2 Sign in + pick the right subscription

```powershell
az login                    # browser flow
az account list --output table
az account set --subscription "<your subscription id or name>"
```

### 1.3 Set defaults so you don't repeat them

```powershell
$env:AZURE_REGION = "uaecentral"
$env:RG = "fmb-prod-rg"
az config set defaults.location=$env:AZURE_REGION
az config set defaults.group=$env:RG
```

### 1.4 Create the resource group

```powershell
az group create --name $env:RG --location $env:AZURE_REGION
```

---

## Phase 2 — Postgres + Redis

### 2.1 Create Postgres Flexible Server with PostGIS

Pick a strong password and stash it — you'll inject it into the connection
string later. Use the secrets generator:

```powershell
$pgPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
Write-Host "Postgres admin password: $pgPassword"  # save it somewhere safe
```

Create the server:

```powershell
az postgres flexible-server create `
  --name fmb-prod-pg `
  --admin-user fmbadmin `
  --admin-password "$pgPassword" `
  --version 16 `
  --tier Burstable --sku-name Standard_B1ms `
  --storage-size 32 `
  --public-access 0.0.0.0 `
  --backup-retention 7 `
  --geo-redundant-backup Disabled `
  --high-availability Disabled
```

(`--public-access 0.0.0.0` opens it to all Azure services; we'll lock down to
just Container Apps later. For pilot it's acceptable.)

Create the database:

```powershell
az postgres flexible-server db create --server-name fmb-prod-pg --database-name findmybay
```

Enable PostGIS:

```powershell
az postgres flexible-server parameter set --server-name fmb-prod-pg `
  --name azure.extensions --value "POSTGIS"
az postgres flexible-server restart --name fmb-prod-pg

# Then connect and create the extension inside the DB:
$pgHost = "fmb-prod-pg.postgres.database.azure.com"
psql "host=$pgHost port=5432 dbname=findmybay user=fmbadmin password=$pgPassword sslmode=require" `
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

(If `psql` isn't installed: `winget install --id PostgreSQL.PostgreSQL`. Or
do this step from the Azure Portal's "Query editor" later.)

### 2.2 Build the connection string for the backend

```powershell
$DATABASE_URL = "postgresql://fmbadmin:$pgPassword@${pgHost}:5432/findmybay?sslmode=require"
```

Save that string for Phase 5.

### 2.3 Create Redis

```powershell
az redis create --name fmb-prod-redis --sku Basic --vm-size c0
# Wait ~10 minutes for provisioning
az redis show --name fmb-prod-redis --query hostName --output tsv
```

Get the access key:

```powershell
$redisHost = az redis show --name fmb-prod-redis --query hostName --output tsv
$redisKey = az redis list-keys --name fmb-prod-redis --query primaryKey --output tsv
$REDIS_URL = "rediss://:$redisKey@${redisHost}:6380"
```

---

## Phase 3 — Container Registry + image push

### 3.1 Create the registry

```powershell
az acr create --name fmbprodacr --sku Basic --admin-enabled true
```

(`--admin-enabled` lets us pull with username/password from Container Apps;
for production you'd switch to managed identity later.)

### 3.2 Build + push the image to ACR (no Docker daemon needed!)

ACR can build straight from your source — no local Docker required. Run from
the project root (the directory above `backend/`):

```powershell
cd "C:\Users\Rimas\OneDrive\Documents\Claude\Projects\Find My Bay\backend"
az acr build --registry fmbprodacr --image fmb-backend:v1 .
```

That uploads your source to ACR, builds the image cloud-side, and tags it
`fmb-backend:v1`. Takes 3–5 minutes the first time.

(If you'd rather build locally: `docker build -t fmb-backend:v1 backend`,
then `az acr login --name fmbprodacr && docker tag fmb-backend:v1 fmbprodacr.azurecr.io/fmb-backend:v1 && docker push fmbprodacr.azurecr.io/fmb-backend:v1`.
The ACR build is simpler.)

---

## Phase 4 — Generate production secrets

In TERMINAL A:

```powershell
cd "C:\Users\Rimas\OneDrive\Documents\Claude\Projects\Find My Bay\backend"
npx tsx scripts/gen-prod-secrets.ts > prod-secrets.tmp.txt
notepad prod-secrets.tmp.txt    # copy the JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values
```

You'll paste those into the Container Apps env vars below. Delete
`prod-secrets.tmp.txt` after you've harvested them.

---

## Phase 5 — Backend on Container Apps

### 5.1 Create the Container Apps environment

```powershell
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

az containerapp env create --name fmb-prod-cae --location $env:AZURE_REGION
```

### 5.2 Get ACR creds

```powershell
$acrServer = az acr show --name fmbprodacr --query loginServer --output tsv
$acrUser = az acr credential show --name fmbprodacr --query username --output tsv
$acrPass = az acr credential show --name fmbprodacr --query "passwords[0].value" --output tsv
```

### 5.3 Deploy the backend

Replace the `<…>` placeholders below with values from earlier steps. The
JWT secrets came from `prod-secrets.tmp.txt`. The `GOOGLE_OAUTH_CLIENT_ID`
is the same one you use locally.

```powershell
az containerapp create `
  --name fmb-backend `
  --environment fmb-prod-cae `
  --image $acrServer/fmb-backend:v1 `
  --registry-server $acrServer `
  --registry-username $acrUser `
  --registry-password $acrPass `
  --target-port 3000 `
  --ingress external `
  --min-replicas 1 `
  --max-replicas 3 `
  --cpu 0.5 --memory 1.0Gi `
  --env-vars `
    NODE_ENV=production `
    PORT=3000 `
    LOG_LEVEL=info `
    DATABASE_URL="secretref:database-url" `
    REDIS_URL="secretref:redis-url" `
    JWT_ACCESS_SECRET="secretref:jwt-access" `
    JWT_REFRESH_SECRET="secretref:jwt-refresh" `
    JWT_ACCESS_TTL_MIN=15 `
    JWT_REFRESH_TTL_DAYS=30 `
    OTP_DELIVERY=console `
    OTP_TTL_MIN=5 `
    OTP_RESEND_COOLDOWN_SEC=30 `
    OTP_MAX_ATTEMPTS=5 `
    CORS_ORIGINS="https://findmybay.ae,https://admin.findmybay.ae" `
    GOOGLE_MAPS_API_KEY="<your maps key>" `
    GOOGLE_OAUTH_CLIENT_ID="343658146175-4lup27uphshfmlmetnomi20i6pm1rol9.apps.googleusercontent.com" `
    PAYMENT_PROVIDER=mock `
    PUBLIC_API_BASE_URL="https://fmb-backend.<random>.uaecentral.azurecontainerapps.io" `
    PAYMENT_RETURN_DEEP_LINK=findmybay://payment/return `
  --secrets `
    database-url="$DATABASE_URL" `
    redis-url="$REDIS_URL" `
    jwt-access="<paste from prod-secrets.tmp.txt>" `
    jwt-refresh="<paste from prod-secrets.tmp.txt>"
```

After deploy, get the URL:

```powershell
$apiUrl = az containerapp show --name fmb-backend --query properties.configuration.ingress.fqdn --output tsv
"https://$apiUrl"
```

Update the `PUBLIC_API_BASE_URL` env we pre-populated:

```powershell
az containerapp update --name fmb-backend `
  --set-env-vars PUBLIC_API_BASE_URL="https://$apiUrl"
```

### 5.4 Smoke-test the API

```powershell
curl "https://$apiUrl/health"
# Expected: {"ok":true,"ts":"2026-..."}
```

If you see `{"ok":true}` — the backend is live, migrations applied, alert
worker started. If not, get the logs:

```powershell
az containerapp logs show --name fmb-backend --follow
```

### 5.5 Seed the platform admin

```powershell
az containerapp exec --name fmb-backend --command "/bin/sh"
# Inside the container:
npx tsx prisma/scripts/create-admin.ts admin@findmybay.ae <strong-password>
exit
```

(If `containerapp exec` isn't available in your CLI version, run the
seed locally pointing at the prod DB:
`cd backend && DATABASE_URL=$DATABASE_URL npx tsx prisma/scripts/create-admin.ts ...`)

---

## Phase 6 — Vendor admin on Static Web Apps

### 6.1 Build the SPA against the prod API

```powershell
cd "C:\Users\Rimas\OneDrive\Documents\Claude\Projects\Find My Bay\vendor-admin"
# vendor-admin uses Vite's /api proxy in dev. For prod we point straight at
# the backend FQDN. Either set VITE_API_BASE_URL or use a rewrite rule.

$env:VITE_API_BASE_URL = "https://$apiUrl"
npm run build
```

### 6.2 Deploy

The simplest path: Static Web Apps deploys from GitHub via the SWA CLI.

```powershell
npm install -g @azure/static-web-apps-cli
az staticwebapp create --name fmb-vendor-admin `
  --location uaecentral `
  --sku Free
swa deploy ./dist --deployment-token $(az staticwebapp secrets list --name fmb-vendor-admin --query "properties.apiKey" -o tsv)
```

Or wire your GitHub repo to it via the portal — push to `main` auto-deploys.

---

## Phase 7 — Domain + SSL via Cloudflare

After you've bought `findmybay.ae` and added it to Cloudflare (DEPLOYMENT.md
Phase 2):

```
api.findmybay.ae      CNAME  →  <apiUrl>
admin.findmybay.ae    CNAME  →  <swa default hostname>
findmybay.ae          A/CNAME → marketing site (later)
```

In the Container Apps blade → **Custom domains** → add `api.findmybay.ae`,
verify the TXT record, click **Bind**. Container Apps gets an Azure-managed
TLS cert automatically. Same flow for the SWA → custom domain.

Update `CORS_ORIGINS` once domains are live:

```powershell
az containerapp update --name fmb-backend `
  --set-env-vars CORS_ORIGINS="https://findmybay.ae,https://admin.findmybay.ae"
```

And update the Android `local.properties` for your release build:
```
API_BASE_URL=https://api.findmybay.ae/
```

---

## Phase 8 — Final sanity check

```powershell
# Backend healthy
curl https://api.findmybay.ae/health

# DB reachable + migrations applied (the count tells you it's a real DB)
az containerapp logs show --name fmb-backend --tail 100 |
  Select-String "alert worker started"

# Vendor admin loads
curl -I https://admin.findmybay.ae

# Customer Android app: build a release APK pointing at api.findmybay.ae,
# sign in with Google, book a slot.
```

When all four pass, you're live.

---

## Future: secrets in Key Vault, not env vars

For pilot it's fine to leave secrets inline in Container Apps. Before you
take real customer cards, move them to Key Vault:

```powershell
az keyvault create --name fmb-prod-kv --location $env:AZURE_REGION
az keyvault secret set --vault-name fmb-prod-kv --name DATABASE-URL --value "$DATABASE_URL"
# … repeat for each secret …
# Then bind via managed identity instead of registry creds + secretrefs.
```

That's a 1-hour follow-up. Not blocking pilot.

---

## Cost monitoring

Set a budget alert before you forget:

```powershell
az consumption budget create `
  --budget-name fmb-monthly `
  --amount 200 `
  --category cost `
  --time-grain Monthly `
  --start-date 2026-05-01 `
  --end-date 2027-05-01
```

---

## What's still on my side vs yours

**Done by me in code** — Dockerfile, .dockerignore, prod env template,
secret generator, this runbook.

**Yours, in Azure CLI**:
- Phase 1.1–1.4 (15 min)
- Phase 2 (20 min, plus Postgres provisioning wait)
- Phase 3 (10 min)
- Phase 4 (5 min)
- Phase 5 (15 min)
- Phase 6 (10 min)
- Phase 7 (after domain — 15 min)

If anything errors out, paste it back and I'll diagnose. Most common gotcha:
forgetting to enable PostGIS on the Postgres parameter group → the
`/vendors/nearby` query 500s.
