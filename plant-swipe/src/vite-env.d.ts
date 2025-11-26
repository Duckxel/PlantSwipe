/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_PWA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.html?raw" {
  const content: string
  export default content
}
