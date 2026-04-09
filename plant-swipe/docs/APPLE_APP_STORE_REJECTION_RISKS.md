# Apple App Store — common rejection themes and how we mitigate them

This is an internal engineering checklist. It is **not legal advice**. App Store Review Guidelines change; always read [Apple’s current guidelines](https://developer.apple.com/app-store/review/guidelines/) and align App Privacy labels and review notes with your counsel.

---

## 1. Safety, scams, and illegal content (4.x)

| Risk | What reviewers look for | Mitigation in this repo |
|------|-------------------------|-------------------------|
| User-generated content without moderation | Abuse, harassment, illegal goods | Keep moderation tooling and reporting aligned with your policy; document in review notes if UGC is central. |
| Deceptive behavior | Fake functionality, hidden purchases | No fake “pay to unlock” in consumer paths; pricing must match IAP if you add subscriptions. |

---

## 2. Performance, completeness, and “minimum functionality” (2.1, 4.2)

| Risk | What reviewers look for | Mitigation |
|------|-------------------------|------------|
| Crashes, blank screens, broken core flows | App must work on current iOS | Test **release** builds on **physical devices**; cold start, login, main tabs, offline errors (no infinite spinners). |
| Thin website wrapper | Desktop UI in a WebView, poor touch targets | Mobile-first layout, safe areas, native chrome (`StatusBar`, `contentInset`); see `docs/APP_STORE_READINESS.md`. |
| Placeholder or “coming soon” as main feature | Broken or empty primary navigation | Remove or hide unfinished consumer features from production routes. |
| **Remote code / changing app behavior** (2.5.2) | Loading executable logic that alters features post-review | **No `server.url` in production**; bundled `webDir` only. See `docs/LIVE_UPDATES_STORE_POLICY.md`. |

---

## 3. Business, payments, and subscriptions (3.1.x)

| Risk | Mitigation |
|------|------------|
| Digital goods without IAP | If you sell digital subscriptions in the app, use Apple IAP (or qualify for a narrow exception — verify with counsel). |
| External purchase links where not allowed | Follow current “reader app” and StoreKit External Purchase rules if applicable. |

*(Aphylia’s store monetization model must be verified before submission.)*

---

## 4. Design, spam, and copycats (4.0, 4.3)

| Risk | Mitigation |
|------|------------|
| App looks like a template or duplicate | Distinct branding, screenshots, and copy; avoid generic placeholder art in the binary. |
| Misleading metadata | Screenshots and description must match the **submitted build**. |

---

## 5. Privacy, tracking, and data collection (5.1.x)

| Risk | Mitigation |
|------|------------|
| Missing or inaccurate **App Privacy** answers | Declare data collected by the app and SDKs (Supabase, Sentry, analytics if enabled, reCAPTCHA, push). |
| **App Tracking Transparency (ATT)** | If you use IDFA or certain cross-app tracking, implement ATT + `NSUserTrackingUsageDescription`. Gate analytics to match web consent where applicable. |
| **Privacy manifest** (required reason APIs) | `ios/App/App/PrivacyInfo.xcprivacy` declares **UserDefaults** (`CA92.1`) for typical Capacitor/plugin use. **Expand** this file if Xcode or App Store Connect reports additional required APIs (e.g. disk space, boot time). |
| Secret tracking / fingerprinting | Do not collect more than disclosed; document server-side retention. |

---

## 6. Permissions and Info.plist strings (5.1.1)

| Capability | Key | Status in repo |
|------------|-----|----------------|
| Camera / photos (picker) | `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` | Present in `Info.plist`. |
| Location (GPS city picker in web app) | `NSLocationWhenInUseUsageDescription` | **Added** — required before iOS shows the location prompt. |
| Microphone | `NSMicrophoneUsageDescription` | **Not** in plist — camera path uses **video-only** `getUserMedia` (`audio: false`). Add this key only if you enable microphone. |
| Photo library **write** | `NSPhotoLibraryAddUsageDescription` | Add only if you save images to the library. |
| Push | Background mode `remote-notification` + user-facing notification permission | Configured; ensure copy matches real use (messages, reminders). |

---

## 7. Encryption export compliance

| Risk | Mitigation |
|------|------------|
| Unclear export compliance in App Store Connect | `ITSAppUsesNonExemptEncryption` set to **`false`** in `Info.plist` for standard HTTPS/TLS only. **Change to `true` and complete export paperwork** if you ship custom or non-exempt crypto. |

---

## 8. Sign in with Apple (4.8)

| Risk | Mitigation |
|------|------------|
| Third-party social login without Apple | Current primary auth is **email/password** via Supabase. **If you add** Google/Facebook/etc. as sign-in, evaluate **Sign in with Apple** requirement and implement alongside. |

---

## 9. Account deletion (5.1.1(v))

| Risk | Mitigation |
|------|------------|
| No way to delete account | In-app GDPR / account deletion must work; note URL in App Store Connect if required. See `docs/APP_STORE_READINESS.md`. |

---

## 10. Legal, intellectual property, and metadata (5.2, metadata)

| Risk | Mitigation |
|------|------------|
| Missing terms / privacy links | Ensure live URLs in App Store Connect match the app. |
| Third-party content rights | Plant images, user uploads — ensure licensing and DMCA/process as needed. |

---

## 11. Universal Links, auth, and WebView navigation

| Risk | Mitigation |
|------|------------|
| Magic links / OAuth break in app | `allowNavigation` for Supabase and app domain via env at `cap sync`; auth URL handling in `supabaseClient.ts`. See `docs/UNIVERSAL_LINKS_AND_AUTH.md`. |
| Associated domains misconfigured | Host `apple-app-site-association` on HTTPS; match Team ID + bundle ID. |

---

## 12. Device requirements

| Item | Change |
|------|--------|
| `UIRequiredDeviceCapabilities` | **Updated** from `armv7` to **`arm64`** (64-bit only; aligns with modern App Store expectations). |

---

## Pre-upload sanity (engineering)

```bash
cd plant-swipe
bun run build:cap
# Xcode: Archive → Validate; fix any Privacy Manifest or signing warnings
```

---

## Related docs

- `docs/APP_STORE_REVIEW_CHECKLIST.md` — short pre-flight list  
- `docs/APP_STORE_READINESS.md` — UX, SDKs, permissions detail  
- `docs/MOBILE_ARCHITECTURE.md` — bundled assets, no production `server.url`  
- `docs/LIVE_UPDATES_STORE_POLICY.md` — guideline 2.5.2 stance  
