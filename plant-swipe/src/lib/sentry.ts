import * as Sentry from '@sentry/react'

/**
 * Maintenance window state for Sentry error filtering.
 * 
 * When the server restarts (via Pull & Build in Admin Dashboard),
 * users may experience network errors. We suppress these expected errors
 * during the maintenance window to avoid flooding Sentry.
 */
const maintenanceState = {
  /** Whether we're currently in a maintenance window */
  active: false,
  /** Timestamp when maintenance window started */
  startTime: 0,
}

// Maximum maintenance window duration (10 minutes) - auto-exits after this
const MAX_MAINTENANCE_DURATION_MS = 10 * 60 * 1000

/**
 * Check if an error message indicates a network/connectivity issue
 */
function isNetworkError(message: string): boolean {
  const networkErrorPatterns = [
    'Failed to fetch',
    'Network request failed',
    'NetworkError',
    'Load failed',
    'fetch failed',
    'net::ERR_',
    'NS_ERROR_',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_RESET',
    'ERR_NAME_NOT_RESOLVED',
    'The network connection was lost',
    'A server with the specified hostname could not be found',
    'The Internet connection appears to be offline',
    'cancelled',
    'aborted',
  ]
  
  const lowerMessage = message.toLowerCase()
  return networkErrorPatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()))
}

/**
 * Check if an HTTP status code indicates server maintenance
 */
function isMaintenanceStatusCode(statusCode: number | undefined): boolean {
  if (!statusCode) return false
  // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
  return statusCode === 502 || statusCode === 503 || statusCode === 504
}

/**
 * Check if we're currently in a maintenance window
 */
export function isInMaintenanceWindow(): boolean {
  if (!maintenanceState.active) return false
  
  // Auto-exit maintenance window after max duration
  const elapsed = Date.now() - maintenanceState.startTime
  if (elapsed > MAX_MAINTENANCE_DURATION_MS) {
    maintenanceState.active = false
    console.info('[Sentry] Maintenance window auto-expired after 10 minutes')
    return false
  }
  
  return true
}

/**
 * Enter maintenance mode - call this when starting Pull & Build or server restart.
 * Network errors will be suppressed until exitMaintenanceMode() is called.
 */
export function enterMaintenanceMode() {
  maintenanceState.active = true
  maintenanceState.startTime = Date.now()
  console.info('[Sentry] Entering maintenance window - network errors will be suppressed')
  
  // Add breadcrumb for debugging
  Sentry.addBreadcrumb({
    category: 'maintenance',
    message: 'Entered maintenance mode',
    level: 'info',
  })
}

/**
 * Exit maintenance mode - call this when server is healthy again.
 * Normal error reporting resumes.
 */
export function exitMaintenanceMode() {
  if (maintenanceState.active) {
    const duration = Date.now() - maintenanceState.startTime
    console.info(`[Sentry] Exiting maintenance window after ${Math.round(duration / 1000)}s`)
    
    // Add breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: 'maintenance',
      message: `Exited maintenance mode after ${Math.round(duration / 1000)}s`,
      level: 'info',
    })
  }
  maintenanceState.active = false
}

/**
 * Determine if an error should be filtered out during maintenance
 */
function shouldFilterMaintenanceError(event: Sentry.ErrorEvent): boolean {
  // If not in maintenance window, don't filter
  if (!isInMaintenanceWindow()) return false
  
  // Check if this is a network-related error
  const message = event.message || ''
  const exceptionValues = event.exception?.values || []
  
  for (const exception of exceptionValues) {
    const exceptionMessage = exception.value || ''
    const exceptionType = exception.type || ''
    
    // Check for network errors
    if (isNetworkError(exceptionMessage) || isNetworkError(exceptionType)) {
      return true
    }
    
    // Check for TypeError with network message (common pattern)
    if (exceptionType === 'TypeError' && isNetworkError(exceptionMessage)) {
      return true
    }
  }
  
  // Check main message
  if (isNetworkError(message)) {
    return true
  }
  
  // Check for HTTP status codes indicating maintenance
  const statusCode = event.contexts?.response?.status_code as number | undefined
  if (isMaintenanceStatusCode(statusCode)) {
    return true
  }
  
  return false
}

