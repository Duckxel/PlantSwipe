# App Store readiness (Aphylia / Capacitor)

Internal checklist for a **fully functional v1 without live updates**. Not legal advice; align App Privacy labels and review answers with your privacy counsel.

## 1. Fully functional without OTA

- Production builds use **`webDir`** copied into the app at **`cap sync`** (no **`server.url`**). See `docs/LIVE_UPDATES_STORE_POLICY.md`.
- First release must ship with **complete** flows for the promised features (auth, gardens, messaging, scan, etc.). Do not rely on post-launch web URL swaps for core behavior.

## 2. Not a “thin website wrapper”

- **Mobile-first UI:** tab bar (`MobileNavBar`), touch targets, responsive layouts, lazy routes.
- **Native feel:** `src/platform/` (web Share / vibrate where available); **`@capacitor/status-bar`** for shell chrome; **`ios.contentInset: "always"`** in `capacitor.config.json` for safe-area-aware scrolling; **`allowsLinkPreview: false`** to reduce “browser” affordances.
- **Safe areas:** `viewport-fit=cover` in `index.html`; global **`safe-area-top` / `safe-area-bottom`** utilities in `index.scss`; **`body.mobile-nav-mounted`** bottom padding on small screens so content clears the fixed nav + home indicator.
- **Continue to improve:** audit any screen that still feels desktop-first; prefer bottom sheets and full-width mobile patterns.

## 3. Permissions & usage descriptions (Xcode)

After `npx cap add ios`, edit **`ios/App/App/Info.plist`** (or target build settings) so every sensitive capability has a **clear, specific** purpose string. Typical keys (add only what you actually request at runtime):

| Key | When needed |
|-----|-------------|
| `NSCameraUsageDescription` | Camera / plant scan / messaging photo capture |
| `NSPhotoLibraryUsageDescription` | Saving or picking photos (if you add picker flows) |
| `NSPhotoLibraryAddUsageDescription` | Saving images to library |
| `NSMicrophoneUsageDescription` | Only if you enable microphone (e.g. video) |
| `NSUserTrackingUsageDescription` | Only if you use App Tracking Transparency (IDFA) |
| `NSLocationWhenInUseUsageDescription` | GPS city detection in setup (see `city-country-selector.tsx`) — **present in `Info.plist`** |

**Push:** system permission prompt uses text you configure for notifications; ensure copy matches actual use (task reminders, messages, etc.).

**Privacy manifest:** `ios/App/App/PrivacyInfo.xcprivacy` declares **UserDefaults** (required-reason API) for typical Capacitor usage. Re-validate in Xcode after dependency upgrades; add entries if Apple flags additional API categories.

**Export compliance:** `ITSAppUsesNonExemptEncryption` is set to `false` for standard TLS/HTTPS. Update if you ship custom cryptography.

**Tracking:** If you use **Google Analytics** or other cross-app tracking on iOS 14+, follow ATT rules and App Privacy disclosures. The web app gates GA behind cookie consent; mirror that behavior in the native shell and disclose collected data types in App Store Connect.

## 4. App Privacy (third-party data)

Document in App Store Connect (and your privacy policy) data linked to the user, used for tracking, etc. Common SDKs in this repo:

| SDK / service | Typical disclosure categories |
|---------------|------------------------------|
| **Supabase** | Account, user content, diagnostics (per your configuration) |
| **Sentry** | Diagnostics, possibly device/usage (configure scrubbing; disclose) |
| **Google Analytics** (if enabled after consent) | Usage, identifiers (disclose; ATT if applicable) |
| **Google reCAPTCHA** | Fraud prevention, device signals |
| **@capacitor/app, @capacitor/status-bar, @capacitor/camera, @capacitor/haptics, @capacitor/push-notifications** | Disclose camera/mic/notifications usage strings; push needs Firebase/APNs setup server-side |

Re-run this table whenever you add an SDK.

## 5. Sign in with Apple (guideline 4.8)

- **Current auth:** email/password (and related flows) via **Supabase** — **no third-party social login as primary** in the codebase reviewed here.
- **If you add** Google/Facebook/etc. as a **sign-in** option: evaluate whether **Sign in with Apple** is required (4.8) and implement it alongside other third‑party login options.

## 6. Account deletion

- **In-app:** Settings and profile flows call **`deleteAccount`** → **`/api/account/delete-gdpr`** (see `AuthContext.tsx`). Keep this visible and working for store review.
- **App Store Connect:** provide the same capability per Apple requirements (link or in-app).

## 7. Placeholders & unfinished features

- Remove or hide **“coming soon”** primary navigation, broken deep links, and admin-only experiments from **consumer** builds if they look like broken product.
- **Download page** may mention future store listings; ensure it does not imply features that are not in the binary.

## 8. Real device testing

- **Mandatory:** test on **physical iPhones** (notch, Dynamic Island, home indicator, keyboard, camera, share sheet, push if enabled).
- Exercise **slow network** and **offline** to validate loading states and errors (no infinite spinners without message).

## 9. Pre-submission command checklist

```bash
cd plant-swipe
bun run build:web
bun run build:cap
# Open Xcode / Android Studio, set signing, verify Info.plist strings, run on device
```

For a concise review matrix, see **`docs/APP_STORE_REVIEW_CHECKLIST.md`**. Platform build steps: **`docs/BUILD_ANDROID.md`**, **`docs/BUILD_IOS.md`**.

---

*Update this document when auth, SDKs, or permissions change.*
