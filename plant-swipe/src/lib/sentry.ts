import * as Sentry from '@sentry/react'

/**
 * Maintenance window detection for Sentry error filtering.
 * 
 * When the server restarts, users may experience network errors.
 * We detect this by tracking consecutive network failures and suppress
 * maintenance-related errors to avoid flooding Sentry with expected errors.
 */
const maintenanceState = {
  /** Timestamp of the last successful API response */
  lastSuccessfulCall: Date.now(),
  /** Count of consecutive network failures */
  consecutiveFailures: 0,
  /** Whether we believe we're in a maintenance window */
  inMaintenanceWindow: false,
  /** Timestamp when maintenance window was detected */
  maintenanceStartTime: 0,
}

// Grace period after detecting maintenance (5 minutes)
const MAINTENANCE_GRACE_PERIOD_MS = 5 * 60 * 1000
// Number of consecutive failures before assuming maintenance
const FAILURE_THRESHOLD = 3

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
    'cancelled', // iOS cancellation during page unload
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
 * Record a successful API call - resets maintenance detection
 */
export function recordSuccessfulApiCall() {
  maintenanceState.lastSuccessfulCall = Date.now()
  maintenanceState.consecutiveFailures = 0
  if (maintenanceState.inMaintenanceWindow) {
    maintenanceState.inMaintenanceWindow = false
    console.info('[Sentry] Exiting maintenance window - server is back online')
  }
}

/**
 * Record a failed API call - may trigger maintenance window detection
 */
export function recordFailedApiCall() {
  maintenanceState.consecutiveFailures++
  
  if (maintenanceState.consecutiveFailures >= FAILURE_THRESHOLD && !maintenanceState.inMaintenanceWindow) {
    maintenanceState.inMaintenanceWindow = true
    maintenanceState.maintenanceStartTime = Date.now()
    console.info('[Sentry] Entering maintenance window - suppressing network errors')
  }
}

/**
 * Check if we're currently in a maintenance window
 */
function isInMaintenanceWindow(): boolean {
  if (!maintenanceState.inMaintenanceWindow) return false
  
  // Auto-exit maintenance window after grace period
  const elapsed = Date.now() - maintenanceState.maintenanceStartTime
  if (elapsed > MAINTENANCE_GRACE_PERIOD_MS) {
    maintenanceState.inMaintenanceWindow = false
    console.info('[Sentry] Maintenance window grace period expired')
    return false
  }
  
  return true
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
 * - Smart maintenance window detection (filters errors during server restarts)
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

    // Sample rates - capture more in production to get all errors
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

    // Smart error filtering with maintenance window detection
    beforeSend(event, hint) {
      // In development, log to console instead of sending
      if (import.meta.env.DEV) {
        console.info('[Sentry] Would send event:', event, hint)
        return null
      }
      
      // Filter out maintenance-related errors
      if (shouldFilterMaintenanceError(event)) {
        console.debug('[Sentry] Filtering maintenance-related error:', event.message)
        return null
      }
      
      // Add maintenance state context to all errors
      event.tags = {
        ...event.tags,
        maintenance_window: maintenanceState.inMaintenanceWindow ? 'true' : 'false',
        consecutive_failures: String(maintenanceState.consecutiveFailures),
      }
      
      return event
    },
  })

  // Set up global fetch interceptor to track API success/failure
  setupFetchInterceptor()

  // Set user context if available (can be updated later when user logs in)
  Sentry.setTag('app', 'aphylia')
  Sentry.setTag('platform', 'web')

  if (import.meta.env.DEV) {
    console.info('[Sentry] Initialized successfully', { dsn: dsn.substring(0, 20) + '...', environment, release, serverName })
  }
}

/**
 * Set up a fetch interceptor to automatically track API success/failure
 * for maintenance window detection
 */
function setupFetchInterceptor() {
  const originalFetch = window.fetch
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const response = await originalFetch.call(window, input, init)
      
      // Track successful calls to our API
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url && (url.includes('/api/') || url.includes('aphylia.app'))) {
        if (response.ok || (response.status >= 200 && response.status < 500)) {
          recordSuccessfulApiCall()
        } else if (isMaintenanceStatusCode(response.status)) {
          recordFailedApiCall()
        }
      }
      
      return response
    } catch (error) {
      // Track failed calls (network errors)
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
      if (url && (url.includes('/api/') || url.includes('aphylia.app'))) {
        recordFailedApiCall()
      }
      throw error
    }
  }
}

/**
 * Manually enter maintenance mode (e.g., from admin action or broadcast)
 */
export function enterMaintenanceMode() {
  maintenanceState.inMaintenanceWindow = true
  maintenanceState.maintenanceStartTime = Date.now()
  console.info('[Sentry] Manually entering maintenance window')
}

/**
 * Manually exit maintenance mode
 */
export function exitMaintenanceMode() {
  maintenanceState.inMaintenanceWindow = false
  maintenanceState.consecutiveFailures = 0
  console.info('[Sentry] Manually exiting maintenance window')
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
