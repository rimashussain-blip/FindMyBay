# Find My Bay — Android App

UAE car wash aggregator: find the nearest free bay, book it, and get a smart departure alert that accounts for live UAE traffic.

This module is the **customer-facing Android app** (Kotlin + Jetpack Compose). It is one of three components in the Find My Bay system; see `../Find_My_Bay_Architecture.docx` for the full picture.

## What's in this skeleton

- **Phone OTP sign-in** (`feature/auth`) — request + verify against the backend.
- **Nearby Map** (`feature/home`) — Google Maps with pins for nearby vendors and a horizontal card carousel showing free bays and price.
- **Network layer** (`data/api`, `core/di`) — Retrofit + kotlinx-serialization with a `Bearer` token interceptor backed by `DataStore`.
- **Theming** (`core/theme`) — Material 3, light + dark, deep-blue brand palette.
- **Hilt DI** wired end-to-end.
- **Permissions** — Accompanist permissions for runtime location.
- **Firebase Messaging** dependency wired (push to be implemented next).

## Project layout

```
android/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle/
│   └── libs.versions.toml          # version catalog (single source of truth)
├── gradle.properties               # MAPS_API_KEY + API_BASE_URL
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/ae/findmybay/
        │   ├── FindMyBayApp.kt     # @HiltAndroidApp
        │   ├── MainActivity.kt
        │   ├── core/
        │   │   ├── di/             # NetworkModule (Retrofit, OkHttp, JSON)
        │   │   ├── nav/            # AppNav (Navigation Compose graph)
        │   │   ├── storage/        # TokenStore (DataStore)
        │   │   └── theme/          # Color, Type, Theme
        │   ├── data/
        │   │   ├── api/            # AuthApi, VendorApi + DTOs
        │   │   └── repo/           # AuthRepository, VendorRepository
        │   ├── domain/model/       # Vendor, AuthSession (pure Kotlin)
        │   └── feature/
        │       ├── auth/           # PhoneOtpScreen, OtpVerifyScreen, AuthViewModel
        │       └── home/           # NearbyMapScreen, NearbyViewModel
        └── res/
            ├── values/             # strings, colors, themes
            └── xml/                # backup + data extraction rules
```

## Getting started

### 1. Prerequisites
- Android Studio Ladybug (2024.2.x) or newer
- JDK 17
- An Android device or emulator on API 28+

### 2. Drop in your secrets

Open `gradle.properties` and replace the placeholders, **or** preferably put them in `~/.gradle/gradle.properties` so they are not committed:

```
MAPS_API_KEY=AIzaSy...your-key...
API_BASE_URL=https://api.findmybay.ae/
```

For pointing at a local backend running on your laptop, use the Android emulator's loopback host:

```
API_BASE_URL=http://10.0.2.2:3000/
```

> Note: the manifest disables `usesCleartextTraffic`. For HTTP localhost dev, add a network-security config that allow-lists `10.0.2.2`.

### 3. Add Firebase

1. Create a Firebase project, register the app with package name `ae.findmybay` (and `ae.findmybay.debug` for the debug variant).
2. Download `google-services.json` and drop it into `app/`.
3. Uncomment the `gms.google.services` plugin line in `app/build.gradle.kts`.

### 4. Run

```
./gradlew :app:assembleDebug
```

…or just press Run in Android Studio.

## Backend contract assumed by this app

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/otp/request` | `{phone}` → `{challengeId, resendInSec}` |
| `POST` | `/auth/otp/verify` | `{phone, challengeId, code}` → `{accessToken, refreshToken, user}` |
| `GET`  | `/vendors/nearby?lat=..&lng=..&radius=15000` | List of vendors with free bays sorted by distance |

These match the API design in section 7 of the architecture document.

## What's NOT in the skeleton yet (roadmap)

- VendorDetailScreen + slot picker + booking flow
- Smart-alert FCM service + foreground location service for live ETA
- Payment sheet integration (Network International / Telr / Google Pay)
- Arabic localization + RTL screenshots
- Unit tests for ViewModels and instrumented tests for navigation

These are tracked against the MVP milestone in `Find_My_Bay_Architecture.docx`, section 13.1.

## License
Proprietary — Find My Bay project. All rights reserved.
