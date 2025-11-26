/**
 * reCAPTCHA v3 utility functions
 */

let scriptLoaded = false
let scriptLoading = false
let loadPromise: Promise<boolean> | null = null

/**
 * Get the reCAPTCHA site key from environment
 */
export function getRecaptchaSiteKey(): string | undefined {
  return (
    import.meta.env?.VITE_RECAPTCHA_SITE_KEY ??
    (globalThis as unknown as Window).__ENV__?.VITE_RECAPTCHA_SITE_KEY
  )
}

/**
 * Load the reCAPTCHA v3 script dynamically
 */
function loadRecaptchaScript(): Promise<boolean> {
  if (scriptLoaded && window.grecaptcha) {
    return Promise.resolve(true)
  }
  
  if (loadPromise) {
    return loadPromise
  }
  
  const siteKey = getRecaptchaSiteKey()
  if (!siteKey) {
    console.warn('[recaptcha] Site key not configured, skipping script load')
    return Promise.resolve(false)
  }
  
  if (scriptLoading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (scriptLoaded || window.grecaptcha) {
          clearInterval(checkInterval)
          resolve(true)
        }
      }, 100)
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(false)
      }, 10000)
    })
  }
  
  scriptLoading = true
  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.async = true
    script.defer = true
    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      console.log('[recaptcha] Script loaded successfully')
      resolve(true)
    }
    script.onerror = () => {
      scriptLoading = false
      console.error('[recaptcha] Failed to load script')
      resolve(false)
    }
    document.head.appendChild(script)
  })
  
  return loadPromise
}

/**
 * Check if reCAPTCHA is available and configured
 */
export function isRecaptchaEnabled(): boolean {
  return !!getRecaptchaSiteKey()
}

/**
 * Execute reCAPTCHA v3 and get a token for verification
 * @param action - The action name to associate with this request (e.g., 'login', 'signup')
 * @returns Promise that resolves with the reCAPTCHA token, or null if not available
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
  const siteKey = getRecaptchaSiteKey()
  
  if (!siteKey) {
    console.warn('[recaptcha] Site key not configured')
    return null
  }

  // Ensure script is loaded
  const loaded = await loadRecaptchaScript()
  if (!loaded || !window.grecaptcha) {
    console.warn('[recaptcha] grecaptcha not available after load attempt')
    return null
  }

  return new Promise((resolve) => {
    window.grecaptcha!.ready(async () => {
      try {
        const token = await window.grecaptcha!.execute(siteKey, { action })
        console.log('[recaptcha] Token obtained for action:', action)
        resolve(token)
      } catch (error) {
        console.error('[recaptcha] Failed to execute:', error)
        resolve(null)
      }
    })
  })
}
