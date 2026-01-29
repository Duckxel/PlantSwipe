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
  eventId: string | null
}

/**
 * ErrorBoundary component to catch and handle React errors gracefully
 * Particularly useful for catching lazy loading failures
 * Now integrated with Sentry for automatic error reporting
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, eventId: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    
    // Add breadcrumb for context
    addBreadcrumb(
      `ErrorBoundary caught: ${error.message}`,
      'error',
      'error',
      {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
      }
    )
    
    // Send to Sentry
    const eventId = captureException(error, {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    })
    
    if (eventId) {
      this.setState({ eventId })
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
