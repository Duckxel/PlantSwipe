import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Validation status for a field.
 * - 'idle': no validation running, no result yet
 * - 'validating': async validation in progress
 * - 'valid': value passed all checks
 * - 'error': value failed validation
 */
export type FieldStatus = 'idle' | 'validating' | 'valid' | 'error'

export type FieldValidationResult = {
  /** Current validation status */
  status: FieldStatus
  /** Error message when status is 'error' */
  error: string | null
  /** Optional suggestion (e.g., email typo correction) */
  suggestion: string | null
  /** Force a reset to idle (e.g., when closing a dialog) */
  reset: () => void
}

type ValidateFn = (value: string) => Promise<{ valid: boolean; error?: string; suggestion?: string }>

/**
 * A hook that performs debounced field validation.
 *
 * After the user stops typing for `delay` ms, the `validate` function is
 * called. While it runs, status is 'validating'. Once done, status becomes
 * 'valid' or 'error'. If the value is empty the status stays 'idle'.
 *
 * This hook is the engine behind the `ValidatedInput` component but can
 * also be used standalone for custom validation UI.
 *
 * @param value - The current field value
 * @param validate - Async function that returns { valid, error?, suggestion? }
 * @param delay - Debounce delay in ms (default 400)
 * @param enabled - Whether validation is active (default true). Set to false to pause validation.
 */
export function useFieldValidation(
  value: string,
  validate: ValidateFn,
  delay = 400,
  enabled = true,
): FieldValidationResult {
  const [status, setStatus] = useState<FieldStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const latestValue = useRef(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep a mutable ref so the effect closure always sees the latest validate fn
  const validateRef = useRef(validate)
  validateRef.current = validate

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setSuggestion(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    latestValue.current = value

    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // Empty → idle
    if (!value.trim() || !enabled) {
      setStatus('idle')
      setError(null)
      setSuggestion(null)
      return
    }

    // Start debounce
    timerRef.current = setTimeout(async () => {
      // Double-check value hasn't changed during the debounce window
      if (latestValue.current !== value) return

      setStatus('validating')
      setError(null)
      setSuggestion(null)

      try {
        const result = await validateRef.current(value)

        // Only apply if value hasn't changed while we were validating
        if (latestValue.current !== value) return

        if (result.valid) {
          setStatus('valid')
          setError(null)
          setSuggestion(result.suggestion || null)
        } else {
          setStatus('error')
          setError(result.error || 'Invalid')
          setSuggestion(result.suggestion || null)
        }
      } catch {
        // On error, don't block the user – just go idle
        if (latestValue.current === value) {
          setStatus('idle')
        }
      }
    }, delay)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, delay, enabled])

  return { status, error, suggestion, reset }
}
