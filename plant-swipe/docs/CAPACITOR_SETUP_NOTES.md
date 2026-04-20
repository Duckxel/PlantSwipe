# Capacitor setup notes (`setup.sh` and local dev)

How the **optional Capacitor pipeline** in the repo root **`setup.sh`** works, and how it differs by OS.

## Enabling the pipeline

The mobile block runs only when **`SETUP_CAPACITOR`** is truthy (`1`, `yes`, `true`, `on`, `y`). Deprecated alias: **`CAPACITOR_SYNC`** (same truthy check).

```bash
sudo SETUP_CAPACITOR=1 ./setup.sh
```

If unset or false, the script sets the Capacitor report lines to **“skipped (SETUP_CAPACITOR not enabled)”** and does **not** run `cap add` / `cap sync`.

## What runs when `SETUP_CAPACITOR=1` (both Linux and macOS)

Order is fixed in `setup.sh`:

1. **`setup_verify_web_build_toolchain`** — Bun executable, **Node**, **npx** on PATH (fails fast if missing).
2. **`bun install`** in `plant-swipe/` (`NODE_DIR`).
3. **`install_capacitor_npm_packages_if_missing`** — If core Capacitor deps are absent from `package.json`, runs `bun add` for `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/status-bar` and dev **`@capacitor/cli`**; then **`bun install`** again.
4. **`ensure_capacitor_config`** — Writes default **`capacitor.config.json`** only if missing (`appId` **app.aphylia**, `webDir` **dist**, basic `ios` keys).
5. **Android SDK** — **`setup_assert_android_sdk`** **always** runs on both OSes: requires **`ANDROID_HOME`** or **`ANDROID_SDK_ROOT`**, or falls back to **`$HOME/Android/Sdk`** or the service user’s home. Must contain `platform-tools`, `cmdline-tools`, or `build-tools`. **Fails with a clear error** if not found.
6. **Xcode** — See **macOS vs Linux** below.
7. **`setup_run_capacitor_production_build`** — Runs **`bun run build`** with:
   - `NODE_OPTIONS=--max-old-space-size=$NODE_BUILD_MEMORY` (default **1536**),
   - `SKIP_SITEMAP_GENERATION` defaulting to **`1`** if unset,
   - `VITE_APP_BASE_PATH=$PWA_BASE_PATH`,
   - **`VITE_APP_NATIVE_BUILD=1`**,
   - `CI=${CI:-true}`.
8. **`npx cap add android`** if **`android/`** is missing.
9. **`npx cap add ios`** — **macOS only** if **`ios/`** is missing; skipped on Linux with a log line.
10. **Ownership** — If **`SERVICE_USER`** is set and not `root`, **`chown -R`** on `android/` and `ios/` to that user.
11. **`node scripts/assert-capacitor-store-bundle.mjs && node scripts/sync-native-version.mjs && npx cap sync && node scripts/normalize-capacitor-generated-files.mjs`** with `ANDROID_HOME`/`ANDROID_SDK_ROOT` exported to the resolved SDK.

After this block, if the Capacitor pipeline ran, the main PlantSwipe web build later in `setup.sh` is **skipped** (“already built during Capacitor pipeline”).

## Linux vs macOS — exact differences

| Step | **Linux** | **macOS (Darwin)** |
|------|-----------|---------------------|
| Xcode / `xcodebuild` | **Not** required; log: *“iOS native project steps will be skipped (requires macOS / Xcode)”* | **`setup_assert_xcode_for_ios`** runs: `xcodebuild` in PATH, runs successfully, **`xcode-select -p`** returns active developer dir. **Exits with error** if any check fails. |
| **`npx cap add ios`** | **Skipped** if `ios/` missing; report: *“skipped (Linux host — use a macOS runner for npx cap add ios)”* | **Runs** if `ios/` is missing |
| **`npx cap add android`** | Same as macOS | Same |
| Android SDK | **Required** on both | **Required** on both |

**Important:** On Linux, **`SETUP_CAPACITOR=1` still requires the Android SDK** even though iOS is skipped. There is no mode that runs only iOS from `setup.sh` on Linux.

## Post-setup report

When the pipeline runs, `setup.sh` appends a **Capacitor / mobile pipeline report** summarizing:

- Web build status (`CAP_REPORT_WEB`)
- Android project status (`CAP_REPORT_ANDROID`)
- iOS project status (`CAP_REPORT_IOS`)
- Sync status (`CAP_REPORT_SYNC`)

## Local development without `setup.sh`

Developers typically:

```bash
cd plant-swipe
bun install
bun run build:cap    # or build:web + sync:cap
bun run open:android
bun run open:ios     # macOS only
```

See **`docs/BUILD_ANDROID.md`** and **`docs/BUILD_IOS.md`**.

## CI

GitHub Actions **`.github/workflows/capacitor-mobile.yml`** uses **`bun run cap:ci:sync`** after a web build, with **`NATIVE_BUILD_NUMBER`**. It does not invoke the full server **`setup.sh`** Capacitor block unless your infra does so explicitly.

## Related

- `docs/MOBILE_ARCHITECTURE.md` — PWA-first layout and hot-update rules
- `AGENTS.md` (repo root) — Cursor/cloud overview of ports and env files
