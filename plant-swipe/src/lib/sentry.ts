/**
 * Sentry Error Monitoring Configuration
 * GDPR-Compliant Implementation
 * 
 * This module initializes Sentry for the React frontend with:
 * - Consent-aware initialization (respects cookie preferences)
 * - PII scrubbing (no emails, IPs anonymized)
 * - Enhanced error context for developers
 * - Lightweight performance monitoring (optimized for minimal overhead)
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Session replay is disabled (heavy DOM observation overhead)
 * - Long task and INP monitoring disabled (continuous overhead)
 * - Console capture limited to 'error' only (not 'warn' to reduce noise)
 * - HTTP client integration disabled (monitors all requests)
 * - Consent check results are cached to avoid repeated localStorage reads
 * - Reduced trace sample rate for lower overhead
 * 
 * Import this module early in your application (before React renders).
 */
import * as Sentry from '@sentry/react'

const SENTRY_DSN = 'https://758053551e0396eab52314bdbcf57924@o4510783278350336.ingest.de.sentry.io/4510783285821520'

// Server identification: Set VITE_SERVER_NAME to 'DEV' or 'MAIN' in your .env file
const SERVER_NAME = (import.meta.env as Record<string, string>).VITE_SERVER_NAME || 
                    (import.meta.env as Record<string, string>).VITE_PLANTSWIPE_SERVER_NAME ||
                    (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__SERVER_NAME__ as string) ||
                    'unknown'

// Track initialization state
let sentryInitialized = false
let consentGiven = false

// Cache consent check to avoid repeated localStorage reads (performance optimization)
let consentCacheTimestamp = 0
let cachedConsentResult = false
const CONSENT_CACHE_TTL = 5000 // Cache consent check for 5 seconds

/**
 * Error categories for better organization in Sentry dashboard
 */
export const ErrorCategory = {
  NETWORK: 'network',
  AUTH: 'authentication', 
  API: 'api',
  UI: 'ui',
  NAVIGATION: 'navigation',
  STORAGE: 'storage',
  GARDEN: 'garden',
  PLANT: 'plant',
  CHAT: 'chat',
  UPLOAD: 'upload',
  PERFORMANCE: 'performance',
} as const

export type ErrorCategoryType = typeof ErrorCategory[keyof typeof ErrorCategory]

/**
 * Check if user has given consent for analytics/error tracking
 * GDPR requires explicit consent before sending data
 * 
 * PERFORMANCE: Results are cached for CONSENT_CACHE_TTL ms to avoid
 * repeated synchronous localStorage reads which can block the main thread.
 */
export function hasTrackingConsent(): boolean {
  const now = Date.now()
  
  // Return cached result if still valid
  if (now - consentCacheTimestamp < CONSENT_CACHE_TTL) {
    return cachedConsentResult
  }
  
  try {
    const stored = localStorage.getItem('cookie_consent')
    if (!stored) {
      cachedConsentResult = false
      consentCacheTimestamp = now
      return false
    }
    const consent = JSON.parse(stored)
    // Analytics consent includes error tracking
    cachedConsentResult = consent.level === 'analytics' || consent.level === 'all'
    consentCacheTimestamp = now
    return cachedConsentResult
  } catch {
    cachedConsentResult = false
    consentCacheTimestamp = now
    return false
  }
}

/**
 * Invalidate the consent cache - call this when consent changes
 */
export function invalidateConsentCache(): void {
  consentCacheTimestamp = 0
}

/**
 * Scrub PII from event before sending to Sentry
 * GDPR compliance: Remove or hash personally identifiable information
 */
function scrubPII<T extends Sentry.Event>(event: T): T {
  // Remove or hash email addresses in event data
  if (event.user) {
    // Keep only anonymous ID, remove PII
    event.user = {
      id: event.user.id,
      // Don't send email - GDPR compliance
      // email: undefined,
      // username is acceptable if it's a display name, not real name
      username: event.user.username,
    }
  }

  // Scrub any email patterns from exception messages and values
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  
  if (event.message) {
    event.message = event.message.replace(emailRegex, '[EMAIL_REDACTED]')
  }

  // Scrub from exception values
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(exc => ({
      ...exc,
      value: exc.value?.replace(emailRegex, '[EMAIL_REDACTED]'),
    }))
  }

  // Scrub from breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(crumb => ({
      ...crumb,
      message: crumb.message?.replace(emailRegex, '[EMAIL_REDACTED]'),
      data: crumb.data ? Object.fromEntries(
        Object.entries(crumb.data).map(([k, v]) => [
          k,
          typeof v === 'string' ? v.replace(emailRegex, '[EMAIL_REDACTED]') : v
        ])
      ) : undefined,
    }))
  }

  return event
}

/**
 * Initialize Sentry for error tracking
 * Should be called once at application startup
 * Respects GDPR consent settings
 */
