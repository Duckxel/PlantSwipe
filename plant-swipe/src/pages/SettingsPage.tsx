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
import { Settings, Mail, Lock, Trash2, AlertTriangle, Check, Globe, Monitor, Sun, Moon, Bell, Clock, Shield, User, Eye, EyeOff, ChevronDown, ChevronUp, MapPin, Calendar } from "lucide-react"
import { SUPPORTED_LANGUAGES } from "@/lib/i18n"
import usePushSubscription from "@/hooks/usePushSubscription"

type SettingsTab = 'account' | 'notifications' | 'privacy' | 'preferences' | 'danger'

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
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

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
        } else {
          // Fetch profile if not loaded
          const { data } = await supabase
            .from('profiles')
            .select('is_private, disable_friend_requests, garden_invite_privacy, timezone')
            .eq('id', user.id)
            .maybeSingle()
          if (data) {
            setIsPrivate(Boolean(data.is_private || false))
            setDisableFriendRequests(Boolean(data.disable_friend_requests || false))
            setGardenInvitePrivacy((data as any).garden_invite_privacy || 'anyone')
            setTimezone(data.timezone || detectedTimezone)
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
      } catch (e: any) {
        setError(e?.message || t('settings.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, profile, navigate])

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === email) {
      setError(t('settings.email.enterNewEmail'))
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError(t('settings.email.enterValidEmail'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (updateError) throw updateError

      setSuccess(t('settings.email.updateRequestSent'))
      setNewEmail("")
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.email) {
        setEmail(authUser.email)
      }
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

    if (!newPassword || newPassword.length < 6) {
      setError(t('settings.password.passwordTooShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('settings.password.passwordsDontMatch'))
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
                <div className="grid gap-2">
                  <Label htmlFor="new-email">{t('settings.email.newEmail')}</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder={t('settings.email.newEmailPlaceholder')}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <Button
                  onClick={handleUpdateEmail}
                  disabled={saving || !newEmail || newEmail === email}
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
                <div className="grid gap-2">
                  <Label htmlFor="current-password">{t('settings.password.currentPassword')}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder={t('settings.password.currentPasswordPlaceholder')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">{t('settings.password.newPassword')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder={t('settings.password.newPasswordPlaceholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">{t('settings.password.confirmPassword')}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder={t('settings.password.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <Button
                  onClick={handleUpdatePassword}
                  disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
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
          {/* Notification Preferences */}
          <Card className={glassCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-emerald-600" />
                <CardTitle>{t('settings.notifications.preferencesTitle', { defaultValue: 'Notification Preferences' })}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.notifications.preferencesDescription', { defaultValue: 'Choose which notifications you want to receive.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Push Notifications Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="notify-push"
                  checked={notifyPush}
                  onChange={handleToggleNotifyPush}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="notify-push" className="font-semibold cursor-pointer text-base">
                    {t('settings.notifications.pushNotifications', { defaultValue: 'Push Notifications' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('settings.notifications.pushDescription', { defaultValue: 'Receive push notifications for reminders, task updates, and important alerts.' })}
                  </p>
                </div>
              </div>

              {/* Email Campaigns Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/50 dark:bg-[#1c1c1f]/50">
                <input
                  type="checkbox"
                  id="notify-email"
                  checked={notifyEmail}
                  onChange={handleToggleNotifyEmail}
                  disabled={saving}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <Label htmlFor="notify-email" className="font-semibold cursor-pointer text-base">
                    {t('settings.notifications.emailCampaigns', { defaultValue: 'Email Campaigns' })}
                  </Label>
                  <p className="text-sm opacity-70 mt-1">
                    {t('settings.notifications.emailDescription', { defaultValue: 'Receive newsletters, product updates, and promotional emails from Aphylia.' })}
                  </p>
                </div>
              </div>
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