/**
 * Initialize Sentry monitoring for the Aphylia application.
 * 
 * This configuration enables:
 * - Long Task Monitoring (tracks tasks blocking the main thread > 50ms)
 * - INP (Interaction to Next Paint) Monitoring
 * - Console Capture Integration (excludes Warning to avoid flooding)
 * - HTTP Client Integration (tracks outgoing HTTP requests)
 * - Manual maintenance window support (filters errors during server restarts)
 */
export function initSentry() {
  // Get runtime env from window.__ENV__
  const runtimeEnv = (window as Window & { __ENV__?: Record<string, unknown> }).__ENV__ || {}
  
  // Get DSN from environment variables
  const dsn = runtimeEnv.VITE_SENTRY_DSN as string
    || import.meta.env.VITE_SENTRY_DSN as string

  // Only initialize if DSN is configured
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] Skipping initialization - no DSN configured')
    }
    return
  }

  // Determine environment
  const environment = import.meta.env.PROD ? 'production' : 'development'
  
  // Get release version from build info
  const release = `aphylia@${(import.meta.env as Record<string, string>).VITE_APP_VERSION || '1.0.0'}`
  
  // Get server name from environment (e.g., 'DEV', 'PROD', 'STAGING')
  const serverName = runtimeEnv.SERVER_NAME as string
    || import.meta.env.VITE_SERVER_NAME as string
    || 'unknown'

  Sentry.init({
    dsn,
    environment,
    release,
    
    // Set the server name from environment variable to identify the instance
    serverName,

    // Sample rates - capture errors comprehensively
    tracesSampleRate: import.meta.env.PROD ? 0.3 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.2 : 0,

    // Enable Long Task and INP monitoring via browserTracingIntegration
    integrations: [
      // Browser tracing with Long Task and INP monitoring enabled
      Sentry.browserTracingIntegration({
        enableLongTask: true,
        enableInp: true,
      }),
      
      // HTTP Client Integration - tracks outgoing HTTP requests and their errors
      Sentry.httpClientIntegration({
        failedRequestStatusCodes: [[400, 599]],
        failedRequestTargets: [/.*/],
      }),
      
      // Console Capture Integration - capture console logs except warnings
      Sentry.captureConsoleIntegration({
        levels: ['log', 'info', 'error', 'debug', 'assert'],
      }),
    ],

    // Only send errors from our own domain in production
    allowUrls: import.meta.env.PROD
      ? [/https?:\/\/(.*\.)?aphylia\.app/]
      : undefined,

    // Minimal ignore list - only truly non-actionable errors
    ignoreErrors: [
      // Script errors from cross-origin scripts we can't debug
      'Script error.',
      // ResizeObserver errors (benign browser behavior)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Browser extension errors (not our code)
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
    ],

    // Smart error filtering with maintenance window support
    beforeSend(event, hint) {
      // In development, log to console instead of sending
      if (import.meta.env.DEV) {
        console.info('[Sentry] Would send event:', event, hint)
        return null
      }
      
      // Filter out maintenance-related errors during server restarts
      if (shouldFilterMaintenanceError(event)) {
        console.debug('[Sentry] Filtering maintenance-related error:', event.message)
        return null
      }
      
      // Add maintenance state context to all errors
      event.tags = {
        ...event.tags,
        maintenance_window: maintenanceState.active ? 'true' : 'false',
      }
      
      return event
    },
  })

  // Set user context if available (can be updated later when user logs in)
  Sentry.setTag('app', 'aphylia')
  Sentry.setTag('platform', 'web')

  if (import.meta.env.DEV) {
    console.info('[Sentry] Initialized successfully', { dsn: dsn.substring(0, 20) + '...', environment, release, serverName })
  }
}

/**
 * Set user context for Sentry error tracking.
 * Call this when a user logs in.
 */
export function setSentryUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  })
}

/**
 * Clear user context when user logs out.
 */
export function clearSentryUser() {
  Sentry.setUser(null)
}

/**
 * Capture a custom error with additional context.
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture a custom message.
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Add breadcrumb for debugging.
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb)
}

export { Sentry }
