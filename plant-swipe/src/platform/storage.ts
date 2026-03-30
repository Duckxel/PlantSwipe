/**
 * Key/value storage — web first (`localStorage` / `sessionStorage`).
 * Swap implementation here later for Capacitor Preferences if needed (same API).
 */
function safeGet(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(storage: Storage | undefined, key: string): void {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const platformStorage = {
  getLocal(key: string): string | null {
    if (typeof localStorage === 'undefined') return null
    return safeGet(localStorage, key)
  },
  setLocal(key: string, value: string): boolean {
    if (typeof localStorage === 'undefined') return false
    return safeSet(localStorage, key, value)
  },
  removeLocal(key: string): void {
    if (typeof localStorage === 'undefined') return
    safeRemove(localStorage, key)
  },
  getSession(key: string): string | null {
    if (typeof sessionStorage === 'undefined') return null
    return safeGet(sessionStorage, key)
  },
  setSession(key: string, value: string): boolean {
    if (typeof sessionStorage === 'undefined') return false
    return safeSet(sessionStorage, key, value)
  },
  removeSession(key: string): void {
    if (typeof sessionStorage === 'undefined') return
    safeRemove(sessionStorage, key)
  },
}
