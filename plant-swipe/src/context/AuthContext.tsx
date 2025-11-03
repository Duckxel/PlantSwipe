import React from 'react'
import { supabase, type ProfileRow } from '@/lib/supabaseClient'
import { applyAccentByKey } from '@/lib/accent'

type AuthUser = {
  id: string
  email: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  profile: ProfileRow | null
  loading: boolean
  signUp: (opts: { email: string; password: string; displayName: string }) => Promise<{ error?: string }>
  signIn: (opts: { email: string; password: string }) => Promise<{ error?: string }>
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
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, liked_plant_ids, is_admin, username, country, bio, favorite_plant, avatar_url, timezone, experience_years, accent_key, is_private')
      .eq('id', currentId)
      .maybeSingle()
    if (!error) {
      setProfile(data as any)
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

  const signUp: AuthContextValue['signUp'] = async ({ email, password, displayName }) => {
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

    // Create profile row
    const { error: perr } = await supabase.from('profiles').insert({
      id: uid,
      display_name: displayName,
      liked_plant_ids: [],
      accent_key: 'emerald',
    })
    if (perr) return { error: perr.message }

    // Update local session immediately; profile fetch runs in background
    await loadSession()
    refreshProfile().catch(() => {})
    return {}
  }

  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
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
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) return { error: 'Not authenticated' }
    // Cannot delete auth user with anon key; require a callable function/edge or admin key.
    // For demo, we delete profile and sign out.
    await supabase.from('profiles').delete().eq('id', uid)
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
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


