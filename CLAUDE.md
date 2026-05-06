# Find My Bay — Claude Code project guide

A UAE car-wash booking platform. This file orients any future Claude Code
session (Windows OR Mac) on the project state and conventions.

## Sub-projects in this monorepo

| Folder | Tech | Status |
|---|---|---|
| `android/` | Kotlin + Jetpack Compose + Hilt + Retrofit + Maps SDK + FCM | **Production** — signed with `android/keystores/fmb-release.jks`, on Play Store |
| `backend/` | Node 20 + Express + Prisma + PostgreSQL/PostGIS + Socket.io + JWT | **Production** — deployed to Azure Container Apps |
| `vendor-admin/` | React + Vite + Zustand + react-query + react-router + Tailwind | **Production** — deployed to Azure Static Web Apps |
| `website/` | Static HTML/CSS marketing site | **Production** — deployed to Azure Static Web Apps |
| `ios/` | Swift + SwiftUI (planned) | **Not started** — Mac-side work begins here |

## Production URLs and Azure resources

- **Backend API**: `https://fmb-backend.bravegrass-00d218a4.uaenorth.azurecontainerapps.io`
- **Vendor admin SPA**: `fmb-vendor-admin` Static Web App (UAE North)
- **Marketing site**: `fmb-marketing` Static Web App (UAE North)
- **Postgres**: `fmb-prod-pg` Flexible Server (UAE North)
- **Container Registry**: `fmbprodbfyqwc.azurecr.io/fmb-backend`
- **Resource Group**: `fmb-prod-rg`

⚠️ **ACR Tasks (`az acr build`) is blocked on this subscription.** Always
use local `docker build` + `docker push` after `az acr login`. See
`backend/scripts/deploy-azure.ps1`.

## Identity / external services

- **Firebase project**: `findmybay-99459`
  - Android client registered for `ae.findmybay` (release) + `ae.findmybay.debug`
  - **iOS client needs to be added** for the new iOS app — bundle id `ae.findmybay`
- **Google OAuth web client id** (validated by `/auth/google`):
  `343658146175-4lup27uphshfmlmetnomi20i6pm1rol9.apps.googleusercontent.com`
- **Maps API key for Android** (Firebase auto-created, whitelisted with
  release SHA1): `AIzaSyDhzIzDD9AfxhIfVWskCjNSo1Qv59yPvOU`
- **Release keystore SHA-1**:
  `6E:F8:B4:1C:45:A9:30:76:44:F0:C0:09:E2:FD:E0:9E:85:23:55:DE`

## Brand palette (single source of truth)

| Token | Hex |
|---|---|
| `primary` | `#14B8A6` |
| `primaryDeep` | `#0F766E` |
| `cream` (background) | `#FFF7EC` |
| `mint` (cards/edges) | `#DBF5F0` |
| `mintEdge` | `#C8EBE4` |
| `coral` (accent/error) | `#FF8B6B` |
| `ink` (primary text) | `#0B3B36` |
| `inkSoft` (secondary text) | `#5C7C77` |
| `white` | `#FFFFFF` |

The Android app, vendor admin Tailwind config, and marketing site CSS
variables all use these. The new iOS app should mirror them in a
`Color+Brand.swift` extension.

## Backend API contract (the iOS app will consume this)

Auth (all return `{accessToken, refreshToken, user}`):
- `POST /auth/google` — body `{idToken}` → exchanges Google ID token for app tokens
- `POST /auth/refresh` — body `{refreshToken}` → new access token
- `POST /auth/logout`

Profile:
- `GET /auth/me`
- `PATCH /auth/me/profile` — body `{phone, carMake, carColor, carType, carPlate}`

Browse + book:
- `GET /vendors/nearby?lat=&lng=` — vendor list with logo, services, freeBays, priceFromAed
- `GET /vendors/:id` — vendor detail + services + opening hours
- `GET /vendors/:id/availability?date=YYYY-MM-DD&serviceId=` — slot picker data
- `POST /bookings` — body `{vendorId, serviceId, slotStart}` → creates pending booking
- `POST /bookings/:id/pay` — returns payment URL (open in `SFSafariViewController` on iOS)
- `GET /bookings/me` — list of customer's bookings
- `POST /bookings/:id/cancel`
- `POST /bookings/:id/leave-now`

Realtime:
- Socket.io at the backend URL, room `customer:{userId}`, event `booking:status`

Push deep link:
- Payment return URL: `findmybay://payment/return?bookingId=...`

## iOS app goals (the Mac work)

**Aim**: feature parity with the Kotlin Android app at `android/`. The
backend is ready and unchanged — the iOS app is a pure client.

