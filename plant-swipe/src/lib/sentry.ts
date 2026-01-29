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
  if (!hostname) return 'unknown'
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'localhost'
  if (hostname.includes('aphylia.app')) return 'aphylia.app'
  if (hostname.includes('staging')) return 'staging'
  // Return the actual hostname for any other case
  return hostname
}

// Track initialization state
let isInitialized = false

// GDPR consent state - defaults to true, can be updated later
let hasConsent = true

// Maintenance mode state
// When true, Sentry will filter out HTTP errors (4xx/5xx) that are likely due to server restart/deployment
let isMaintenanceMode = false
let maintenanceModeTimeout: ReturnType<typeof setTimeout> | null = null

// Track recent server errors for auto-maintenance detection
const recentServerErrors: number[] = []
const SERVER_ERROR_WINDOW_MS = 10000 // 10 second window
const SERVER_ERROR_THRESHOLD = 3 // 3 errors in window triggers maintenance mode
const MAINTENANCE_AUTO_DISABLE_MS = 60000 // Auto-disable maintenance after 60 seconds

/**
 * Enable maintenance mode manually
 * Useful when triggering a deployment or server restart from the UI
 * @param duration - How long to stay in maintenance mode (ms), defaults to 60 seconds
 */
export function enableMaintenanceMode(duration: number = MAINTENANCE_AUTO_DISABLE_MS): void {
  isMaintenanceMode = true
  console.info(`[Sentry] Maintenance mode enabled for ${duration}ms`)
  
  // Clear existing timeout
  if (maintenanceModeTimeout) {
    clearTimeout(maintenanceModeTimeout)
  }
  
  // Auto-disable after duration
  maintenanceModeTimeout = setTimeout(() => {
    disableMaintenanceMode()
  }, duration)
}

/**
 * Disable maintenance mode manually
 */
export function disableMaintenanceMode(): void {
  isMaintenanceMode = false
  if (maintenanceModeTimeout) {
    clearTimeout(maintenanceModeTimeout)
    maintenanceModeTimeout = null
  }
  console.info('[Sentry] Maintenance mode disabled')
}

/**
 * Check if we're in maintenance mode
 */
export function isInMaintenanceMode(): boolean {
  return isMaintenanceMode
}

/**
 * Track a server error for auto-maintenance detection
 * If too many 5xx errors occur in a short window, we assume maintenance
 */
function trackServerError(): void {
  const now = Date.now()
  recentServerErrors.push(now)
  
  // Remove errors outside the window
  while (recentServerErrors.length > 0 && recentServerErrors[0] < now - SERVER_ERROR_WINDOW_MS) {
    recentServerErrors.shift()
  }
  
  // If we have too many errors, enable maintenance mode
  if (recentServerErrors.length >= SERVER_ERROR_THRESHOLD && !isMaintenanceMode) {
    console.info(`[Sentry] Auto-enabling maintenance mode (${recentServerErrors.length} server errors in ${SERVER_ERROR_WINDOW_MS}ms)`)
    enableMaintenanceMode()
  }
}

/**
 * Check if an error looks like a maintenance/deployment error
 */
function isMaintenanceRelatedError(error: unknown, hint?: { originalException?: unknown }): boolean {
  // Check error message patterns
  const errorMessage = error instanceof Error ? error.message : String(error || '')
  const originalMessage = hint?.originalException instanceof Error 
    ? hint.originalException.message 
    : String(hint?.originalException || '')
  
  const combinedMessage = `${errorMessage} ${originalMessage}`.toLowerCase()
  
  // Common maintenance-related error patterns
  const maintenancePatterns = [
    'failed to fetch',
    'network error',
    'net::err_',
    'load failed',
    'connection refused',
    'connection reset',
    'connection closed',
    'socket hang up',
    'econnrefused',
    'econnreset',
    'etimedout',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    '502',
    '503',
    '504',
    'server is restarting',
    'maintenance',
  ]
  
  return maintenancePatterns.some(pattern => combinedMessage.includes(pattern))
}

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
      
      // Server name for identifying the host/instance
      serverName,
      
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
        
        // Ensure tags object exists and add server context
        event.tags = event.tags || {}
        event.tags['server'] = serverName
        event.tags['hostname'] = typeof window !== 'undefined' ? window.location.hostname : 'unknown'
        event.tags['maintenance_mode'] = isMaintenanceMode.toString()
        
        // Get error details for filtering
        const error = hint.originalException
        const errorMessage = error && typeof error === 'object' && 'message' in error
          ? String((error as Error).message || '')
          : ''
        
        // Check if this looks like a server error (5xx) - track for auto-maintenance
        const is5xxError = errorMessage.match(/\b(50[0-4]|502|503|504)\b/) ||
          event.tags?.['http.status_code']?.toString().startsWith('5')
        
        if (is5xxError) {
          trackServerError()
        }
        
        // Filter out errors during maintenance mode
        if (isMaintenanceMode) {
          // During maintenance, only allow critical non-HTTP errors through
          if (isMaintenanceRelatedError(error, hint)) {
            console.debug('[Sentry] Filtered maintenance-related error:', errorMessage.slice(0, 100))
            return null
          }
          
          // Also filter HTTP client errors (4xx/5xx) during maintenance
          if (event.exception?.values?.some(v => 
            v.type === 'HttpClientError' || 
            v.value?.includes('status code') ||
            v.value?.match(/\b[45]\d{2}\b/)
          )) {
            console.debug('[Sentry] Filtered HTTP error during maintenance')
            return null
          }
        }
        
        // Skip common non-actionable errors (always filter these)
        if (
          errorMessage.includes('ResizeObserver loop') ||
          errorMessage.includes('Non-Error promise rejection') ||
          errorMessage.includes('signal is aborted without reason') || // AbortController cancellation
          errorMessage.includes('user aborted') ||
          errorMessage.includes('AbortError')
        ) {
          return null
        }
        
        // Filter "Load failed" only during maintenance (might be valid error otherwise)
        if (errorMessage.includes('Load failed') && isMaintenanceMode) {
          return null
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
    
    // Set initial tags
    Sentry.setTag('gdpr_consent', hasConsent.toString())
    Sentry.setTag('server', serverName)
    Sentry.setTag('hostname', typeof window !== 'undefined' ? window.location.hostname : 'unknown')
    
    // Set context with app info
    Sentry.setContext('app', {
      version: import.meta.env.VITE_APP_VERSION || 'unknown',
      commit: import.meta.env.VITE_COMMIT_SHA || 'unknown',
      base_url: import.meta.env.BASE_URL,
      environment,
      serverName,
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
  enableMaintenanceMode,
  disableMaintenanceMode,
  isInMaintenanceMode,
}
