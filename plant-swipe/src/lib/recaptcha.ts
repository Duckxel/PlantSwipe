/**
 * Google reCAPTCHA Enterprise v3 helper
 * 
 * Site key is loaded in index.html via script tag.
 * This utility provides a typed interface for executing reCAPTCHA.
 */

// reCAPTCHA Enterprise site key
const RECAPTCHA_SITE_KEY = '6Leg5BgsAAAAAEh94kkCnfgS9vV-Na4Arws3yUtd'

// Define the grecaptcha.enterprise types
declare global {
  interface Window {
    grecaptcha?: {
      enterprise: {
        ready: (callback: () => void) => void
        execute: (siteKey: string, options: { action: string }) => Promise<string>
      }
    }
  }
}

/**
 * Execute reCAPTCHA v3 Enterprise and return the token
 * @param action - The action name (e.g., 'login', 'signup')
 * @returns Promise<string> - The reCAPTCHA token
 */
export async function executeRecaptcha(action: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.grecaptcha?.enterprise) {
      reject(new Error('reCAPTCHA not loaded'))
      return
    }

    window.grecaptcha.enterprise.ready(async () => {
      try {
        const token = await window.grecaptcha!.enterprise.execute(RECAPTCHA_SITE_KEY, { action })
        resolve(token)
      } catch (error) {
        reject(error)
      }
    })
  })
}

/**
 * Check if reCAPTCHA is available
 */
export function isRecaptchaReady(): boolean {
  return typeof window !== 'undefined' && !!window.grecaptcha?.enterprise
}
