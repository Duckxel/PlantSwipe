# Phase 1 — PWA native / Capacitor compatibility audit

This document records findings for the current **Vite + React** PWA in `plant-swipe/`: build output, routing behavior in a WebView, browser API usage, PWA-only features, and a **native compatibility matrix** for Capacitor planning.

---

## 1. Web build output folder

| Item | Value |
|------|--------|
| **Output directory** | `plant-swipe/dist/` (Vite default; not overridden in `vite.config.ts`) |
| **Entry HTML** | `dist/index.html` — single root document for the SPA |
| **Build command** | `bun run build` → `tsc -b && vite build` |
| **PWA / service worker** | `vite-plugin-pwa` with `injectManifest`; emits `dist/sw.js` (and intermediate `dist/sw.mjs` during build) |
| **Base path** | `import.meta.env.BASE_URL` from `VITE_APP_BASE_PATH` (normalized in `vite.config.ts`); production must serve the app at that path so asset URLs and SW scope stay consistent |

**Stable directory:** Yes — one deployable tree under `dist/` with a stable `index.html` at the root of that tree (plus `assets/`, static copies of `icons/`, `locales/`, `offline.html`, `env-loader.js`, etc.).

---

## 2. Production `index.html` and PWA manifest

- **Shell:** Source template is `plant-swipe/index.html`; Vite rewrites script/link targets into hashed chunks under `dist/assets/` in production.
- **Manifest:** `<link rel="manifest" href="/api/manifest.webmanifest" />` points at the **Express API**, not a static file in `dist/`. For a static file server or `capacitor://` origin without the API, installability / manifest-driven metadata would need a Capacitor-specific strategy (e.g. static `manifest.webmanifest` in `webDir` or native config).
- **Runtime env:** `env-loader.js` + `env.js` in `dist/` load configuration before the app bundle.

---

## 3. Routing and WebView behavior

- **Router:** `BrowserRouter` from `react-router-dom` with `basename` derived from `import.meta.env.BASE_URL` (`App.tsx`).
- **URLs:** Client-side history API (`pushState` / `popstate`). Deep links are path-based (plus optional `?` query), not hash-based.
- **WebView implication:** The native shell must **rewrite or intercept navigations** so that:
  - Initial load can start from any path (e.g. `/fr/gardens`) and still serve **`index.html`** (SPA fallback).
  - In-app navigation continues to work without full page reloads to missing files.
- **i18n:** Language-prefixed routes (`/:lang/*`) and redirects on first load (`App.tsx`) depend on `location.pathname`; behavior is the same in a WebView as in a browser **if** the WebView reports the correct path.
- **Service worker:** `sw.ts` uses a **NetworkFirst** strategy for navigations (non-`/api/` paths). Offline navigation may serve cached documents; cold starts still need the host to resolve unknown paths to `index.html` where the SW is not controlling the client yet.

**Conclusion:** Routing is **standard HTML5 / client-side routing**. It works in WebViews that behave like a normal browser tab **only if** the server (or Capacitor `server` config) provides SPA fallback. Hash routing is **not** used today; switching to hash is optional hardening for awkward file-URL or static-host edge cases.

---

## 4. Browser APIs — classification

Legend:

- **Web-only** — Fine on web; on native WebView often present but semantics differ, or irrelevant outside browser chrome.
- **Capacitor plugin** — Often need `@capacitor/*` (or similar) for parity, permissions, or OS integration.
- **Avoid / gate on native** — Easy to misuse; privacy, store policy, or broken UX on native unless explicitly handled.

### 4.1 Works on web; usually OK in WebView (no plugin required for basics)

| API / pattern | Where / notes |
|---------------|----------------|
| `fetch`, `Request`, `AbortController`, `Headers` | Throughout |
| `URL`, `URLSearchParams`, `URL.createObjectURL` / `revokeObjectURL` | Messaging, scans, exports, downloads |
| `localStorage` / `sessionStorage` | Auth cache, theme, consent, plant cache, PWA ack flags, etc. |
| `document.cookie` (clearing GA cookies) | `CookieConsent.tsx`, `gdprAnalytics.ts` |
| `window.matchMedia` | Theme, breakpoints, `SwipePage` pointer/hover detection |
| `requestAnimationFrame`, `requestIdleCallback` (when available) | `App.tsx`, `PlantSwipe.tsx`, charts, animations |
| `ResizeObserver`, `IntersectionObserver` | Layout, infinite scroll, lazy sections |
| `Intl.*` (e.g. `DateTimeFormat`, timezone) | Blog cards, settings, admin |
| `File` / `<input type="file">` / FormData uploads | Upload flows (server + Supabase) |
| `FileReader` | Admin image workflows |
| React 19 / DOM APIs used normally | — |

### 4.2 Needs Capacitor plugin or native configuration for full parity

