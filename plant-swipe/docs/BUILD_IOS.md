# Building the iOS app (Capacitor)

**macOS + Xcode are required.** iOS projects cannot be built on Linux. CI builds the **Simulator** target with **`ios/App/App.xcodeproj`** (see `.github/workflows/capacitor-mobile.yml`).

**Push (APNs):** Configure push in Apple Developer + Xcode signing; set server env **`APNS_KEY_ID`**, **`APNS_TEAM_ID`**, **`APNS_KEY_P8`** (`.p8` PEM or base64), **`APNS_BUNDLE_ID`** (default `app.aphylia`), and **`APNS_USE_SANDBOX=1`** for dev builds if needed.

## Prerequisites

- **Xcode** (current version supported by Capacitor 8)
- **CocoaPods** — `cd ios/App && pod install` when `Podfile` changes
- **Bun** and **Node** (for `npx cap`)
- **Apple Developer** account for device testing and App Store distribution

## One-time / occasional

```bash
cd plant-swipe
bun install
bun run cap:assets    # icons/splashes from assets/
```

After adding plugins or native deps:

```bash
cd ios/App && pod install
```

## Store-ready pipeline

From `plant-swipe/`:

```bash
export SKIP_SITEMAP_GENERATION=1
export NATIVE_BUILD_NUMBER=456   # optional; maps to CFBundleVersion in sync script

bun run build:cap
```

Then **open Xcode** (recommended for signing and archive):

```bash
bun run open:ios
```

Or CLI (still macOS only):

```bash
bun run build:ios:release
```

The `build:ios:*` scripts wrap `bash scripts/run-on-macos.sh` so they **no-op with exit 0** on non-macOS hosts (useful for mixed CI matrices).

### Archive & upload

1. Open **`ios/App/App.xcworkspace`** (not `.xcodeproj` alone if CocoaPods is used).
2. Select the **App** scheme, **Any iOS Device** or **Generic iOS Device**.
3. **Product → Archive**.
4. Use **Organizer** to **Validate** and **Distribute** to App Store Connect.

Configure **Signing & Capabilities**, **Associated Domains** (universal links), and **Info.plist** usage strings before submission. See `docs/APP_STORE_REVIEW_CHECKLIST.md`.

## Debug / simulator

```bash
bun run build:ios:debug
```

Or build/run from Xcode with a simulator destination.

## Bundle identifier

**`app.aphylia`** — must match **Apple App Site Association** (`applinks`) and **Sign in with Apple** / OAuth configuration if applicable.

## npm/bun scripts reference

| Script | Purpose |
|--------|---------|
| `build:cap` | Web bundle for native + `sync:cap` |
| `build:ios` | `build:ios:release` |
| `build:ios:release` | `build:cap` + `npx cap build ios` (macOS only) |
| `build:ios:debug` | Debug export method (macOS only) |
| `open:ios` | `npx cap open ios` |

## Orientation and safe area

The project targets **portrait-primary** on iPhone in `Info.plist`; iPad orientations may still include landscape. WebView **safe areas** are handled in shared CSS (`viewport-fit=cover`, `PlantSwipe` / `mobile-nav` padding) plus Capacitor **`ios.contentInset: "always"`** in `capacitor.config.json`.

## Troubleshooting

- **Pod errors** — `pod repo update` then `pod install` in `ios/App`.
- **Signing errors** — Fix in Xcode; use automatic signing for dev, manual/profiles for release as per org policy.
- **Universal links not opening app** — Verify **Associated Domains**, AASA file on **https://** production host, and team/bundle ID in the AASA file.
