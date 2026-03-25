# Mobile architecture (PWA + Capacitor)

How Aphylia combines a **browser-first PWA** with an **optional native shell**, where code lives, and what rules govern native work and releases.

## PWA-first philosophy

1. **The product is the web app.** Routes, forms, validation, API calls, state, design tokens, and most UX live in **`plant-swipe/src/`** and ship as a Vite production bundle under **`dist/`**.
2. **The browser PWA is the reference deployment.** Installability, service worker, offline shell, and push (where supported) target standard browsers. See `docs/SERVICE_WORKER_CAPACITOR.md` for how the SW differs on web vs native builds.
3. **Capacitor wraps the same bundle.** Store apps copy **`webDir`** (`dist`) into Android/iOS at **`cap sync`**; users get the **reviewed** web assets inside the binary, not a live remote site. Remote **`server.url`** is forbidden for production (enforced by `scripts/assert-capacitor-store-bundle.mjs`).
4. **Native code is additive.** It should configure the shell (icons, splash, status bar, deep links, signing) and expose OS services only when the web platform is insufficient—not duplicate business logic.

## Where shared code lives

| Area | Location | Notes |
|------|-----------|--------|
| UI, routing, i18n | `src/` | React app, `App.tsx`, pages, components |
| Shared “device” APIs | `src/platform/` | Storage, camera, share, push, haptics—web first, minimal native |
| Capacitor bridges | `src/lib/` (e.g. `capDeepLinks.ts`, `nativeStatusBarTheme.ts`) | Small glue; no feature logic forks |
| Auth | `src/lib/supabaseClient.ts`, `src/context/AuthContext.tsx` | Same client in browser and WebView |
| Build output | `dist/` | Vite output; `build:web` includes PWA SW; `build:web:native` omits SW for store |
| Native projects | `android/`, `ios/` | Gradle / Xcode; committed in-repo for CI and reproducibility |
| Capacitor config | `capacitor.config.json` | JSON (not `.ts`) for CLI + `"type": "module"`; version synced by script |
| Version propagation | `scripts/sync-native-version.mjs` | `package.json` → Capacitor, Gradle, Info.plist |

## When native code is allowed

Native (or native-adjacent) changes are appropriate when they:

- **Configure the shell:** app ID, icons, splash, orientation, `Info.plist` / `AndroidManifest.xml`, associated domains / app links.
- **Bridge OS APIs** that have no reliable web equivalent in the WebView, or need store-compliant permission strings.
- **Fix WebView-specific bugs** that cannot be solved in shared web code without harming the browser PWA.

Avoid:

- Reimplementing screens or API clients in Kotlin/Swift when React can do it.
- Adding Capacitor plugins “just in case”; prefer `src/platform/` with feature detection. See `package.json` for the current minimal plugin set.

## Hot update rules

Store production must follow **`docs/LIVE_UPDATES_STORE_POLICY.md`**. In short:

- **No** pointing end users at arbitrary **`server.url`** for the full app shell.
- **Yes** server-driven **data**, **copy**, **feature flags**, and **API behavior** inside code paths already in the shipped bundle.
- Any future OTA-style web updates are **classified**, **manually approved** when they touch user-visible flows, and **rollback-ready**.
- Apple guideline **2.5.2** is treated seriously: OTA is not a loophole to ship unreviewed product behavior.

## Build environments

| Environment | Typical use | Web build | Native sync |
|-------------|-------------|-----------|---------------|
| **Local dev** | `bun run dev` + `bun run serve` | Dev server; PWA optional (`VITE_ENABLE_PWA`) | Not required for daily web work |
| **CI (GitHub Actions)** | `capacitor-mobile.yml` | `build:web` or `build:cap` with `SKIP_SITEMAP_GENERATION=1` | `cap:ci:sync` when `dist` exists; `NATIVE_BUILD_NUMBER` for monotonic codes |
| **Store / release** | Signed artifacts | `build:web:native` → `sync:cap` (or `build:cap`) | Xcode / Android Studio signing; no secrets in git |

Environment variables commonly used:

- **`VITE_APP_NATIVE_BUILD=1`** — set by `build:web:native` / Capacitor pipeline; disables vite-plugin-pwa for the native bundle.
- **`NATIVE_BUILD_NUMBER`** — integer passed to `sync-native-version.mjs` for Android `versionCode` / iOS `CFBundleVersion` (e.g. CI run number).
- **`VITE_SUPABASE_URL`**, **`VITE_APP_UNIVERSAL_LINK_ORIGIN`**, **`CAP_ALLOW_NAVIGATION_HOSTS`** — supply at **`cap sync`** time so `sync-native-version.mjs` can set `server.allowNavigation` (not read from `.env` in that script).

## Related docs

- `docs/LIVE_UPDATES_STORE_POLICY.md` — hot update and `server.url` policy
- `docs/SERVICE_WORKER_CAPACITOR.md` — SW on web vs native
- `docs/CAPACITOR_SETUP_NOTES.md` — **`setup.sh` Linux vs macOS** and local prerequisites
- `docs/BUILD_ANDROID.md`, `docs/BUILD_IOS.md` — platform build steps
