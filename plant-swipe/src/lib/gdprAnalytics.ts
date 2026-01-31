/**
 * GDPR-Compliant Google Analytics Helper
 * 
 * This module provides analytics functions that only work when the user
 * has given explicit consent for analytics cookies.
 */

// GA Measurement ID
const GA_MEASUREMENT_ID = 'G-LDSYW5QNK5'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
    __loadGoogleAnalytics?: () => void
    __gaLoaded?: boolean
  }
}

/**
 * Check if user has given consent for analytics
 */
export function hasAnalyticsConsent(): boolean {
  try {
    const stored = localStorage.getItem('cookie_consent')
    if (!stored) return false
    const consent = JSON.parse(stored)
    return consent.level === 'analytics' || consent.level === 'all'
  } catch {
    return false
  }
}

/**
 * Check if Google Analytics is loaded and ready
 */
export function isAnalyticsReady(): boolean {
  return typeof window !== 'undefined' && !!window.gtag && window.__gaLoaded === true
}

/**
 * Initialize Google Analytics (called after consent)
 */
export function initializeAnalytics(): void {
  if (typeof window === 'undefined') return
  
  if (!hasAnalyticsConsent()) {
    console.log('[Analytics] User has not given consent - skipping initialization')
    return
  }
  
  if (window.__loadGoogleAnalytics) {
    window.__loadGoogleAnalytics()
  }
}

/**
 * Track a page view
 * Only sends if analytics consent is given
 */
export function trackPageView(path: string, title?: string): void {
  if (!hasAnalyticsConsent() || !isAnalyticsReady()) {
    return
  }
  
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  })
}

/**
 * Track a custom event
 * Only sends if analytics consent is given
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
): void {
  if (!hasAnalyticsConsent() || !isAnalyticsReady()) {
    return
  }
  
  window.gtag?.('event', eventName, eventParams)
}

/**
 * Track a user action (more semantic wrapper around trackEvent)
 */
export function trackAction(
  category: string,
  action: string,
  label?: string,
  value?: number
): void {
  trackEvent(action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}

/**
 * Set user properties (for logged-in users)
 * Note: Only set non-PII data
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!hasAnalyticsConsent() || !isAnalyticsReady()) {
    return
  }
  
  window.gtag?.('set', 'user_properties', properties)
}

/**
 * Set the user ID for cross-device tracking
 * Note: Should be a hashed/anonymized ID, not email or personal data
 */
export function setUserId(userId: string | null): void {
  if (!hasAnalyticsConsent() || !isAnalyticsReady()) {
    return
  }
  
  if (userId) {
    window.gtag?.('config', GA_MEASUREMENT_ID, {
      user_id: userId,
    })
  }
}

/**
 * Disable analytics tracking
 * Call this when user withdraws consent
 */
export function disableAnalytics(): void {
  if (typeof window === 'undefined') return
  
  // Set the opt-out flag
  const optOutProperty = `ga-disable-${GA_MEASUREMENT_ID}`
  ;(window as any)[optOutProperty] = true
  
  // Clear GA cookies
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name] = cookie.trim().split('=')
    if (name.startsWith('_ga') || name.startsWith('_gid') || name.startsWith('_gat')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`
    }
  }
  
  console.log('[Analytics] Analytics disabled and cookies cleared')
}

/**
 * Re-enable analytics tracking
 * Call this when user gives consent
 */
export function enableAnalytics(): void {
  if (typeof window === 'undefined') return
  
  // Remove the opt-out flag
  const optOutProperty = `ga-disable-${GA_MEASUREMENT_ID}`
  ;(window as any)[optOutProperty] = false
  
  // Initialize analytics
  initializeAnalytics()
}

// Common event tracking helpers
export const Analytics = {
  // User events
  userSignUp: () => trackEvent('sign_up', { method: 'email' }),
  userLogin: () => trackEvent('login', { method: 'email' }),
  userLogout: () => trackEvent('logout'),
  
  // Plant events
  plantView: (plantId: string, plantName: string) => 
    trackEvent('view_item', { 
      item_id: plantId, 
      item_name: plantName,
      item_category: 'plant'
    }),
  plantBookmark: (plantId: string) => 
    trackEvent('add_to_wishlist', { item_id: plantId }),
  plantSearch: (query: string, resultsCount: number) => 
    trackEvent('search', { search_term: query, results_count: resultsCount }),
  
  // Garden events
  gardenCreate: () => trackEvent('garden_create'),
  gardenPlantAdd: (gardenId: string) => 
    trackEvent('garden_plant_add', { garden_id: gardenId }),
  
  // Engagement events
  share: (contentType: string, itemId: string) => 
    trackEvent('share', { content_type: contentType, item_id: itemId }),
  featureUse: (featureName: string) => 
    trackEvent('feature_use', { feature_name: featureName }),
  
  // E-commerce events (for future premium features)
  viewPricing: () => trackEvent('view_item_list', { item_list_name: 'pricing' }),
  beginCheckout: (planName: string, price: number) => 
    trackEvent('begin_checkout', { 
      currency: 'EUR', 
      value: price,
      items: [{ item_name: planName }]
    }),
}
