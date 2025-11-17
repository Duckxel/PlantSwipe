/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_PWA?: string
  readonly VITE_SITE_NAME?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_SOCIAL_IMAGE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
