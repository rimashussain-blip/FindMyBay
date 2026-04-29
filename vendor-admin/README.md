# Find My Bay — Vendor Web Admin

React + Vite + TypeScript + Tailwind SPA where car wash owners log in to manage their bays, services, and bookings.

This is the third app in the Find My Bay system, alongside the customer Android app (`../android/`) and the backend API (`../backend/`).

## What's in this slice (MVP)

- **Sign-in via phone OTP** — same `/auth/otp/*` endpoints as the customer app, then a vendor-staff role check.
- **Bay board (live)** — grid of bays with tap-to-cycle status (free → busy → closed → free). Polls every 5 seconds.
- **Bookings pipeline** — today's bookings with customer phone, service, slot, total. Manager can mark in-progress / complete.
- **Services & pricing** — inline-editable list with add/edit/delete. Customer detail page reflects changes immediately.
- **Sidebar navigation** — Bay board, Bookings, Services. Analytics tab is a stub.
- **Find My Bay brand** — same teal/cream/sand palette as the Android app, via Tailwind config.

## Project layout

```
vendor-admin/
├── package.json
├── vite.config.ts          # /api proxy → backend at :3000
├── tsconfig.json
├── tailwind.config.ts      # FMB brand palette
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx             # routes, protected wrapper
    ├── index.css           # Tailwind + brand utility classes
    ├── api/
    │   ├── client.ts       # axios instance with bearer interceptor
    │   ├── auth.ts         # OTP request + verify
    │   └── admin.ts        # /admin/* endpoints
    ├── store/
    │   └── auth.ts         # Zustand session store (persisted)
    ├── components/
    │   └── Layout.tsx      # sidebar + main content shell
    └── pages/
        ├── LoginPage.tsx
        ├── BayBoardPage.tsx
        ├── BookingsPage.tsx
        └── ServicesPage.tsx
```

## Prerequisites

- Node.js 20+
- The Find My Bay backend running on `http://localhost:3000` (see `../backend/README.md`)

## Setup

```powershell
cd "C:\Users\Rimas\OneDrive\Documents\Claude\Projects\Find My Bay\vendor-admin"
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

The Vite dev server proxies `/api/*` to `http://localhost:3000/*`, so no CORS configuration is needed.

## Demo logins (after running `npm run db:seed` in backend)

The seed script creates two vendor staff accounts:

| Phone | Vendor | Role |
|---|---|---|
| `+971500000001` | Polaris Auto Spa | owner |
| `+971500000002` | Marina Shine | owner |

Sign in with either phone → look at the **backend dev terminal** for the OTP code (logged in a bordered box) → enter the 6 digits.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/otp/request` | Send OTP |
| `POST` | `/auth/otp/verify` | Verify and get JWT |
| `GET` | `/admin/me` | Current vendor, bays, services, role |
| `PATCH` | `/admin/bays/:id/status` | Toggle bay free/busy/closed |
| `POST` | `/admin/bays` | Add a new bay |
| `POST` | `/admin/services` | Add a service |
| `PATCH` | `/admin/services/:id` | Edit a service |
| `DELETE` | `/admin/services/:id` | Soft-delete a service |
| `GET` | `/admin/bookings/today` | Today's bookings for this vendor |
| `PATCH` | `/admin/bookings/:id/status` | Mark booking in-progress/completed |

All `/admin/*` routes require both a customer JWT (from OTP verify) and a `vendor_members` row binding the user to a vendor.

## What's still on the roadmap

Tracked against the architecture doc, section 9 (Vendor Web Admin):

- **Brand & Branch** — logo upload, hours, address, trade license
- **Staff** — invite managers/attendants, weekly shifts
- **Analytics** — bookings/day chart, utilization %, no-show rate, avg ticket
- **Billing** — payouts, platform fees, invoices (PDF)
- **Walk-in entry** — record an off-app customer
- **Live updates** — replace 5-second polling with Socket.io for instant cross-device sync
- **Multi-branch** — owners with multiple vendors switch between them
- **Vendor onboarding** — sign-up flow with trade license upload, admin approval

## Build for production

```powershell
npm run build
```

Outputs static files to `dist/`. Host behind any static-file CDN (Cloudflare Pages, Netlify, S3+CloudFront).
