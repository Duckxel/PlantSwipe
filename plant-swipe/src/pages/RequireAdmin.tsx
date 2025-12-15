import React from 'react'
import { Navigate } from '@/components/i18n/Navigate'
import { useAuth } from '@/context/AuthContext'
import { checkEditorAccess, checkFullAdminAccess, type UserRole } from '@/constants/userRoles'

type CachedProfile = {
  is_admin?: boolean | null
  roles?: UserRole[] | null
}

const getCachedProfile = (): CachedProfile | null => {
  try {
    const s = localStorage.getItem('plantswipe.profile')
    if (!s) return null
    const obj = JSON.parse(s)
    return obj ? { is_admin: obj.is_admin, roles: obj.roles } : null
  } catch {
    return null
  }
}

const getCachedIsAdmin = (): boolean | null => {
  const cached = getCachedProfile()
  if (!cached) return null
  return checkFullAdminAccess(cached) ? true : false
}

const getCachedHasEditorAccess = (): boolean | null => {
  const cached = getCachedProfile()
  if (!cached) return null
  return checkEditorAccess(cached) ? true : false
}

/**
 * RequireAdmin - Only allows full admin access
 */
export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth()

  const cachedIsAdmin = React.useMemo(() => getCachedIsAdmin(), [])
  const isAdmin = checkFullAdminAccess(profile) || cachedIsAdmin === true

  // Cached negative: fail fast
  if (cachedIsAdmin === false && !checkFullAdminAccess(profile)) {
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

/**
 * RequireEditor - Allows admin OR editor access
 * Use this for: plant creation/editing, requests, blog, notifications, emails
 */
export const RequireEditor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth()

  const cachedHasAccess = React.useMemo(() => getCachedHasEditorAccess(), [])
  const hasAccess = checkEditorAccess(profile) || cachedHasAccess === true

  // Cached negative: fail fast
  if (cachedHasAccess === false && !checkEditorAccess(profile)) {
    return <Navigate to="/" replace />
  }

  // If has access via cache, allow immediately (prevents flicker on reload)
  if (cachedHasAccess === true) return <>{children}</>

  // If we don't have a user yet, wait while auth is resolving
  if (!user) {
    return loading ? null : <Navigate to="/" replace />
  }

  // User known but profile not yet resolved: hold to avoid rendering content early
  if (user && !profile) return null

  // Final check
  if (!hasAccess) return <Navigate to="/" replace />

  return <>{children}</>
}

export default RequireAdmin
