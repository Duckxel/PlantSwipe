/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_PWA?: string
  /** Set to "1" for Capacitor store builds (no service worker in bundle). */
  readonly VITE_APP_NATIVE_BUILD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.html?raw" {
  const content: string
  export default content
}