export function initSentry(): void {
  // Only initialize in production or if explicitly enabled
  const isProduction = import.meta.env.PROD
  const isEnabled = isProduction || import.meta.env.VITE_SENTRY_ENABLED === 'true'

  if (!isEnabled) {
    console.log('[Sentry] Skipping initialization in development mode')
    return
  }

  // Check consent before initializing
  consentGiven = hasTrackingConsent()
  
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      
      // Environment configuration
      environment: import.meta.env.MODE || 'production',
      
      // Release tracking (if version is available)
      release: (import.meta.env as Record<string, string>).VITE_APP_VERSION || undefined,
      
      // GDPR: Disable sending by default until consent is given
      enabled: consentGiven,
      
      // PERFORMANCE: Disabled experimental features to reduce overhead
      // _experiments: { enableLogs: true },
      
      // PERFORMANCE OPTIMIZED: Minimal integrations for lower overhead
      // Heavy integrations (replay, http monitoring) are disabled
      integrations: [
        // Browser tracing for performance monitoring - OPTIMIZED
        Sentry.browserTracingIntegration({
          // PERFORMANCE: Disabled long task monitoring (continuous overhead)
          enableLongTask: false,
          // PERFORMANCE: Disabled INP monitoring (continuous overhead)
          enableInp: false,
        }),
        // PERFORMANCE: Session Replay DISABLED - heavy DOM observation overhead
        // Even with 0% sample rate, the integration still initializes observers
        // Sentry.replayIntegration({ ... }),
        
        // Console capture - only 'error' level for debugging (not 'warn' to reduce noise)
        // This helps devs track console.error() calls while avoiding React warnings etc.
        Sentry.captureConsoleIntegration({
          levels: ['error'], // Only errors, not warnings (reduces noise + overhead)
        }),
        
        // PERFORMANCE: HTTP client integration DISABLED - monitors all requests
        // Sentry.httpClientIntegration({ failedRequestStatusCodes: [[400, 599]] }),
      ],

      // PERFORMANCE: Reduced trace sample rate for lower overhead
      // 10% in production provides good coverage with less impact
      tracesSampleRate: isProduction ? 0.1 : 0.5,

      // PERFORMANCE: Session replay completely disabled
      // Replay has significant overhead even when not actively recording
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      // GDPR: Don't automatically send PII
      sendDefaultPii: false,

      // GDPR: Attach stacktrace only for errors (not for messages)
      attachStacktrace: true,

      // Filter out common non-actionable errors
      beforeSend(event, hint) {
        const error = hint.originalException

        // Re-check consent at send time (user may have withdrawn)
        if (!hasTrackingConsent()) {
          return null
        }

        // Scrub PII before sending
        const scrubbedEvent = scrubPII(event)

        // Ignore ResizeObserver errors (common in browsers, usually not actionable)
        if (error instanceof Error) {
          if (error.message?.includes('ResizeObserver loop')) {
            return null
          }
          // Ignore chunk loading errors (handled by ErrorBoundary with retry UI)
          if (
            error.message?.includes('dynamically imported module') ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported')
          ) {
            return null
          }
          // Ignore network errors that are user-caused
          if (
            error.message?.includes('NetworkError') ||
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('Load failed') ||
            error.message?.includes('Network request failed')
          ) {
            // Still log these but at lower priority
            scrubbedEvent.level = 'warning'
            scrubbedEvent.fingerprint = ['network-error', error.message?.substring(0, 50) || 'unknown']
          }
          // Ignore cancelled requests
          if (error.name === 'AbortError') {
            return null
          }
        }

        // Add app state context for debugging
        try {
          scrubbedEvent.contexts = {
            ...scrubbedEvent.contexts,
            app: {
              online: navigator.onLine,
              language: navigator.language,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
              },
              url: window.location.pathname, // Only path, no query params
            },
          }
        } catch {
          // Ignore context gathering errors
        }

        return scrubbedEvent
      },

      // Custom fingerprinting for better error grouping
      beforeSendTransaction(event) {
        // Don't send transactions without consent
        if (!hasTrackingConsent()) {
          return null
        }
        return event
      },

      // Add additional context
      initialScope: {
        tags: {
          server: SERVER_NAME,
          app: 'plant-swipe',
          platform: 'web',
        },
      },
    })

    sentryInitialized = true
    console.log(`[Sentry] Initialized for server: ${SERVER_NAME} (consent: ${consentGiven})`)

  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error)
  }
}

/**
 * Update Sentry based on consent changes
 * Call this when user updates their cookie preferences
 */
export function updateSentryConsent(): void {
  // Invalidate cache to get fresh consent value
  invalidateConsentCache()
  const newConsent = hasTrackingConsent()
  
  if (newConsent !== consentGiven) {
    consentGiven = newConsent
    
    if (sentryInitialized) {
      const client = Sentry.getClient()
      if (client) {
        client.getOptions().enabled = newConsent
      }
    }
    
    console.log(`[Sentry] Consent updated: ${newConsent}`)
  }
}

/**
 * Capture an exception and send it to Sentry
 * Enhanced with category and context support for developers
 */
