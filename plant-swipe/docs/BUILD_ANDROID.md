# Building the Android app (Capacitor)

Prerequisites: **JDK 17** (match `android/` Gradle config), **Android SDK**, **`ANDROID_HOME`** or **`ANDROID_SDK_ROOT`** pointing at the SDK root, **Bun**, **Node** (for `npx cap`).

**Push (FCM):** Place **`google-services.json`** from the Firebase console in **`android/app/`** (gitignored) so Gradle applies the Google Services plugin. The server needs **`FCM_LEGACY_SERVER_KEY`** (or equivalent) to deliver to Android tokens stored in **`user_fcm_tokens`**.

## One-time / occasional

1. **Install dependencies**

   ```bash
   cd plant-swipe
   bun install
   ```

2. **Regenerate icons & splashes** (after changing `assets/logo.png` or `assets/logo-dark.png`)

   ```bash
   bun run cap:assets
   ```

   Requires a working **sharp** install for `@capacitor/assets` (on some Linux setups you may need to reinstall sharp in that package’s tree).

3. **`local.properties`** (if Gradle cannot find the SDK)

   Create `android/local.properties` (gitignored):

   ```properties
   sdk.dir=/path/to/Android/Sdk
   ```

## Store-ready pipeline (recommended)

From `plant-swipe/`:

```bash
export SKIP_SITEMAP_GENERATION=1   # optional; avoids DB for sitemap during build
export NATIVE_BUILD_NUMBER=123   # optional; CI monotonic build number

bun run build:cap
```

This runs:

1. **`build:web:native`** — TypeScript + Vite with `VITE_APP_NATIVE_BUILD=1` (no service worker in `dist`).
2. **`sync:cap`** — asserts no production `server.url`, runs `scripts/sync-native-version.mjs`, **`npx cap sync`**.

Then open Android Studio or use Gradle:

```bash
cd android
./gradlew assembleRelease    # APK (configure signing for Play)
# or
./gradlew bundleRelease      # AAB for Play Console (if configured in project)
```

**Signing:** Keystores and passwords must **not** be committed. Use Play App Signing and CI secrets, or local `~/.gradle` / env-injected signing config per your org.

## Debug builds

```bash
bun run build:android:debug
```

Equivalent to `build:cap` + `./gradlew assembleDebug`.

## npm/bun scripts reference

| Script | Purpose |
|--------|---------|
| `build:cap` | `build:web:native` + `sync:cap` |
| `build:android` | `build:android:release` |
| `build:android:release` | `build:cap` + `assembleRelease` |
| `build:android:debug` | `build:cap` + `assembleDebug` |
| `open:android` | `npx cap open android` |
| `cap:ci:sync` | CI-safe: assert bundle + sync version + `cap sync` (expects `dist` already built) |

## Application ID

The Android **`applicationId`** / namespace is **`app.aphylia`** (reverse-DNS for **aphylia.app**). Changing it requires updating **Play Console**, **Digital Asset Links** (`assetlinks.json`), and any OAuth/deeplink allowlists.

## Troubleshooting

- **SDK location not found** — Set `ANDROID_HOME` or `sdk.dir` in `local.properties`.
- **Cap sync copies old UI** — Run `bun run build:cap` so `dist/` is fresh before sync.
- **Stale WebView cache after upgrade** — Native builds omit the PWA service worker; if users hit chunk errors after sideloading dev builds, the in-app recovery UI can clear caches (see `SERVICE_WORKER_CAPACITOR.md`).
