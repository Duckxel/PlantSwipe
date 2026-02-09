/**
 * Email address validation utilities.
 *
 * Provides multi-layered email validation:
 * 1. Format validation (RFC 5322 compliant regex)
 * 2. Domain structure checks (valid TLD, no IP literals, etc.)
 * 3. Common typo detection for popular providers
 * 4. Server-side DNS MX record verification via /api/email/validate
 *
 * Used during account creation and email change flows.
 */

// ─── Popular email domains for typo detection ───────────────────────────────
const POPULAR_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.fr',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'gmx.fr',
  'free.fr',
  'orange.fr',
  'sfr.fr',
  'laposte.net',
  'wanadoo.fr',
  'bbox.fr',
  'numericable.fr',
]

// ─── Disposable/temporary email domains (commonly used for spam) ────────────
const DISPOSABLE_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'temp-mail.org',
  'fakeinbox.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'dispostable.com',
  'yopmail.com',
  'yopmail.fr',
  'trashmail.com',
  'trashmail.me',
  'mailnesia.com',
  'maildrop.cc',
  'discard.email',
  'tmpmail.net',
  'tmpmail.org',
  'getnada.com',
  'mohmal.com',
  'burnermail.io',
  '10minutemail.com',
  'minutemail.com',
  'emailondeck.com',
  'crazymailing.com',
  'tmail.ws',
]

export type EmailValidationResult = {
  valid: boolean
  /** Error key for i18n translation (e.g., 'auth.emailErrors.invalidFormat') */
  errorKey?: string
  /** Fallback error message in English */
  error?: string
  /** Suggested correction for typos (e.g., "Did you mean gmail.com?") */
  suggestion?: string
  /** The normalized (lowercased, trimmed) email */
  normalized?: string
}

/**
 * Compute the Levenshtein distance between two strings.
 * Used for typo detection in email domains.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Find the closest popular domain to a given domain (for typo suggestions).
 * Returns the suggestion only if the distance is small enough to be a likely typo.
 */
function findClosestDomain(domain: string): string | null {
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const popular of POPULAR_DOMAINS) {
    const distance = levenshteinDistance(domain, popular)
    // Only suggest if it's a minor typo (distance 1-2)
    if (distance > 0 && distance <= 2 && distance < bestDistance) {
      bestDistance = distance
      bestMatch = popular
    }
  }

  return bestMatch
}

/**
 * Validate email format and structure (client-side only, synchronous).
 *
 * Checks:
 * - Not empty
 * - Valid format (RFC 5322 simplified)
 * - Local part length (max 64 chars)
 * - Domain part structure (valid labels, valid TLD)
 * - Not a disposable email provider
 * - Typo detection for common providers
 *
 * @param email - The email address to validate
 * @returns Validation result with error details and optional typo suggestion
 */
