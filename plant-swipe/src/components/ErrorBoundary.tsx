import React from 'react'
import { captureException, addBreadcrumb } from '@/lib/sentry'

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary component to catch and handle React errors gracefully
 * Particularly useful for catching lazy loading failures
 * Integrates with Sentry for error reporting
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging (but don't spam console in production)
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    }

    // Check if this is a chunk loading error (don't report these to Sentry as they're handled with retry UI)
    const isChunkLoadError = 
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch')

    // Report to Sentry (unless it's a chunk loading error)
    if (!isChunkLoadError) {
      addBreadcrumb('Error boundary caught error', 'error', 'error', {
        componentStack: errorInfo.componentStack,
      })
      captureException(error, {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      })
    }
    
    this.props.onError?.(error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Return fallback UI or default error message
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // Default fallback for lazy loading errors
      const isChunkLoadError = this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('Failed to fetch')
      
      if (isChunkLoadError) {
        return (
          <div className="p-8 text-center">
            <p className="text-stone-600 dark:text-stone-400 mb-4">
              Failed to load this page. Please check your internet connection.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        )
      }
      
      return (
        <div className="p-8 text-center">
          <p className="text-stone-600 dark:text-stone-400">
            Something went wrong. Please try refreshing the page.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Wrapper component for Suspense with ErrorBoundary
 * Use this for lazy-loaded components to handle both loading and error states
 */
export function SuspenseWithErrorBoundary({
  children,
  fallback,
  errorFallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  errorFallback?: React.ReactNode
}): React.JSX.Element {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <React.Suspense fallback={fallback || <div className="p-8 text-center text-sm opacity-60">Loading...</div>}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  )
}

export default ErrorBoundary
