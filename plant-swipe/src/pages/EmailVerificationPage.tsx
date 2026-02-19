import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Mail, Loader2, Check, RefreshCw, ArrowLeft } from "lucide-react"

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

// OTP Input component for 6-digit code entry
const OTPInput: React.FC<{
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
}> = ({ value, onChange, disabled, error }) => {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])
  
  const handleChange = (index: number, char: string) => {
    // Only allow alphanumeric characters
    const sanitized = char.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!sanitized && char !== '') return
    
    const newValue = value.split('')
    newValue[index] = sanitized
    const result = newValue.join('').slice(0, 6)
    onChange(result)
    
    // Move to next input if character was entered
    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }
  
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    onChange(pasted)
    // Focus the last filled input or the next empty one
    const focusIndex = Math.min(pasted.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }
  
  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          disabled={disabled}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200 
            ${error 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600' 
              : value[index] 
                ? 'border-accent bg-accent/10' 
                : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800'
            }
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            text-stone-800 dark:text-stone-100`}
        />
      ))}
    </div>
  )
}

export function EmailVerificationPage() {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const currentLang = useLanguage()
  const location = useLocation()
  const { user, profile, refreshProfile } = useAuth()
  
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sendingCode, setSendingCode] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [codeSent, setCodeSent] = React.useState(false)
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = React.useState<number>(0)
  const [resendCooldown, setResendCooldown] = React.useState(0)
  
  // Target email for email-change flow (passed via navigation state from SettingsPage,
  // or loaded from the server's pending verification code)
  const [targetEmail, setTargetEmail] = React.useState<string | null>(
    (location.state as { targetEmail?: string } | null)?.targetEmail || null
  )
  
  // Countdown timer for code expiration
  React.useEffect(() => {
    if (!expiresAt) return
    
    const updateTimer = () => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      setTimeLeft(diff)
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])
  
  // Resend cooldown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return
    
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    
    return () => clearInterval(timer)
  }, [resendCooldown])
  
  // Redirect if no user or already verified
  React.useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    if (profile?.email_verified) {
      navigate('/discovery')
    }
  }, [user, profile?.email_verified, navigate])
  
  // Check for existing verification code before sending a new one
  React.useEffect(() => {
    if (!user) return

    const loadVerificationState = async () => {
      try {
        const sessionResult = await supabase.auth.getSession()
        const headers: Record<string, string> = {}
        if (sessionResult.data.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionResult.data.session.access_token}`
        }

        const response = await fetch('/api/email-verification/status', {
          method: 'GET',
          headers,
          credentials: 'same-origin'
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check verification status')
        }

        if (data.verified) {
          await refreshProfile()
          navigate('/discovery')
          return
        }

        if (data.hasPendingCode && data.pendingCodeExpiresAt) {
          setCodeSent(true)
          setExpiresAt(new Date(data.pendingCodeExpiresAt))
          // If server returns a targetEmail (email-change flow), use it
          if (data.targetEmail) {
            setTargetEmail(data.targetEmail)
          }
          return
        }

        sendVerificationCode()
      } catch (err) {
        console.error('[email-verification] Status error:', err)
        setError(err instanceof Error ? err.message : 'Failed to check verification status')
      }
    }

    loadVerificationState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
  
  const sendVerificationCode = async () => {
    if (sendingCode || resendCooldown > 0) return
    
    setSendingCode(true)
    setError(null)
    
    try {
      // Get CSRF token and auth session for security-sensitive operation
      const [csrfToken, sessionResult] = await Promise.all([
        getCsrfToken(),
        supabase.auth.getSession()
      ])
      
      const secureHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      }
      if (sessionResult.data.session?.access_token) {
        secureHeaders['Authorization'] = `Bearer ${sessionResult.data.session.access_token}`
      }
      
      // Include targetEmail if this is an email-change flow, so the OTP
      // is sent to the new email address (not the current auth email)
      const sendBody: Record<string, string> = { language: currentLang }
      if (targetEmail) {
        sendBody.targetEmail = targetEmail
      }
      
      const response = await fetch('/api/email-verification/send', {
        method: 'POST',
        headers: secureHeaders,
        body: JSON.stringify(sendBody),
        credentials: 'same-origin'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code')
      }
      
      if (data.alreadyVerified) {
        await refreshProfile()
        navigate('/discovery')
        return
      }
      
      if (data.sent) {
        setCodeSent(true)
        setExpiresAt(new Date(data.expiresAt))
        setResendCooldown(60) // 60 second cooldown between resends
      } else {
        throw new Error(data.reason || 'Failed to send verification code')
      }
    } catch (err) {
      console.error('[email-verification] Send error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setSendingCode(false)
    }
  }
  
  const verifyCode = async () => {
    if (loading || code.length !== 6) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Get CSRF token and auth session for security-sensitive operation
      const [csrfToken, sessionResult] = await Promise.all([
        getCsrfToken(),
        supabase.auth.getSession()
      ])
      
      const secureHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      }
      if (sessionResult.data.session?.access_token) {
        secureHeaders['Authorization'] = `Bearer ${sessionResult.data.session.access_token}`
      }
      
      const response = await fetch('/api/email-verification/verify', {
        method: 'POST',
        headers: secureHeaders,
        body: JSON.stringify({ code }),
        credentials: 'same-origin'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code')
      }
      
      if (data.verified) {
        setSuccess(true)
        await refreshProfile()
        
        // Brief delay to show success state before navigating
        setTimeout(() => {
          navigate('/discovery')
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to verify code')
      }
    } catch (err) {
      console.error('[email-verification] Verify error:', err)
      setError(err instanceof Error ? err.message : 'Failed to verify code')
      setCode('') // Clear code on error
    } finally {
      setLoading(false)
    }
  }
  
  // Auto-submit when 6 characters are entered
  React.useEffect(() => {
    if (code.length === 6 && !loading && !success) {
      verifyCode()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])
  
  // Format time left as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Don't render anything while checking auth
  if (!user) return null
  
  return (
    <>
      {/* Logo theme styles */}
      <style>{`
        .plant-icon-theme {
          filter: brightness(0) saturate(100%);
        }
        .dark .plant-icon-theme {
          filter: brightness(0) saturate(100%) invert(100%);
        }
      `}</style>
      
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white dark:bg-stone-900">
          <div className="flex items-center justify-between px-4 py-4 max-w-2xl mx-auto">
            <button
              onClick={() => navigate('/setup')}
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
                {/* Success animation */}
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
                  {t('emailVerification.successTitle', 'Email Verified!')}
                </motion.h2>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-stone-500 dark:text-stone-400 text-base md:text-lg"
                >
                  {t('emailVerification.successDescription', 'Redirecting you to your garden...')}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center max-w-md mx-auto"
              >
                {/* Email icon */}
                <motion.div 
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="relative mb-8"
                >
                  <div className="absolute inset-0 bg-accent/30 rounded-full blur-2xl scale-150" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 dark:from-accent/30 dark:to-accent/10 flex items-center justify-center shadow-2xl border border-accent/20">
                    <Mail className="w-12 h-12 text-accent" />
                  </div>
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl md:text-3xl font-bold text-stone-800 dark:text-stone-100 mb-3"
                >
                  {t('emailVerification.title', 'Verify Your Email')}
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-stone-500 dark:text-stone-400 text-sm md:text-base mb-2"
                >
                  {t('emailVerification.description', "We've sent a verification code to:")}
                </motion.p>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-stone-800 dark:text-stone-200 font-medium text-base md:text-lg mb-8"
                >
                  {targetEmail || user?.email}
                </motion.p>
                
                {/* Code input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="w-full mb-4"
                >
                  <OTPInput
                    value={code}
                    onChange={setCode}
                    disabled={loading || sendingCode}
                    error={!!error}
                  />
                </motion.div>
                
                {/* Timer and error */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 h-6"
                >
                  {error ? (
                    <p className="text-red-500 dark:text-red-400 text-sm font-medium">
                      {error}
                    </p>
                  ) : timeLeft > 0 ? (
                    <p className="text-stone-400 dark:text-stone-500 text-sm">
                      {t('emailVerification.codeExpires', 'Code expires in')} {formatTime(timeLeft)}
                    </p>
                  ) : codeSent ? (
                    <p className="text-amber-500 dark:text-amber-400 text-sm">
                      {t('emailVerification.codeExpired', 'Code has expired. Please request a new one.')}
                    </p>
                  ) : null}
                </motion.div>
                
                {/* Resend button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <button
                    onClick={sendVerificationCode}
                    disabled={sendingCode || resendCooldown > 0}
                    className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendingCode ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('emailVerification.sending', 'Sending...')}
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        {t('emailVerification.resendIn', 'Resend in')} {resendCooldown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        {t('emailVerification.resendCode', "Didn't receive the code? Resend")}
                      </>
                    )}
                  </button>
                </motion.div>
                
                {/* Info text */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 text-xs text-stone-400 dark:text-stone-500 max-w-xs"
                >
                  {t('emailVerification.checkSpam', "Check your spam folder if you don't see the email. The code is valid for 5 minutes.")}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Verify button (only show when code is complete) */}
        {code.length === 6 && !success && (
          <div className="sticky bottom-0 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 p-4">
            <div className="max-w-md mx-auto">
              <Button 
                onClick={verifyCode}
                disabled={loading}
                size="lg"
                className="w-full rounded-full py-6 text-base font-semibold bg-accent hover:opacity-90 text-accent-foreground shadow-lg transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('emailVerification.verifying', 'Verifying...')}
                  </>
                ) : (
                  t('emailVerification.verifyButton', 'Verify Email')
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default EmailVerificationPage
