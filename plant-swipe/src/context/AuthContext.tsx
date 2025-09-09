import React from 'react'
import { supabase, type ProfileRow } from '@/lib/supabaseClient'

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
  const [profile, setProfile] = React.useState<ProfileRow | null>(null)
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
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, liked_plant_ids')
      .eq('id', currentId)
      .maybeSingle()
    if (!error) setProfile(data as any)
  }, [])

  React.useEffect(() => {
    ;(async () => {
      await loadSession()
      await refreshProfile()
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      await loadSession()
      await refreshProfile()
    })
    return () => { sub.subscription.unsubscribe() }
  }, [loadSession, refreshProfile])

  const signUp: AuthContextValue['signUp'] = async ({ email, password, displayName }) => {
    // Ensure unique email handled by Supabase; ensure unique display_name in profiles
    // First check display_name uniqueness
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
      avatar_url: null,
      liked_plant_ids: [],
    })
    if (perr) return { error: perr.message }

    // Ensure local state updates immediately without waiting for onAuthStateChange
    await loadSession()
    await refreshProfile()
    return {}
  }

  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await refreshProfile()
    return {}
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    // Optimistically clear local state and storage to ensure UI updates immediately
    try { localStorage.removeItem('plantswipe.auth') } catch {}
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


