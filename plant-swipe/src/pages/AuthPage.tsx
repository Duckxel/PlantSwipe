import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ValidatedInput } from "@/components/ui/validated-input"
import { PasswordRules } from "@/components/ui/password-rules"
import { useFieldValidation } from "@/hooks/useFieldValidation"
import { validateEmailFormat, validateEmailDomain } from "@/lib/emailValidation"
import { validateUsername } from "@/lib/username"
import { validatePassword } from "@/lib/passwordValidation"
import { executeRecaptcha } from "@/lib/recaptcha"
import { getConsentLevel } from "@/components/CookieConsent"
import { isNativeCapacitor } from "@/platform/runtime"
import { Mail, Lock, User, ArrowRight } from "lucide-react"

interface AuthPageProps {
  /** Initial mode for the form */
  mode?: "login" | "signup"
}

export function AuthPage({ mode: initialMode = "login" }: AuthPageProps) {
  const { t } = useTranslation("common")
  const navigate = useLanguageNavigate()
  const { signIn, signUp, user } = useAuth()

  const [mode, setMode] = React.useState<"login" | "signup">(initialMode)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [password2, setPassword2] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)
  const [marketingConsent, setMarketingConsent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const isSignup = mode === "signup"

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) navigate("/discovery", { replace: true })
  }, [user, navigate])

  // Sync mode with prop when it changes
  React.useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  // -- Field validation hooks --
  const usernameValidation = useFieldValidation(
    displayName,
    React.useCallback(
      async (val: string) => {
        const fmt = validateUsername(val)
        if (!fmt.valid)
          return { valid: false, error: fmt.error }
        try {
          const resp = await fetch("/api/auth/check-available", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: fmt.normalized }),
            credentials: "same-origin",
          })
          if (resp.ok) {
            const data = await resp.json()
            if (data.username && !data.username.available)
              return {
                valid: false,
                error: t("auth.usernameErrors.taken", {
                  defaultValue: "This username is already taken",
                }),
              }
          }
        } catch {
          // Network error — format is valid, let server catch duplicates
        }
        return { valid: true }
      },
      [t],
    ),
    400,
    isSignup,
  )

  const emailValidation = useFieldValidation(
    email,
    React.useCallback(
      async (val: string) => {
        const fmt = validateEmailFormat(val)
        if (!fmt.valid)
          return {
            valid: false,
            error: t(fmt.errorKey || "auth.emailErrors.invalidFormat", {
              defaultValue: fmt.error,
            }),
          }
        const suggestionText = fmt.suggestion
          ? t("auth.emailSuggestion", {
              defaultValue: "Did you mean {{suggestion}}?",
              suggestion: fmt.suggestion,
            })
          : undefined
        const dns = await validateEmailDomain(val)
        if (!dns.valid)
          return {
            valid: false,
            error: t(dns.errorKey || "auth.emailErrors.invalidDomain", {
              defaultValue: dns.error,
            }),
          }
        try {
          const resp = await fetch("/api/auth/check-available", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: val }),
            credentials: "same-origin",
          })
          if (resp.ok) {
            const data = await resp.json()
            if (data.email && !data.email.available)
              return {
                valid: false,
                error: t("auth.emailErrors.taken", {
                  defaultValue: "This email is already registered",
                }),
              }
          }
        } catch {
          // Proceed on network error
        }
        return { valid: true, suggestion: suggestionText }
      },
      [t],
    ),
    400,
    isSignup,
  )

  const passwordResult = React.useMemo(
    () => validatePassword(password),
    [password],
  )
  const passwordValidation = useFieldValidation(
    password,
    React.useCallback(
      async (val: string) => {
        const r = validatePassword(val)
        if (!r.valid)
          return {
            valid: false,
            error: t("auth.passwordRules.tooWeak", {
              defaultValue: "Password does not meet the requirements",
            }),
          }
        return { valid: true }
      },
      [t],
    ),
    300,
    isSignup,
  )

  const confirmPasswordValidation = useFieldValidation(
    password2,
    React.useCallback(
      async (val: string) => {
        if (val !== password)
          return {
            valid: false,
            error: t("auth.passwordsDontMatch", {
              defaultValue: "Passwords don't match",
            }),
          }
        return { valid: true }
      },
      [t, password],
    ),
    300,
    isSignup,
  )

  const handleAcceptEmailSuggestion = React.useCallback(() => {
    const res = validateEmailFormat(email)
    if (res.suggestion) setEmail(res.suggestion)
  }, [email])

  // -- Submit --
  const handleSubmit = async () => {
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const isNative = isNativeCapacitor()

      // reCAPTCHA (web only)
      let recaptchaToken: string | undefined
      if (!isNative) {
        const consentLevel = getConsentLevel()
        if (!consentLevel || consentLevel === "rejected") {
          setError(t("auth.cookiesRequired"))
          setSubmitting(false)
          return
        }
        try {
          const token = await executeRecaptcha(
            isSignup ? "signup" : "login",
          )
          recaptchaToken = token ?? undefined
        } catch {
          // Continue without token
        }
      }

      if (isSignup) {
        if (usernameValidation.status !== "valid") {
          setError(
            usernameValidation.error ||
              t("auth.usernameErrors.invalid", {
                defaultValue: "Please enter a valid username",
              }),
          )
          setSubmitting(false)
          return
        }
        if (emailValidation.status !== "valid") {
          setError(
            emailValidation.error ||
              t("auth.emailErrors.invalidFormat", {
                defaultValue: "Please enter a valid email address",
              }),
          )
          setSubmitting(false)
          return
        }
        if (!validatePassword(password).valid) {
          setError(
            t("auth.passwordRules.tooWeak", {
              defaultValue: "Password does not meet the requirements",
            }),
          )
          setSubmitting(false)
          return
        }
        if (password !== password2) {
          setError(t("auth.passwordsDontMatch"))
          setSubmitting(false)
          return
        }
        if (!acceptedTerms) {
          setError(t("auth.mustAcceptTerms"))
          setSubmitting(false)
          return
        }
        const { error: signUpError } = await signUp({
          email,
          password,
          displayName,
          recaptchaToken,
          marketingConsent,
        })
        if (signUpError) {
          setError(
            signUpError === "BAN_BLOCKED"
              ? t("ban.loginBlocked")
              : signUpError,
          )
          setSubmitting(false)
          return
        }
      } else {
        const { error: signInError } = await signIn({
          email,
          password,
          recaptchaToken,
        })
        if (signInError) {
          setError(
            signInError === "BAN_BLOCKED"
              ? t("ban.loginBlocked")
              : signInError,
          )
          setSubmitting(false)
          return
        }
      }

      setSubmitting(false)
      // Auth context will update `user`, the useEffect redirect handles navigation
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: unknown }).message || "")
          : ""
      setError(msg || t("auth.unexpectedError"))
      setSubmitting(false)
    }
  }

  // -- Key handler for form submission --
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !submitting) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const termsPath = "/terms"
  const privacyPath = "/privacy"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#1a1a1c] dark:to-[#141415] px-4 py-8 overflow-hidden relative">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/8 dark:bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Logo / Branding */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3"
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/15 rounded-full blur-2xl scale-[2]" />
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 dark:from-emerald-500/25 dark:to-emerald-600/10 border border-emerald-500/20 dark:border-emerald-400/15 shadow-lg">
              <img
                src="/icons/plant-swipe-icon.svg"
                alt="Aphylia"
                className="w-12 h-12 plant-icon-theme"
                draggable="false"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
            Aphylia
          </h1>
          <AnimatePresence mode="wait">
            <motion.p
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-stone-500 dark:text-stone-400"
            >
              {isSignup
                ? t("auth.signupDescription", "Create your account to start gardening")
                : t("auth.loginDescription", "Access favorites, journal, and gardens.")}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Auth Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white/80 dark:bg-[#232326]/80 backdrop-blur-xl rounded-3xl border border-stone-200/80 dark:border-[#3e3e42]/60 p-6 shadow-xl shadow-black/5 dark:shadow-black/30"
          onKeyDown={handleKeyDown}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: isSignup ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignup ? -16 : 16 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {isSignup && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name" className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    {t("auth.displayName")}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500 pointer-events-none" />
                    <ValidatedInput
                      id="auth-name"
                      type="text"
                      placeholder={t("auth.displayNamePlaceholder")}
                      value={displayName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDisplayName(e.target.value)
                      }
                      disabled={submitting}
                      status={usernameValidation.status}
                      error={usernameValidation.error}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  {t("auth.email")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500 pointer-events-none" />
                  <ValidatedInput
                    id="auth-email"
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEmail(e.target.value)
                    }
                    disabled={submitting}
                    status={isSignup ? emailValidation.status : "idle"}
                    error={emailValidation.error}
                    suggestion={emailValidation.suggestion}
                    onAcceptSuggestion={
                      emailValidation.suggestion
                        ? handleAcceptEmailSuggestion
                        : undefined
                    }
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password" className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  {t("auth.password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500 pointer-events-none" />
                  <ValidatedInput
                    id="auth-password"
                    type="password"
                    placeholder={t("auth.passwordPlaceholder")}
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    disabled={submitting}
                    status={isSignup ? passwordValidation.status : "idle"}
                    error={passwordValidation.error}
                    className="pl-10"
                  />
                </div>
                {isSignup && (
                  <PasswordRules
                    rules={passwordResult.rules}
                    visible={password.length > 0}
                    allPassedLabel={t("auth.passwordRules.strong", {
                      defaultValue: "Password is strong",
                    })}
                  />
                )}
              </div>

              {isSignup && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-confirm" className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    {t("auth.confirmPassword")}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500 pointer-events-none" />
                    <ValidatedInput
                      id="auth-confirm"
                      type="password"
                      placeholder={t("auth.confirmPasswordPlaceholder")}
                      value={password2}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword2(e.target.value)
                      }
                      disabled={submitting}
                      status={confirmPasswordValidation.status}
                      error={confirmPasswordValidation.error}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {isSignup && (
                <div className="mt-1 space-y-2.5">
                  <label
                    htmlFor="auth-accept-terms"
                    className="flex items-start gap-3 rounded-2xl border border-stone-200/80 dark:border-[#3e3e42]/60 bg-stone-50/60 dark:bg-[#1a1a1c]/60 p-3 cursor-pointer transition-colors hover:bg-stone-100/60 dark:hover:bg-[#1e1e1e]/80"
                  >
                    <input
                      id="auth-accept-terms"
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      disabled={submitting}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-600 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-[#555] dark:bg-[#1e1e1e]"
                    />
                    <span className="text-xs leading-5 text-stone-600 dark:text-stone-300">
                      {t("auth.acceptTermsLabel")}{" "}
                      <a
                        href={termsPath}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        {t("auth.termsLinkLabel")}
                      </a>{" "}
                      {t("auth.andText")}{" "}
                      <a
                        href={privacyPath}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        {t("auth.privacyLinkLabel")}
                      </a>
                      .
                    </span>
                  </label>
                  <label
                    htmlFor="auth-marketing-consent"
                    className="flex items-start gap-3 rounded-2xl border border-stone-200/80 dark:border-[#3e3e42]/60 bg-stone-50/60 dark:bg-[#1a1a1c]/60 p-3 cursor-pointer transition-colors hover:bg-stone-100/60 dark:hover:bg-[#1e1e1e]/80"
                  >
                    <input
                      id="auth-marketing-consent"
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      disabled={submitting}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-600 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-[#555] dark:bg-[#1e1e1e]"
                    />
                    <span className="text-xs leading-5 text-stone-600 dark:text-stone-300">
                      {t("auth.marketingConsentLabel",
                        "Receive occasional emails about new features and updates",
                      )}
                    </span>
                  </label>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-3 py-2"
                >
                  {error}
                </motion.div>
              )}

              <div className="pt-1 space-y-3">
                <Button
                  className="w-full h-11 rounded-2xl text-sm font-semibold gap-2 shadow-md shadow-emerald-900/10 dark:shadow-emerald-900/20"
                  onClick={handleSubmit}
                  loading={submitting}
                >
                  {isSignup
                    ? t("auth.createAccount")
                    : t("auth.continue")}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>

                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-stone-200 dark:bg-[#3e3e42]" />
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {isSignup
                      ? t("auth.orLoginLabel", "or")
                      : t("auth.orSignupLabel", "or")}
                  </span>
                  <div className="flex-1 h-px bg-stone-200 dark:bg-[#3e3e42]" />
                </div>

                <button
                  className="w-full py-2.5 rounded-2xl text-sm font-medium border border-stone-200 dark:border-[#3e3e42] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#2d2d30] transition-colors"
                  onClick={() => {
                    setMode(isSignup ? "login" : "signup")
                    setError(null)
                  }}
                  disabled={submitting}
                >
                  {isSignup
                    ? t("auth.haveAccount")
                    : t("auth.noAccount")}
                </button>

                {!isSignup && (
                  <div className="text-center">
                    <button
                      className="text-xs text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors"
                      onClick={() => navigate("/forgot-password")}
                      disabled={submitting}
                    >
                      {t("auth.forgotPassword", "Forgot Password?")}
                    </button>
                  </div>
                )}

                {!isNativeCapacitor() && (
                  <p className="text-[10px] text-center text-stone-400 dark:text-stone-500 leading-relaxed">
                    This site is protected by reCAPTCHA and the Google{" "}
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-stone-600 dark:hover:text-stone-400"
                    >
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a
                      href="https://policies.google.com/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-stone-600 dark:hover:text-stone-400"
                    >
                      Terms of Service
                    </a>{" "}
                    apply.
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`
        .plant-icon-theme { filter: brightness(0) saturate(100%); }
        .dark .plant-icon-theme { filter: brightness(0) saturate(100%) invert(100%); }
      `}</style>
    </div>
  )
}

export default AuthPage
