# Find My Bay — Pre-prod Deployment Runbook

This is the path from "works on my machine" to a UAE-hosted, signed-up,
PDPL-compliant pilot. Everything here is **user-driven** — sign-ups,
domain purchases, merchant verifications. Do them in order; later steps
depend on earlier ones.

---

## Phase 1 — Provider sign-ups (run in parallel)

These each take 1–2 business days for verification, so kick them off first.

### 1.1 Telr (sandbox first, live later)

1. Sign up at https://telr.com → Merchant Account → UAE.
2. Once approved, you'll get a **Store ID** + **Auth Key**.
3. In `.env.production`:
   ```
   PAYMENT_PROVIDER=telr
   TELR_STORE_ID=<store id>
   TELR_AUTH_KEY=<auth key>
   TELR_TEST_MODE=true   # flip to false once you've done a real card test
   ```
4. Run a real card test against sandbox → verify the booking flips to
   `confirmed` end-to-end.

### 1.2 Unifonic SMS

1. Sign up at https://www.unifonic.com.
2. Submit a **Sender ID request** for `FINDMYBAY` (TDRA-mandated;
   takes 1–2 days for approval).
3. Once approved, copy the **App SID**.
4. Implement Unifonic delivery in `backend/src/auth/service.ts` —
   the TODO is at the `case 'unifonic':` branch. Use their REST API:
   `POST https://api.unifonic.com/v1/Account/<APP_SID>/SMS/messages`.

### 1.3 Firebase (FCM + Google Sign-In)

1. Create a Firebase project at https://console.firebase.google.com.
2. Add an Android app, download `google-services.json` →
   `android/app/google-services.json` (already gitignored).
3. **Project Settings → Service accounts → Generate new private key** →
   download to `backend/secrets/firebase-service-account.json` (already
   gitignored).
4. **Add the Android signing SHA-1 fingerprint** to the Firebase Android
   app — required for Google Sign-In to work. Run from the `android` dir:
   ```powershell
   keytool -list -v -keystore $env:USERPROFILE\.android\debug.keystore `
     -alias androiddebugkey -storepass android -keypass android
   ```
   Copy the **SHA1** line. In Firebase console → Project Settings →
   Your Android app → **Add fingerprint** → paste. Re-download
   `google-services.json` after.
5. In Google Cloud Console → APIs & Services → Credentials, find the
   **Web client (auto created by Google Service)** entry. Copy its
   client ID — it's the value for both `GOOGLE_OAUTH_CLIENT_ID` env
   on the backend and `GOOGLE_OAUTH_CLIENT_ID` in
   `android/local.properties`.
6. In backend `.env.production`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-service-account.json
   GOOGLE_OAUTH_CLIENT_ID=<the Web client ID from step 5>
   ```
7. In `android/local.properties`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=<same value>
   ```

Without steps 4–7 the Google Sign-In button stays hidden in the app —
nothing breaks, but customers can only use phone OTP.

### 1.4 Google Maps Platform

1. https://console.cloud.google.com → APIs & Services → Library
2. Enable: **Maps SDK for Android**, **Places API**, **Distance Matrix API**.
3. APIs & Services → Credentials → **Create credentials → API key**.
4. **Restrict the key**:
   - Application restriction: **HTTP referrers** = `https://api.findmybay.ae/*`
     for the backend key, **Android apps** for the mobile key (use
     SHA-1 fingerprint from `keytool -list -v -keystore release.keystore`).
   - API restriction: only the three APIs above.
5. Set up **billing alerts** at AED 500 / 1,000 / 2,000.

---

## Phase 2 — Domain & DNS

### 2.1 Buy `findmybay.ae`

- Recommended registrar: **AEserver** (UAE-based, accepts .ae directly)
  or **Namecheap** with .ae from a reseller.
- Protect WHOIS privacy if available.

### 2.2 DNS via Cloudflare

1. Add `findmybay.ae` to Cloudflare → free plan is fine.
2. Update nameservers at the registrar.
3. Wait for propagation (~hours).
4. Records you'll need:
   - `api.findmybay.ae` → CNAME to your backend host (filled in Phase 4)
   - `findmybay.ae` → A/CNAME to your marketing site (later)
   - `admin.findmybay.ae` → CNAME to vendor-admin host
5. SSL: Cloudflare's "Full (strict)" mode + their universal cert handles
   HTTPS at the edge; origin TLS comes from your hosting provider.

---

## Phase 3 — Hosting

Pick **one** of A or B. AWS is the spec's preference for UAE residency.

