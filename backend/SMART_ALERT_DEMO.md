# Smart-Alert Engine — Demo Guide

This document covers how the smart-alert pipeline works end-to-end and how to demonstrate it without waiting an hour for a real probe to fire.

## What got built

Three new pieces wired into the existing system:

1. **Distance Matrix client** (`src/lib/maps.ts`)
   - `mock` provider: deterministic Haversine distance + UAE peak/off-peak speed model. Zero external deps.
   - `google` provider: real Google Distance Matrix with `departure_time=now` and `traffic_model=best_guess`. Activates when `GOOGLE_MAPS_API_KEY` is set.

2. **Push client** (`src/lib/push.ts`)
   - `console` provider: logs push payloads to dev console with a bordered box. Default.
   - `fcm` provider: real Firebase Cloud Messaging via `firebase-admin`. Activates when `FIREBASE_SERVICE_ACCOUNT_PATH` points at a valid service account JSON.

3. **Alert scheduler/worker** (`src/alert/service.ts`)
   - On booking creation, inserts an `alerts` row scheduled at `slot_start − 90 min`.
   - A `setInterval` worker (30 s tick) processes due alerts.
   - For each due alert, queries Distance Matrix → `leave_by = slot_start − travel − 5min buffer`.
   - If `leave_by ≤ now`: fires the push and marks alert `fired`.
   - Otherwise: pushes `due_at` forward with shrinking cadence (30 → 15 → 5 → 1 min as we approach `slot_start`).

The full algorithm matches `Find_My_Bay_Architecture.docx` section 10.

## Demo without waiting

The fastest way to see the alert flow is the test endpoint:

```powershell
# 1. Authenticate (re-do OTP if your $session expired)
$req = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/otp/request `
  -ContentType 'application/json' -Body '{"phone":"+971501234567"}'
# Look at server logs for OTP, then:
$verifyBody = @{ phone='+971501234567'; challengeId=$req.challengeId; code='XXXXXX' } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/otp/verify `
  -ContentType 'application/json' -Body $verifyBody
$headers = @{ Authorization = "Bearer $($session.accessToken)" }

# 2. Look up your most recent booking id
$mine = Invoke-RestMethod 'http://localhost:3000/bookings/me' -Headers $headers
$bookingId = $mine.items[0].id
"Most recent booking: $bookingId"

# 3. Force the alert to fire NOW
$fireBody = @{ bookingId = $bookingId } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/alerts/test-fire-now `
  -ContentType 'application/json' -Headers $headers -Body $fireBody
```

Watch your **server logs**. With the default `console` push provider you'll see:

```
┌─────────────────────────────────────────────────┐
│  📲  PUSH (console mode — no real FCM)          │
│  Title: Time to leave for your wash             │
│  Body:  Polaris Auto Spa · 12 min away · slot...│
│  Tokens: 0                                      │
└─────────────────────────────────────────────────┘
```

`Tokens: 0` is expected if the Android app hasn't registered a device token yet. Once the Android app calls `POST /devices/register` (it does this automatically after sign-in if the FCM SDK is wired), this will be `1+` and a real push goes out.

## Wiring real FCM (optional — for actual notifications on the phone)

The console provider is fine for proving the pipeline works. To get a real banner notification on the emulator:

### 1. Generate a service account key

1. Open https://console.firebase.google.com → your `find-my-bay` project.
2. **Project Settings** (gear icon) → **Service accounts** tab.
3. Click **Generate new private key** → confirm. A JSON file downloads.
4. Move it somewhere private on your laptop, e.g. `C:\Users\Rimas\.findmybay\firebase-admin.json`. **Never commit it.**

### 2. Install firebase-admin

```powershell
cd "C:\Users\Rimas\OneDrive\Documents\Claude\Projects\Find My Bay\backend"
npm install firebase-admin
```

### 3. Set the env var

In `.env`:
```
FIREBASE_SERVICE_ACCOUNT_PATH=C:\Users\Rimas\.findmybay\firebase-admin.json
```

Restart `npm run dev`. On boot you'll see:
```
INFO: Push client initialised (FCM)  path: "C:\\Users\\Rimas\\..."
```

### 4. Wire real Distance Matrix (optional — same flag as Maps SDK)

In `.env`:
```
GOOGLE_MAPS_API_KEY=AIzaSy...your-key...
```

This is **the same key** you already used for the Android Maps SDK. You enabled "Distance Matrix API" earlier in Google Cloud Console — that authorises it. Restart `npm run dev` and you'll see:
```
INFO: Maps client initialised  provider: "google"
```

Now the alert engine uses real UAE traffic data instead of the mock.

## What to expect on the Android side

After sign-in:
- The app calls `POST /devices/register` with its FCM token.
- Subsequent bookings auto-schedule alerts on the backend.
- When the alert fires (by clock or by test endpoint), FCM delivers a high-priority push.
- The Android `FmbFcmService` shows a system notification with `setFullScreenIntent`.
- Tap the notification → MainActivity opens and navigates straight to `LeaveNowScreen` — a high-contrast full-screen "Leave now" UI showing the brand, ETA, and slot time.

## Tuning the algorithm

All in `src/alert/service.ts`:

```typescript
const BUFFER_SECONDS = 5 * 60;       // arrive 5 min early
const TICK_INTERVAL_MS = 30 * 1000;  // worker poll cadence
const SCHEDULE_AHEAD_MS = 90 * 60 * 1000;  // first probe at S - 90min
```

For UAE peak-hours, the mock provider uses 18 km/h (Sheikh Zayed Rd at 17:30 reality) vs 50 km/h off-peak. Tweak in `src/lib/maps.ts` if needed.
