import { useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { removeLanguagePrefix } from '@/lib/i18nRouting'

/**
 * Storage key for navigation history in sessionStorage
 * Using sessionStorage ensures history is cleared when the browser tab is closed
 */
const NAVIGATION_HISTORY_KEY = 'plantswipe.navigation_history'

/**
 * Maximum number of history entries to keep
 * This prevents the history from growing too large
 */
const MAX_HISTORY_SIZE = 50

/**
 * Get the path without language prefix and without query params
 * This is used to compare if two pages are "different"
 */
function getNormalizedPath(pathname: string): string {
  const withoutLang = removeLanguagePrefix(pathname)
  // Remove trailing slashes for consistent comparison
  return withoutLang.replace(/\/+$/, '') || '/'
}

/**
 * Load navigation history from sessionStorage
 */
function loadHistory(): string[] {
  try {
    const stored = sessionStorage.getItem(NAVIGATION_HISTORY_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Ignore storage errors
  }
  return []
}

/**
 * Save navigation history to sessionStorage
 */
function saveHistory(history: string[]): void {
  try {
    sessionStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook that tracks navigation history and provides a function to navigate
 * back to the last page that was different from the current one.
 * 
 * This solves the issue where clicking "back" multiple times is needed when
 * the user has navigated to the same page multiple times (e.g., creating
 * multiple plants in a row).
 * 
 * @param fallbackPath - The path to navigate to if no distinct previous page exists
 * @returns Object with navigateBack function and hasHistory boolean
 */
export function useNavigationHistory(fallbackPath: string = '/') {
  const location = useLocation()
  const navigate = useNavigate()
  const historyRef = useRef<string[]>([])
  const currentNormalizedPath = getNormalizedPath(location.pathname)

  // Initialize history from storage on mount
  useEffect(() => {
    historyRef.current = loadHistory()
  }, [])

  // Track page visits
  useEffect(() => {
    const fullPath = location.pathname + location.search
    const history = historyRef.current
    
    // Don't add duplicate consecutive entries
    if (history.length > 0 && history[history.length - 1] === fullPath) {
      return
    }
    
    // Add current page to history
    history.push(fullPath)
    
    // Trim history if it exceeds max size
    if (history.length > MAX_HISTORY_SIZE) {
      history.splice(0, history.length - MAX_HISTORY_SIZE)
    }
    
    historyRef.current = history
    saveHistory(history)
  }, [location.pathname, location.search])

  /**
   * Navigate back to the last page that has a different normalized path
   * than the current page. This skips over consecutive visits to the same page.
   * 
   * @returns true if navigation was performed, false if falling back
   */
  const navigateBack = useCallback(() => {
    const history = historyRef.current
    
    // Find the last entry with a different normalized path
    // Start from the second-to-last entry (skip current page)
    for (let i = history.length - 2; i >= 0; i--) {
      const entryPath = history[i].split('?')[0] // Remove query params for path comparison
      const normalizedEntryPath = getNormalizedPath(entryPath)
      
      if (normalizedEntryPath !== currentNormalizedPath) {
        // Found a different page - navigate to it
        const targetPath = history[i]
        
        // Remove all entries after this point (including current page)
        historyRef.current = history.slice(0, i + 1)
        saveHistory(historyRef.current)
        
        // Navigate to the found page
        navigate(targetPath)
        return true
      }
    }
    
    // No different page found in history - use fallback
    navigate(fallbackPath)
    return false
  }, [currentNormalizedPath, fallbackPath, navigate])

  /**
   * Check if there's a distinct previous page in history
   */
  const hasDistinctHistory = useCallback(() => {
    const history = historyRef.current
    
    for (let i = history.length - 2; i >= 0; i--) {
      const entryPath = history[i].split('?')[0]
      const normalizedEntryPath = getNormalizedPath(entryPath)
      
      if (normalizedEntryPath !== currentNormalizedPath) {
        return true
      }
    }
    
    return false
  }, [currentNormalizedPath])

  return {
    navigateBack,
    hasDistinctHistory: hasDistinctHistory(),
  }
}
