/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_PWA?: string
  /** Set to "1" for Capacitor store builds (no service worker in bundle). */
  readonly VITE_APP_NATIVE_BUILD?: string
  /** Absolute HTTPS API origin used by bundled native builds for `/api/*` requests. */
  readonly VITE_API_ORIGIN?: string
  /** Canonical public site URL. */
  readonly VITE_SITE_URL?: string
  /** Override for the Aphydle (sister daily plant guessing game) origin. */
  readonly VITE_APHYDLE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.html?raw" {
  const content: string
  export default content
}