### Option A — AWS me-central-1 (Bahrain)

- **Backend**: ECS Fargate behind an Application Load Balancer.
  - Push container to ECR (use the Dockerfile in `backend/` — note: not
    yet written, build with `docker init` or copy the standard Node 20
    Alpine pattern).
  - Task def: 0.5 vCPU / 1 GB to start; scale on CPU.
  - Mount Firebase service account from Secrets Manager → `/secrets`.
- **Postgres**: RDS PostgreSQL 16 (single-AZ for pilot; multi-AZ for GA).
  - Enable PostGIS extension after creation.
  - Daily snapshots, 7-day retention, PITR on.
- **Redis**: ElastiCache for Redis 7, single-node.
- **Vendor admin**: build with `npm run build`, upload `dist/` to S3,
  serve via CloudFront. Cloudflare in front handles edge caching.
- **Secrets**: AWS Secrets Manager. Pull at task start via `aws secretsmanager
  get-secret-value` → write to `/secrets/.env` → app reads on boot.

### Option B — DigitalOcean FRA1 (Frankfurt — closest UAE-ish)

Faster to set up, ~$50/mo for the pilot:

- **App Platform** for the backend (auto-build from GitHub).
- **Managed Postgres** ($15/mo basic).
- **Managed Redis** ($15/mo basic).
- **App Platform Static Site** for vendor-admin (free).
- Env vars + secrets entered in the App Platform UI.

### 3.1 Deploy steps (either option)

1. Generate prod secrets: `cd backend && npx tsx scripts/gen-prod-secrets.ts`
2. Fill in `.env.production` from `.env.production.example` using those
   values + the provider creds from Phase 1.
3. Push the values into your secret manager (Secrets Manager / DO env panel).
4. Deploy backend → wait for `/health` to return `200`.
5. Run `npx prisma migrate deploy` against the prod DB (one-shot).
6. Run `npx tsx prisma/scripts/create-admin.ts <your-email> <strong-password>`
   to provision the platform admin.

### 3.2 DNS final step

Point `api.findmybay.ae` (CNAME) at the backend host. Wait for the cert
to issue, then verify:

```
curl https://api.findmybay.ae/health
# → {"ok":true,"ts":"..."}
```

---

## Phase 4 — Mobile app config

In `android/local.properties` (or CI build env):

```
API_BASE_URL=https://api.findmybay.ae/
MAPS_API_KEY=<the Android-restricted key from 1.4>
```

Build the release APK:

```
cd android
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"
./gradlew :app:assembleRelease
```

(You'll need a release keystore — `keytool -genkey -v -keystore
android/app/release.keystore -keyalg RSA -keysize 2048 -validity 10000
-alias fmb`. Add the matching `keyAlias`/`keyPassword`/`storePassword`
to `android/key.properties` — gitignored.)

Smoke-test the release build against the live API. When it passes, upload
the `.aab` to Play Console for closed testing track.

---

## Phase 5 — Final checks before opening to pilot vendors

- [ ] Strong JWT secrets generated and rotated into prod
- [ ] `.env.production` not in git (already gitignored, but double-check)
- [ ] HTTPS working: `curl -v https://api.findmybay.ae/health`
- [ ] Postgres backups visible in console (AWS RDS / DO snapshots)
- [ ] Sentry receiving events (throw a test error after deploy)
- [ ] At least one platform admin account created
- [ ] PDPL endpoints reachable: `curl -H "Authorization: Bearer <token>"
      https://api.findmybay.ae/auth/me/export`
- [ ] Telr live mode tested with a real card (refund the AED 1 test charge)
- [ ] Unifonic OTP delivers to a real UAE number
- [ ] FCM push lands on the production-built app
- [ ] Customer cancellation flow works
- [ ] Vendor "approve / suspend" flow works in /platform/vendors
- [ ] Map shows real vendors after creating the pilot 3–5

When all those tick, you can hand the URL to the first pilot car wash.

---

## What's still on the punch list (post-launch ok)

These don't block onboarding the first pilot vendor but should be
tackled within the first month:

- Audit log for admin actions (spec §11)
- Refresh token rotation
- Rate limiting on `/auth/otp/request` (spec mandates 5/hr per phone & IP)
- BullMQ to replace the `setInterval` alert worker (multi-instance safe)
- Smoke tests covering: OTP login, booking → pay → confirm, vendor approval
- Arabic / RTL strings on the customer app
- Logo file upload (currently URL string)
- WhatsApp alerts as second push channel
- iOS app
