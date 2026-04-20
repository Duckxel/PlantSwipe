# Service worker, PWA caching, and Capacitor

## Decision: different behavior for browser PWA vs store WebView

| Context | Service worker | Rationale |
|---------|----------------|-----------|
| **Browser / installable PWA** (`bun run build` / `bun run build:web`) | **Enabled** (unless `VITE_DISABLE_PWA`) | Offline shell, update toast, Web Push hooks in `sw.ts`. |
| **Capacitor store bundle** (`bun run build:web:native`, `bun run build:cap`) | **Disabled** (`vite-plugin-pwa` not emitted) | Assets ship inside the binary; a service worker adds another cache layer that can **outlive** an app update and serve **stale JS** against a new `index.html`. iOS WKWebView service-worker support is also uneven compared to Chrome. |

Runtime flag: builds compiled for the native shell set `import.meta.env.VITE_APP_NATIVE_BUILD === '1'` (via `VITE_APP_NATIVE_BUILD=1`). The UI skips Workbox registration in that configuration.

## Web PWA: version-scoped runtime caches

Workbox **precache** entries already get revision hashes. **Runtime** caches (`pages-cache`, `static-assets`, etc.) previously used **fixed names** and could retain old responses across releases. In `src/sw.ts`, those cache names are suffixed with the app version (`VITE_APP_VERSION`), and on **activate** the worker deletes:

- Legacy unversioned cache names from older installs.
- Versioned caches whose suffix does not match the current build.

That limits cross-version mismatches after a normal PWA refresh/update cycle.

## Recovery UX (visible path when the bundle is inconsistent)

`ServiceWorkerToast` listens for **dynamic import / chunk load failures** (typical when HTML points at new hashed chunks but an old cache or SW still serves an older graph). It shows **“Clear cache & reload”**, which unregisters any service workers, deletes `CacheStorage` entries, and reloads.

On **native store builds**, if a developer-installed SW remains from a previous dev build, the app attempts to **unregister** registrations on startup so nothing intercepts `capacitor://` requests. The startup code also proactively **deletes stale `sw-native.js`** files via `Cache.delete` to prevent upgraded apps from serving an old service worker that redirects notification taps to Chrome instead of handling them in-app.

## Operational notes

- **Do not** point production at `server.url`; bundle policy is documented in `docs/LIVE_UPDATES_STORE_POLICY.md`.
- **Push on native** should not rely on the web SW alone; plan **FCM/APNs** and Capacitor push APIs (see Phase 1 matrix in `docs/PWA_NATIVE_COMPATIBILITY_PHASE1.md`).
