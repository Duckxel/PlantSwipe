/**
 * Password validation utilities.
 *
 * Password requirements:
 * - Minimum 8 characters long
 * - At least 1 letter (a-z or A-Z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*etc.)
 *
 * Used during account creation and password change flows.
 */

export type PasswordRule = {
  /** Translation key for i18n */
  key: string
  /** Fallback label in English */
  label: string
  /** Whether this rule passes */
  met: boolean
}

export type PasswordValidationResult = {
  valid: boolean
  /** Individual rule results for UI display */
  rules: PasswordRule[]
  /** Error key for i18n (first failing rule) */
  errorKey?: string
  /** Fallback error message in English */
  error?: string
}

/**
 * Validate a password against the strength requirements.
 *
 * Returns detailed per-rule results so the UI can show which
 * criteria are met and which are not.
 *
 * @param password - The password to validate
 * @returns Validation result with per-rule details
 */
export function validatePassword(password: string): PasswordValidationResult {
  const rules: PasswordRule[] = [
    {
      key: 'auth.passwordRules.minLength',
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      key: 'auth.passwordRules.hasLetter',
      label: 'Contains a letter',
      met: /[a-zA-Z]/.test(password),
    },
    {
      key: 'auth.passwordRules.hasNumber',
      label: 'Contains a number',
      met: /[0-9]/.test(password),
    },
    {
      key: 'auth.passwordRules.hasSpecial',
      label: 'Contains a special character',
      met: /[^a-zA-Z0-9]/.test(password),
    },
  ]

  const valid = rules.every((r) => r.met)
  const firstFailing = rules.find((r) => !r.met)

  return {
    valid,
    rules,
    errorKey: firstFailing?.key,
    error: firstFailing?.label,
  }
}
