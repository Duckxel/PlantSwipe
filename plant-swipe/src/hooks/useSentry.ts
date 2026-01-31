/**
 * React hooks and utilities for Sentry error tracking
 * 
 * This module provides developer-friendly hooks for:
 * - Tracking user flows and performance
 * - Capturing errors with rich context
 * - Adding navigation and action breadcrumbs
 */

import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  captureError,
  captureException,
  addBreadcrumb,
  addNavigationBreadcrumb,
  addActionBreadcrumb,
  addAPIBreadcrumb,
  trackUserFlow,
  setTag,
  ErrorCategory,
  type ErrorCategoryType,
} from '@/lib/sentry'

/**
 * Hook to track route changes in Sentry
 * Automatically adds navigation breadcrumbs
 */
export function useSentryRouteTracking(): void {
  const location = useLocation()
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const currentPath = location.pathname
    
    if (previousPath.current && previousPath.current !== currentPath) {
      addNavigationBreadcrumb(previousPath.current, currentPath)
    }
    
    previousPath.current = currentPath
  }, [location.pathname])
}

/**
 * Hook to capture errors in a component with automatic context
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { captureComponentError, trackAction } = useSentryCapture('MyComponent', 'UI')
 *   
 *   const handleSubmit = async () => {
 *     try {
 *       trackAction('submit')
 *       await submitForm()
 *     } catch (error) {
 *       captureComponentError(error, 'Form submission failed')
 *     }
 *   }
 * }
 * ```
 */
export function useSentryCapture(
  componentName: string,
  category: ErrorCategoryType = ErrorCategory.UI
) {
  // Capture an error with component context
  const captureComponentError = useCallback(
    (error: unknown, action?: string, extra?: Record<string, unknown>) => {
      return captureError({
        error,
        category,
        message: action || 'Component error',
        component: componentName,
        action,
        extra,
      })
    },
    [componentName, category]
  )

  // Track a user action
  const trackAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      addActionBreadcrumb(action, componentName, data)
    },
    [componentName]
  )

  // Track an API call
  const trackAPICall = useCallback(
    (method: string, endpoint: string, status?: number, duration?: number) => {
      addAPIBreadcrumb(method, endpoint, status, duration)
    },
    []
  )

  return {
    captureComponentError,
    trackAction,
    trackAPICall,
  }
}

/**
 * Hook to track a user flow with timing
 * 
 * @example
 * ```tsx
 * function CheckoutPage() {
 *   const { startFlow, endFlow, stepCompleted } = useUserFlowTracking('checkout')
 *   
 *   useEffect(() => {
 *     startFlow()
 *     return () => endFlow()
 *   }, [])
 *   
 *   const handleAddressSubmit = () => {
 *     stepCompleted('address_entered')
 *     // ...
 *   }
 * }
 * ```
 */
export function useUserFlowTracking(flowName: string) {
  const startTime = useRef<number>(0)
  const steps = useRef<string[]>([])

  const startFlow = useCallback(() => {
    startTime.current = Date.now()
    steps.current = []
    addBreadcrumb(`Started ${flowName} flow`, 'user-flow', 'info')
    setTag('current_flow', flowName)
  }, [flowName])

  const endFlow = useCallback((success: boolean = true) => {
    const duration = Date.now() - startTime.current
    addBreadcrumb(
      `${success ? 'Completed' : 'Abandoned'} ${flowName} flow`,
      'user-flow',
      success ? 'info' : 'warning',
      {
        duration,
        steps: steps.current,
        stepsCount: steps.current.length,
      }
    )
    setTag('current_flow', '')
  }, [flowName])

  const stepCompleted = useCallback((stepName: string, data?: Record<string, unknown>) => {
    steps.current.push(stepName)
    addBreadcrumb(`${flowName}: ${stepName}`, 'user-flow', 'info', {
      step: stepName,
      stepNumber: steps.current.length,
      ...data,
    })
  }, [flowName])

  return {
    startFlow,
    endFlow,
    stepCompleted,
  }
}

/**
 * Hook to track async operations with error handling
 * 
 * @example
 * ```tsx
 * function DataLoader() {
 *   const { wrapAsync } = useAsyncTracking('DataLoader', 'API')
 *   
 *   const fetchData = wrapAsync(async () => {
 *     const response = await fetch('/api/data')
 *     return response.json()
 *   }, 'fetchData')
 * }
 * ```
 */
export function useAsyncTracking(
  componentName: string,
  category: ErrorCategoryType = ErrorCategory.API
) {
  const wrapAsync = useCallback(
    <T>(
      fn: () => Promise<T>,
      operationName: string
    ): (() => Promise<T>) => {
      return async () => {
        const startTime = Date.now()
        addBreadcrumb(`Starting ${operationName}`, 'async', 'info', {
          component: componentName,
        })

        try {
          const result = await trackUserFlow(
            `${componentName}.${operationName}`,
            'async.operation',
            fn
          )
          
          addBreadcrumb(`Completed ${operationName}`, 'async', 'info', {
            component: componentName,
            duration: Date.now() - startTime,
          })

          return result
        } catch (error) {
          captureError({
            error,
            category,
            message: `Async operation failed: ${operationName}`,
            component: componentName,
            action: operationName,
            extra: {
              duration: Date.now() - startTime,
            },
          })
          throw error
        }
      }
    },
    [componentName, category]
  )

  return { wrapAsync }
}

/**
 * Hook to track form submissions with validation errors
 */
export function useFormTracking(formName: string) {
  const { captureComponentError, trackAction } = useSentryCapture(formName, ErrorCategory.UI)

  const trackSubmitAttempt = useCallback((fields: string[]) => {
    trackAction('form_submit_attempt', { fields: fields.length })
  }, [trackAction])

  const trackValidationError = useCallback((field: string, error: string) => {
    addBreadcrumb(`Validation error: ${field}`, 'form', 'warning', {
      form: formName,
      field,
      error,
    })
  }, [formName])

  const trackSubmitSuccess = useCallback(() => {
    trackAction('form_submit_success')
  }, [trackAction])

  const trackSubmitError = useCallback((error: unknown) => {
    captureComponentError(error, 'form_submit_error')
  }, [captureComponentError])

  return {
    trackSubmitAttempt,
    trackValidationError,
    trackSubmitSuccess,
    trackSubmitError,
  }
}

/**
 * Simple error capture for one-off errors
 */
export function useCaptureException() {
  return useCallback((error: unknown, context?: Record<string, unknown>) => {
    return captureException(error, {
      extra: context,
    })
  }, [])
}

/**
 * Pre-configured hooks for common use cases
 */
export const SentryHooks = {
  useRouteTracking: useSentryRouteTracking,
  useCapture: useSentryCapture,
  useFlowTracking: useUserFlowTracking,
  useAsyncTracking,
  useFormTracking,
  useCaptureException,
}

export default SentryHooks
