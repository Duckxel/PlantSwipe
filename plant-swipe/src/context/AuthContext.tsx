import React from 'react'
import { supabase, type ProfileRow } from '@/lib/supabaseClient'
import { applyAccentByKey } from '@/lib/accent'

// Default timezone for users who haven't set one
const DEFAULT_TIMEZONE = 'Europe/London'

type AuthUser = {
  id: string
  email: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  profile: ProfileRow | null
  loading: boolean
  signUp: (opts: { email: string; password: string; displayName: string; recaptchaToken?: string }) => Promise<{ error?: string }>
  signIn: (opts: { email: string; password: string; recaptchaToken?: string }) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ error?: string }>
  refreshProfile: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [profile, setProfile] = React.useState<ProfileRow | null>(() => {
    try {
      const cached = localStorage.getItem('plantswipe.profile')
      return cached ? (JSON.parse(cached) as ProfileRow) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = React.useState(true)

  const loadSession = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const s = data.session
    setUser(s?.user ? { id: s.user.id, email: s.user.email ?? null } : null)
  }, [])

  const refreshProfile = React.useCallback(async () => {
    const currentId = (await supabase.auth.getUser()).data.user?.id
    if (!currentId) {
      setProfile(null)
      try { localStorage.removeItem('plantswipe.profile') } catch {}
      return
    }
    // Note: notify_push and notify_email columns may not exist yet in the database
    // They will be added when the schema migration is applied
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, liked_plant_ids, is_admin, username, country, bio, favorite_plant, avatar_url, timezone, experience_years, accent_key, is_private, disable_friend_requests')
      .eq('id', currentId)
      .maybeSingle()
    if (!error) {
      setProfile(data as any)
      
      // Auto-update timezone if missing (detect from browser, fallback to London)
      // Only auto-update if user hasn't manually set a timezone
      if (data && !data.timezone) {
        const detectedTimezone = typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
          : DEFAULT_TIMEZONE
        
        // Update in background (non-blocking)
        // This ensures users get a timezone even if they haven't visited Settings yet
        void (async () => {
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ timezone: detectedTimezone })
              .eq('id', currentId)
            
            // Update local state if update succeeded
            if (!updateError) {
              const updatedProfile = { ...data, timezone: detectedTimezone }
              setProfile(updatedProfile as any)
              try { localStorage.setItem('plantswipe.profile', JSON.stringify(updatedProfile)) } catch {}
            }
          } catch {
            // Silently fail - timezone update is non-critical
          }
        })()
      }
      
      // Persist profile alongside session so reloads can hydrate faster
      try { localStorage.setItem('plantswipe.profile', JSON.stringify(data)) } catch {}
      // Apply accent if present
      if ((data as any)?.accent_key) {
        try { applyAccentByKey((data as any).accent_key) } catch {}
      }
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      // Before first paint: load session then profile (if any) and only then render
      await loadSession()
      // Profile in background to reduce chances of startup stalls
      refreshProfile().catch(() => {})
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // Non-blocking: update in background
      loadSession()
      refreshProfile().catch(() => {})
    })
    return () => { sub.subscription.unsubscribe() }
  }, [loadSession, refreshProfile])

  const signUp: AuthContextValue['signUp'] = async ({ email, password, displayName, recaptchaToken }) => {
    // Verify reCAPTCHA token before attempting signup
    if (recaptchaToken) {
      try {
        const verifyResp = await fetch('/api/recaptcha/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: recaptchaToken, action: 'signup' }),
          credentials: 'same-origin',
        })
        const verifyResult = await verifyResp.json().catch(() => ({ success: false }))
        if (!verifyResult.success) {
          return { error: 'reCAPTCHA verification failed. Please try again.' }
        }
      } catch {
        // If verification endpoint fails, continue but log warning
        console.warn('reCAPTCHA verification endpoint failed')
      }
    }

    // Check ban by email and IP before attempting signup
    try {
      const check = await fetch(`/api/banned/check?email=${encodeURIComponent(email)}`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ banned: false }))
      if (check?.banned) return { error: 'Your account is banned. Signup is not allowed.' }
    } catch {}
    // Ensure unique email handled by Supabase; ensure unique display_name in profiles
    // First check display_name uniqueness (case-insensitive)
    const existing = await supabase.from('profiles').select('id').ilike('display_name', displayName).maybeSingle()
    if (existing.data?.id) return { error: 'Display name already taken' }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    const uid = data.user?.id
    if (!uid) return { error: 'Signup failed' }

    // Auto-detect timezone from browser, fallback to London
    const detectedTimezone = typeof Intl !== 'undefined' 
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
      : DEFAULT_TIMEZONE
    
    // Create profile row
    // Note: notify_push and notify_email columns will default to true once the migration is applied
    const { error: perr } = await supabase.from('profiles').insert({
      id: uid,
      display_name: displayName,
      liked_plant_ids: [],
      timezone: detectedTimezone,
      accent_key: 'emerald',
    })
    if (perr) return { error: perr.message }

    // Update local session immediately; profile fetch runs in background
    await loadSession()
    refreshProfile().catch(() => {})
    return {}
  }

  const signIn: AuthContextValue['signIn'] = async ({ email, password, recaptchaToken }) => {
    // Verify reCAPTCHA token before attempting login
    if (recaptchaToken) {
      try {
        const verifyResp = await fetch('/api/recaptcha/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: recaptchaToken, action: 'login' }),
          credentials: 'same-origin',
        })
        const verifyResult = await verifyResp.json().catch(() => ({ success: false }))
        if (!verifyResult.success) {
          return { error: 'reCAPTCHA verification failed. Please try again.' }
        }
      } catch {
        // If verification endpoint fails, continue but log warning
        console.warn('reCAPTCHA verification endpoint failed')
      }
    }

    // Gate sign-in if email/IP banned, and show a clear message
    try {
      const check = await fetch(`/api/banned/check?email=${encodeURIComponent(email)}`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ banned: false }))
      if (check?.banned) return { error: 'Your account has been banned.' }
    } catch {}
    // Allow login with display name (username) or email
    let loginEmail = email
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_email_by_display_name', { _name: email })
        if (!rpcErr && data) loginEmail = String(data)
      } catch {}
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) return { error: error.message }
    // Fetch profile in background; do not block sign-in completion
    refreshProfile().catch(() => {})
    return {}
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    // Optimistically clear local state and storage to ensure UI updates immediately
    try {
      localStorage.removeItem('plantswipe.auth')
      localStorage.removeItem('plantswipe.profile')
    } catch {}
    setProfile(null)
    setUser(null)
    await supabase.auth.signOut()
  }

  const deleteAccount: AuthContextValue['deleteAccount'] = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return { error: 'Not authenticated' }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return { error: 'Not authenticated' }

    try {
      const resp = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
      })
      if (!resp.ok) {
        let message = 'Failed to delete account'
        try {
          const payload = await resp.json()
          if (payload?.error && typeof payload.error === 'string') {
            message = payload.error
          }
        } catch {}
        return { error: message }
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete account' }
    }

    try {
      localStorage.removeItem('plantswipe.auth')
      localStorage.removeItem('plantswipe.profile')
    } catch {}
    setProfile(null)
    setUser(null)
    try {
      await supabase.auth.signOut()
    } catch {}
    return {}
  }

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    refreshProfile,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


