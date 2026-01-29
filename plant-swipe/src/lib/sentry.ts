/**
 * Sentry error tracking and console logging integration
 * 
 * This module initializes Sentry with:
 * - Console capture (log, info, error, debug, assert - excludes warn to avoid flooding)
 * - Long Task monitoring for detecting slow JavaScript execution
 * - INP (Interaction to Next Paint) monitoring for Core Web Vitals
 * - HTTP client integration for request/response tracking
 * 
 * Console messages are captured as breadcrumbs and sent with error events.
 */

import * as Sentry from '@sentry/react'

// Sentry DSN - replace with your actual DSN from Sentry project settings
// Leave empty to disable Sentry in development
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

// Determine environment
const getEnvironment = () => {
  if (import.meta.env.DEV) return 'development'
  if (window.location.hostname === 'localhost') return 'local'
  if (window.location.hostname.includes('staging')) return 'staging'
  return 'production'
}

// Determine server name from hostname
const getServerName = () => {
  if (typeof window === 'undefined') return 'ssr'
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local'
  if (hostname.includes('aphylia.app')) return 'production'
  if (hostname.includes('staging')) return 'staging'
  return hostname || 'unknown'
}

// Track initialization state
let isInitialized = false

// GDPR consent state - defaults to true, can be updated later
let hasConsent = true

/**
 * Update GDPR consent status
 * Call this when user opts in/out of tracking
 */
export function updateSentryConsent(consent: boolean): void {
  hasConsent = consent
  if (isInitialized) {
    Sentry.getCurrentScope().setTag('gdpr_consent', consent.toString())
  }
  console.info(`[Sentry] Consent updated: ${consent}`)
}

/**
 * Initialize Sentry with console capture integration
 * Should be called as early as possible in the application lifecycle
 */
export function initSentry(): void {
  // Prevent double initialization
  if (isInitialized) {
    console.warn('[Sentry] Already initialized, skipping')
    return
  }

  // Skip initialization if no DSN is configured
  if (!SENTRY_DSN) {
    console.info('[Sentry] No DSN configured, error tracking disabled')
    // Still mark as initialized to prevent repeated attempts
    isInitialized = true
    return
  }

  const environment = getEnvironment()
  const serverName = getServerName()
  
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment,
      
      // Integrations for monitoring and debugging
      integrations: [
        // Console Capture Integration
        // Captures console.* calls as breadcrumbs (excluding 'warn' to avoid flooding devs)
        Sentry.captureConsoleIntegration({
          levels: ['log', 'info', 'error', 'debug', 'assert'],
        }),
        
        // Browser Tracing Integration with Long Task and INP monitoring
        Sentry.browserTracingIntegration({
          // Enable INP (Interaction to Next Paint) monitoring for Core Web Vitals
          enableInp: true,
          // Enable Long Task monitoring to detect slow JavaScript execution (>50ms)
          enableLongTask: true,
          // Enable long animation frame detection
          enableLongAnimationFrame: true,
        }),
        
        // HTTP Client Integration
        // Captures failed HTTP requests (4xx/5xx) as errors with request/response details
        Sentry.httpClientIntegration({
          // Capture errors for 4xx and 5xx status codes
          failedRequestStatusCodes: [[400, 599]],
          // Capture request/response targets
          failedRequestTargets: [/.*/],
        }),
        
        // Replay integration for session replay (optional - enable if needed)
        // Sentry.replayIntegration({
        //   maskAllText: true,
        //   blockAllMedia: true,
        // }),
      ],
      
      // Performance monitoring sample rate (0.0 to 1.0)
      // In production, you may want to lower this for high-traffic sites
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      
      // Session replay sample rate (disabled by default - uncomment to enable)
      // replaysSessionSampleRate: 0.1,
      // replaysOnErrorSampleRate: 1.0,
      
      // Release and version info for source maps
      release: `aphylia@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      dist: import.meta.env.VITE_COMMIT_SHA || 'unknown',
      
      // Send default PII (like user IPs) - set to false for stricter privacy
      sendDefaultPii: false,
      
      // Breadcrumbs configuration
      maxBreadcrumbs: 100, // Keep more breadcrumbs for debugging
      
      // Before sending events, you can modify or filter them
      beforeSend(event, hint) {
        // Don't send events if user hasn't consented
        if (!hasConsent) {
          return null
        }
        
        // Add custom context
        if (event.tags) {
          event.tags['server.name'] = serverName
        }
        
        // Filter out certain errors if needed (e.g., network errors from extensions)
        const error = hint.originalException
        if (error && typeof error === 'object' && 'message' in error) {
          const message = String((error as Error).message || '')
          
          // Skip common non-actionable errors
          if (
            message.includes('ResizeObserver loop') ||
            message.includes('Non-Error promise rejection') ||
            message.includes('Load failed') // Safari network error
          ) {
            return null
          }
        }
        
        return event
      },
      
      // Before sending breadcrumbs (console logs, etc.)
      beforeBreadcrumb(breadcrumb) {
        // Always capture breadcrumbs regardless of consent
        // (they're only sent with events, which respect consent)
        
        // Add timestamp formatting for easier reading
        if (breadcrumb.timestamp) {
          breadcrumb.data = breadcrumb.data || {}
          breadcrumb.data.timestamp_formatted = new Date(breadcrumb.timestamp * 1000).toISOString()
        }
        
        return breadcrumb
      },
      
      // Error sampling - always capture all errors
      sampleRate: 1.0,
      
      // Attach stack traces to messages (console.error, etc.)
      attachStacktrace: true,
      
      // Enable debug mode in development
      debug: import.meta.env.DEV,
    })
    
    // Set initial context
    Sentry.setTag('gdpr_consent', hasConsent.toString())
    Sentry.setTag('server.name', serverName)
    
    // Set context with app info
    Sentry.setContext('app', {
      version: import.meta.env.VITE_APP_VERSION || 'unknown',
      commit: import.meta.env.VITE_COMMIT_SHA || 'unknown',
      base_url: import.meta.env.BASE_URL,
      environment,
    })
    
    isInitialized = true
    console.info(`[Sentry] Initialized for server: ${serverName} (consent: ${hasConsent})`)
    
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error)
    isInitialized = true // Mark as initialized to prevent repeated attempts
  }
}

/**
 * Manually capture an exception and send to Sentry
 */
export function captureException(error: unknown, context?: Record<string, unknown>): string | undefined {
  if (!isInitialized || !hasConsent) {
    console.error('[Sentry] Cannot capture exception - not initialized or no consent')
    return undefined
  }
  
  return Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Manually capture a message and send to Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>): string | undefined {
  if (!isInitialized || !hasConsent) {
    return undefined
  }
  
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

/**
 * Set user information for Sentry
 */
export function setUser(user: { id?: string; email?: string; username?: string } | null): void {
  if (!isInitialized) return
  
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Add a custom breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = 'user-action',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void {
  if (!isInitialized) return
  
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Set a custom tag on the current scope
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) return
  Sentry.setTag(key, value)
}

/**
 * Set custom context
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!isInitialized) return
  Sentry.setContext(name, context)
}

/**
 * Get the Sentry instance for advanced usage
 */
export { Sentry }

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  setTag,
  setContext,
  updateSentryConsent,
  isSentryInitialized,
}
