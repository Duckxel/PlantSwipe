import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry monitoring for the Aphylia application.
 * 
 * This configuration enables:
 * - Long Task Monitoring (tracks tasks blocking the main thread > 50ms)
 * - INP (Interaction to Next Paint) Monitoring
 * - Console Capture Integration (excludes Warning to avoid flooding)
 * - HTTP Client Integration (tracks outgoing HTTP requests)
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

    // Sample rates
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0, // 20% in production, 100% in dev
    replaysSessionSampleRate: 0, // Disable session replays by default
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.1 : 0, // 10% on error in production

    // Enable Long Task and INP monitoring via browserTracingIntegration
    integrations: [
      // Browser tracing with Long Task and INP monitoring enabled
      Sentry.browserTracingIntegration({
        enableLongTask: true,         // Long Task Monitoring (tasks > 50ms)
        enableInp: true,              // INP (Interaction to Next Paint) Monitoring
      }),
      
      // HTTP Client Integration - tracks outgoing HTTP requests and their errors
      Sentry.httpClientIntegration({
        failedRequestStatusCodes: [[400, 599]], // Capture 4xx and 5xx responses
        failedRequestTargets: [/.*/], // Track all targets
      }),
      
      // Console Capture Integration - capture console logs except warnings
      // Excluding 'warn' level to avoid flooding developers with noise
      Sentry.captureConsoleIntegration({
        levels: ['log', 'info', 'error', 'debug', 'assert'],
      }),
    ],

    // Only send errors from our own domain in production
    allowUrls: import.meta.env.PROD
      ? [/https?:\/\/(.*\.)?aphylia\.app/]
      : undefined,

    // Ignore common non-actionable errors
    ignoreErrors: [
      // Browser extensions
      /Extensions/,
      /extension/,
      // Network errors that users can't control
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      // Script errors from cross-origin scripts
      'Script error.',
      // ResizeObserver errors (benign, often caused by rapid resizing)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Common third-party errors
      /^ChunkLoadError/,
    ],

    // Before sending, add additional context
    beforeSend(event, hint) {
      // In development, log to console instead of sending
      if (import.meta.env.DEV) {
        console.info('[Sentry] Would send event:', event, hint)
        return null // Don't send in development
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
