# Find My Bay — Maps & Firebase Setup Guide

This walks you through the two external accounts the Android app needs before it can run. Allow ~30 minutes total. Both have free tiers more than generous enough for development.

---

## Part 1 — Google Maps API key (~15 min)

The app uses Google Maps SDK for Android (the map you see), and later will use Distance Matrix (for the smart-alert ETA calculation). Both live under the same "Google Maps Platform" umbrella.

### Step 1.1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Sign in with the Google account that will own the billing.
3. At the top of the page, click the project dropdown (it might say "Select a project") → **New Project**.
4. Name it `find-my-bay` (or anything). Leave Organization as default.
5. Click **Create**, then wait ~10 seconds and select the project from the dropdown.

### Step 1.2 — Enable billing

Google Maps requires a billing account, but the **free tier gives you $200/month of usage** which is far more than you'll consume in development. You will not be charged unless you exceed it.

1. Left sidebar → **Billing**
2. **Link a billing account** → either reuse an existing one or create a new one.
3. Add a card. Google will not auto-charge unless you exceed $200/month.

### Step 1.3 — Enable the Maps APIs

1. Left sidebar → **APIs & Services → Library**
2. Search for and **Enable** each of these:
   - **Maps SDK for Android** (required now)
   - **Distance Matrix API** (required for smart-alert later)
   - **Places API** (optional now, used for vendor address autocomplete in the admin)

### Step 1.4 — Create the API key

1. Left sidebar → **APIs & Services → Credentials**
2. Click **+ Create Credentials → API key**
3. Copy the key that pops up. It looks like `AIzaSy...` (39 characters).

### Step 1.5 — Restrict the key (important for security)

If you skip this, someone who finds your key can run up your bill. Always restrict.

1. On the same Credentials page, click your new key to edit it.
2. **Application restrictions** → choose **Android apps**.
3. Click **Add an item**:
   - **Package name**: `ae.findmybay.debug` (debug build) — and add another for `ae.findmybay` (release build)
   - **SHA-1 certificate fingerprint**: Run this in a terminal (Windows PowerShell):
     ```powershell
     keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android | Select-String SHA1
     ```
     On Mac/Linux:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
     ```
     Copy the SHA1 line (looks like `SHA1: 12:34:56:...`). Paste it.
4. **API restrictions** → **Restrict key** → tick the three APIs you enabled above.
5. **Save**.

### Step 1.6 — Drop the key into the project

Open `android/gradle.properties` and replace:
```
MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
```
with your real key:
```
MAPS_API_KEY=AIzaSyYourActualKeyHere
```

> **Better practice**: don't commit this. Put it instead in `~/.gradle/gradle.properties` (Mac/Linux) or `%USERPROFILE%\.gradle\gradle.properties` (Windows). Gradle merges that file into your build automatically.

---

## Part 2 — Firebase project (~15 min)

Firebase is what we use for **push notifications** (the "leave now" alert). It's a free Google service.

### Step 2.1 — Create a Firebase project

1. Go to https://console.firebase.google.com
2. **Add project** → name it `find-my-bay` → Continue.
3. **Disable Google Analytics** for now (you can enable later) → Create Project.
4. Wait for it to provision, then click **Continue**.

> Tip: if you already have the Google Cloud project from Part 1, Firebase will offer to reuse it instead of creating a new one. Either is fine — they're linked under the hood.

### Step 2.2 — Register the Android app

1. On the Firebase project home, click the **Android icon** (`</>` next to "Get started by adding Firebase to your app").
2. **Android package name**: `ae.findmybay.debug`
   *(start with the debug variant so you can test locally; you'll register `ae.findmybay` separately for the release build later)*
3. **App nickname**: `Find My Bay (debug)` — optional.
4. **Debug signing certificate SHA-1**: paste the same SHA-1 you copied in Step 1.5. (Optional but needed for some Firebase services.)
5. Click **Register app**.

### Step 2.3 — Download `google-services.json`

1. The next screen will offer a **Download google-services.json** button. Download it.
2. Move the file to `Find My Bay/android/app/google-services.json` (the `app/` directory, not the project root).
3. Skip the SDK steps — they're already wired in our `build.gradle.kts`.

### Step 2.4 — Enable Firebase Cloud Messaging

1. In the Firebase console left sidebar → **Build → Cloud Messaging** (sometimes under "Engage").
2. It should already be enabled. If it asks for an API setup, accept the defaults.

### Step 2.5 — Wire up the plugin in the app

Open `android/app/build.gradle.kts` and **uncomment** this line near the top of the `plugins { }` block:

```kotlin
// Uncomment after dropping a real google-services.json into app/
// alias(libs.plugins.gms.google.services)
```

becomes:

```kotlin
// Uncomment after dropping a real google-services.json into app/
alias(libs.plugins.gms.google.services)
```

---

## Part 3 — Verify everything

In Android Studio:

1. **File → Sync Project with Gradle Files** (or click the elephant icon in the toolbar). It should finish without errors.
2. **Build → Make Project**. If your keys are wrong, you'll get a clear error here rather than a runtime crash.
3. Boot your emulator or plug in your phone, then click the green **Run** button.
4. The app should launch on the OTP screen.

> The OTP and Nearby Map will fail to load real data (because there's no backend yet — that's the next milestone), but the UI will render and the map will show your current location with the proper Google logo and tile rendering, which proves your Maps key is correctly wired.

---

## Common pitfalls

- **Map shows a grey grid with "For development purposes only" watermark** → Maps key invalid OR billing not enabled. Re-check Step 1.2 and 1.5.
- **Map shows a blank grey screen, no watermark** → Manifest placeholder didn't substitute. Confirm your `gradle.properties` has `MAPS_API_KEY=...` (no quotes, no spaces around `=`).
- **`Could not find google-services.json`** → File is in the wrong folder. It must be at `android/app/google-services.json`, not `android/google-services.json`.
- **`Default FirebaseApp is not initialized`** → You forgot Step 2.5 (uncomment the plugin line).
- **`SHA-1 fingerprint does not match`** → You restricted the API key with the release SHA-1 but are running a debug build. Either add the debug SHA-1 too, or remove the Android app restriction temporarily during dev.

---

## What's next

Once both keys are live and you can run the app and see the OTP screen + map render:

1. The OTP "Send" button will fail (no backend). That's expected — backend skeleton is the next milestone.
2. Or, if you want to see the full UI flow without a backend, ask me to add a "mock mode" that fakes API responses so you can navigate end-to-end with canned data.
