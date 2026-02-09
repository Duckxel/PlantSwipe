import React from "react"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { useChangeLanguage, useLanguage } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { Settings, Mail, Lock, Trash2, AlertTriangle, Check, Globe, Monitor, Sun, Moon, Bell, Clock, Shield, User, Eye, EyeOff, ChevronDown, ChevronUp, MapPin, Calendar, Download, FileText, ExternalLink, Palette, Loader2, X } from "lucide-react"
import { Link } from "@/components/i18n/Link"
import { SUPPORTED_LANGUAGES } from "@/lib/i18n"
import usePushSubscription from "@/hooks/usePushSubscription"
import { ACCENT_OPTIONS, applyAccentByKey, saveAccentKey, type AccentKey } from "@/lib/accent"
import { SearchInput } from "@/components/ui/search-input"
import { useDebounce } from "@/hooks/useDebounce"
import { validateEmail, validateEmailFormat, validateEmailDomain } from "@/lib/emailValidation"
import { validatePassword } from "@/lib/passwordValidation"
import { ValidatedInput } from "@/components/ui/validated-input"
import { PasswordRules } from "@/components/ui/password-rules"
import { useFieldValidation } from "@/hooks/useFieldValidation"

type SettingsTab = 'account' | 'notifications' | 'privacy' | 'preferences' | 'danger'

interface LocationSuggestion {
  id: number
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

/**
 * Fetch a CSRF token for security-sensitive operations
 * Tokens are single-use and expire after 15 minutes
 */
async function getCsrfToken(): Promise<string> {
  const session = (await supabase.auth.getSession()).data.session
  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch('/api/csrf-token', {
    method: 'GET',
    headers,
    credentials: 'same-origin',
  })
  
  if (!response.ok) {
    throw new Error('Failed to get CSRF token')
  }
  
  const data = await response.json()
  return data.token
}

export default function SettingsPage() {
  const { user, profile, refreshProfile, deleteAccount, signOut } = useAuth()
  const navigate = useLanguageNavigate()
  const changeLanguage = useChangeLanguage()
  const currentLang = useLanguage()
  const { t } = useTranslation('common')
  const { theme, setTheme } = useTheme()
  const {
    supported: pushSupported,
    permission: pushPermission,
    subscribed: pushSubscribed,
    loading: pushLoading,
    error: pushError,
    enable: enablePush,
    disable: disablePush,
    refresh: refreshPush
  } = usePushSubscription(user?.id ?? null)

  // Tab state
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('account')

  // Form states
  const [email, setEmail] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  // Debounced validation for new email field
  const newEmailValidation = useFieldValidation(
    newEmail,
    React.useCallback(async (val: string) => {
      if (val === email) return { valid: false, error: t('settings.email.enterNewEmail') }
      const fmt = validateEmailFormat(val)
      if (!fmt.valid) return { valid: false, error: t(fmt.errorKey || 'auth.emailErrors.invalidFormat', { defaultValue: fmt.error }) }
      const dns = await validateEmailDomain(val)
      if (!dns.valid) return { valid: false, error: t(dns.errorKey || 'auth.emailErrors.domainCannotReceiveEmail', { defaultValue: dns.error }) }
      const suggestionText = fmt.suggestion ? t('auth.emailSuggestion', { defaultValue: 'Did you mean {{suggestion}}?', suggestion: fmt.suggestion }) : undefined
      return { valid: true, suggestion: suggestionText }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email, t]),
    400,
  )

  // Debounced validation for new password
  const newPasswordResult = React.useMemo(() => validatePassword(newPassword), [newPassword])
  const newPasswordValidation = useFieldValidation(
    newPassword,
    React.useCallback(async (val: string) => {
      const r = validatePassword(val)
      if (!r.valid) return { valid: false, error: r.error }
      return { valid: true }
    }, []),
    400,
  )

  // Debounced validation for confirm password
  const confirmPasswordValidation = useFieldValidation(
    confirmPassword,
    React.useCallback(async (val: string) => {
      if (!newPassword) return { valid: false, error: t('settings.password.passwordsDontMatch') }
      if (val !== newPassword) return { valid: false, error: t('settings.password.passwordsDontMatch') }
      return { valid: true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newPassword, t]),
    400,
  )

  // UI toggle states
  const [showEmail, setShowEmail] = React.useState(false)
  const [showNewEmailForm, setShowNewEmailForm] = React.useState(false)
  const [showPasswordForm, setShowPasswordForm] = React.useState(false)
  const [isPrivate, setIsPrivate] = React.useState(false)
  const [disableFriendRequests, setDisableFriendRequests] = React.useState(false)
  const [gardenInvitePrivacy, setGardenInvitePrivacy] = React.useState<'anyone' | 'friends_only'>('anyone')
  const [notifyPush, setNotifyPush] = React.useState(true)
  const [notifyEmail, setNotifyEmail] = React.useState(true)
  const [timezone, setTimezone] = React.useState<string>("")
  const [country, setCountry] = React.useState("")
  const [city, setCity] = React.useState("")
  const [notificationHour, setNotificationHour] = React.useState<number>(10)
  const [detectingLocation, setDetectingLocation] = React.useState(false)
  const [gardenType, setGardenType] = React.useState("")
  const [experienceLevel, setExperienceLevel] = React.useState("")
  const [lookingFor, setLookingFor] = React.useState("")
  const [locationSearch, setLocationSearch] = React.useState("")
  const debouncedLocationSearch = useDebounce(locationSearch, 350)
  const [locationSuggestions, setLocationSuggestions] = React.useState<LocationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [searchingLocation, setSearchingLocation] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const suggestionsRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)
  
  // GDPR consent states
  const [marketingConsent, setMarketingConsent] = React.useState(false)
  const [marketingConsentDate, setMarketingConsentDate] = React.useState<string | null>(null)
  const [termsAcceptedDate, setTermsAcceptedDate] = React.useState<string | null>(null)
  const [privacyAcceptedDate, setPrivacyAcceptedDate] = React.useState<string | null>(null)
  const [exporting, setExporting] = React.useState(false)
  
  // Granular email preferences
  const [emailProductUpdates, setEmailProductUpdates] = React.useState(true)
  const [emailTipsAdvice, setEmailTipsAdvice] = React.useState(true)
  const [emailCommunityHighlights, setEmailCommunityHighlights] = React.useState(true)
  const [emailPromotions, setEmailPromotions] = React.useState(false)
  
  // Granular push preferences
  const [pushTaskReminders, setPushTaskReminders] = React.useState(true)
  const [pushFriendActivity, setPushFriendActivity] = React.useState(true)
  const [pushMessages, setPushMessages] = React.useState(true)
  const [pushGardenUpdates, setPushGardenUpdates] = React.useState(true)
  
  // Personalization preferences
  const [personalizedRecommendations, setPersonalizedRecommendations] = React.useState(true)
  const [analyticsImprovement, setAnalyticsImprovement] = React.useState(true)

  // Get detected timezone from browser
  const detectedTimezone = React.useMemo(() => {
    if (typeof Intl !== 'undefined') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
    }
    return 'Europe/London'
  }, [])

