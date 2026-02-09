/**
 * Username validation and normalization utilities.
 * 
 * Usernames (display_name) must:
 * - Contain only URL-safe characters: letters, numbers, underscores, hyphens, and periods
 * - Be unique on a case-insensitive basis (DB enforces via lower(display_name) unique index)
 * - Be stored with the user's ORIGINAL casing (e.g. "FIVE" stays "FIVE")
 * - Be between 2 and 30 characters long
 */

// Regex pattern for valid username characters
// Allows: a-z, A-Z, 0-9, underscore, hyphen, period
// Must start and end with alphanumeric character
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/

// Minimum and maximum length
const MIN_LENGTH = 2
const MAX_LENGTH = 30

export type UsernameValidationResult = {
  valid: boolean
  error?: string
  /** The original trimmed username preserving the user's casing (for storage). */
  original?: string
  /** Lowercase version of the username (for uniqueness comparisons only). */
  normalized?: string
}

/**
 * Validates a username according to the following rules:
 * - Only contains URL-safe characters (letters, numbers, underscore, hyphen, period)
 * - Between 2 and 30 characters
 * - Starts and ends with alphanumeric character
 * - No consecutive special characters (e.g., "..", "--", "__")
 * 
 * Returns both `original` (preserving user casing, for storage) and
 * `normalized` (lowercase, for uniqueness checks).
 * 
 * @param username - The username to validate
 * @returns Object with valid boolean, optional error, original, and normalized
 */
export function validateUsername(username: string): UsernameValidationResult {
  // Trim whitespace
  const trimmed = username.trim()
  
  // Check if empty
  if (!trimmed) {
    return { valid: false, error: 'Username is required' }
  }
  
  // Check length
  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${MIN_LENGTH} characters` }
  }
  
  if (trimmed.length > MAX_LENGTH) {
    return { valid: false, error: `Username must be at most ${MAX_LENGTH} characters` }
  }
  
  // Check for invalid characters
  if (!USERNAME_PATTERN.test(trimmed)) {
    // Provide a helpful error message based on what's wrong
    if (/[^a-zA-Z0-9._-]/.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, underscores, hyphens, and periods' }
    }
    if (/^[._-]/.test(trimmed) || /[._-]$/.test(trimmed)) {
      return { valid: false, error: 'Username must start and end with a letter or number' }
    }
    return { valid: false, error: 'Invalid username format' }
  }
  
  // Check for consecutive special characters
  if (/[._-]{2,}/.test(trimmed)) {
    return { valid: false, error: 'Username cannot contain consecutive special characters' }
  }
  
  // Return both versions:
  // - original: preserves user casing (for storage in DB)
  // - normalized: lowercase (for uniqueness comparisons)
  return { valid: true, original: trimmed, normalized: trimmed.toLowerCase() }
}

/**
 * Normalizes a username to lowercase.
 * Use this for comparison/lookup purposes only, NOT for storage.
 * 
 * @param username - The username to normalize
 * @returns Lowercase, trimmed username
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

/**
 * Validates and normalizes a username in one step.
 * Returns the original (user-cased) username if valid, throws an error if invalid.
 * 
 * @param username - The username to validate and normalize
 * @returns The original (user-cased, trimmed) username
 * @throws Error if username is invalid
 */
export function validateAndNormalizeUsername(username: string): string {
  const result = validateUsername(username)
  if (!result.valid) {
    throw new Error(result.error)
  }
  return result.original!
}

/**
 * Checks if two usernames are the same (case-insensitive).
 * 
 * @param username1 - First username
 * @param username2 - Second username
 * @returns True if usernames are the same (ignoring case)
 */
export function usernamesMatch(username1: string, username2: string): boolean {
  return normalizeUsername(username1) === normalizeUsername(username2)
}
