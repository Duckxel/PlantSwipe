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
import { Settings, Mail, Lock, Trash2, AlertTriangle, Check, ChevronDown, ChevronUp, Globe } from "lucide-react"
import { SUPPORTED_LANGUAGES } from "@/lib/i18n"

export default function SettingsPage() {
  const { user, profile, refreshProfile, deleteAccount, signOut } = useAuth()
  const navigate = useLanguageNavigate()
  const changeLanguage = useChangeLanguage()
  const currentLang = useLanguage()
  const { t } = useTranslation('common')

  const [email, setEmail] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isPrivate, setIsPrivate] = React.useState(false)
  const [disableFriendRequests, setDisableFriendRequests] = React.useState(false)
  const [emailExpanded, setEmailExpanded] = React.useState(false)
  const [passwordExpanded, setPasswordExpanded] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

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

        // Load profile privacy setting
        if (profile) {
          setIsPrivate(Boolean((profile as any).is_private || false))
          setDisableFriendRequests(Boolean((profile as any).disable_friend_requests || false))
        } else {
          // Fetch profile if not loaded
          const { data } = await supabase
            .from('profiles')
            .select('is_private, disable_friend_requests')
            .eq('id', user.id)
            .maybeSingle()
          if (data) {
            setIsPrivate(Boolean(data.is_private || false))
            setDisableFriendRequests(Boolean(data.disable_friend_requests || false))
          }
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
      // Refresh auth state
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
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword
      })

      if (signInError) {
        throw new Error(t('settings.password.currentPasswordIncorrect'))
      }

      // If sign in succeeds, update the password
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
      setIsPrivate(!newPrivacyValue) // Revert on error
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
      setDisableFriendRequests(!newValue) // Revert on error
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

      // Sign out and redirect
      await signOut()
      navigate("/")
    } catch (e: any) {
      setError(e?.message || t('settings.dangerZone.failedToDelete'))
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
        <div className="p-8 text-center text-sm opacity-60">{t('settings.loading')}</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Settings className="h-6 w-6" />
          {t('settings.title')}
        </h1>
        <p className="text-sm opacity-70 mt-2">{t('settings.description')}</p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-start gap-2">
          <Check className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">{success}</div>
        </div>
      )}

      {/* Account Information */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <button
            onClick={() => setEmailExpanded(!emailExpanded)}
            className="w-full text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <CardTitle>{t('settings.email.title')}</CardTitle>
            </div>
            {emailExpanded ? (
              <ChevronUp className="h-5 w-5 opacity-60" />
            ) : (
              <ChevronDown className="h-5 w-5 opacity-60" />
            )}
          </button>
          {!emailExpanded ? (
            <CardDescription className="mt-2">
              {t('settings.email.emailAddressLabel')} <span className="font-medium">{email}</span>
            </CardDescription>
          ) : (
            <CardDescription className="mt-2">
              {t('settings.email.description')}
            </CardDescription>
          )}
        </CardHeader>
        {emailExpanded && (
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-email">{t('settings.email.currentEmail')}</Label>
              <Input
                id="current-email"
                type="email"
                value={email}
                disabled
                className="bg-stone-50"
              />
            </div>
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

      {/* Password */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <button
            onClick={() => setPasswordExpanded(!passwordExpanded)}
            className="w-full text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>{t('settings.password.title')}</CardTitle>
            </div>
            {passwordExpanded ? (
              <ChevronUp className="h-5 w-5 opacity-60" />
            ) : (
              <ChevronDown className="h-5 w-5 opacity-60" />
            )}
          </button>
          {!passwordExpanded ? (
            <CardDescription className="mt-2">
              {t('settings.password.passwordLabel')} <span className="font-medium">••••••••</span>
            </CardDescription>
          ) : (
            <CardDescription className="mt-2">
              {t('settings.password.description')}
            </CardDescription>
          )}
        </CardHeader>
        {passwordExpanded && (
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

      {/* Privacy Settings */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <CardTitle>{t('settings.privacy.title')}</CardTitle>
          <CardDescription>{t('settings.privacy.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="private-profile"
              checked={isPrivate}
              onChange={handleTogglePrivacy}
              disabled={saving}
              className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <Label htmlFor="private-profile" className="font-medium cursor-pointer">
                {t('settings.privacy.privateProfile')}
              </Label>
              <p className="text-sm opacity-70 mt-1">
                {t('settings.privacy.privateProfileDescription')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Friend Requests Settings */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <CardTitle>{t('settings.friendRequests.title')}</CardTitle>
          <CardDescription>{t('settings.friendRequests.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="disable-friend-requests"
              checked={disableFriendRequests}
              onChange={handleToggleFriendRequests}
              disabled={saving}
              className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <Label htmlFor="disable-friend-requests" className="font-medium cursor-pointer">
                {t('settings.friendRequests.disable')}
              </Label>
              <p className="text-sm opacity-70 mt-1">
                {t('settings.friendRequests.disableDescription')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.language.title')}
          </CardTitle>
          <CardDescription>
            {t('settings.language.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Button
                key={lang}
                onClick={() => changeLanguage(lang)}
                variant={currentLang === lang ? "default" : "secondary"}
                className={`rounded-2xl ${currentLang === lang ? "bg-black text-white hover:bg-black/90" : ""}`}
              >
                {lang === 'en' ? t('settings.language.english') : t('settings.language.french')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="rounded-3xl border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.dangerZone.title')}
          </CardTitle>
          <CardDescription className="text-red-600/80">
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
              <div className="p-4 rounded-xl bg-white border border-red-200 space-y-4">
                <p className="text-sm font-medium text-red-700">
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
  )
}