  // Common timezones list with UTC offsets
  const commonTimezones = React.useMemo(() => {
    const now = new Date()
    const getOffset = (tz: string): string => {
      try {
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }))
        const offsetMs = tzDate.getTime() - utcDate.getTime()
        const offsetHours = offsetMs / (1000 * 60 * 60)
        const sign = offsetHours >= 0 ? '+' : ''
        const hours = Math.floor(Math.abs(offsetHours))
        const minutes = Math.floor((Math.abs(offsetHours) - hours) * 60)
        return minutes === 0 
          ? `UTC${sign}${hours}` 
          : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`
      } catch {
        return ''
      }
    }

    return [
      { value: 'Europe/London', label: `London (GMT/BST) - ${getOffset('Europe/London')}` },
      { value: 'Europe/Paris', label: `Paris (CET/CEST) - ${getOffset('Europe/Paris')}` },
      { value: 'Europe/Berlin', label: `Berlin (CET/CEST) - ${getOffset('Europe/Berlin')}` },
      { value: 'Europe/Rome', label: `Rome (CET/CEST) - ${getOffset('Europe/Rome')}` },
      { value: 'Europe/Madrid', label: `Madrid (CET/CEST) - ${getOffset('Europe/Madrid')}` },
      { value: 'Europe/Amsterdam', label: `Amsterdam (CET/CEST) - ${getOffset('Europe/Amsterdam')}` },
      { value: 'Europe/Stockholm', label: `Stockholm (CET/CEST) - ${getOffset('Europe/Stockholm')}` },
      { value: 'Europe/Zurich', label: `Zurich (CET/CEST) - ${getOffset('Europe/Zurich')}` },
      { value: 'Europe/Vienna', label: `Vienna (CET/CEST) - ${getOffset('Europe/Vienna')}` },
      { value: 'Europe/Brussels', label: `Brussels (CET/CEST) - ${getOffset('Europe/Brussels')}` },
      { value: 'America/New_York', label: `New York (EST/EDT) - ${getOffset('America/New_York')}` },
      { value: 'America/Chicago', label: `Chicago (CST/CDT) - ${getOffset('America/Chicago')}` },
      { value: 'America/Denver', label: `Denver (MST/MDT) - ${getOffset('America/Denver')}` },
      { value: 'America/Los_Angeles', label: `Los Angeles (PST/PDT) - ${getOffset('America/Los_Angeles')}` },
      { value: 'America/Toronto', label: `Toronto (EST/EDT) - ${getOffset('America/Toronto')}` },
      { value: 'America/Vancouver', label: `Vancouver (PST/PDT) - ${getOffset('America/Vancouver')}` },
      { value: 'America/Mexico_City', label: `Mexico City (CST/CDT) - ${getOffset('America/Mexico_City')}` },
      { value: 'America/Sao_Paulo', label: `São Paulo (BRT/BRST) - ${getOffset('America/Sao_Paulo')}` },
      { value: 'America/Buenos_Aires', label: `Buenos Aires (ART) - ${getOffset('America/Buenos_Aires')}` },
      { value: 'Asia/Tokyo', label: `Tokyo (JST) - ${getOffset('Asia/Tokyo')}` },
      { value: 'Asia/Shanghai', label: `Shanghai (CST) - ${getOffset('Asia/Shanghai')}` },
      { value: 'Asia/Hong_Kong', label: `Hong Kong (HKT) - ${getOffset('Asia/Hong_Kong')}` },
      { value: 'Asia/Singapore', label: `Singapore (SGT) - ${getOffset('Asia/Singapore')}` },
      { value: 'Asia/Dubai', label: `Dubai (GST) - ${getOffset('Asia/Dubai')}` },
      { value: 'Asia/Kolkata', label: `Mumbai/Delhi (IST) - ${getOffset('Asia/Kolkata')}` },
      { value: 'Asia/Seoul', label: `Seoul (KST) - ${getOffset('Asia/Seoul')}` },
      { value: 'Australia/Sydney', label: `Sydney (AEDT/AEST) - ${getOffset('Australia/Sydney')}` },
      { value: 'Australia/Melbourne', label: `Melbourne (AEDT/AEST) - ${getOffset('Australia/Melbourne')}` },
      { value: 'Australia/Brisbane', label: `Brisbane (AEST) - ${getOffset('Australia/Brisbane')}` },
      { value: 'Pacific/Auckland', label: `Auckland (NZDT/NZST) - ${getOffset('Pacific/Auckland')}` },
      { value: 'Africa/Cairo', label: `Cairo (EET) - ${getOffset('Africa/Cairo')}` },
      { value: 'Africa/Johannesburg', label: `Johannesburg (SAST) - ${getOffset('Africa/Johannesburg')}` },
      { value: 'UTC', label: 'UTC (Coordinated Universal Time) - UTC+0' },
    ]
  }, [])

  const parseNotificationHour = (value?: string | null) => {
    if (!value) return 10
    const digits = value.replace(/[^\d]/g, '')
    const parsed = digits ? Number.parseInt(digits, 10) : 10
    if (Number.isNaN(parsed)) return 10
    return Math.min(23, Math.max(0, parsed))
  }

  const notificationHourOptions = React.useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        value: String(hour),
        label: `${String(hour).padStart(2, '0')}:00`,
      })),
    []
  )

  const heroCardClass =
    "relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#1b1b1f] dark:via-[#121214] dark:to-[#050506] p-6 md:p-10 shadow-[0_35px_60px_-15px_rgba(16,185,129,0.35)]"
  const glassCard =
    "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#151517]/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)]"

  // Function to partially censor email
  const censorEmail = (email: string): string => {
    if (!email || email.length === 0) return email
    const [localPart, domain] = email.split('@')
    if (!domain) return email
    
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`
    }
    const visibleStart = localPart.substring(0, 2)
    const visibleEnd = localPart.substring(localPart.length - 1)
    const censored = '*'.repeat(Math.max(3, localPart.length - 3))
    return `${visibleStart}${censored}${visibleEnd}@${domain}`
  }

  // Load current user data
  React.useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        navigate("/")
        return
      }

      try {
        // Get current email
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser?.email) {
          setEmail(authUser.email)
        }

        // Load profile settings
        if (profile) {
          setIsPrivate(Boolean((profile as any).is_private || false))
          setDisableFriendRequests(Boolean((profile as any).disable_friend_requests || false))
          setGardenInvitePrivacy((profile as any).garden_invite_privacy || 'anyone')
          const savedTimezone = (profile as any).timezone
          setTimezone(savedTimezone || detectedTimezone)
          setCountry((profile as any).country || '')
          setCity((profile as any).city || '')
          setNotificationHour(parseNotificationHour((profile as any).notification_time))
          setGardenType((profile as any).garden_type || '')
          setExperienceLevel((profile as any).experience_level || '')
          setLookingFor((profile as any).looking_for || '')
        } else {
          // Fetch profile if not loaded
          const { data } = await supabase
            .from('profiles')
            .select('is_private, disable_friend_requests, garden_invite_privacy, timezone, country, city, notification_time, garden_type, experience_level, looking_for')
            .eq('id', user.id)
            .maybeSingle()
          if (data) {
            setIsPrivate(Boolean(data.is_private || false))
            setDisableFriendRequests(Boolean(data.disable_friend_requests || false))
            setGardenInvitePrivacy((data as any).garden_invite_privacy || 'anyone')
            setTimezone(data.timezone || detectedTimezone)
            setCountry((data as any).country || '')
            setCity((data as any).city || '')
            setNotificationHour(parseNotificationHour((data as any).notification_time))
            setGardenType((data as any).garden_type || '')
            setExperienceLevel((data as any).experience_level || '')
            setLookingFor((data as any).looking_for || '')
          } else {
            setTimezone(detectedTimezone)
          }
        }

        // Try to fetch notification preferences (columns may not exist yet)
        try {
          const { data: notifData } = await supabase
            .from('profiles')
            .select('notify_push, notify_email')
            .eq('id', user.id)
            .maybeSingle()
          if (notifData) {
            // Notification preferences default to true if not set (null)
            setNotifyPush(notifData.notify_push !== false)
            setNotifyEmail(notifData.notify_email !== false)
          }
        } catch {
          // Columns don't exist yet - use defaults (enabled)
          setNotifyPush(true)
          setNotifyEmail(true)
        }

        // Try to fetch GDPR consent data (columns may not exist yet)
        try {
          const { data: consentData } = await supabase
            .from('profiles')
            .select('marketing_consent, marketing_consent_date, terms_accepted_date, privacy_policy_accepted_date, email_product_updates, email_tips_advice, email_community_highlights, email_promotions, push_task_reminders, push_friend_activity, push_messages, push_garden_updates, personalized_recommendations, analytics_improvement')
            .eq('id', user.id)
            .maybeSingle()
          if (consentData) {
            setMarketingConsent(Boolean(consentData.marketing_consent))
            setMarketingConsentDate(consentData.marketing_consent_date || null)
            setTermsAcceptedDate(consentData.terms_accepted_date || null)
            setPrivacyAcceptedDate(consentData.privacy_policy_accepted_date || null)
            // Granular email preferences (default to true if null)
            setEmailProductUpdates(consentData.email_product_updates !== false)
            setEmailTipsAdvice(consentData.email_tips_advice !== false)
            setEmailCommunityHighlights(consentData.email_community_highlights !== false)
            setEmailPromotions(Boolean(consentData.email_promotions))
            // Granular push preferences (default to true if null)
            setPushTaskReminders(consentData.push_task_reminders !== false)
            setPushFriendActivity(consentData.push_friend_activity !== false)
            setPushMessages(consentData.push_messages !== false)
            setPushGardenUpdates(consentData.push_garden_updates !== false)
            // Personalization preferences (default to true if null)
            setPersonalizedRecommendations(consentData.personalized_recommendations !== false)
            setAnalyticsImprovement(consentData.analytics_improvement !== false)
          }
        } catch {
          // Columns don't exist yet - use defaults
          setMarketingConsent(false)
        }
      } catch (e: any) {
        setError(e?.message || t('settings.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, profile, navigate])

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  React.useEffect(() => {
    if (debouncedLocationSearch.length < 2) {
      setLocationSuggestions([])
      setHasSearched(false)
      return
    }

    let cancelled = false
    const searchLocations = async () => {
      setSearchingLocation(true)
      try {
        const resp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(debouncedLocationSearch)}&count=8&language=${currentLang}&format=json`
        )
        if (cancelled) return

        if (resp.ok) {
          const data = await resp.json()
          if (cancelled) return

          if (data.results && Array.isArray(data.results)) {
            setLocationSuggestions(
              data.results.map((r: any) => ({
                id: r.id,
                name: r.name,
                country: r.country || '',
                admin1: r.admin1 || '',
                latitude: r.latitude,
                longitude: r.longitude,
                timezone: r.timezone,
              }))
            )
          } else {
            setLocationSuggestions([])
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[settings] Location search failed:', err)
          setLocationSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setSearchingLocation(false)
          setHasSearched(true)
        }
      }
    }

    searchLocations()

    return () => {
      cancelled = true
    }
  }, [debouncedLocationSearch, currentLang])

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === email) {
      setError(t('settings.email.enterNewEmail'))
      return
    }

    // Gate on debounced validation result (already computed by hook)
    if (newEmailValidation.status !== 'valid') {
      // If still validating, run a final synchronous check
      const emailCheck = await validateEmail(newEmail)
      if (!emailCheck.valid) {
        setError(t(emailCheck.errorKey || 'settings.email.enterValidEmail', { defaultValue: emailCheck.error }))
        return
      }
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Get CSRF token and auth session for security-sensitive operations
      const csrfToken = await getCsrfToken()
      const session = (await supabase.auth.getSession()).data.session
      
      // Build secure headers with both CSRF and Authorization
      const secureHeaders: Record<string, string> = { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      }
      if (session?.access_token) {
        secureHeaders['Authorization'] = `Bearer ${session.access_token}`
      }
      
      // Check if email is already in use by another user (CSRF + Auth protected)
      const checkResponse = await fetch('/api/security/check-email-available', {
        method: 'POST',
        headers: secureHeaders,
        body: JSON.stringify({ 
          email: newEmail,
          currentUserId: user?.id 
        }),
        credentials: 'same-origin',
      })
      
      // Handle security errors (CSRF, Auth)
      if (checkResponse.status === 401 || checkResponse.status === 403) {
        const errorData = await checkResponse.json().catch(() => ({}))
        if (errorData.code === 'CSRF_INVALID') {
          throw new Error(t('settings.security.csrfError', { defaultValue: 'Security validation failed. Please refresh the page and try again.' }))
        }
        if (errorData.code === 'AUTH_REQUIRED' || errorData.code === 'AUTH_MISMATCH') {
          throw new Error(t('settings.security.authError', { defaultValue: 'Authentication failed. Please sign in again and retry.' }))
        }
        // Generic auth error
        throw new Error(errorData.error || t('settings.security.authError', { defaultValue: 'Authentication failed. Please sign in again and retry.' }))
      }
      
      const checkResult = await checkResponse.json().catch(() => ({ available: true }))
      
      if (!checkResult.available) {
        throw new Error(t('settings.email.emailAlreadyInUse', { defaultValue: 'This email is already in use by another account.' }))
      }

      const oldEmailAddress = email // Store old email before change
      
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (updateError) throw updateError

      // Reset email_verified to false since user is changing their email
      // They will need to verify the new email address via OTP
      if (user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ email_verified: false })
          .eq('id', user.id)
        
        if (profileError) {
          console.warn('[email-change] Failed to reset email_verified:', profileError)
        }
      }

      // Get fresh CSRF token and session for subsequent requests
      const [freshCsrfToken, sessionRes] = await Promise.all([
        getCsrfToken(), 
        supabase.auth.getSession()
      ])
      
      const secureApiHeaders: Record<string, string> = { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': freshCsrfToken,
      }
      if (sessionRes.data.session?.access_token) {
        secureApiHeaders['Authorization'] = `Bearer ${sessionRes.data.session.access_token}`
      }

      // Send notification to OLD email about the change (security alert)
      if (user?.id && oldEmailAddress) {
        fetch('/api/security/email-changed-notification', {
          method: 'POST',
          headers: secureApiHeaders,
          body: JSON.stringify({
            userId: user.id,
            oldEmail: oldEmailAddress,
            newEmail: newEmail,
            userDisplayName: profile?.display_name || 'User',
            userLanguage: (profile as any)?.language || currentLang || 'en',
          }),
          credentials: 'same-origin',
        }).catch((err) => {
          console.warn('[email-change] Failed to send notification to old email:', err)
        })
      }

      // Send OTP verification code to the NEW email address
      // User will need to verify their new email before continuing
      try {
        await fetch('/api/email-verification/send', {
          method: 'POST',
          headers: secureApiHeaders,
          body: JSON.stringify({
            language: (profile as any)?.language || currentLang || 'en',
          }),
          credentials: 'same-origin',
        })
      } catch (err) {
        console.warn('[email-change] Failed to send verification code to new email:', err)
      }

      // Refresh profile to get the updated email_verified status
      await refreshProfile()
      
      // Redirect to email verification page for OTP verification
      navigate('/verify-email')
    } catch (e: any) {
      setError(e?.message || t('settings.email.failedToUpdate'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      setError(t('settings.password.enterCurrentPassword'))
      return
    }

    if (!validatePassword(newPassword).valid) {
      setError(t('auth.passwordRules.tooWeak', { defaultValue: 'Password does not meet the requirements' }))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('settings.password.passwordsDontMatch'))
      return
    }

    // Check if new password is the same as current password
    if (newPassword === currentPassword) {
      setError(t('settings.password.newPasswordSameAsCurrent', { defaultValue: 'New password must be different from your current password.' }))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword
      })

      if (signInError) {
        throw new Error(t('settings.password.currentPasswordIncorrect'))
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      // Send password change confirmation email (CSRF + Auth protected, non-blocking)
      if (user?.id && email) {
        Promise.all([getCsrfToken(), supabase.auth.getSession()]).then(([csrfToken, sessionRes]) => {
          const pwHeaders: Record<string, string> = { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          }
          if (sessionRes.data.session?.access_token) {
            pwHeaders['Authorization'] = `Bearer ${sessionRes.data.session.access_token}`
          }
          fetch('/api/security/password-changed', {
            method: 'POST',
            headers: pwHeaders,
            body: JSON.stringify({
              userId: user.id,
              userEmail: email,
              userDisplayName: profile?.display_name || 'User',
              userLanguage: (profile as any)?.language || 'en',
              // Browser will auto-detect device from user-agent on server
            }),
            credentials: 'same-origin',
          })
        }).catch((err) => {
          console.warn('[password-change] Failed to send confirmation email:', err)
        })
      }

      setSuccess(t('settings.password.updated'))
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: any) {
      setError(e?.message || t('settings.password.failedToUpdate'))
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePrivacy = async () => {
    if (!user?.id) return

    const newPrivacyValue = !isPrivate
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_private: newPrivacyValue })
        .eq('id', user.id)

      if (updateError) throw updateError

      setIsPrivate(newPrivacyValue)
      setSuccess(newPrivacyValue ? t('settings.privacy.profileNowPrivate') : t('settings.privacy.profileNowPublic'))
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('settings.privacy.failedToUpdate'))
      setIsPrivate(!newPrivacyValue)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleFriendRequests = async () => {
    if (!user?.id) return

    const newValue = !disableFriendRequests
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ disable_friend_requests: newValue })
        .eq('id', user.id)

      if (updateError) throw updateError

      setDisableFriendRequests(newValue)
      setSuccess(newValue ? t('settings.friendRequests.friendRequestsNowDisabled') : t('settings.friendRequests.friendRequestsNowEnabled'))
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('settings.friendRequests.failedToUpdate'))
      setDisableFriendRequests(!newValue)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleGardenInvitePrivacy = async () => {
    if (!user?.id) return

    const newValue = gardenInvitePrivacy === 'anyone' ? 'friends_only' : 'anyone'
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ garden_invite_privacy: newValue })
        .eq('id', user.id)

      if (updateError) {
        // Column might not exist yet - show helpful message
        if (updateError.message?.includes('column') || updateError.code === '42703') {
          throw new Error(t('gardenInvites.columnNotReady', { defaultValue: 'This feature is not available yet.' }))
        }
        throw updateError
      }

      setGardenInvitePrivacy(newValue)
      setSuccess(newValue === 'friends_only' 
        ? t('gardenInvites.privacyFriendsOnly', { defaultValue: 'Only friends can invite me' })
        : t('gardenInvites.privacyAnyone', { defaultValue: 'Anyone can invite me' })
      )
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('gardenInvites.failedToUpdate', { defaultValue: 'Failed to update privacy setting' }))
      // Revert to opposite of what was attempted
      setGardenInvitePrivacy(newValue === 'anyone' ? 'friends_only' : 'anyone')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleNotifyPush = async () => {
    if (!user?.id) return

    const newValue = !notifyPush
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ notify_push: newValue })
        .eq('id', user.id)

      if (updateError) {
        // Column might not exist yet - show helpful message
        if (updateError.message?.includes('column') || updateError.code === '42703') {
          throw new Error(t('settings.notifications.columnNotReady', { defaultValue: 'This feature is not available yet. Please wait for the database update.' }))
        }
        throw updateError
      }

      setNotifyPush(newValue)
      setSuccess(newValue 
        ? t('settings.notifications.pushEnabled', { defaultValue: 'Push notifications enabled' })
        : t('settings.notifications.pushDisabled', { defaultValue: 'Push notifications disabled' })
      )
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('settings.notifications.failedToUpdate', { defaultValue: 'Failed to update notification setting' }))
      setNotifyPush(!newValue)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleNotifyEmail = async () => {
    if (!user?.id) return

    const newValue = !notifyEmail
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ notify_email: newValue })
        .eq('id', user.id)

      if (updateError) {
        // Column might not exist yet - show helpful message
        if (updateError.message?.includes('column') || updateError.code === '42703') {
          throw new Error(t('settings.notifications.columnNotReady', { defaultValue: 'This feature is not available yet. Please wait for the database update.' }))
        }
        throw updateError
      }

      setNotifyEmail(newValue)
      setSuccess(newValue 
        ? t('settings.notifications.emailEnabled', { defaultValue: 'Email campaigns enabled' })
        : t('settings.notifications.emailDisabled', { defaultValue: 'Email campaigns disabled' })
      )
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('settings.notifications.failedToUpdate', { defaultValue: 'Failed to update notification setting' }))
      setNotifyEmail(!newValue)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateNotificationHour = async (nextHour: number) => {
    if (!user?.id) return

    const previousHour = notificationHour
    setNotificationHour(nextHour)
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ notification_time: `${nextHour}h` })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      setSuccess(t('common.saved', { defaultValue: 'Saved' }))
    } catch (e: any) {
      setNotificationHour(previousHour)
      setError(e?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateLocation = async (overrides?: { country?: string; city?: string; timezone?: string }) => {
    if (!user?.id) return

    const nextCountry = (overrides?.country ?? country).trim()
    const nextCity = (overrides?.city ?? city).trim()
    const nextTimezone = overrides?.timezone

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updates: { country?: string | null; city?: string | null; timezone?: string | null } = {
        country: nextCountry || null,
        city: nextCity || null,
      }
      if (nextTimezone) {
        updates.timezone = nextTimezone
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (updateError) throw updateError

      if (nextTimezone) {
        setTimezone(nextTimezone)
      }
      await refreshProfile()
      setSuccess(t('common.saved', { defaultValue: 'Saved' }))
    } catch (e: any) {
      setError(e?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSetupField = async (
    field: 'garden_type' | 'experience_level' | 'looking_for',
    nextValue: string,
    previousValue: string,
    setValue: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!user?.id) return

    setValue(nextValue)
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [field]: nextValue || null })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      setSuccess(t('common.saved', { defaultValue: 'Saved' }))
    } catch (e: any) {
      setValue(previousValue)
      setError(e?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDetectLocation = async () => {
    setDetectingLocation(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('https://ipapi.co/json/')
      if (!response.ok) {
        throw new Error(t('setup.location.detectFailed', { defaultValue: 'Unable to detect location. Please enter it manually.' }))
      }

      const data = await response.json()
      const nextCountry = data.country_name || ''
      const nextCity = data.city || ''
      const nextTimezone = data.timezone || ''

      if (!nextCountry && !nextCity) {
        throw new Error(t('setup.location.detectFailed', { defaultValue: 'Unable to detect location. Please enter it manually.' }))
      }

      setCountry(nextCountry)
      setCity(nextCity)
      if (nextTimezone) {
        setTimezone(nextTimezone)
      }
      setLocationSearch('')
      setLocationSuggestions([])
      setShowSuggestions(false)
      setHasSearched(false)

      await handleUpdateLocation({
        country: nextCountry,
        city: nextCity,
        timezone: nextTimezone || undefined,
      })
    } catch (e: any) {
      setError(e?.message || t('setup.location.detectFailed', { defaultValue: 'Unable to detect location. Please enter it manually.' }))
    } finally {
      setDetectingLocation(false)
    }
  }

  const handleLocationSearchChange = (value: string) => {
    setLocationSearch(value)
    setShowSuggestions(true)
    if (value !== debouncedLocationSearch) {
      setHasSearched(false)
    }
  }

  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    const nextCity = suggestion.name || ''
    const nextCountry = suggestion.country || ''
    const nextTimezone = suggestion.timezone || ''

    setCity(nextCity)
    setCountry(nextCountry)
    if (nextTimezone) {
      setTimezone(nextTimezone)
    }
    setLocationSearch('')
    setLocationSuggestions([])
    setShowSuggestions(false)
    setHasSearched(false)
    void handleUpdateLocation({
      city: nextCity,
      country: nextCountry,
      timezone: nextTimezone || undefined,
    })
  }

  const handleClearLocation = () => {
    setCity('')
    setCountry('')
    setLocationSearch('')
    setLocationSuggestions([])
    setShowSuggestions(false)
    setHasSearched(false)
    void handleUpdateLocation({ city: '', country: '' })
  }

  const handleUpdateTimezone = async () => {
    if (!user?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ timezone: timezone || detectedTimezone })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess(t('settings.timezone.updated', { defaultValue: 'Timezone updated successfully' }))
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('settings.timezone.failedToUpdate', { defaultValue: 'Failed to update timezone' }))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm || deleteConfirmText !== "DELETE") {
      setError(t('settings.dangerZone.typeDeleteToConfirm'))
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const result = await deleteAccount()
      if (result?.error) {
        throw new Error(result.error)
      }

      await signOut()
      navigate("/")
    } catch (e: any) {
      setError(e?.message || t('settings.dangerZone.failedToDelete'))
      setDeleting(false)
    }
  }

  // GDPR: Toggle marketing consent
  const handleToggleMarketingConsent = async () => {
    if (!user?.id) return

    const newValue = !marketingConsent
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/account/consent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ marketingConsent: newValue }),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update consent')
      }

      const result = await response.json()
      setMarketingConsent(newValue)
      setMarketingConsentDate(result.updatedAt || new Date().toISOString())
      setSuccess(t('gdpr.consentUpdated', { defaultValue: 'Your preferences have been saved.' }))
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t('gdpr.consentUpdateFailed', { defaultValue: 'Failed to update consent preferences' }))
      setMarketingConsent(!newValue)
    } finally {
      setSaving(false)
    }
  }

  // GDPR: Export user data
  const handleExportData = async () => {
    if (!user?.id) return

    setExporting(true)
    setError(null)

    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/account/export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export data')
      }

      // Download the JSON file
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aphylia-data-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess(t('gdpr.exportSuccess', { defaultValue: 'Your data has been exported successfully.' }))
    } catch (e: any) {
      setError(e?.message || t('gdpr.exportFailed', { defaultValue: 'Failed to export your data' }))
    } finally {
      setExporting(false)
    }
  }

  // Format date for display
  const formatConsentDate = (dateStr: string | null): string => {
    if (!dateStr) return t('gdpr.notSet', { defaultValue: 'Not set' })
    try {
      return new Date(dateStr).toLocaleDateString(currentLang, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  // Generic preference update handler
  const handleUpdatePreference = async (
    column: string, 
    newValue: boolean, 
    setState: React.Dispatch<React.SetStateAction<boolean>>,
    successKey: string,
    errorKey: string
  ) => {
    if (!user?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [column]: newValue })
        .eq('id', user.id)

      if (updateError) {
        if (updateError.message?.includes('column') || updateError.code === '42703') {
          throw new Error(t('settings.columnNotReady', { defaultValue: 'This feature is not available yet.' }))
        }
        throw updateError
      }

      setState(newValue)
      setSuccess(t(successKey, { defaultValue: 'Preference updated' }))
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || t(errorKey, { defaultValue: 'Failed to update preference' }))
      setState(!newValue)
    } finally {
      setSaving(false)
    }
  }

  // Granular preference handlers
  const handleToggleEmailProductUpdates = () => handleUpdatePreference(
    'email_product_updates', !emailProductUpdates, setEmailProductUpdates,
    'prefs.emailProductUpdatesSuccess', 'prefs.updateFailed'
  )
  const handleToggleEmailTipsAdvice = () => handleUpdatePreference(
    'email_tips_advice', !emailTipsAdvice, setEmailTipsAdvice,
    'prefs.emailTipsAdviceSuccess', 'prefs.updateFailed'
  )
  const handleToggleEmailCommunityHighlights = () => handleUpdatePreference(
    'email_community_highlights', !emailCommunityHighlights, setEmailCommunityHighlights,
    'prefs.emailCommunitySuccess', 'prefs.updateFailed'
  )
  const handleToggleEmailPromotions = () => handleUpdatePreference(
    'email_promotions', !emailPromotions, setEmailPromotions,
    'prefs.emailPromotionsSuccess', 'prefs.updateFailed'
  )
  const handleTogglePushTaskReminders = () => handleUpdatePreference(
    'push_task_reminders', !pushTaskReminders, setPushTaskReminders,
    'prefs.pushTaskRemindersSuccess', 'prefs.updateFailed'
  )
  const handleTogglePushFriendActivity = () => handleUpdatePreference(
    'push_friend_activity', !pushFriendActivity, setPushFriendActivity,
    'prefs.pushFriendActivitySuccess', 'prefs.updateFailed'
  )
  const handleTogglePushMessages = () => handleUpdatePreference(
    'push_messages', !pushMessages, setPushMessages,
    'prefs.pushMessagesSuccess', 'prefs.updateFailed'
  )
  const handleTogglePushGardenUpdates = () => handleUpdatePreference(
    'push_garden_updates', !pushGardenUpdates, setPushGardenUpdates,
    'prefs.pushGardenUpdatesSuccess', 'prefs.updateFailed'
  )
  const handleTogglePersonalizedRecommendations = () => handleUpdatePreference(
    'personalized_recommendations', !personalizedRecommendations, setPersonalizedRecommendations,
    'prefs.personalizedSuccess', 'prefs.updateFailed'
  )
  const handleToggleAnalyticsImprovement = () => handleUpdatePreference(
    'analytics_improvement', !analyticsImprovement, setAnalyticsImprovement,
    'prefs.analyticsSuccess', 'prefs.updateFailed'
  )

  // Tab configuration
  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    { id: 'account', icon: <User className="h-4 w-4" />, label: t('settings.tabs.account', { defaultValue: 'Account' }) },
    { id: 'notifications', icon: <Bell className="h-4 w-4" />, label: t('settings.tabs.notifications', { defaultValue: 'Notifications' }) },
    { id: 'privacy', icon: <Shield className="h-4 w-4" />, label: t('settings.tabs.privacy', { defaultValue: 'Privacy' }) },
    { id: 'preferences', icon: <Settings className="h-4 w-4" />, label: t('settings.tabs.preferences', { defaultValue: 'Preferences' }) },
    { id: 'danger', icon: <AlertTriangle className="h-4 w-4" />, label: t('settings.tabs.danger', { defaultValue: 'Danger Zone' }) },
  ]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
        <div className="p-8 text-center text-sm opacity-60">{t('settings.loading')}</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
      {/* Hero Section */}
      <div className={heroCardClass}>
        <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-emerald-200/60 dark:bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-emerald-100/70 dark:bg-emerald-500/5 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <Settings className="h-4 w-4" />
            {t('settings.title')}
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-2xl">
            {t('settings.description')}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-stone-100/80 dark:bg-[#1c1c1f]/80 border border-stone-200/50 dark:border-[#3e3e42]/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setError(null)
              setSuccess(null)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#252528] shadow-sm text-emerald-700 dark:text-emerald-300'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-white/50 dark:hover:bg-[#252528]/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Status Messages */}
      {error && (
        <div className={`${glassCard} p-4 text-red-700 dark:text-red-300 flex items-start gap-2`}>
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {success && (
        <div className={`${glassCard} p-4 text-emerald-700 dark:text-emerald-300 flex items-start gap-2`}>
          <Check className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">{success}</div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* User Info Section */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.account.userInfo', { defaultValue: 'Your Information' })}</CardTitle>
              </div>
              <CardDescription>{t('settings.account.userInfoDescription', { defaultValue: 'Your profile information' })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar and Display Name */}
              <div className="flex items-center gap-4">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile?.display_name || ''} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-700"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <User className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{profile?.display_name || t('settings.account.noDisplayName', { defaultValue: 'No display name set' })}</h3>
                  {profile?.username && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">@{profile.username}</p>
                  )}
                </div>
              </div>

              {/* User Details Grid */}
              <div className="grid gap-3 mt-4">
                {/* Email with reveal toggle */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/80 dark:bg-[#1c1c1f]/80 border border-stone-200/50 dark:border-[#3e3e42]/50">
                  <Mail className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-stone-500 dark:text-stone-400">{t('settings.email.currentEmail', { defaultValue: 'Email' })}</p>
                    <p className="text-sm font-medium truncate">{showEmail ? email : censorEmail(email)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmail(!showEmail)}
                    className="p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-[#3e3e42]/50 transition-colors"
                    aria-label={showEmail ? t('settings.email.hideEmail', { defaultValue: 'Hide email' }) : t('settings.email.showEmail', { defaultValue: 'Show email' })}
                  >
                    {showEmail ? (
                      <EyeOff className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                    )}
                  </button>
                </div>

                {/* Country */}
                {profile?.country && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/80 dark:bg-[#1c1c1f]/80 border border-stone-200/50 dark:border-[#3e3e42]/50">
                    <MapPin className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-stone-500 dark:text-stone-400">{t('settings.account.country', { defaultValue: 'Country' })}</p>
                      <p className="text-sm font-medium">{profile.country}</p>
                    </div>
                  </div>
                )}

                {/* Experience Years */}
                {profile?.experience_years !== undefined && profile.experience_years !== null && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/80 dark:bg-[#1c1c1f]/80 border border-stone-200/50 dark:border-[#3e3e42]/50">
                    <Calendar className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-stone-500 dark:text-stone-400">{t('settings.account.experience', { defaultValue: 'Gardening Experience' })}</p>
                      <p className="text-sm font-medium">{profile.experience_years} {profile.experience_years === 1 ? t('settings.account.year', { defaultValue: 'year' }) : t('settings.account.years', { defaultValue: 'years' })}</p>
                    </div>
                  </div>
                )}

                {/* Bio */}
                {profile?.bio && (
                  <div className="p-3 rounded-xl bg-stone-50/80 dark:bg-[#1c1c1f]/80 border border-stone-200/50 dark:border-[#3e3e42]/50">
                    <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">{t('settings.account.bio', { defaultValue: 'Bio' })}</p>
                    <p className="text-sm">{profile.bio}</p>
                  </div>
                )}

                {/* Favorite Plant */}
                {profile?.favorite_plant && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/80 dark:bg-[#1c1c1f]/80 border border-stone-200/50 dark:border-[#3e3e42]/50">
                    <span className="text-base">🌱</span>
                    <div className="flex-1">
                      <p className="text-xs text-stone-500 dark:text-stone-400">{t('settings.account.favoritePlant', { defaultValue: 'Favorite Plant' })}</p>
                      <p className="text-sm font-medium">{profile.favorite_plant}</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                {t('settings.account.editProfileHint', { defaultValue: 'To edit your profile information, visit your public profile page.' })}
              </p>
            </CardContent>
          </Card>

          {/* Email Section - Collapsible */}
          <Card className={glassCard}>
            <CardHeader 
              className="cursor-pointer select-none"
              onClick={() => setShowNewEmailForm(!showNewEmailForm)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-emerald-600" />
                  <CardTitle>{t('settings.email.changeEmail', { defaultValue: 'Change Email' })}</CardTitle>
                </div>
                {showNewEmailForm ? (
                  <ChevronUp className="h-5 w-5 text-stone-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-stone-500" />
                )}
              </div>
              <CardDescription>{t('settings.email.description')}</CardDescription>
            </CardHeader>
            {showNewEmailForm && (
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label htmlFor="new-email">{t('settings.email.newEmail')}</Label>
                  <ValidatedInput
                    id="new-email"
                    type="email"
                    placeholder={t('settings.email.newEmailPlaceholder')}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={saving}
                    status={newEmailValidation.status}
                    error={newEmailValidation.error}
                    suggestion={newEmailValidation.suggestion}
                    onAcceptSuggestion={newEmailValidation.suggestion ? () => { /* display-only */ } : undefined}
                  />
                </div>
                <Button
                  onClick={handleUpdateEmail}
                  disabled={saving || !newEmail || newEmail === email || newEmailValidation.status === 'error'}
                  className="rounded-2xl"
                >
                  {saving ? t('settings.email.updating') : t('settings.email.update')}
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Password Section - Collapsible */}
          <Card className={glassCard}>
            <CardHeader 
              className="cursor-pointer select-none"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-emerald-600" />
                  <CardTitle>{t('settings.password.title')}</CardTitle>
                </div>
                {showPasswordForm ? (
                  <ChevronUp className="h-5 w-5 text-stone-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-stone-500" />
                )}
              </div>
              <CardDescription>{t('settings.password.description')}</CardDescription>
            </CardHeader>
            {showPasswordForm && (
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label htmlFor="current-password">{t('settings.password.currentPassword')}</Label>
                  <ValidatedInput
                    id="current-password"
                    type="password"
                    placeholder={t('settings.password.currentPasswordPlaceholder')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="new-password">{t('settings.password.newPassword')}</Label>
                  <ValidatedInput
                    id="new-password"
                    type="password"
                    placeholder={t('settings.password.newPasswordPlaceholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={saving}
                    status={newPasswordValidation.status}
                    error={newPasswordValidation.error}
                  />
                  <PasswordRules rules={newPasswordResult.rules} visible={newPassword.length > 0} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="confirm-password">{t('settings.password.confirmPassword')}</Label>
                  <ValidatedInput
                    id="confirm-password"
                    type="password"
                    placeholder={t('settings.password.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={saving}
                    status={confirmPasswordValidation.status}
                    error={confirmPasswordValidation.error}
                  />
                </div>
                <Button
                  onClick={handleUpdatePassword}
                  disabled={saving || !currentPassword || !newPassword || newPasswordValidation.status === 'error' || confirmPasswordValidation.status === 'error'}
                  className="rounded-2xl"
                >
                  {saving ? t('settings.password.updating') : t('settings.password.update')}
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Master Push Notifications Toggle */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.notifications.pushTitle', { defaultValue: 'Push Notifications' })}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.notifications.pushMasterDescription', { defaultValue: 'Control push notifications on your devices.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Master Push Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                <input
                  type="checkbox"
                  id="notify-push-master"
                  checked={notifyPush}
                  onChange={handleToggleNotifyPush}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="notify-push-master" className="font-semibold cursor-pointer text-base">
                    {t('settings.notifications.enablePush', { defaultValue: 'Enable Push Notifications' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('settings.notifications.enablePushDescription', { defaultValue: 'Turn on to receive any push notifications. Turn off to disable all push notifications.' })}
                  </p>
                </div>
              </div>

              {/* Granular Push Preferences */}
              {notifyPush && (
                <div className="space-y-3 pl-4 border-l-2 border-stone-200 dark:border-[#3e3e42]">
                  <p className="text-sm font-medium opacity-70 mb-3">{t('prefs.pushCategories', { defaultValue: 'Choose which notifications to receive:' })}</p>
                  
                  {/* Task Reminders */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="push-task-reminders"
                      checked={pushTaskReminders}
                      onChange={handleTogglePushTaskReminders}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="push-task-reminders" className="font-medium cursor-pointer text-sm">
                        {t('prefs.pushTaskReminders', { defaultValue: 'Task Reminders' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.pushTaskRemindersDesc', { defaultValue: 'Watering, fertilizing, and plant care reminders' })}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="push-messages"
                      checked={pushMessages}
                      onChange={handleTogglePushMessages}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="push-messages" className="font-medium cursor-pointer text-sm">
                        {t('prefs.pushMessages', { defaultValue: 'Messages' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.pushMessagesDesc', { defaultValue: 'New messages from friends' })}
                      </p>
                    </div>
                  </div>

                  {/* Friend Activity */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="push-friend-activity"
                      checked={pushFriendActivity}
                      onChange={handleTogglePushFriendActivity}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="push-friend-activity" className="font-medium cursor-pointer text-sm">
                        {t('prefs.pushFriendActivity', { defaultValue: 'Friend Activity' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.pushFriendActivityDesc', { defaultValue: 'Friend requests and activity updates' })}
                      </p>
                    </div>
                  </div>

                  {/* Garden Updates */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="push-garden-updates"
                      checked={pushGardenUpdates}
                      onChange={handleTogglePushGardenUpdates}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="push-garden-updates" className="font-medium cursor-pointer text-sm">
                        {t('prefs.pushGardenUpdates', { defaultValue: 'Garden Updates' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.pushGardenUpdatesDesc', { defaultValue: 'Activity in your shared gardens' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Notifications */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <CardTitle>{t('settings.notifications.emailTitle', { defaultValue: 'Email Notifications' })}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.notifications.emailMasterDescription', { defaultValue: 'Choose which emails you want to receive from Aphylia.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Master Email Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10">
                <input
                  type="checkbox"
                  id="notify-email-master"
                  checked={notifyEmail}
                  onChange={handleToggleNotifyEmail}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <Label htmlFor="notify-email-master" className="font-semibold cursor-pointer text-base">
                    {t('settings.notifications.enableEmail', { defaultValue: 'Enable Email Notifications' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('settings.notifications.enableEmailDescription', { defaultValue: 'Turn on to receive email notifications. Turn off to disable all emails except account security.' })}
                  </p>
                </div>
              </div>

              {/* Granular Email Preferences */}
              {notifyEmail && (
                <div className="space-y-3 pl-4 border-l-2 border-stone-200 dark:border-[#3e3e42]">
                  <p className="text-sm font-medium opacity-70 mb-3">{t('prefs.emailCategories', { defaultValue: 'Choose which emails to receive:' })}</p>
                  
                  {/* Product Updates */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="email-product-updates"
                      checked={emailProductUpdates}
                      onChange={handleToggleEmailProductUpdates}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="email-product-updates" className="font-medium cursor-pointer text-sm">
                        {t('prefs.emailProductUpdates', { defaultValue: 'Product Updates & New Features' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.emailProductUpdatesDesc', { defaultValue: 'Learn about new features and improvements' })}
                      </p>
                    </div>
                  </div>

                  {/* Tips & Advice */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="email-tips-advice"
                      checked={emailTipsAdvice}
                      onChange={handleToggleEmailTipsAdvice}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="email-tips-advice" className="font-medium cursor-pointer text-sm">
                        {t('prefs.emailTipsAdvice', { defaultValue: 'Gardening Tips & Advice' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.emailTipsAdviceDesc', { defaultValue: 'Seasonal tips, plant care guides, and expert advice' })}
                      </p>
                    </div>
                  </div>

                  {/* Community Highlights */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="email-community-highlights"
                      checked={emailCommunityHighlights}
                      onChange={handleToggleEmailCommunityHighlights}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="email-community-highlights" className="font-medium cursor-pointer text-sm">
                        {t('prefs.emailCommunity', { defaultValue: 'Community Highlights' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.emailCommunityDesc', { defaultValue: 'Featured gardens, success stories, and community news' })}
                      </p>
                    </div>
                  </div>

                  {/* Promotions */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1c1c1f]/50">
                    <input
                      type="checkbox"
                      id="email-promotions"
                      checked={emailPromotions}
                      onChange={handleToggleEmailPromotions}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <Label htmlFor="email-promotions" className="font-medium cursor-pointer text-sm">
                        {t('prefs.emailPromotions', { defaultValue: 'Promotions & Special Offers' })}
                      </Label>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('prefs.emailPromotionsDesc', { defaultValue: 'Exclusive deals, discounts, and partner offers' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs opacity-50 mt-2">
                {t('prefs.securityEmailsNote', { defaultValue: 'Note: Security-related emails (password changes, suspicious activity) cannot be disabled.' })}
              </p>
            </CardContent>
          </Card>

          {/* Browser Push Notifications */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.notifications.browserTitle', { defaultValue: 'Browser Push Setup' })}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.notifications.browserDescription', { defaultValue: 'Enable browser push notifications on this device.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pushSupported ? (
                <p className="text-sm opacity-80">
                  {t('settings.notifications.unsupported', {
                    defaultValue: 'Your browser does not support push notifications.',
                  })}
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 rounded-2xl border border-stone-200/70 bg-white/80 p-4 text-sm dark:border-[#3e3e42]/70 dark:bg-[#1c1c1f] md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">
                        {pushSubscribed
                          ? t('settings.notifications.enabledLabel', { defaultValue: 'Browser notifications are enabled' })
                          : t('settings.notifications.disabledLabel', { defaultValue: 'Browser notifications are disabled' })}
                      </p>
                      <p className="mt-1 text-xs opacity-70">
                        {t('settings.notifications.permissionStatus', { defaultValue: 'Browser permission:' })}{' '}
                        <span className="font-semibold capitalize">
                          {pushPermission === 'default'
                            ? t('settings.notifications.permissionDefault', { defaultValue: 'Not granted yet' })
                            : pushPermission}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                        pushSubscribed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'bg-stone-200 text-stone-700 dark:bg-[#2d2d30] dark:text-stone-200'
                      }`}
                    >
                      {pushSubscribed
                        ? t('settings.notifications.statusOn', { defaultValue: 'Enabled' })
                        : t('settings.notifications.statusOff', { defaultValue: 'Disabled' })}
                    </span>
                  </div>
                  {pushError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {pushError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={pushSubscribed ? disablePush : enablePush}
                      disabled={pushLoading}
                      className="rounded-2xl"
                    >
                      {pushLoading
                        ? t('settings.notifications.loading', { defaultValue: 'Working…' })
                        : pushSubscribed
                        ? t('settings.notifications.disableBrowser', { defaultValue: 'Disable browser push' })
                        : t('settings.notifications.enableBrowser', { defaultValue: 'Enable browser push' })}
                    </Button>
                    {/* Re-sync button - helps fix cases where subscription wasn't saved to server */}
                    {pushSubscribed && pushPermission === 'granted' && (
                      <Button
                        onClick={enablePush}
                        variant="outline"
                        disabled={pushLoading}
                        className="rounded-2xl"
                        title="Re-sync your push subscription with the server"
                      >
                        {t('settings.notifications.resync', { defaultValue: 'Re-sync subscription' })}
                      </Button>
                    )}
                    <Button
                      onClick={refreshPush}
                      variant="outline"
                      disabled={pushLoading}
                      className="rounded-2xl"
                    >
                      {t('settings.notifications.refresh', { defaultValue: 'Refresh status' })}
                    </Button>
                  </div>
                  {/* Help text for troubleshooting */}
                  {pushSubscribed && pushPermission === 'granted' && (
                    <p className="text-xs opacity-60 mt-2">
                      {t('settings.notifications.troubleshootTip', { 
                        defaultValue: 'Not receiving notifications? Try clicking "Re-sync subscription" to ensure your device is properly registered.' 
                      })}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.privacy.title')}</CardTitle>
              </div>
              <CardDescription>{t('settings.privacy.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="private-profile"
                  checked={isPrivate}
                  onChange={handleTogglePrivacy}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="private-profile" className="font-semibold cursor-pointer text-base">
                    {t('settings.privacy.privateProfile')}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('settings.privacy.privateProfileDescription')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="disable-friend-requests"
                  checked={disableFriendRequests}
                  onChange={handleToggleFriendRequests}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="disable-friend-requests" className="font-semibold cursor-pointer text-base">
                    {t('settings.friendRequests.disable')}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('settings.friendRequests.disableDescription')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="garden-invite-privacy"
                  checked={gardenInvitePrivacy === 'friends_only'}
                  onChange={handleToggleGardenInvitePrivacy}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="garden-invite-privacy" className="font-semibold cursor-pointer text-base">
                    {t('gardenInvites.privacySetting', { defaultValue: 'Garden invite privacy' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {gardenInvitePrivacy === 'friends_only' 
                      ? t('gardenInvites.privacyFriendsOnly', { defaultValue: 'Only friends can invite me' })
                      : t('gardenInvites.privacyAnyone', { defaultValue: 'Anyone can invite me' })
                    }
                  </p>
                  <p className="text-xs opacity-50 mt-1">
                    {t('gardenInvites.privacyDescription', { defaultValue: 'Control who can send you garden invitations' })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions for Privacy */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-600" />
                <CardTitle>{t('prefs.quickActionsTitle', { defaultValue: 'Quick Actions' })}</CardTitle>
              </div>
              <CardDescription>
                {t('prefs.quickActionsDescription', { defaultValue: 'Quickly adjust multiple settings at once.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await supabase.from('profiles').update({
                        marketing_consent: false,
                        email_product_updates: false,
                        email_tips_advice: false,
                        email_community_highlights: false,
                        email_promotions: false,
                        personalized_recommendations: false,
                        analytics_improvement: false,
                      }).eq('id', user?.id)
                      setMarketingConsent(false)
                      setEmailProductUpdates(false)
                      setEmailTipsAdvice(false)
                      setEmailCommunityHighlights(false)
                      setEmailPromotions(false)
                      setPersonalizedRecommendations(false)
                      setAnalyticsImprovement(false)
                      setSuccess(t('prefs.optOutSuccess', { defaultValue: 'Opted out of all non-essential data processing' }))
                    } catch (e: any) {
                      setError(e?.message || t('prefs.updateFailed'))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  {t('prefs.optOutAll', { defaultValue: 'Opt-out of Non-Essential Processing' })}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await supabase.from('profiles').update({
                        notify_email: false,
                        notify_push: false,
                        email_product_updates: false,
                        email_tips_advice: false,
                        email_community_highlights: false,
                        email_promotions: false,
                        push_task_reminders: false,
                        push_friend_activity: false,
                        push_messages: false,
                        push_garden_updates: false,
                      }).eq('id', user?.id)
                      setNotifyEmail(false)
                      setNotifyPush(false)
                      setEmailProductUpdates(false)
                      setEmailTipsAdvice(false)
                      setEmailCommunityHighlights(false)
                      setEmailPromotions(false)
                      setPushTaskReminders(false)
                      setPushFriendActivity(false)
                      setPushMessages(false)
                      setPushGardenUpdates(false)
                      setSuccess(t('prefs.disableAllNotificationsSuccess', { defaultValue: 'All notifications disabled' }))
                    } catch (e: any) {
                      setError(e?.message || t('prefs.updateFailed'))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  {t('prefs.disableAllNotifications', { defaultValue: 'Disable All Notifications' })}
                </Button>
              </div>
              <p className="text-xs opacity-50">
                {t('prefs.quickActionsNote', { defaultValue: 'You can re-enable individual settings at any time in the Notifications tab.' })}
              </p>
            </CardContent>
          </Card>

          {/* GDPR Data & Consent Management */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <CardTitle>{t('gdpr.title', { defaultValue: 'Data & Consent' })}</CardTitle>
              </div>
              <CardDescription>
                {t('gdpr.description', { defaultValue: 'Manage your data and consent preferences under GDPR.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Marketing Consent Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="marketing-consent"
                  checked={marketingConsent}
                  onChange={handleToggleMarketingConsent}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="marketing-consent" className="font-semibold cursor-pointer text-base">
                    {t('gdpr.marketingConsent', { defaultValue: 'Marketing Communications' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('gdpr.marketingConsentDescription', { defaultValue: 'Receive occasional emails about new features and updates.' })}
                  </p>
                  {marketingConsentDate && (
                    <p className="text-xs opacity-50 mt-2">
                      {t('gdpr.lastUpdated', { defaultValue: 'Last updated:' })} {formatConsentDate(marketingConsentDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Consent History */}
              <div className="p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <h4 className="font-semibold text-sm mb-3">{t('gdpr.consentHistory', { defaultValue: 'Consent History' })}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">{t('gdpr.termsAccepted', { defaultValue: 'Terms of Service accepted' })}</span>
                    <span className="font-medium">{formatConsentDate(termsAcceptedDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">{t('gdpr.privacyAccepted', { defaultValue: 'Privacy Policy accepted' })}</span>
                    <span className="font-medium">{formatConsentDate(privacyAcceptedDate)}</span>
                  </div>
                </div>
              </div>

              {/* Legal Documents Links */}
              <div className="flex flex-wrap gap-3">
                <Link 
                  to="/terms" 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1c1c1f] hover:bg-stone-50 dark:hover:bg-[#252528] transition-colors text-sm"
                >
                  <FileText className="h-4 w-4" />
                  {t('gdpr.viewTerms', { defaultValue: 'Terms of Service' })}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Link>
                <Link 
                  to="/privacy" 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1c1c1f] hover:bg-stone-50 dark:hover:bg-[#252528] transition-colors text-sm"
                >
                  <Shield className="h-4 w-4" />
                  {t('gdpr.viewPrivacy', { defaultValue: 'Privacy Policy' })}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Personalization & Analytics */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600" />
                <CardTitle>{t('prefs.personalizationTitle', { defaultValue: 'Personalization & Analytics' })}</CardTitle>
              </div>
              <CardDescription>
                {t('prefs.personalizationDescription', { defaultValue: 'Control how we personalize your experience and use data to improve the app.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Personalized Recommendations */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="personalized-recommendations"
                  checked={personalizedRecommendations}
                  onChange={handleTogglePersonalizedRecommendations}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <Label htmlFor="personalized-recommendations" className="font-semibold cursor-pointer text-base">
                    {t('prefs.personalizedRecommendations', { defaultValue: 'Personalized Recommendations' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('prefs.personalizedRecommendationsDesc', { defaultValue: 'Get plant suggestions and content based on your interests and garden activity.' })}
                  </p>
                </div>
              </div>

              {/* Analytics for Improvement */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="analytics-improvement"
                  checked={analyticsImprovement}
                  onChange={handleToggleAnalyticsImprovement}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <Label htmlFor="analytics-improvement" className="font-semibold cursor-pointer text-base">
                    {t('prefs.analyticsImprovement', { defaultValue: 'Help Improve Aphylia' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('prefs.analyticsImprovementDesc', { defaultValue: 'Allow anonymous usage data collection to help us improve the app experience.' })}
                  </p>
                </div>
              </div>

              <p className="text-xs opacity-50">
                {t('prefs.privacyNote', { defaultValue: 'We never sell your data. See our Privacy Policy for details on how we protect your information.' })}
              </p>
            </CardContent>
          </Card>

          {/* Data Export */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('gdpr.exportData', { defaultValue: 'Export My Data' })}</CardTitle>
              </div>
              <CardDescription>
                {t('gdpr.exportDataDescription', { defaultValue: 'Download all data we have about you in a machine-readable format.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm opacity-80">
                {t('gdpr.exportInfo', { defaultValue: 'Your export will include your profile, gardens, plants, messages, friends, bookmarks, and all other personal data.' })}
              </p>
              <Button
                onClick={handleExportData}
                disabled={exporting}
                className="rounded-2xl"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting 
                  ? t('gdpr.exporting', { defaultValue: 'Preparing export...' })
                  : t('gdpr.downloadData', { defaultValue: 'Download My Data' })
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          {/* Language */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.language.title')}</CardTitle>
              </div>
              <CardDescription>{t('settings.language.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="language-select">{t('settings.language.selectLanguage')}</Label>
                <select
                  id="language-select"
                  value={currentLang}
                  onChange={(e) => changeLanguage(e.target.value as typeof currentLang)}
                  className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang === 'en' ? t('settings.language.english') : t('settings.language.french')}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.theme.title')}</CardTitle>
              </div>
              <CardDescription>{t('settings.theme.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="theme-select">{t('settings.theme.selectTheme')}</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {theme === 'system' && <Monitor className="h-4 w-4 opacity-60" />}
                    {theme === 'light' && <Sun className="h-4 w-4 opacity-60" />}
                    {theme === 'dark' && <Moon className="h-4 w-4 opacity-60" />}
                  </div>
                  <select
                    id="theme-select"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                    className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] pl-10 pr-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors appearance-none"
                  >
                    <option value="system">{t('settings.theme.system')}</option>
                    <option value="light">{t('settings.theme.light')}</option>
                    <option value="dark">{t('settings.theme.dark')}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accent Color */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-accent" />
                <CardTitle>{t('settings.accent.title', { defaultValue: 'Accent Color' })}</CardTitle>
              </div>
              <CardDescription>{t('settings.accent.description', { defaultValue: 'Choose your personal accent color that appears throughout the app.' })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {ACCENT_OPTIONS.map((opt) => {
                  const isActive = (profile as any)?.accent_key === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={async () => {
                        if (!user?.id) return
                        setSaving(true)
                        try {
                          const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ accent_key: opt.key })
                            .eq('id', user.id)
                          if (updateError) throw updateError
                          applyAccentByKey(opt.key as AccentKey)
                          saveAccentKey(opt.key as AccentKey)
                          await refreshProfile()
                          setSuccess(t('common.saved', { defaultValue: 'Saved' }))
                        } catch (e: any) {
                          setError(e?.message || t('common.error'))
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={saving}
                      className={`h-12 rounded-xl relative transition-all ${isActive ? 'ring-2 ring-offset-2 ring-stone-500 dark:ring-stone-400 scale-105' : 'hover:scale-105'}`}
                      title={opt.label}
                      style={{ backgroundColor: opt.hex }}
                      aria-pressed={isActive}
                    />
                  )
                })}
              </div>
              <p className="text-xs opacity-60">
                {t('settings.accent.current', { defaultValue: 'Current:' })} <span className="font-medium">{ACCENT_OPTIONS.find(o => o.key === (profile as any)?.accent_key)?.label || 'Emerald'}</span>
              </p>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('setup.location.title', { defaultValue: 'Where are you located?' })}</CardTitle>
              </div>
              <CardDescription>
                {t('setup.location.subtitle', { defaultValue: 'This helps us provide local gardening advice' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {(city || country) && (
                <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-800 dark:text-stone-100 truncate">
                      {[city, country].filter(Boolean).join(', ')}
                    </div>
                    {timezone && (
                      <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 mt-1">
                        <Clock className="w-3 h-3" />
                        {timezone}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    disabled={saving}
                    className="p-2 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                    aria-label={t('setup.location.clear', { defaultValue: 'Clear location' })}
                  >
                    <X className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  {t('setup.location.searchLabel', { defaultValue: 'Search for your city' })}
                </Label>
                <div className="relative" ref={suggestionsRef}>
                  <SearchInput
                    variant="lg"
                    value={locationSearch}
                    onChange={(e) => handleLocationSearchChange(e.target.value)}
                    onFocus={() => locationSearch.length >= 2 && setShowSuggestions(true)}
                    onClear={locationSearch ? () => {
                      setLocationSearch('')
                      setLocationSuggestions([])
                      setShowSuggestions(false)
                    } : undefined}
                    placeholder={t('setup.location.searchPlaceholder', { defaultValue: 'Type a city name...' })}
                    loading={searchingLocation}
                    disabled={saving}
                    className="bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
                  />

                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl overflow-hidden">
                      {locationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-left"
                          onClick={() => handleSelectLocation(suggestion)}
                        >
                          <MapPin className="w-5 h-5 text-stone-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-stone-800 dark:text-stone-100 truncate">
                              {suggestion.name}
                            </div>
                            <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
                              {suggestion.admin1 ? `${suggestion.admin1}, ` : ''}{suggestion.country}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showSuggestions && hasSearched && !searchingLocation && locationSuggestions.length === 0 && debouncedLocationSearch.length >= 2 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl p-4 text-center text-sm text-stone-500">
                      {t('setup.location.noResults', { defaultValue: 'No cities found. Try a different search.' })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleDetectLocation}
                  disabled={saving || detectingLocation}
                  variant="outline"
                  className="rounded-2xl"
                >
                  {detectingLocation ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('setup.location.detectingGPS', { defaultValue: 'Detecting...' })}
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      {t('setup.location.detectButton', { defaultValue: 'Use my current location' })}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs opacity-70">
                {t('gardenDashboard.settingsSection.locationSet', { defaultValue: 'Weather-based advice will use this location for forecasts.' })}
              </p>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.timezone.title', { defaultValue: 'Timezone' })}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.timezone.description', { defaultValue: 'Set your timezone to receive scheduled notifications at the correct local time.' })}
                {timezone !== detectedTimezone && (
                  <span className="block mt-1 text-xs opacity-70">
                    {t('settings.timezone.detected', { defaultValue: 'Detected:' })} {commonTimezones.find(tz => tz.value === detectedTimezone)?.label || detectedTimezone}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="timezone-select">{t('settings.timezone.selectTimezone', { defaultValue: 'Select Timezone' })}</Label>
                <select
                  id="timezone-select"
                  value={timezone || detectedTimezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                >
                  {commonTimezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs opacity-70 mt-1">
                  {t('settings.timezone.helper', { defaultValue: 'Scheduled notifications will be sent at the same local time in your timezone.' })}
                </p>
              </div>
              <Button
                onClick={handleUpdateTimezone}
                disabled={saving || !timezone || timezone === ((profile as any)?.timezone || detectedTimezone)}
                className="rounded-2xl"
              >
                {saving ? t('common.saving', { defaultValue: 'Saving...' }) : t('settings.timezone.save', { defaultValue: 'Save Timezone' })}
              </Button>
            </CardContent>
          </Card>

          {/* Garden Preferences */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌱</span>
                <CardTitle>{t('setup.settings.title', { defaultValue: 'Garden Preferences' })}</CardTitle>
              </div>
              <CardDescription>{t('setup.settings.description', { defaultValue: 'Update your gardening preferences and notification settings.' })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Garden Type */}
              <div className="grid gap-2">
                <Label htmlFor="garden-type-select">{t('setup.settings.gardenType', { defaultValue: 'Garden Location' })}</Label>
                <p className="text-xs opacity-60 -mt-1 mb-1">{t('setup.settings.gardenTypeDescription', { defaultValue: 'Where do you grow your plants?' })}</p>
                <select
                  id="garden-type-select"
                  value={gardenType}
                  onChange={(e) => handleUpdateSetupField('garden_type', e.target.value || '', gardenType, setGardenType)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                >
                  <option value="">{t('common.select', { defaultValue: 'Select...' })}</option>
                  <option value="inside">{t('setup.gardenType.inside', { defaultValue: 'Inside your home' })}</option>
                  <option value="outside">{t('setup.gardenType.outside', { defaultValue: 'Outside, in a yard' })}</option>
                  <option value="both">{t('setup.gardenType.both', { defaultValue: 'Both inside and outside' })}</option>
                </select>
              </div>

              {/* Experience Level */}
              <div className="grid gap-2">
                <Label htmlFor="experience-level-select">{t('setup.settings.experienceLevel', { defaultValue: 'Experience Level' })}</Label>
                <p className="text-xs opacity-60 -mt-1 mb-1">{t('setup.settings.experienceLevelDescription', { defaultValue: 'Your gardening expertise level' })}</p>
                <select
                  id="experience-level-select"
                  value={experienceLevel}
                  onChange={(e) => handleUpdateSetupField('experience_level', e.target.value || '', experienceLevel, setExperienceLevel)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                >
                  <option value="">{t('common.select', { defaultValue: 'Select...' })}</option>
                  <option value="novice">{t('setup.experience.novice', { defaultValue: 'Novice' })}</option>
                  <option value="intermediate">{t('setup.experience.intermediate', { defaultValue: 'Intermediate' })}</option>
                  <option value="expert">{t('setup.experience.expert', { defaultValue: 'Expert' })}</option>
                </select>
              </div>

              {/* Garden Purpose */}
              <div className="grid gap-2">
                <Label htmlFor="looking-for-select">{t('setup.settings.lookingFor', { defaultValue: 'Garden Purpose' })}</Label>
                <p className="text-xs opacity-60 -mt-1 mb-1">{t('setup.settings.lookingForDescription', { defaultValue: "What's your main gardening goal?" })}</p>
                <select
                  id="looking-for-select"
                  value={lookingFor}
                  onChange={(e) => handleUpdateSetupField('looking_for', e.target.value || '', lookingFor, setLookingFor)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                >
                  <option value="">{t('common.select', { defaultValue: 'Select...' })}</option>
                  <option value="eat">{t('setup.purpose.eat', { defaultValue: 'Grow food' })}</option>
                  <option value="ornamental">{t('setup.purpose.ornamental', { defaultValue: 'Ornamental garden' })}</option>
                  <option value="various">{t('setup.purpose.various', { defaultValue: 'A bit of everything!' })}</option>
                </select>
              </div>

              {/* Notification Time */}
              <div className="grid gap-2">
                <Label htmlFor="notification-time-select">{t('setup.settings.notificationTime', { defaultValue: 'Notification Time' })}</Label>
                <p className="text-xs opacity-60 -mt-1 mb-1">{t('setup.settings.notificationTimeDescription', { defaultValue: 'When should we send you reminders?' })}</p>
                <select
                  id="notification-time-select"
                  value={String(notificationHour)}
                  onChange={(e) => {
                    const nextHour = Number.parseInt(e.target.value, 10)
                    if (Number.isNaN(nextHour)) return
                    handleUpdateNotificationHour(nextHour)
                  }}
                  disabled={saving}
                  className="w-full rounded-2xl border border-stone-300 bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                >
                  {notificationHourOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs opacity-70 mt-1">
                  {t('setup.settings.notificationTimeHelper', {
                    defaultValue: 'Scheduled notifications will be sent at the same local time in your timezone ({{timezone}}).',
                    timezone: timezone || detectedTimezone,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="space-y-6">
          <Card className={`${glassCard} border-red-200 dark:border-red-800/50 bg-red-50/70 dark:bg-red-900/30`}>
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('settings.dangerZone.title')}
              </CardTitle>
              <CardDescription className="text-red-600/80 dark:text-red-400/80">
                {t('settings.dangerZone.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!deleteConfirm ? (
                <>
                  <p className="text-sm opacity-90">
                    {t('settings.dangerZone.deleteWarning')}
                  </p>
                  <Button
                    onClick={() => setDeleteConfirm(true)}
                    variant="destructive"
                    className="rounded-2xl"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('settings.dangerZone.deleteAccount')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-white dark:bg-[#252526] border border-red-200 dark:border-red-800/50 space-y-4">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      {t('settings.dangerZone.confirmDelete')}
                    </p>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-delete" className="text-sm">
                        {t('settings.dangerZone.typeDelete')}
                      </Label>
                      <Input
                        id="confirm-delete"
                        type="text"
                        placeholder="DELETE"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        disabled={deleting}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteAccount}
                        variant="destructive"
                        disabled={deleting || deleteConfirmText !== "DELETE"}
                        className="rounded-2xl"
                      >
                        {deleting ? t('settings.dangerZone.deleting') : t('settings.dangerZone.yesDelete')}
                      </Button>
                      <Button
                        onClick={() => {
                          setDeleteConfirm(false)
                          setDeleteConfirmText("")
                          setError(null)
                        }}
                        variant="secondary"
                        disabled={deleting}
                        className="rounded-2xl"
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
