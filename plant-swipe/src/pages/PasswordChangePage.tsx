import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Loader2, Check, Eye, EyeOff } from "lucide-react"

/**
 * Get CSRF token from backend (SECURITY: Required for state-changing operations)
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

export function PasswordChangePage() {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const { user, profile, refreshProfile, signOut } = useAuth()

  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  // Redirect if no user
  React.useEffect(() => {
    if (!user) {
      navigate('/')
    }
  }, [user, navigate])

  // Redirect if user doesn't need password change
  const localStorageFlag = (() => {
    try { return localStorage.getItem('plantswipe.force_password_change') === 'true' } catch { return false }
  })()
  React.useEffect(() => {
    if (user && profile && !profile.force_password_change && !localStorageFlag) {
      navigate('/discovery')
    }
  }, [user, profile, navigate, localStorageFlag])

  const handleSubmit = async () => {
    if (loading) return

    // Validate
    if (!newPassword || newPassword.length < 6) {
      setError(t('passwordChange.passwordTooShort', 'Password must be at least 6 characters.'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwordChange.passwordsDontMatch', 'Passwords do not match.'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get CSRF token and auth session
      const [csrfToken, sessionResult] = await Promise.all([
        getCsrfToken(),
        supabase.auth.getSession()
      ])

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      }
      if (sessionResult.data.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionResult.data.session.access_token}`
      }

      const response = await fetch('/api/force-password-change', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newPassword }),
        credentials: 'same-origin',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password.')
      }

      if (data.success) {
        setSuccess(true)
        // Clear both the DB flag (via profile refresh) and the localStorage flag
        try { localStorage.removeItem('plantswipe.force_password_change') } catch {}
        await refreshProfile()

        // Navigate after brief delay to show success
        setTimeout(() => {
          navigate('/discovery')
        }, 2000)
      } else {
        throw new Error('Failed to change password.')
      }
    } catch (err) {
      console.error('[password-change] Error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  // Don't render until auth is resolved
  if (!user) return null

  return (
    <>
      <style>{`
        .plant-icon-theme {
          filter: brightness(0) saturate(100%);
        }
        .dark .plant-icon-theme {
          filter: brightness(0) saturate(100%) invert(100%);
        }
      `}</style>

      <div className="min-h-screen bg-white dark:bg-stone-900 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white dark:bg-stone-900">
          <div className="flex items-center justify-between px-4 py-4 max-w-2xl mx-auto">
            <div className="w-10" />

            <img
              src="/icons/plant-swipe-icon.svg"
              alt="Aphylia"
              className="w-8 h-8 plant-icon-theme opacity-60"
              draggable="false"
            />

            <button
              onClick={async () => {
                try { localStorage.removeItem('plantswipe.force_password_change') } catch {}
                await signOut()
                navigate('/')
              }}
              className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            >
              {t('common.logout', 'Log out')}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center text-center max-w-md mx-auto"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="relative mb-8"
                >
                  <div className="absolute inset-0 bg-accent/40 rounded-full blur-2xl scale-150" />
                  <div className="relative w-28 h-28 rounded-3xl bg-accent flex items-center justify-center shadow-2xl">
                    <Check className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl md:text-3xl font-bold text-stone-800 dark:text-stone-100 mb-4"
                >
                  {t('passwordChange.successTitle', 'Password Changed!')}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-stone-500 dark:text-stone-400 text-base md:text-lg"
                >
                  {t('passwordChange.successDescription', 'Redirecting you to the app...')}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center max-w-md mx-auto w-full"
              >
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="relative mb-8"
                >
                  <div className="absolute inset-0 bg-accent/30 rounded-full blur-2xl scale-150" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 dark:from-accent/30 dark:to-accent/10 flex items-center justify-center shadow-2xl border border-accent/20">
                    <KeyRound className="w-12 h-12 text-accent" />
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl md:text-3xl font-bold text-stone-800 dark:text-stone-100 mb-3"
                >
                  {t('passwordChange.title', 'Change Your Password')}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-stone-500 dark:text-stone-400 text-sm md:text-base mb-8"
                >
                  {t('passwordChange.description', 'You must set a new password before continuing.')}
                </motion.p>

                {/* Password form */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="w-full space-y-4"
                >
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="new-password">
                      {t('passwordChange.newPasswordLabel', 'New Password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder={t('passwordChange.newPasswordPlaceholder', 'Enter new password')}
                        value={newPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                        disabled={loading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 text-left">
                    <Label htmlFor="confirm-password">
                      {t('passwordChange.confirmPasswordLabel', 'Confirm Password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t('passwordChange.confirmPasswordPlaceholder', 'Confirm new password')}
                        value={confirmPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="pr-10"
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'Enter') handleSubmit()
                        }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-500 dark:text-red-400 text-sm"
                    >
                      {error}
                    </motion.p>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full rounded-full py-6 text-base font-semibold bg-accent hover:opacity-90 text-accent-foreground shadow-lg transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {t('passwordChange.changing', 'Changing Password...')}
                      </>
                    ) : (
                      t('passwordChange.submit', 'Change Password')
                    )}
                  </Button>
                </motion.div>

                {/* Password requirements */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 text-xs text-stone-400 dark:text-stone-500 max-w-xs"
                >
                  {t('passwordChange.requirements', 'Password must be at least 6 characters long.')}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

export default PasswordChangePage
