# Live updates, hot reload, and store compliance (internal policy)

This document defines how Aphylia treats **over-the-air (OTA) web updates**, **remote `server.url`**, and **App Store / Play policy** for the Capacitor shell. It is **not** legal advice; engineering and release owners must align with Apple/Google guidelines and counsel when in doubt.

## Baseline: production = bundled web assets

- **Store and production Capacitor builds** load the **reviewed** PWA output from **`webDir`** (copied into the native project at `cap sync` / build time). They **must not** use Capacitor **`server.url`** to point the WebView at a remote site for end users.
- This repo uses **`capacitor.config.json`** (not `.ts`) so the Capacitor CLI loads config cleanly alongside **`package.json` `"type": "module"`**. The **`version`** field is kept in sync with **`package.json`** by `scripts/sync-native-version.mjs` before each `cap sync`.
- Capacitor documents remote URLs as useful for **development**; that mode is **not** the shipping configuration for app store releases.
- **Content, copy, feature flags, and API-driven behavior** continue to come from **your backend and remote config**, not from replacing the entire shipped bundle via an unreviewed URL.

## Apple guideline 2.5.2 (interpretation for this project)

Apple restricts apps from **downloading and executing code** that **changes features or functionality** in ways that circumvent review. Capacitor’s own deployment docs note that real-time web updates *can* be compatible with stores when done carefully; **we still treat OTA updates as a controlled, policy-bound tool**, not a way to ship arbitrary new product behavior without review.

## What is safe to hot-update (with controls)

Allowed categories **only if** they do not introduce new native capabilities, payment flows, or materially new user journeys without review:

| Category | Examples | Notes |
|----------|-----------|--------|
| **Static content** | CMS text, images, legal copy versions served as data | Render through existing components only. |
| **Remote config / flags** | Kill switches, gradual rollouts, A/B labels | Server returns data; app already contains code paths. Turning a flag **on** must not enable a **new** untested major flow without policy below. |
| **API-driven UI state** | Lists, badges, recommendations driven by API | Same screens and navigation; data changes only. |
| **Bugfix-style web patches** | Narrow fixes inside existing flows | Must be documented and rollback-ready. |

## What requires a new store submission

- New **native** plugins or permissions (camera, health, payments, etc.).
- New **screens or primary flows** not present at review (e.g. entirely new checkout, new account type, new regulated feature).
- Changes that **materially alter** what the app does for compliance (privacy, age, region rules).
- Anything your App Store / Play questionnaire would treat as a **new feature** rather than data or copy.

When in doubt: **ship a store build**.

## Live update / OTA policy (if adopted later)

1. **Scope** — OTA may update **only** assets explicitly classified as “safe” above; no wholesale replacement of the binary’s web layer for **feature** changes without review.
2. **Manual approval** — A **human release owner** must approve any OTA change that affects **user-visible flows** (copy/layout that changes meaning, enabling a new path, changing conversion-critical UX). Automated pipelines may not skip this step.
3. **Rollback** — Every OTA release must have a **documented rollback** (previous bundle version, feature flag off, or revert endpoint) executable **without** a new app store submission where possible.
4. **Audit trail** — Keep who approved, what changed, and which build identifiers were targeted.
5. **No `server.url` for production users** — Remote loading of the **main** app shell from arbitrary URLs remains **out of scope** for store production; OTA, if used, must follow vendor-safe patterns (e.g. bounded asset updates), not “load the whole app from the internet.”

## Related repo mechanics

- **`scripts/assert-capacitor-store-bundle.mjs`** — fails `build:cap` / `sync:cap` if `server.url` appears in Capacitor config (override only with `CAPACITOR_ALLOW_REMOTE_WEB=1` for local dev).
- **Feature detection** — Use `src/platform/` and API/config data so web and native share one codebase without forking UI for store compliance.

---

*Last updated: engineering policy for Capacitor / store releases.*
