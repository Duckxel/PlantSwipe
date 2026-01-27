/**
 * Google reCAPTCHA Enterprise v3 helper - GDPR Compliant
 * 
 * reCAPTCHA is loaded dynamically after user consent.
 * This utility provides a typed interface for executing reCAPTCHA
 * with graceful fallbacks when consent hasn't been given.
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
    __loadRecaptcha?: () => Promise<void>
    __recaptchaLoaded?: boolean
  }
}

/**
 * Check if the user has given consent for reCAPTCHA (any consent except rejected)
 */
function hasRecaptchaConsent(): boolean {
  try {
    const stored = localStorage.getItem('cookie_consent')
    if (!stored) return false
    const consent = JSON.parse(stored)
    return consent.level !== 'rejected'
  } catch {
    return false
  }
}

/**
 * Ensure reCAPTCHA is loaded (will load if consent given and not yet loaded)
 */
async function ensureRecaptchaLoaded(): Promise<boolean> {
  // If already loaded, we're good
  if (window.grecaptcha?.enterprise) {
    return true
  }
  
  // Check consent
  if (!hasRecaptchaConsent()) {
    console.log('[reCAPTCHA] Skipping - user has not given consent or rejected cookies')
    return false
  }
  
  // Try to load reCAPTCHA
  if (window.__loadRecaptcha) {
    try {
      await window.__loadRecaptcha()
      // Wait a bit for grecaptcha to initialize
      await new Promise(resolve => setTimeout(resolve, 500))
      return !!window.grecaptcha?.enterprise
    } catch (error) {
      console.warn('[reCAPTCHA] Failed to load:', error)
      return false
    }
  }
  
  return false
}

/**
 * Execute reCAPTCHA v3 Enterprise and return the token
 * Returns null if reCAPTCHA is not available (no consent or failed to load)
 * 
 * @param action - The action name (e.g., 'login', 'signup')
 * @returns Promise<string | null> - The reCAPTCHA token or null if unavailable
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
  // Ensure reCAPTCHA is loaded
  const isLoaded = await ensureRecaptchaLoaded()
  
  if (!isLoaded || !window.grecaptcha?.enterprise) {
    console.log('[reCAPTCHA] Not available - proceeding without token')
    return null
  }
  
  return new Promise((resolve, reject) => {
    window.grecaptcha!.enterprise.ready(async () => {
      try {
        const token = await window.grecaptcha!.enterprise.execute(RECAPTCHA_SITE_KEY, { action })
        resolve(token)
      } catch (error) {
        console.warn('[reCAPTCHA] Failed to execute:', error)
        // Return null instead of rejecting - allow forms to work without reCAPTCHA
        resolve(null)
      }
    })
  })
}

/**
 * Execute reCAPTCHA and throw if not available
 * Use this for high-security operations where reCAPTCHA is required
 * 
 * @param action - The action name (e.g., 'login', 'signup')
 * @returns Promise<string> - The reCAPTCHA token
 * @throws Error if reCAPTCHA is not available
 */
export async function executeRecaptchaRequired(action: string): Promise<string> {
  const token = await executeRecaptcha(action)
  
  if (!token) {
    throw new Error('reCAPTCHA verification is required. Please accept cookies to continue.')
  }
  
  return token
}

/**
 * Check if reCAPTCHA is available (loaded and consent given)
 */
export function isRecaptchaReady(): boolean {
  return typeof window !== 'undefined' && !!window.grecaptcha?.enterprise
}

/**
 * Check if reCAPTCHA consent has been given
 */
export function hasRecaptchaConsentGiven(): boolean {
  return hasRecaptchaConsent()
}
