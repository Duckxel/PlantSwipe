/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_PWA?: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.html?raw" {
  const content: string
  export default content
}

// reCAPTCHA v3 type declarations
interface ReCaptchaV3 {
  ready(callback: () => void): void
  execute(siteKey: string, options: { action: string }): Promise<string>
}

declare global {
  interface Window {
    grecaptcha?: ReCaptchaV3
    __ENV__?: {
      VITE_RECAPTCHA_SITE_KEY?: string
      [key: string]: string | undefined
    }
  }
}

export {}
