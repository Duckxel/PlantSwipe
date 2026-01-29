import React from 'react'
import { 
  captureError, 
  addBreadcrumb, 
  ErrorCategory,
  setContext 
} from '@/lib/sentry'

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
  /** Name of the component/section for error context */
  componentName?: string
  /** Error category for Sentry filtering */
  category?: keyof typeof ErrorCategory
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Show a retry button for recoverable errors */
  showRetry?: boolean
  /** Custom retry handler */
  onRetry?: () => void
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
}

/**
 * ErrorBoundary component to catch and handle React errors gracefully
 * 
 * Features:
 * - Integrates with Sentry for error reporting with rich context
 * - Handles lazy loading failures with automatic retry
 * - Provides detailed component stack for debugging
 * - Supports custom fallback UI
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary componentName="GardenDashboard" category="GARDEN">
 *   <GardenDashboard />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Store error info for rendering
    this.setState({ errorInfo })

    // Log error for debugging (but don't spam console in production)
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    }

    // Determine error type for categorization
    const isChunkLoadError = 
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch')

    const isNetworkError =
      error.message?.includes('NetworkError') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('Load failed')

    // Don't report chunk loading errors to Sentry (handled with retry UI)
    if (isChunkLoadError) {
      addBreadcrumb('Chunk load error - showing retry UI', 'error', 'warning', {
        component: this.props.componentName,
        errorMessage: error.message,
      })
      return
    }

    // Report to Sentry with rich context
    captureError({
      error,
      category: this.props.category 
        ? ErrorCategory[this.props.category] 
        : ErrorCategory.UI,
      message: `React error in ${this.props.componentName || 'unknown component'}`,
      component: this.props.componentName,
      action: 'render',
      severity: isNetworkError ? 'warning' : 'error',
      extra: {
        // Component stack trace (sanitized in Sentry lib)
        componentStack: errorInfo.componentStack,
        // Error classification
        errorType: error.name,
        errorMessage: error.message,
        // Retry context
        retryCount: this.state.retryCount,
        // Environment context
        url: window.location.pathname,
        online: navigator.onLine,
        // Rendering context
        reactVersion: React.version,
        timestamp: new Date().toISOString(),
      },
    })

    // Set persistent context for subsequent errors
    setContext('lastErrorBoundary', {
      component: this.props.componentName,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry()
    }
    
    addBreadcrumb('User clicked retry after error', 'user-action', 'info', {
      component: this.props.componentName,
      retryCount: this.state.retryCount + 1,
    })

    this.setState(prev => ({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: prev.retryCount + 1 
    }))
  }

  handleReload = (): void => {
    addBreadcrumb('User clicked reload after error', 'user-action', 'info', {
      component: this.props.componentName,
    })
    window.location.reload()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Return custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      const { error, retryCount } = this.state
      
      // Check if this is a chunk loading error (recoverable with retry)
      const isChunkLoadError = 
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Failed to fetch')
      
      // Check if this is a network-related error
      const isNetworkError =
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('network') ||
        !navigator.onLine

      // Show specific UI for chunk loading errors
      if (isChunkLoadError) {
        return (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-semibold text-stone-800 dark:text-stone-200 mb-2">
              Failed to load this section
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-4 text-sm">
              {!navigator.onLine 
                ? 'You appear to be offline. Please check your internet connection.'
                : 'There was a problem loading some content. This can happen after an update.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  Try Again {retryCount > 0 && `(${retryCount}/3)`}
                </button>
              )}
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors text-sm font-medium"
              >
                Reload Page
              </button>
            </div>
            {retryCount >= 3 && (
              <p className="text-xs text-stone-500 mt-3">
                Multiple retries failed. Try reloading the page or clearing your browser cache.
              </p>
            )}
          </div>
        )
      }

      // Show specific UI for network errors
      if (isNetworkError) {
        return (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.142 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h3 className="font-semibold text-stone-800 dark:text-stone-200 mb-2">
              Connection Problem
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-4 text-sm">
              Unable to connect. Please check your internet connection and try again.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              Retry Connection
            </button>
          </div>
        )
      }
      
      // Default error UI
      return (
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 dark:text-stone-200 mb-2">
            Something went wrong
          </h3>
          <p className="text-stone-600 dark:text-stone-400 mb-4 text-sm">
            {this.props.componentName 
              ? `An error occurred in ${this.props.componentName}.`
              : 'An unexpected error occurred.'}
            {' '}Our team has been notified.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {(this.props.showRetry ?? true) && (
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors text-sm font-medium"
            >
              Reload Page
            </button>
          </div>
          {/* Development-only error details */}
          {import.meta.env.DEV && error && (
            <details className="mt-4 text-left text-xs bg-stone-100 dark:bg-stone-800 rounded-lg p-3">
              <summary className="cursor-pointer text-stone-600 dark:text-stone-400 font-medium">
                Error Details (dev only)
              </summary>
              <pre className="mt-2 overflow-auto text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-2 overflow-auto text-stone-500 whitespace-pre-wrap">
                  Component Stack:
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Wrapper component for Suspense with ErrorBoundary
 * Use this for lazy-loaded components to handle both loading and error states
 * 
 * Usage:
 * ```tsx
 * <SuspenseWithErrorBoundary componentName="Settings">
 *   <LazySettings />
 * </SuspenseWithErrorBoundary>
 * ```
 */
export function SuspenseWithErrorBoundary({
  children,
  fallback,
  errorFallback,
  componentName,
  category,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  errorFallback?: React.ReactNode
  componentName?: string
  category?: keyof typeof ErrorCategory
}): React.JSX.Element {
  return (
    <ErrorBoundary 
      fallback={errorFallback}
      componentName={componentName}
      category={category}
    >
      <React.Suspense fallback={fallback || <LoadingFallback />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  )
}

/**
 * Default loading fallback component
 */
function LoadingFallback(): React.JSX.Element {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        Loading...
      </p>
    </div>
  )
}

export default ErrorBoundary
