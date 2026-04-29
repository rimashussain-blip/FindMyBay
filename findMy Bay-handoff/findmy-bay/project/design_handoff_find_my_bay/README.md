# Handoff: Find My Bay — Customer App (Refined)

## Overview
Find My Bay is a UAE-based mobile app for booking free car-wash bays at nearby vendors. The customer flow covers phone-OTP sign-in, discovering nearby vendors on a map, picking a service and slot, receiving a smart "leave now" alert that factors traffic, and managing upcoming bookings.

This handoff covers eight screens plus the app icon, refined from earlier wireframes into a modern, fresh, welcoming and warm visual direction.

## About the Design Files
The files in this bundle are **design references created in HTML** — high-fidelity prototypes showing intended look, layout, and behavior. They are **not production code to copy directly**.

Your job is to **recreate these designs in the existing codebase** using its established framework, component library, and styling conventions (whatever you've started with — React Native, Flutter, SwiftUI, native Android, etc.). Use the HTML files as your visual + behavioral spec, and translate every pixel value, color, font weight, and interaction into the equivalents your stack already uses.

If your codebase already has primitives for buttons, cards, list rows, tabs, toasts, etc., **use those primitives** — match the design's *look* using your stack's *materials*. Only build new components when nothing existing fits.

## Fidelity
**High-fidelity.** The mockups define final colors, typography weights/sizes, spacing, radii, shadow recipes, and component states. Recreate them faithfully — but on the target platform's idiomatic primitives (e.g. iOS-style large titles where iOS, Material 3 sheets where Android).

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#14B8A6` | Primary CTA, active pins, focus rings, key accents |
| `primary-deep` | `#0F766E` | Headings, prices, deep accents, active tab text |
| `ink` | `#0B3B36` | Body text, titles |
| `ink-soft` | `#3F6B65` | Secondary text, captions |
| `cream` | `#FFF7EC` | App background — warm welcoming surface |
| `sand` | `#FCE7C8` | Warm accent, hero gradients, success halo |
| `sand-deep` | `#F5C77E` | Amber CTA on dark backgrounds, star ratings |
| `mint` | `#E6F7F4` | Surface tint, free-bay chip background |
| `mint-edge` | `#CDEEE8` | Hairlines, card borders |
| `coral` | `#FF8B6B` | Busy state, destructive (cancel) |
| `coral-soft` | `#FFE3D9` | Busy chip background |
| `white` | `#FFFFFF` | Cards |
| `hairline` | `rgba(11,59,54,0.08)` | Dividers inside cards |

### Typography
- **Family:** SF Pro / system on iOS, Roboto / system on Android. Fallback `-apple-system, "SF Pro", system-ui`.
- **Display 28/700/-0.6** — splash title ("Find My Bay")
- **Title 22/700/-0.4** — screen titles ("My bookings", "Nearby car washes")
- **Heading 19/700/-0.4** — vendor name in detail
- **Subheading 17/700/-0.3** — sticky bar / nav title
- **Body 13–14/700** — card titles
- **Body 13/400** — body copy
- **Caption 11/600** — labels, metadata
- **Eyebrow 11/700/0.3 uppercase** — section labels (`PRIMARY-DEEP`)
- **Micro 10/600** — tags, timestamps

### Spacing
4-pt scale: 4, 8, 12, 16, 22, 28. Card padding: 12–16. Page horizontal padding: 16–22.

### Radii
- 10 — small chips
- 12 — buttons inside cards, small inputs
- 14 — primary buttons, OTP cells
- 18 — cards
- 22 — hero cards
- 26 — list groups
- 44 — phone frame

### Shadows
- Card: `0 8px 24px rgba(11,59,54,0.08)`
- Card subtle: `0 6px 20px rgba(11,59,54,0.06)`
- Primary CTA: `0 8px 20px rgba(20,184,166,0.35)`
- Amber CTA: `0 12px 26px rgba(245,199,126,0.45)`
- Phone frame: `0 30px 60px rgba(11,59,54,0.18)`

## App Icon
- 1024×1024 master, rounded-square (iOS) / adaptive (Android, foreground inside safe area).
- **Background:** radial gradient `#2DD4BF → #14B8A6 → #0F766E` (origin top-left), with a warm sand radial glow (`rgba(245,199,126,0.55)`) bottom-right.
- **Foreground glyph:** white water-drop with a deep-teal `P` set inside it. The P is set in -apple-system / SF Pro Display, weight 800, size ~26 (relative to a 100-unit canvas), letter-spacing -1, baseline ~68. A small deep-teal dot sits near the top of the drop as a location ping.
- **Sheen:** 160deg linear `rgba(255,255,255,0.28) → 0%` overlay for glassy lift.

See `screens.jsx → AppIcon` for the exact rendering recipe.

## Screens

### 1. Phone OTP (sign-in)
**Purpose:** First-launch sign-in. User enters their UAE phone number to receive an SMS OTP.

**Layout (top→bottom):**
- Status bar (44px)
- Sand-glow halo (180×180 radial) behind a 68px logo mark, centered, with a 30px top offset so the glow extends above the logo
- Title `Find My Bay` (28/700) + subtitle `Book a free wash bay in seconds — across the UAE.` (13/inkSoft, 1.5 lh, centered)
- Eyebrow `MOBILE NUMBER` + input row: white card, 14px radius, 1px mint-edge border, 14×16 padding, country flag + `+971` + vertical hairline + placeholder `50 123 4567`
- Primary CTA `Send code` (52px tall, 14px radius, primary fill, white text 15/600, primary CTA shadow)
- Spacer pushes terms text (`By continuing you agree to the Terms & Privacy Policy`) to the bottom; "Terms" and "Privacy Policy" are primary-deep / 500.
- Home indicator (28px, 120×4 pill).

### 2. OTP Verify
**Purpose:** Enter the 6-digit code. Show countdown until resend is allowed.

**Layout:**
- Back-button square (36×36, 12 radius, white card)
- Two-line title `Enter the code / we just sent you` (26/700/-0.5)
- Subtitle naming the destination phone, with the number itself in primary-deep/600.
- 6 OTP cells (40×52, 12 radius, 1.5px border). Empty cells: white + mint-edge border. Filled cells: mint fill + primary border. **Active cell** (cursor): primary border + 4px focus halo `rgba(20,184,166,0.15)`.
- Resend status: `Didn't get it? Resend in 0:24` (12/inkSoft, with the resend phrase in primary-deep/600). When countdown hits 0 the phrase becomes a tap target.
- Primary CTA `Verify & continue` pinned to bottom (52/14r/primary).

### 3. Nearby Map
**Purpose:** Browse vendors near current location and pick one.

**Layout:**
- Greeting block: tiny `Good morning, Sara ☀️` (12/inkSoft) + screen title `Nearby car washes` (22/700/-0.4) with a refresh button (36×36 mint square) on the right.
- Map card: rounded 24px, mint-tinted base (`#DCEFEA`), with stylised land patches (`#E9F4F0` and a 45%-opacity sand sweep), white roads (10px and 6px), and `#CDEEE8` park circles. **Don't render the SVG verbatim** — use a real map provider (Mapbox / Apple Maps / Google) with a custom style sheet that matches these tones.
- Floating search pill (top of map, 14r, white@92% + 10px blur, 4–14px padding, 13/inkSoft text) with a magnifier icon.
- Filter chips below the search: ink-filled active chip, white-glass pseudo-pills inactive. (`Free now / Under AED 40 / Open late`).
- "You" pulse: 16×16 primary dot with 3px white border + 36×36 `rgba(20,184,166,0.25)` pulse halo.
- Vendor pins: pill marker showing free-bay count, with a downward 8×8 rotated square as the tail. Active pin uses `primary-deep` and is `scale(1.05)`; inactive uses `primary`.
- Bottom card peek: white, 18r, 8/24/0.08 shadow, with a 48×48 mint-to-sand thumbnail tile, vendor name + ★4.7, distance + ETA, and a "2 free now" mint chip + price.

### 4. Vendor Detail
**Purpose:** See vendor info, live bay availability, services; tap a service then book.

**Layout:**
- Hero card 130h, mint-to-sand gradient, decorative white circles, back button (top-left) and heart/save (top-right) as 34px white-glass squares. A car emoji sits bottom-left as a placeholder for a vendor photo — **replace with the vendor's actual photo** when available.
- Title row: vendor name + star/rating/(reviews) + neighborhood/city/distance line.
- Live bay status card: white, 18r, mint-edge border. Eyebrow `LIVE BAY STATUS` + "Updated now" with primary dot. Below: 4-up grid of bay pills — free=mint+primary-deep, busy=coral-soft+coral, each with `Bay N` (9/600/inkSoft) above the state (11/700).
- `Services` section row + `See all` link. Each service is a 14r row 12×14 padding, 38×38 thumbnail, name (13/700), duration line (11/inkSoft), and price (14/800/primary-deep) right-aligned. The picked service uses mint fill + primary border.
- Sticky CTA: 52/14r primary fill `Book a wash · AED 35 ›`, with a chevron icon.

### 5. Slot Picker
**Purpose:** Pick a date and time for the chosen service.

**Layout:**
- Sticky header: 36px back square + `Pick a time` (17/700).
- Eyebrow `DATE` + 4-up day cards (Mon/Tue/Wed/Thu). Each card: flex column with day-of-week (10/0.8), date (18/700), and a small label slot (`Today` / `Tomorrow`) reserving 10px of vertical space whether filled or not. Selected day = primary-deep fill + white text.
- Eyebrow `MORNING SLOTS` + bay-availability hint (`● Bay 1 available`).
- 3-column slot grid, 12r, 12 vertical padding, 14/600 type. **States:**
  - Past slot — `#F1F1EE` fill, `#B7B7B0` text, line-through.
  - Available — white fill, mint-edge border, ink text.
  - Selected — primary fill, white text, primary CTA shadow.
- Smart-leave promise card (sand fill, 14r, 14p): eyebrow `You'll get a smart-leave alert` + 🚦, with a 11/inkSoft body about traffic-aware notifications.
- CTA: `Confirm · Tue 10:00 · AED 35` (52/14r/primary).

### 6. Booking Confirmed
**Purpose:** Confirmation of a successful booking.

**Layout:**
- Stacked-halo success mark: outer sand halo (`rgba(245,199,126,0.35)`), middle mint disc, inner 64px gradient disc (`#2DD4BF → primary-deep`) with white check.
- Headline `You're all set!` (22/700/-0.4) + reassurance subtitle (12/inkSoft, centered) about the smart-leave alert.
- Receipt card: white, 18r, 1px mint-edge border, 6/20/0.06 shadow. Top row: 38×38 thumbnail + vendor + neighborhood. **Tear-line:** 1px hairline with 16×16 cream-colored notches cut into the card edges (left/right) at the divider's vertical midpoint — render as absolutely-positioned cream circles for the tear effect. Below: `Service / Bay / Time / Duration` rows (11/inkSoft label, 11/600/ink value). Final hairline + `Total` row with the price in 18/800/primary-deep.
- Two secondary buttons: `📅 Add to calendar` and `🧭 Get directions` (44/12r, white + mint-edge border, 12/600 text). **Replace emojis with proper icons** (calendar, navigation arrow) from your icon set.
- Primary `Done` CTA at bottom (52/14r/primary).

### 7. Leave Now (smart alert)
**Purpose:** Full-screen alert nudging the user to leave for their wash, factoring traffic.

This screen is the warmest, most reassuring moment in the app and uses a dark-on-aqua treatment.

**Layout:**
- Background: 165deg gradient `#2DD4BF 0% → #0F766E 75% → #0B3B36 100%`. Two soft radial glows: sand top-left (200×200), aqua bottom-right (220×220).
- Status bar text uses white.
- Eyebrow `SMART LEAVE ALERT` (11/600/0.7-white, 1.5 letter-spacing, uppercase).
- Hero icon: 80×80 sand-gradient rounded square (26r) with a car emoji (or vendor-relevant icon) and a pulsing sand halo `rgba(245,199,126,0.25)` (animation: scale 1→1.15, opacity 0.55→0.25, 2s ease-in-out).
- Big headline `Leave now` (36/800/-1, white) + subtitle `Heading to <vendor> for your <time> wash`. Vendor name is sand/700; time is 600 white.
- Glass info card: white@95% with 20px blur, 22r, 12/32/0.18 shadow. Two columns split by a 1px hairline:
  - Left — `Drive` label, big `12 min` (30/800), and `+3 traffic` warning in coral/700.
  - Right — `Slot` label, big `10:00` (30/800/primary-deep), `Bay 1 · Tue` subtitle.
- Primary action: `I'm leaving now` — 56h/16r, sand-gradient fill (`sand → sand-deep`), primary-deep text, 16/700, amber CTA shadow. (Amber against the deep aqua gives the warmest possible call-to-action.)
- Secondary action: `Snooze 5 min` — ghost button on dark, 1px white@35% border.

### 8. My Bookings
**Purpose:** Manage upcoming bookings; show countdown to next slot.

**Layout:**
- Title `My bookings` (22/700/-0.4) + plus button (36×36 mint square with primary-deep `+` icon) on the right.
- Segmented control `Upcoming / Past`: white with mint-edge border, 12r, 4px inner padding; active segment is primary-fill with white text and 9r inner radius.
- **Active booking card:** white, 18r, 1.5px primary border, 8/20/0.15 primary-tinted shadow.
  - Mint-to-sand header strip: eyebrow `TOMORROW · 10:00` + countdown `in 18h 14m`, both primary-deep/700 small.
  - Body: 38×38 thumbnail, vendor, service+bay, price.
  - Action row: `Show QR` (primary-deep fill, white, with a small QR-grid SVG icon), `Reschedule` (white + mint-edge border), and a 36×36 cancel button (white + mint-edge border, coral × glyph).
- **Future booking card:** white, 18r, mint-edge border. Date in 10/600/inkSoft + small `SCHEDULED` mint pill (9/700/primary-deep) right-aligned. Same body row pattern as above.
- **Loyalty teaser:** sand-to-coral-soft gradient, 18r. 28px gift glyph + title `One free wash on us` + progress text `3 of 5 washes complete` + 4px progress bar (white@60% track, primary-fill bar at 60%).
- **Replace emojis** (🚿 ✨ 🎁) with real icons from your set.

## Interactions & Behavior

### Navigation flow
1. **OTP** → tap *Send code* → **Verify**
2. **Verify** → cells filled or tap *Verify & continue* → **Map**
3. **Map** → tap card or pin → **Vendor**
4. **Vendor** → pick service → tap *Book a wash* → **Slot**
5. **Slot** → pick day + time → tap *Confirm* → **Confirmed**
6. **Confirmed** → tap *Done* → back to **Map** (or **Bookings**)
7. (Background) traffic-aware timer fires → **Leave Now** full-screen alert
8. **Bookings** is reachable from a tab bar or profile entry-point (not yet drawn — design tab bar separately)

### Animations
- **Pulse halo** on Leave Now sand icon — 2s ease-in-out infinite, scale 1↔1.15, opacity 0.55↔0.25.
- **OTP cells** — when a digit is entered, animate fill (mint) + border (primary) over 120ms ease-out. Active cell shows the 4px halo.
- **Day/slot selection** — 100ms color crossfade.
- **CTA press** — scale 0.98, 80ms ease-out; release back to 1.0 over 160ms.
- **Map pin tap** — selected pin scales to 1.05 and the bottom card slides up over 200ms.

### States to design / build
- **Loading:** map skeleton (mint-edge stroke shapes), card skeletons (mint-edge background, shimmer at 1.6s linear).
- **Empty:** `No nearby vendors yet` with a small drop-with-question-mark glyph.
- **Error:** coral pill toast at top of screen, `0 6px 16px rgba(255,139,107,0.3)` shadow.
- **OTP failure:** flash all 6 cells with coral border for 220ms then clear.
- **Bay sold out (slot conflict):** show coral pill `That slot just filled — try 10:30?` and auto-suggest next.

### Form rules
- Phone: must match `+971` + 9 digits. Disable *Send code* until valid.
- OTP: numeric only, 6 digits. Auto-advance between cells. Auto-submit when 6th digit is entered. Resend disabled for 30s.

## State Management
Suggested slices:

- `auth`: `{ phone, otpRequestedAt, verified }`
- `location`: `{ coords, permissionStatus }`
- `vendors`: `{ list, byId, lastFetchedAt }` — list endpoint sorted by distance.
- `vendor(id)`: `{ services, bays }` — bays poll every 15s while screen is foregrounded.
- `booking-draft`: `{ vendorId, serviceId, dayISO, timeISO, totalAed }`
- `bookings`: `{ upcoming[], past[] }`
- `leaveAlert`: triggered by a server-side push that factors live traffic between the user's current location and the vendor; client schedules a fallback local notification using the cached ETA at booking time.

## Assets
- Vendor photos — supplied by vendors at onboarding. Aspect-fill the hero card; if missing, fall back to the mint-to-sand gradient with a centered car/wash icon (NOT an emoji in production).
- Icons — replace all emojis (🚿 🚗 ✨ 🎁 ☀️ 📅 🧭 🇦🇪) with vector icons from your icon set. Stroke-style icons at 1.6–2px weight match the calm visual.
- Map tiles — your map provider's "light" or custom style; tint roads to white, land to `#E9F4F0`, and water to `#BFE3DC`.
- App icon — recreate from the `AppIcon` recipe at 1024×1024, then export iOS/Android sizes.

## Files in this Bundle
- `Find My Bay.html` — entry point, lays out the icon block, palette, and 8 screens on a presentation canvas.
- `screens.jsx` — React components for each screen + `AppIcon` + `LogoMark`. Every visual token is encoded here in the `fmb` constant. **Read this for exact pixel values.**
- `ios-frame.jsx` — generic iOS frame helpers (not directly used by these screens but useful for follow-up mocks).
- `wireframes_original.html` — the earlier aqua-only wireframes for reference.

## Open Questions for the PM / Design
- Tab bar / global nav — not yet designed. Bookings, Map, Profile?
- Vendor reviews list / profile screen — out of scope here.
- Payment screen — UAE payment methods (Apple Pay, card, Tabby/Tamara?).
- Push permission priming — when do we ask?
- Cancellation policy display — copy + placement.
