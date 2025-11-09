import { ChangeEvent, FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2, Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"

const SUPPORT_EMAIL = "support@aphylia.app"
const SUPPORT_FUNCTION = "contact-support"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldKey = "name" | "email" | "message"
type FormStatus = "idle" | "success" | "error"

type FormState = Record<FieldKey, string>
type FormErrors = Partial<Record<FieldKey, string>>

export default function ContactUsPage() {
  const { t } = useTranslation('common')
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    message: "",
  })
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<FormStatus>("idle")
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleEmailClick = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}`
  }

  const handleEmailCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
    } catch (err) {
      console.error('Failed to copy email:', err)
    }
  }

  const handleFieldChange = (field: FieldKey) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }

    if (status !== "idle") {
      setStatus("idle")
    }
    if (serverError) {
      setServerError(null)
    }
  }

  const validate = (data: FormState): FormErrors => {
    const errors: FormErrors = {}
    const trimmedName = data.name.trim()
    const trimmedEmail = data.email.trim()
    const trimmedMessage = data.message.trim()

    if (!trimmedName) {
      errors.name = t('contactUs.form.validation.name')
    } else if (trimmedName.length > 120) {
      errors.name = t('contactUs.form.validation.nameMax')
    }

    if (!trimmedEmail) {
      errors.email = t('contactUs.form.validation.email')
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = t('contactUs.form.validation.emailInvalid')
    }

    if (!trimmedMessage) {
      errors.message = t('contactUs.form.validation.message')
    } else if (trimmedMessage.length < 10) {
      errors.message = t('contactUs.form.validation.messageMin')
    } else if (trimmedMessage.length > 4000) {
      errors.message = t('contactUs.form.validation.messageMax')
    }

    return errors
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus("idle")
    setServerError(null)

    const trimmedData: FormState = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      message: formData.message.trim(),
    }

    const errors = validate(trimmedData)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke(SUPPORT_FUNCTION, {
        body: {
          ...trimmedData,
          submittedAt: new Date().toISOString(),
        },
      })

      if (error || data?.error) {
        console.error('Failed to submit contact form', error ?? data?.error)
        setStatus("error")
        setServerError(data?.message ?? error?.message ?? t('contactUs.form.errorDescription'))
        return
      }

      setStatus("success")
      setFormData({
        name: "",
        email: "",
        message: "",
      })
      setFormErrors({})
    } catch (err) {
      console.error('Unexpected error submitting contact form', err)
      setStatus("error")
      setServerError(t('contactUs.form.errorDescription'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid =
    formData.name.trim().length > 0 &&
    EMAIL_PATTERN.test(formData.email.trim()) &&
    formData.message.trim().length >= 10 &&
    formData.message.trim().length <= 4000

  const buttonLabel = isSubmitting
    ? t('contactUs.form.submitting')
    : t('contactUs.form.submit')

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <MessageCircle className="h-6 w-6" />
          {t('contactUs.title')}
        </h1>
        <p className="text-sm opacity-70 mt-2">{t('contactUs.description')}</p>
      </div>

      {/* Main Contact Card */}
      <Card className="rounded-3xl mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
              <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle>{t('contactUs.supportEmail')}</CardTitle>
              <CardDescription className="mt-1">
                {t('contactUs.supportEmailDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#252526] border border-stone-200 dark:border-[#3e3e42]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm opacity-70 mb-1">{t('contactUs.emailLabel')}</p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-lg font-medium text-emerald-600 dark:text-emerald-400 hover:underline break-all"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEmailClick}
                  className="rounded-2xl"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t('contactUs.sendEmail')}
                </Button>
                <Button
                  onClick={handleEmailCopy}
                  variant="outline"
                  className="rounded-2xl"
                >
                  {t('contactUs.copyEmail')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl mb-6">
        <CardHeader>
          <div className="space-y-2">
            <CardTitle>{t('contactUs.form.title')}</CardTitle>
            <CardDescription>
              {t('contactUs.form.description')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {status === "success" && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  {t('contactUs.form.successTitle')}
                </p>
                <p className="text-emerald-700 dark:text-emerald-300/80">
                  {t('contactUs.form.successDescription')}
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm dark:bg-destructive/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {t('contactUs.form.errorTitle')}
                </p>
                <p className="text-destructive/80">{serverError ?? t('contactUs.form.errorDescription')}</p>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">{t('contactUs.form.nameLabel')}</Label>
              <Input
                id="contact-name"
                name="name"
                autoComplete="name"
                placeholder={t('contactUs.form.namePlaceholder')}
                value={formData.name}
                onChange={handleFieldChange("name")}
                maxLength={120}
                required
                className="rounded-2xl"
              />
              {formErrors.name ? (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-email">{t('contactUs.form.emailLabel')}</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t('contactUs.form.emailPlaceholder')}
                value={formData.email}
                onChange={handleFieldChange("email")}
                maxLength={254}
                required
                className="rounded-2xl"
              />
              {formErrors.email ? (
                <p className="text-sm text-destructive">{formErrors.email}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-message">{t('contactUs.form.messageLabel')}</Label>
              <Textarea
                id="contact-message"
                name="message"
                placeholder={t('contactUs.form.messagePlaceholder')}
                value={formData.message}
                onChange={handleFieldChange("message")}
                rows={6}
                maxLength={4000}
                required
                className="rounded-2xl"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {formErrors.message ? (
                  <p className="text-destructive">{formErrors.message}</p>
                ) : (
                  <span>{t('contactUs.form.messageHelper')}</span>
                )}
                <span>{formData.message.length}/4000</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="rounded-2xl"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {buttonLabel}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 opacity-60" />
              <CardTitle className="text-lg">{t('contactUs.responseTime.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-70">
              {t('contactUs.responseTime.description')}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 opacity-60" />
              <CardTitle className="text-lg">{t('contactUs.helpfulInfo.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-70">
              {t('contactUs.helpfulInfo.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