export function validateEmailFormat(email: string): EmailValidationResult {
  // Trim and normalize
  const trimmed = email.trim()

  if (!trimmed) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.required',
      error: 'Email address is required',
    }
  }

  const normalized = trimmed.toLowerCase()

  // Basic format check - must have exactly one @
  const atIndex = normalized.indexOf('@')
  const lastAtIndex = normalized.lastIndexOf('@')
  if (atIndex === -1 || atIndex !== lastAtIndex) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.invalidFormat',
      error: 'Please enter a valid email address',
      normalized,
    }
  }

  const localPart = normalized.slice(0, atIndex)
  const domainPart = normalized.slice(atIndex + 1)

  // Local part checks
  if (!localPart || localPart.length === 0) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.invalidFormat',
      error: 'Please enter a valid email address',
      normalized,
    }
  }

  if (localPart.length > 64) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.localPartTooLong',
      error: 'The part before @ is too long (max 64 characters)',
      normalized,
    }
  }

  // Local part: allow letters, numbers, and . _ + -
  // Must not start or end with a dot, no consecutive dots
  if (/^[.]|[.]$/.test(localPart) || /[.]{2,}/.test(localPart)) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.invalidFormat',
      error: 'Please enter a valid email address',
      normalized,
    }
  }

  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.invalidCharacters',
      error: 'Email contains invalid characters',
      normalized,
    }
  }

  // Domain part checks
  if (!domainPart || domainPart.length === 0) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.missingDomain',
      error: 'Please enter the domain part after @',
      normalized,
    }
  }

  if (domainPart.length > 253) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.domainTooLong',
      error: 'The domain name is too long',
      normalized,
    }
  }

  // Must have at least one dot in domain (e.g., example.com)
  if (!domainPart.includes('.')) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.invalidDomain',
      error: 'Please enter a valid domain (e.g., example.com)',
      normalized,
    }
  }

  // Domain labels must be valid
  const labels = domainPart.split('.')
  for (const label of labels) {
    if (!label || label.length === 0) {
      return {
        valid: false,
        errorKey: 'auth.emailErrors.invalidDomain',
        error: 'Please enter a valid domain',
        normalized,
      }
    }
    if (label.length > 63) {
      return {
        valid: false,
        errorKey: 'auth.emailErrors.invalidDomain',
        error: 'Domain label is too long',
        normalized,
      }
    }
    // Labels can only contain letters, numbers, and hyphens
    // Must not start or end with a hyphen
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return {
        valid: false,
        errorKey: 'auth.emailErrors.invalidDomain',
        error: 'Please enter a valid domain',
        normalized,
      }
    }
  }

  // TLD must be at least 2 characters and only letters
  const tld = labels[labels.length - 1]
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.invalidTld',
      error: 'Please enter a valid domain extension (e.g., .com, .fr)',
      normalized,
    }
  }

  // No IP address literals
  if (/^\[.*\]$/.test(domainPart) || /^\d+\.\d+\.\d+\.\d+$/.test(domainPart)) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.noIpDomain',
      error: 'IP address domains are not allowed',
      normalized,
    }
  }

  // Check for disposable email domains
  if (DISPOSABLE_DOMAINS.includes(domainPart)) {
    return {
      valid: false,
      errorKey: 'auth.emailErrors.disposableEmail',
      error: 'Disposable email addresses are not allowed. Please use a permanent email.',
      normalized,
    }
  }

  // Check for common typos in domain
  if (!POPULAR_DOMAINS.includes(domainPart)) {
    const suggestion = findClosestDomain(domainPart)
    if (suggestion) {
      return {
        valid: true,
        suggestion: `${localPart}@${suggestion}`,
        normalized,
      }
    }
  }

  return {
    valid: true,
    normalized,
  }
}

/**
 * Validate email by checking DNS MX records on the server.
 * This verifies that the domain can actually receive emails.
 *
 * @param email - The email address to validate (should already pass format validation)
 * @returns Promise resolving to validation result
 */
export async function validateEmailDomain(email: string): Promise<EmailValidationResult> {
  const normalized = email.trim().toLowerCase()

  try {
    const response = await fetch('/api/email/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
      credentials: 'same-origin',
    })

    if (!response.ok) {
      // If server endpoint is unavailable, don't block the user
      // Format validation already passed, so allow proceeding
      console.warn('[email-validation] Server validation unavailable, allowing email')
      return { valid: true, normalized }
    }

    const data = await response.json()

    if (!data.valid) {
      return {
        valid: false,
        errorKey: data.errorKey || 'auth.emailErrors.domainCannotReceiveEmail',
        error: data.error || 'This email domain cannot receive emails. Please check the address.',
        normalized,
      }
    }

    return { valid: true, normalized }
  } catch {
    // Network error - don't block the user, format validation already passed
    console.warn('[email-validation] Server validation failed, allowing email')
    return { valid: true, normalized }
  }
}

/**
 * Full email validation: format check + server-side DNS MX verification.
 *
 * This is the main function to call during signup and email change.
 * It first validates the format client-side, then verifies the domain
 * can receive emails via a server-side DNS lookup.
 *
 * @param email - The email address to validate
 * @returns Promise resolving to validation result with all checks
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // Step 1: Format validation (instant, client-side)
  const formatResult = validateEmailFormat(email)
  if (!formatResult.valid) {
    return formatResult
  }

  // Step 2: DNS MX record check (server-side, async)
  const domainResult = await validateEmailDomain(email)
  if (!domainResult.valid) {
    return domainResult
  }

  // Carry over any typo suggestion from format check
  return {
    valid: true,
    normalized: formatResult.normalized,
    suggestion: formatResult.suggestion,
  }
}
