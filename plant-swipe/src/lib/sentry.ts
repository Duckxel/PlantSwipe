/**
 * Sentry Error Monitoring Configuration
 * 
 * This module initializes Sentry for the React frontend.
 * Import this module early in your application (before React renders).
 */
import * as Sentry from '@sentry/react'

const SENTRY_DSN = 'https://758053551e0396eab52314bdbcf57924@o4510783278350336.ingest.de.sentry.io/4510783285821520'

/**
 * Initialize Sentry for error tracking
 * Should be called once at application startup
 */
export function initSentry(): void {
  // Only initialize in production or if explicitly enabled
  const isProduction = import.meta.env.PROD
  const isEnabled = isProduction || import.meta.env.VITE_SENTRY_ENABLED === 'true'

  if (!isEnabled) {
    console.log('[Sentry] Skipping initialization in development mode')
    return
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      
      // Environment configuration
      environment: import.meta.env.MODE || 'production',
      
      // Release tracking (if version is available)
      release: (import.meta.env as Record<string, string>).VITE_APP_VERSION || undefined,
      
      // Send structured logs to Sentry
      _experiments: {
        enableLogs: true,
      },
      
      // Integrations
      integrations: [
        // Browser tracing for performance monitoring
        Sentry.browserTracingIntegration(),
        // Replay for session recordings on errors
        Sentry.replayIntegration({
          // Only capture replays on errors
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // Tracing - capture 100% of transactions
      tracesSampleRate: 1.0,

      // Session replay
      // Capture 10% of all sessions, 100% of sessions with errors
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Don't send errors in development unless explicitly enabled
      enabled: isEnabled,

      // Filter out common non-actionable errors
      beforeSend(event, hint) {
        const error = hint.originalException

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
        }

        return event
      },

      // Add additional context
      initialScope: {
        tags: {
          app: 'plant-swipe',
          platform: 'web',
        },
      },
    })

    console.log('[Sentry] Initialized successfully')
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error)
  }
}

/**
 * Capture an exception and send it to Sentry
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}

/**
 * Capture a message and send it to Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level)
}

/**
 * Set user context for Sentry
 * Call this when user logs in
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
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
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string = 'app',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  })
}

// Re-export Sentry for direct access if needed
export { Sentry }