Suggested screen order (mirrors Android):
1. **SplashScreen** — logo + spinner while restoring auth from Keychain
2. **LoginScreen** — single "Continue with Google" button via `GoogleSignIn-iOS`
3. **OnboardingScreen** — phone + plate + car details form, calls `PATCH /auth/me/profile`
4. **NearbyMapScreen** — `MapKit` (or Google Maps SDK for iOS) with vendor markers
5. **VendorDetailScreen** + **SlotPickerScreen**
6. **ReviewPayScreen** — opens `SFSafariViewController` for payment, listens for `findmybay://payment/return`
7. **BookingConfirmedScreen** — QR code via `CIFilter.qrCodeGenerator()`
8. **MyBookingsScreen** — list of `/bookings/me`
9. **ProfileScreen** — view + edit
10. **Smart-alert FCM receiver** — `UNUserNotificationCenter` + Firebase Messaging iOS SDK → navigate to LeaveNowScreen

Native equivalents to Android packages:

| Android (Kotlin) | iOS (Swift) |
|---|---|
| Hilt (DI) | Manual DI or `@EnvironmentObject` / Factory |
| Retrofit + OkHttp | `URLSession` + a thin `APIClient` actor |
| `EncryptedSharedPreferences` | Keychain via `Security` framework |
| Maps Android SDK | MapKit (preferred) or Google Maps SDK for iOS |
| FCM (`com.google.firebase:firebase-messaging`) | Firebase iOS SDK + APNs |
| WorkManager (smart-alert safety net) | `BGTaskScheduler` |
| Custom Tabs (payment WebView) | `SFSafariViewController` |

## Cross-platform invariants

- **Phone uniqueness is scoped to customers only** — the partial unique
  index `users_customer_phone_key ON users(phone) WHERE role = 'customer'`
  enforces this. Vendors can share phone numbers with each other or with
  customers without conflict.
- **`/auth/me/profile` orphan-absorb**: if a customer signs in with Google
  and the phone they enter belongs to an "orphan" customer record (created
  via OTP, no Google sub, no bookings, no vendor membership), the orphan
  is absorbed into the new account. Real conflicts return 409 with
  `code: 'phone_taken'`.
- **Walk-in bookings** have nullable `customerId`. The iOS app filters
  these out of "My Bookings" — they're vendor-side only.
- **Payment flow**: `POST /bookings/:id/pay` → opens external browser →
  user pays → browser redirects to `findmybay://payment/return` → app
  resumes and refetches the booking.

## Conventions

- **Branch naming**: `feat/...`, `fix/...`, `chore/...`
- **PRs**: keep them tight; CI runs lint + type check + tests
- **Backend deploy**: `backend/scripts/deploy-azure.ps1` (Windows) — bumps
  image tag, builds locally, pushes to ACR, updates Container App
- **Vendor admin deploy**: `vendor-admin/scripts/deploy-azure.ps1`
- **Marketing deploy**: `website/scripts/deploy-azure.ps1`
- **Android signing**: `android/keystores/fmb-release.jks`, alias
  `fmb-upload`. Already whitelisted on Maps API key + Firebase. Do **not**
  regenerate this — the Play Store accepts upgrades only with this cert.

## Mac iOS-specific setup (first session on Mac mini)

When a Claude Code session starts on the Mac, it should:

1. **Confirm the working directory** is outside `~/Library/Mobile Documents`
   (iCloud Drive). Recommended: `~/Dev/find-my-bay/`. iCloud sync breaks
   Xcode builds the same way OneDrive broke RN builds on Windows.
2. **Verify Xcode + Command Line Tools + CocoaPods** are installed.
3. **Add the iOS app to Firebase Console** for bundle id `ae.findmybay`,
   download `GoogleService-Info.plist` into the new `ios/` Xcode project.
4. **Get an iOS Maps API key** (or use MapKit and skip this) and an iOS
   OAuth client id from GCP Console.
5. **Match the Android app's brand palette** from `android/app/src/main/`
   `java/ae/findmybay/ui/theme/Color.kt` in a `Color+Brand.swift`.
6. **Reuse the existing backend** — no backend changes are needed for iOS.

## Things NOT to do

- Don't mock the Postgres database in tests — integration tests must hit
  a real DB. (Past incident where mocked tests passed but a prod
  migration failed.)
- Don't store the dead Maps key `AIzaSyCikUz4...` anywhere — fully rotated.
- Don't commit the Firebase config files (`google-services.json`,
  `GoogleService-Info.plist`) — they're gitignored.
- Don't build inside iCloud Drive or OneDrive.
- Don't use ACR Tasks — local docker build + push only.
