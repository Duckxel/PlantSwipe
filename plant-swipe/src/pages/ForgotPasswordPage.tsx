import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { Label } from "@/components/ui/label"
import { KeyRound, Loader2, Check, ArrowLeft, Mail } from "lucide-react"

export function ForgotPasswordPage() {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()

  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleSubmit = async () => {
    if (loading || !email.trim()) return

    // Basic email validation
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError(t('forgotPassword.invalidEmail', 'Please enter a valid email address.'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        credentials: 'same-origin',
      })

      const data = await response.json()

      if (!response.ok || !data.found) {
        setError(data.error || t('forgotPassword.noAccountFound', 'No account found with this email address.'))
        setLoading(false)
        return
      }

      if (data.found && data.sent) {
        // Set localStorage flag so the app knows to redirect to /password-change
        // after the magic link session is established (works even if DB column doesn't exist)
        try { localStorage.setItem('plantswipe.force_password_change', 'true') } catch {}
        setSuccess(true)
      } else {
        setError(data.reason || t('forgotPassword.failedToSend', 'Failed to send email. Please try again.'))
      }
    } catch (err) {
      console.error('[forgot-password] Error:', err)
      setError(t('forgotPassword.unexpectedError', 'An unexpected error occurred. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

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
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <img
              src="/icons/plant-swipe-icon.svg"
              alt="Aphylia"
              className="w-8 h-8 plant-icon-theme opacity-60"
              draggable="false"
            />

            <div className="w-10" />
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
                  {t('forgotPassword.successTitle', 'Email Sent!')}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-stone-500 dark:text-stone-400 text-base md:text-lg mb-6"
                >
                  {t('forgotPassword.successDescription', 'We have sent a password reset link to your email. Click the link to sign in and set a new password.')}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Button
                    onClick={() => navigate('/')}
                    className="rounded-full px-8 py-3 bg-accent hover:opacity-90 text-accent-foreground"
                  >
                    {t('forgotPassword.backToHome', 'Back to Home')}
                  </Button>
                </motion.div>
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
                  {t('forgotPassword.title', 'Forgot Your Password?')}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-stone-500 dark:text-stone-400 text-sm md:text-base mb-8"
                >
                  {t('forgotPassword.description', 'Enter the email address associated with your account and we will send you a link to reset your password.')}
                </motion.p>

                {/* Email input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="w-full space-y-4"
                >
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="forgot-password-email">
                      {t('forgotPassword.emailLabel', 'Email Address')}
                    </Label>
                    <SearchInput
                      id="forgot-password-email"
                      icon={<Mail className="h-full w-full" />}
                      placeholder={t('forgotPassword.emailPlaceholder', 'you@example.com')}
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      onClear={() => setEmail('')}
                      disabled={loading}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') handleSubmit()
                      }}
                    />
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
                    disabled={loading || !email.trim()}
                    className="w-full rounded-full py-6 text-base font-semibold bg-accent hover:opacity-90 text-accent-foreground shadow-lg transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {t('forgotPassword.sending', 'Sending...')}
                      </>
                    ) : (
                      t('forgotPassword.submit', 'Send Reset Link')
                    )}
                  </Button>
                </motion.div>

                {/* Info text */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 text-xs text-stone-400 dark:text-stone-500 max-w-xs"
                >
                  {t('forgotPassword.checkSpam', "Check your spam folder if you don't see the email. The link will log you in and redirect you to change your password.")}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

export default ForgotPasswordPage