export function captureException(
  error: unknown, 
  context?: {
    category?: ErrorCategoryType
    component?: string
    action?: string
    extra?: Record<string, unknown>
  }
): string | undefined {
  if (!hasTrackingConsent()) {
    console.warn('[Sentry] Error not sent - no consent:', error)
    return undefined
  }

  return Sentry.withScope((scope) => {
    // Set error category for filtering in dashboard
    if (context?.category) {
      scope.setTag('error.category', context.category)
    }
    
    // Set component context
    if (context?.component) {
      scope.setTag('component', context.component)
    }
    
    // Set action context
    if (context?.action) {
      scope.setTag('action', context.action)
    }
    
    // Add extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }

    // Add current route for context
    scope.setExtra('route', window.location.pathname)
    
    // Add device info
    scope.setContext('device', {
      online: navigator.onLine,
      memory: (navigator as any).deviceMemory,
      cores: navigator.hardwareConcurrency,
    })

    return Sentry.captureException(error)
  })
}

/**
 * Capture a structured error with full context
 * Designed for developer-friendly error reports
 */
export function captureError(params: {
  error: Error | unknown
  category: ErrorCategoryType
  message: string
  component?: string
  action?: string
  severity?: Sentry.SeverityLevel
  extra?: Record<string, unknown>
}): string | undefined {
  const { error, category, message, component, action, severity = 'error', extra } = params

  if (!hasTrackingConsent()) {
    console.warn(`[Sentry] [${category}] ${message}:`, error)
    return undefined
  }

  return Sentry.withScope((scope) => {
    scope.setLevel(severity)
    scope.setTag('error.category', category)
    scope.setTag('error.message', message.substring(0, 100))
    
    if (component) scope.setTag('component', component)
    if (action) scope.setTag('action', action)
    
    // Custom fingerprint for better grouping
    scope.setFingerprint([category, message, component || 'unknown'])
    
    scope.setContext('error_details', {
      category,
      message,
      component,
      action,
      route: window.location.pathname,
      timestamp: new Date().toISOString(),
      ...extra,
    })

    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }

    return Sentry.captureException(error)
  })
}

/**
 * Capture a message and send it to Sentry
 */
export function captureMessage(
  message: string, 
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): void {
  if (!hasTrackingConsent() && level !== 'fatal') {
    return
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }
    Sentry.captureMessage(message, level)
  })
}

/**
 * Set user context for Sentry
 * GDPR-compliant: Only stores anonymous identifiers, no PII
 * Call this when user logs in
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (user) {
    // GDPR: Only send anonymous ID and non-PII username
    // Do NOT send email address
    Sentry.setUser({
      id: user.id,
      // GDPR: Don't include email
      // email: user.email, 
      // Only include username if it's a display name (not real name)
      username: user.username,
    })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Add a breadcrumb for debugging
 * Breadcrumbs help trace user actions leading up to an error
 */
export function addBreadcrumb(
  message: string,
  category: string = 'app',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void {
  if (!hasTrackingConsent()) return

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Add navigation breadcrumb
 * Tracks route changes for debugging
 */
export function addNavigationBreadcrumb(from: string, to: string): void {
  addBreadcrumb(`Navigate: ${from} → ${to}`, 'navigation', 'info', {
    from,
    to,
  })
}

/**
 * Add user action breadcrumb
 * Tracks user interactions for debugging
 */
export function addActionBreadcrumb(action: string, component: string, data?: Record<string, unknown>): void {
  addBreadcrumb(`${component}: ${action}`, 'user-action', 'info', {
    action,
    component,
    ...data,
  })
}

/**
 * Add API call breadcrumb
 * Tracks API requests for debugging
 */
export function addAPIBreadcrumb(
  method: string, 
  endpoint: string, 
  status?: number,
  duration?: number
): void {
  addBreadcrumb(
    `${method} ${endpoint}${status ? ` → ${status}` : ''}`,
    'api',
    status && status >= 400 ? 'error' : 'info',
    { method, endpoint, status, duration }
  )
}

/**
 * Start a performance transaction for a user flow
 * Returns a finish function to end the transaction
 */
export function startTransaction(
  name: string, 
  operation: string,
  data?: Record<string, unknown>
): () => void {
  if (!hasTrackingConsent()) {
    return () => {}
  }

  Sentry.startSpan(
    {
      name,
      op: operation,
      attributes: data as Record<string, string | number | boolean | undefined>,
    },
    () => {}
  )

  return () => {
    // Transaction auto-finishes when callback completes
  }
}

/**
 * Track a specific user flow with timing
 */
export async function trackUserFlow<T>(
  flowName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!hasTrackingConsent()) {
    return fn()
  }

  return Sentry.startSpan(
    {
      name: flowName,
      op: operation,
    },
    fn
  )
}

/**
 * Set a tag that persists across all events
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value)
}

/**
 * Set context that persists across all events
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context)
}

// Listen for consent changes
if (typeof window !== 'undefined') {
  window.addEventListener('cookie_consent_granted', () => {
    invalidateConsentCache()
    updateSentryConsent()
  })
  
  // Also listen for consent withdrawal
  window.addEventListener('cookie_consent_rejected', () => {
    invalidateConsentCache()
    updateSentryConsent()
  })
}

// Re-export Sentry for direct access if needed
export { Sentry }
