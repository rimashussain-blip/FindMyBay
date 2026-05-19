# Find My Bay — iOS

SwiftUI port of the Android app. Targets iOS 17+, uses URLSession + async/await,
no third-party DI. Designed to be source-compatible with the Android module
(domain models, DTOs, API protocols, design tokens all match 1:1).

## First-time setup

1. **Xcode 26+** must be installed.
2. Install `xcodegen`: `brew install xcodegen`.
3. From this folder run `xcodegen` — generates `FindMyBay.xcodeproj`.
4. Open the project: `open FindMyBay.xcodeproj`.
5. Run on the iPhone 17 Simulator.

## Regenerating the project

`FindMyBay.xcodeproj` is **not** committed — it's regenerated from `project.yml`.
After pulling new changes that add files or change settings:

```bash
cd ios
xcodegen
```

## Folder layout

- `FindMyBay/App` — entrypoint, root view, AppEnvironment (DI container)
- `FindMyBay/Core/Theme` — design tokens (`Color.kt`/`Type.kt` parity)
- `FindMyBay/Core/Network` — URLSession-based JSON client + error types
- `FindMyBay/Core/Storage` — Keychain-backed `TokenStore`
- `FindMyBay/Core/Realtime` — Socket.IO client (added in next pass)
- `FindMyBay/Core/Location` — CoreLocation reporter (added in next pass)
- `FindMyBay/Core/Payment` — payment-return URL bus
- `FindMyBay/Core/Navigation` — routing
- `FindMyBay/Data/DTO` — Codable types matching the backend wire format
- `FindMyBay/Data/API` — protocol-per-resource HTTP layer (parity with Retrofit interfaces)
- `FindMyBay/Data/Repo` — repositories (added with each feature)
- `FindMyBay/Domain` — pure domain models
- `FindMyBay/Features/<feature>` — one folder per screen feature

## Configuration

- API base URL is hardcoded in `Core/Network/AppConfig.swift` — same value
  the Android module reads from `BuildConfig.API_BASE_URL`.
- Google Maps iOS API key reads from `GOOGLE_MAPS_API_KEY` in Info.plist.
  Wire it up via a non-committed `Secrets.xcconfig` once the key is restricted
  to the iOS bundle ID.

## What's NOT done yet

- Third-party SPM packages (GoogleMaps, Firebase, Socket.IO, Kingfisher,
  KeychainAccess) — `project.yml` has them commented out. Add incrementally.
- `Features/*` views — currently a single placeholder root view that proves
  the build succeeds. Real screens are ported next, in roughly this order:
  Auth → Home/Map → VendorDetail → SlotPicker → ReviewPay → BookingConfirmed
  → MyBookings/QR/Rate → Profile → LeaveNow → realtime → push.
