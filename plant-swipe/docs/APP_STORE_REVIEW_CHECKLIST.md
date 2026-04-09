# App Store & Play review checklist

Internal pre-submission list for **Aphylia** (Capacitor + shared web app). Not legal advice; align answers and privacy labels with counsel.

## Binary & web bundle

- [ ] Built from a **tagged / reviewed commit**; no debug-only endpoints in production env.
- [ ] **`build:cap`** (or `build:web:native` + `sync:cap`) used for store; **`server.url`** not set for end users (`assert-capacitor-store-bundle` passes).
- [ ] **`NATIVE_BUILD_NUMBER`** (or semver-derived code) set intentionally for **versionCode** / **CFBundleVersion**.
- [ ] Tested **release** configuration (not only debug): signed **AAB/APK** (Android) and **Archive** (iOS).

## Functionality & UX

- [ ] Core flows work **offline-aware** (errors, retries—not infinite spinners): auth, gardens, discovery, settings, account deletion.
- [ ] **Account deletion** available and working (see Settings / GDPR flows).
- [ ] No **placeholder** primary features or broken tabs visible to consumers.
- [ ] **Mobile-first** layout: safe areas (notch, home indicator), bottom nav clearance, readable typography.
- [ ] **Deep links** / universal links open the correct in-app route; **auth callbacks** (magic link, recovery) work from mail and browser return paths.

## Permissions & plist / manifest

- [ ] **iOS `Info.plist`:** every runtime permission has a clear **usage description** (camera, photos, location, mic, tracking, etc.—only keys you actually use).
- [ ] **`PrivacyInfo.xcprivacy`** bundled in the app target; **required-reason APIs** declared (expand if App Store Connect reports missing types).
- [ ] **`ITSAppUsesNonExemptEncryption`:** set correctly for your crypto story (HTTPS-only → `false` unless counsel says otherwise).
- [ ] **Android:** dangerous permissions declared only if used; **runtime** requests match copy shown to users.
- [ ] **Push:** if implemented, notification copy matches actual behavior; native push may require FCM/APNs beyond web push.

## Privacy & data

- [ ] **App Store Connect / Play Data safety** updated for **Supabase**, **Sentry**, **Analytics** (if enabled), **reCAPTCHA**, and any new SDK.
- [ ] **ATT** (App Tracking Transparency) if IDFA or cross-app tracking applies.
- [ ] **Cookie / consent** behavior in WebView consistent with web policy where applicable.

## Sign in with Apple (4.8)

- [ ] If **third-party social login** is offered as a sign-in method, confirm whether **Sign in with Apple** is required and implement if needed.
- [ ] Current primary email/password via Supabase is fine if social is not primary; re-check when adding Google/Facebook/etc.

## Hot updates & remote code

- [ ] Review stance documented: **bundled** web assets for store; no arbitrary remote shell. See `docs/LIVE_UPDATES_STORE_POLICY.md`.
- [ ] If using any OTA vendor later, scope matches policy and legal review.

## Credentials & associations

- [ ] **Universal Links:** `apple-app-site-association` on **HTTPS** without extension; **TEAMID** + bundle **`app.aphylia`** correct.
- [ ] **Android App Links:** `assetlinks.json` with correct **package_name** **`app.aphylia`** and signing cert fingerprint.
- [ ] **Supabase / OAuth redirect URLs** include app-specific and HTTPS callback URLs as required.

## Device QA (mandatory before major release)

- [ ] **Physical iPhone** (notch / Dynamic Island) and **physical Android** (gesture nav).
- [ ] **Cold start**, **background** / **resume**, **low network**, **airplane mode** edge cases.
- [ ] **Uploads**, **camera** (if used), **file picker** flows.
- [ ] **Store listing** screenshots and description match the binary.

## Commands (sanity)

```bash
cd plant-swipe
bun run build:web          # browser PWA check
bun run build:cap          # native bundle + sync
# Then Xcode + Android Studio for signed release artifacts
```

## Related docs

- `docs/APPLE_APP_STORE_REJECTION_RISKS.md` — themed list of common rejection reasons + repo mitigations
- `docs/APP_STORE_READINESS.md` — deeper UX/SDK notes (update plugin names there if they drift)
- `docs/LIVE_UPDATES_STORE_POLICY.md`
- `docs/MOBILE_ARCHITECTURE.md`
