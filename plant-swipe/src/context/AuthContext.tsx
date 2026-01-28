import React from 'react'
import { supabase, type ProfileRow } from '@/lib/supabaseClient'
import { applyAccentByKey } from '@/lib/accent'
import { validateUsername } from '@/lib/username'
import { setUser as setSentryUser } from '@/lib/sentry'

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
  signUp: (opts: { 
    email: string; 
    password: string; 
    displayName: string; 
    recaptchaToken?: string;
    marketingConsent?: boolean;
  }) => Promise<{ error?: string }>
  signIn: (opts: { email: string; password: string; recaptchaToken?: string }) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ error?: string }>
  refreshProfile: () => Promise<void>
  updateMarketingConsent: (consent: boolean) => Promise<{ error?: string }>
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

  const clearCachedAuth = React.useCallback(() => {
    try {
      localStorage.removeItem('plantswipe.auth')
      localStorage.removeItem('plantswipe.profile')
    } catch {}
  }, [])

  const forceSignOut = React.useCallback(async () => {
    clearCachedAuth()
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
  }, [clearCachedAuth])

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
      .select('id, display_name, liked_plant_ids, is_admin, roles, username, country, bio, favorite_plant, avatar_url, timezone, language, experience_years, accent_key, is_private, disable_friend_requests, threat_level')
      .eq('id', currentId)
      .maybeSingle()
    if (!error) {
      // Check if user is banned (threat_level === 3)
      if (data?.threat_level === 3) {
        console.warn('[auth] User is banned, signing out')
        await forceSignOut()
        return
      }
      
      setProfile(data as any)
      
      // Auto-update timezone and language if missing
      // Detect from browser and update in background
      const needsTimezone = data && !data.timezone
      const needsLanguage = data && !data.language
      
      if (needsTimezone || needsLanguage) {
        const detectedTimezone = needsTimezone
          ? (typeof Intl !== 'undefined'
              ? Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
              : DEFAULT_TIMEZONE)
          : null
        
        // Detect language from browser (French if browser is French)
        const detectedLanguage = needsLanguage
          ? (() => {
              try {
                const browserLang = navigator.language || (navigator as any).languages?.[0] || ''
                return browserLang.startsWith('fr') ? 'fr' : 'en'
              } catch {
                return 'en'
              }
            })()
          : null
        
        // Update in background (non-blocking)
        void (async () => {
          try {
            const updates: Record<string, string> = {}
            if (detectedTimezone) updates.timezone = detectedTimezone
            if (detectedLanguage) updates.language = detectedLanguage
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', currentId)
            
            // Update local state if update succeeded
            if (!updateError) {
              const updatedProfile = { ...data, ...updates }
              setProfile(updatedProfile as any)
              try { localStorage.setItem('plantswipe.profile', JSON.stringify(updatedProfile)) } catch {}
            }
          } catch {
            // Silently fail - auto-detection update is non-critical
          }
        })()
      }
      
      // Persist profile alongside session so reloads can hydrate faster
      try { localStorage.setItem('plantswipe.profile', JSON.stringify(data)) } catch {}
      // Apply accent if present
      if ((data as any)?.accent_key) {
        try { applyAccentByKey((data as any).accent_key) } catch {}
      }
      // Set Sentry user context for error tracking
      // GDPR: Only send anonymous ID and display name, NOT email
      try {
        setSentryUser({
          id: currentId,
          // Only include display name (not real name or email)
          username: (data as any)?.display_name || undefined,
          // email is intentionally omitted for GDPR compliance
        })
      } catch {}
    }
  }, [forceSignOut])

  // Immediately sign out if a cached profile shows a ban
  React.useEffect(() => {
    if (profile?.threat_level === 3) {
      forceSignOut().catch(() => {})
    }
  }, [forceSignOut, profile?.threat_level])

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

  const signUp: AuthContextValue['signUp'] = async ({ email, password, displayName, recaptchaToken, marketingConsent = true }) => {
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
    // Validate and normalize the display name (username)
    const validationResult = validateUsername(displayName)
    if (!validationResult.valid) {
      return { error: validationResult.error || 'Invalid display name' }
    }
    const normalizedDisplayName = validationResult.normalized!

    // Ensure unique email handled by Supabase; ensure unique display_name in profiles
    // First check display_name uniqueness (case-insensitive, using normalized lowercase)
    const existing = await supabase.from('profiles').select('id').ilike('display_name', normalizedDisplayName).maybeSingle()
    if (existing.data?.id) return { error: 'Display name already taken' }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    const uid = data.user?.id
    if (!uid) return { error: 'Signup failed' }

    // Auto-detect timezone from browser, fallback to London
    const detectedTimezone = typeof Intl !== 'undefined' 
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
      : DEFAULT_TIMEZONE
    
    // Detect language from browser (French if browser is French, else English)
    const detectedLanguage = (() => {
      try {
        const browserLang = navigator.language || (navigator as any).languages?.[0] || ''
        return browserLang.startsWith('fr') ? 'fr' : 'en'
      } catch {
        return 'en'
      }
    })()
    
    // GDPR: Record consent timestamps for terms, privacy policy, and optional marketing
    const consentTimestamp = new Date().toISOString()
    
    // Create profile row with detected timezone, language, and GDPR consent tracking
    // Note: notify_push and notify_email columns will default to true once the migration is applied
    // Use normalized (lowercase) display name for consistent uniqueness
    const { error: perr } = await supabase.from('profiles').insert({
      id: uid,
      display_name: normalizedDisplayName,
      liked_plant_ids: [],
      timezone: detectedTimezone,
      language: detectedLanguage,
      accent_key: 'emerald',
      // GDPR consent tracking
      terms_accepted_date: consentTimestamp,
      privacy_policy_accepted_date: consentTimestamp,
      marketing_consent: marketingConsent,
      marketing_consent_date: marketingConsent ? consentTimestamp : null,
    })
    if (perr) return { error: perr.message }

    // Update local session immediately; profile fetch runs in background
    await loadSession()
    refreshProfile().catch(() => {})

    // Send welcome email (non-blocking, fire-and-forget)
    // Uses the same detected language that was saved to the profile
    if (email) {
      fetch('/api/send-automatic-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'WELCOME_EMAIL',
          userId: uid,
          userEmail: email,
          userDisplayName: normalizedDisplayName,
          userLanguage: detectedLanguage,
        }),
        credentials: 'same-origin',
      }).catch((err) => {
        console.warn('[signup] Failed to send welcome email:', err)
      })
    }

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
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) return { error: error.message }

    // Immediately validate threat level after login to prevent banned users from staying signed in
    const uid = signInData.user?.id || (await supabase.auth.getUser()).data.user?.id
    if (uid) {
      try {
        const { data: threatRow } = await supabase
          .from('profiles')
          .select('threat_level')
          .eq('id', uid)
          .maybeSingle()
        if (threatRow?.threat_level === 3) {
          await forceSignOut()
          return { error: 'Your account has been banned.' }
        }
      } catch {}
    }

    // Fetch profile in background; do not block sign-in completion
    refreshProfile().catch(() => {})
    return {}
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    // Optimistically clear local state and storage to ensure UI updates immediately
    clearCachedAuth()
    setProfile(null)
    setUser(null)
    // Clear Sentry user context
    try { setSentryUser(null) } catch {}
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
      // Use the enhanced GDPR-compliant deletion endpoint
      const resp = await fetch('/api/account/delete-gdpr', {
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
      // Clear cookie consent on account deletion
      localStorage.removeItem('cookie_consent')
    } catch {}
    setProfile(null)
    setUser(null)
    try {
      await supabase.auth.signOut()
    } catch {}
    return {}
  }

  // GDPR: Update marketing consent preference
  const updateMarketingConsent: AuthContextValue['updateMarketingConsent'] = async (consent: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return { error: 'Not authenticated' }

    try {
      const resp = await fetch('/api/account/consent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ marketingConsent: consent }),
        credentials: 'same-origin',
      })
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}))
        return { error: payload?.error || 'Failed to update consent' }
      }
      // Refresh profile to get updated consent values
      await refreshProfile()
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update consent' }
    }
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
    updateMarketingConsent,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

