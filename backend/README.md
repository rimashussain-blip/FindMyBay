# Find My Bay — Backend

UAE car wash aggregator API. Node.js 20 + Express + PostgreSQL 16 + PostGIS, written in TypeScript.

This is the server the **Android app** in `../android/` and the **vendor web admin** (next milestone) talk to. See `../Find_My_Bay_Architecture.docx` for the full system view.

## What's in this slice

- `POST /auth/otp/request` — issue a 6-digit OTP for a UAE phone number
- `POST /auth/otp/verify` — verify code, create user, return JWT access + refresh tokens
- `GET /vendors/nearby` — geospatial search powered by PostGIS, returns vendors with at least one free bay sorted by distance
- Prisma schema + initial migration (with raw-SQL PostGIS extension, geometry column, trigger, GIST index)
- Seed script for 5 sample UAE vendors (Dubai / Sharjah / Abu Dhabi)
- Pino structured logging, Zod validation, CORS, JWT auth middleware

## Project layout

```
backend/
├── package.json
├── tsconfig.json
├── docker-compose.yml          # postgres+postgis + redis (one command)
├── .env.example                # copy → .env, fill in
├── prisma/
│   ├── schema.prisma           # data model
│   ├── migrations/             # init_postgis.sql is hand-edited
│   └── seed.ts                 # sample UAE vendors
└── src/
    ├── index.ts                # Express bootstrap
    ├── config/
    │   ├── env.ts              # Zod-validated env
    │   └── db.ts               # shared Prisma client
    ├── lib/
    │   ├── logger.ts           # Pino + pretty in dev
    │   └── error.ts            # HttpError, asyncHandler, error middleware
    ├── auth/
    │   ├── jwt.ts              # access + refresh token helpers
    │   ├── service.ts          # OTP request + verify business logic
    │   ├── middleware.ts       # requireAuth — validates Bearer token
    │   └── router.ts           # /auth/otp/request, /auth/otp/verify
    └── vendor/
        ├── service.ts          # findNearby — raw PostGIS query
        └── router.ts           # /vendors/nearby
```

## Prerequisites

- Node.js 20 or newer (`node --version`)
- Docker Desktop (running)
- npm (comes with Node)

That's it. Postgres + PostGIS + Redis all run in containers.

## Setup

### 1. Install deps

```bash
cd backend
npm install
```

This will also generate the Prisma client after install (`postinstall` hook isn't wired — run it explicitly the first time):

```bash
npx prisma generate
```

### 2. Boot the database

```bash
npm run db:up
```

This starts `postgis/postgis:16-3.4-alpine` on port 5432 and `redis:7-alpine` on 6379.

> First run downloads ~250 MB of images. Watch with `docker compose ps` — both should be `healthy` before you continue.

### 3. Configure env

```bash
cp .env.example .env
```

The defaults match `docker-compose.yml`, so it should work as-is. **Before any production deploy** you must regenerate the JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Run migration + seed

```bash
npm run db:migrate     # creates tables, enables postgis, builds geometry trigger
npm run db:seed        # loads 5 sample UAE car washes
```

You should see:

```
🌱 Seeding 5 vendors…
  ✓ Polaris Auto Spa (Dubai) — 4 bays, 2 free
  ✓ Marina Shine (Dubai) — 3 bays, 1 free
  ✓ Al Quoz Detailing (Dubai) — 6 bays, 4 free
  ✓ Sharjah Auto Care (Sharjah) — 3 bays, 2 free
  ✓ Yas Premium Wash (Abu Dhabi) — 5 bays, 3 free
✅ Seed complete.
```

### 5. Start the dev server

```bash
npm run dev
```

You should see:

```
🚀 Find My Bay API listening on http://localhost:3000
```

It auto-reloads on file changes (powered by `tsx watch`).

## Smoke-test it

### Health check

```bash
curl http://localhost:3000/health
# → {"ok":true,"ts":"2026-04-26T..."}
```

### OTP request → verify

```bash
curl -X POST http://localhost:3000/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+971501234567"}'
```

Response:
```json
{ "challengeId": "clxx...", "resendInSec": 30 }
```

**Look in your dev server logs** — the OTP code is logged to the console:

```
  ┌──────────────────────────────────────────────┐
  │  📱  OTP for +971501234567   →  482915       │
  │  (Dev mode: not actually sent via SMS.)      │
  └──────────────────────────────────────────────┘
```

Verify it:

```bash
curl -X POST http://localhost:3000/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+971501234567","challengeId":"clxx...","code":"482915"}'
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "...",
  "user": { "id": "...", "phone": "+971501234567", "fullName": null, "role": "customer" }
}
```

### Nearby vendors (Burj Khalifa centre)

```bash
TOKEN="<paste accessToken from above>"
curl "http://localhost:3000/vendors/nearby?lat=25.1972&lng=55.2744&radius=20000" \
  -H "Authorization: Bearer $TOKEN"
```

You should see a JSON list with the seeded vendors, sorted by distance, with `freeBays > 0`.

## Connecting from the Android emulator

The emulator can't reach `localhost` on the host — it needs `10.0.2.2` (the emulator's loopback to your machine).

In `android/gradle.properties`:
```
API_BASE_URL=http://10.0.2.2:3000/
```

You'll also need to allow cleartext for `10.0.2.2` because we're on plain HTTP in dev:

1. Add `android/app/src/main/res/xml/network_security_config.xml`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <network-security-config>
       <domain-config cleartextTrafficPermitted="true">
           <domain includeSubdomains="true">10.0.2.2</domain>
       </domain-config>
   </network-security-config>
   ```
2. Reference it from the manifest: in `<application>`, add
   `android:networkSecurityConfig="@xml/network_security_config"`
3. Rebuild + run.

## Troubleshooting

**`Error: P1001: Can't reach database server at localhost:5432`**
→ Docker isn't running, or `db:up` hasn't finished. Run `docker compose ps` and confirm `fmb-postgres` is `healthy`.

**`Cannot find module '@prisma/client'` after `npm install`**
→ Run `npx prisma generate` once.

**Migration says `extension "postgis" already exists`**
→ Safe; the SQL uses `IF NOT EXISTS`. Continue.

**Seed throws `Foreign key constraint failed`**
→ A previous seed left data in inconsistent state. Run `npm run db:reset` (⚠️ wipes everything) and re-seed.

**`429 Please wait Xs before requesting another code`**
→ Rate-limit working as designed. Wait, or `npm run db:reset` to clear OTPs.

## What's next (not in this slice)

- Vendor detail + slot picker + booking endpoints
- Socket.io live bay-status events
- BullMQ smart-alert worker (Distance Matrix integration)
- Payment intent endpoints (Network International / Telr)
- Admin endpoints (vendor approval, audit log)
- Rate-limiting middleware (per-IP)
- OpenAPI schema export
- Vitest tests + Supertest integration tests
- Dockerfile + production deployment manifests

Tracked against milestones in `../Find_My_Bay_Architecture.docx`, sections 13.1 and 13.2.