| API / feature | Why | Representative usage |
|---------------|-----|------------------------|
| **Push notifications** (Web Push + SW `push` / `showNotification`) | iOS/Android need APNs/FCM and often native bridges; SW push is web-centric | `sw.ts`, `usePushSubscription.ts`, `pushNotifications.ts`, `notifications.ts`, `messaging.ts` |
| **`navigator.geolocation`** | Explicit permission; background rules differ on native | `city-country-selector.tsx` |
| **`navigator.mediaDevices.getUserMedia`** / `enumerateDevices` | Camera/mic permissions and lifecycle differ | `CameraCapture.tsx` |
| **`navigator.share`** | On web optional; on native often want **Share** plugin for files and reliability | `ConversationMediaGallery.tsx`, `PublicProfilePage.tsx`, `PlantInfoPage.tsx`, `BookmarkPage.tsx`, `GardenDashboardPage.tsx` |
| **`navigator.clipboard.writeText`** | May require **Clipboard** plugin or HTTPS / permission quirks in some WebViews | Admin panels, contact page, share fallbacks |
| **`window.open(..., '_blank')`** | Often blocked or opens external browser; may need **Browser** / **App** plugin | Messaging, admin, internal previews |
| **`EventSource` (SSE)** | `/api/broadcast/stream` — must be same-origin or CORS-friendly; WebView cookie/session behavior must match | `BroadcastToast.tsx` |
| **Dynamic manifest** (`/api/manifest.webmanifest`) | Not in static `dist/`; native “add to home” / store metadata uses other mechanisms | `index.html` |
| **`navigator.serviceWorker` + Workbox** | SW registration works on **Android** WebView in many setups; **iOS** WKWebView has limited / no SW in older versions; Capacitor may ship without SW | `ServiceWorkerToast.tsx`, `main.tsx` |
| **`navigator.windowControlsOverlay` (PWA title bar)** | Desktop PWA only | `main.tsx` |

### 4.3 Should be avoided or heavily gated on native

| API / pattern | Risk |
|---------------|------|
| **Fingerprinting-style signals** (WebGL vendor/renderer, `hardwareConcurrency`, canvas probes) | Privacy / App Store scrutiny; may trigger rejection if perceived as tracking | `PlantSwipe.tsx` (diagnostics / fingerprint-style block) |
| **Relying on third-party cookies** for auth | Already problematic on web; worse in embedded WebViews | Mitigate with same-site / storage-based session (Supabase handles most auth storage) |
| **Assuming `window.open` opens an in-app tab** | Breaks UX in WebView | Prefer in-app routes or Capacitor Browser |
| **`navigator.vibrate`** | Harmless if missing; do not assume haptics match native | Messaging / search UI |

---

## 5. PWA-only features and graceful degradation in Capacitor

| Feature | Current behavior | In Capacitor |
|---------|------------------|--------------|
| **Service worker + precache** | Workbox precache, offline fallback page, update toast | Treat as **optional**: gate with `VITE_DISABLE_PWA` or runtime `Capacitor.isNativePlatform()`; offline can move to native networking + optional cache |
| **Web Push (SW)** | Push handled in `sw.ts` | Prefer **Push Notifications** plugin + server-side FCM/APNs |
| **“Install app” / beforeinstallprompt** | Not implemented in codebase | N/A; distribution is store / TestFlight |
| **Manifest shortcuts / screenshots from API** | Manifest served dynamically | Replace with static manifest or skip |
| **Display-mode / standalone detection** | Not used for core logic | Optional for UI tweaks |
| **Offline toast / connectivity checks** | `ServiceWorkerToast` + `/api/health` | Still useful; may double-count with native reachability |
| **theme-color / apple-mobile-web-app meta** | In `index.html` | Partially redundant; status bar via **StatusBar** plugin |

Most **core product flows** (Supabase auth, REST/fetch to API, uploads, React Router) are **not** PWA-exclusive; they degrade as long as the WebView has network and correct API base URL.

---

## 6. Native compatibility matrix

| Area | Web / PWA today | Capacitor / native notes |
|------|-------------------|---------------------------|
| **Auth** | Supabase Auth (`AuthContext.tsx`), tokens in client storage | Works in WebView if redirect URLs and cookie/storage behavior are configured for the app origin. OAuth deep links need **App** + **universal links / app links** configuration. |
| **File uploads** | `File` + `fetch`/Supabase storage | Generally works in WebView; large files / memory: consider **Filesystem** or native picker for very large media if needed. |
| **Notifications** | Permission API + **PushManager** + SW `push` / `notificationclick` | Use **Push Notifications** plugin; reimplement click routing with **App** launch URL / **Local Notifications** for foreground if needed. |
| **Deep links** | Full URL paths to SPA | Map `https://aphylia.app/...` (or app scheme) to WebView initial route; ensure server SPA fallback matches. |
| **Camera** | `getUserMedia` in `CameraCapture.tsx` | Optional **Camera** plugin for permissions, gallery, and consistent UX; keep web path as fallback. |
| **Share sheet** | `navigator.share` + clipboard fallback | **Share** plugin for files and text where Web Share is missing. |
| **Storage** | `localStorage`, `sessionStorage`, Supabase | Usually OK; for quotas or persistence guarantees consider **Preferences** / **Filesystem** for critical flags only. |
| **Offline / SW** | Workbox precache, runtime caches, `offline.html` | **Store WebView:** SW disabled (`VITE_APP_NATIVE_BUILD`); browser PWA keeps SW with version-scoped caches. See `docs/SERVICE_WORKER_CAPACITOR.md`. |

---

## 7. Quick file references

- Build & PWA: `plant-swipe/vite.config.ts`, `plant-swipe/src/sw.ts`
- SW registration UI: `plant-swipe/src/components/pwa/ServiceWorkerToast.tsx`
- Router shell: `plant-swipe/src/App.tsx`
- Push: `plant-swipe/src/hooks/usePushSubscription.ts`, `plant-swipe/src/lib/pushNotifications.ts`

---

*Generated as Phase 1 audit input for Capacitor / native packaging. Update as implementation choices are made.*
