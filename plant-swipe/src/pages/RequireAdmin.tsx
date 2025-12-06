import React from 'react'
import { Navigate } from '@/components/i18n/Navigate'
import { useAuth } from '@/context/AuthContext'

const getCachedIsAdmin = (): boolean | null => {
  try {
    const s = localStorage.getItem('plantswipe.profile')
    if (!s) return null
    const obj = JSON.parse(s)
    return obj && typeof obj.is_admin === 'boolean' ? obj.is_admin : null
  } catch {
    return null
  }
}

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth()

  const cachedIsAdmin = React.useMemo(() => getCachedIsAdmin(), [])
  const isAdmin = !!profile?.is_admin || cachedIsAdmin === true

  // Cached negative: fail fast
  if (cachedIsAdmin === false || profile?.is_admin === false) {
    return <Navigate to="/" replace />
  }

  // If admin via cache, allow immediately (prevents flicker on reload)
  if (cachedIsAdmin === true) return <>{children}</>

  // If we don't have a user yet, wait while auth is resolving
  if (!user) {
    return loading ? null : <Navigate to="/" replace />
  }

  // User known but profile not yet resolved: hold to avoid rendering content early
  if (user && !profile) return null

  // Final check
  if (!isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}

export default RequireAdmin
