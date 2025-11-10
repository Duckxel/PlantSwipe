import { useState, useRef } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2, Mail, MessageCircle, Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabaseClient"

const SUPPORT_EMAIL = "support@aphylia.app"
const SUPPORT_FUNCTION = "contact-support"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldKey = "name" | "email" | "message"
type FormStatus = "idle" | "success" | "error" | "loading"

type FormState = Record<FieldKey, string>
type FormErrors = Partial<Record<FieldKey, string>>

type DialogFormState = {
  name: string
  email: string
  subject: string
  message: string
}

type CopyState = "idle" | "copied"

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
  const [formOpen, setFormOpen] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const copyResetRef = useRef<number | null>(null)
  const [formValues, setFormValues] = useState<DialogFormState>({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [formStatus, setFormStatus] = useState<FormStatus>("idle")
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  const handleEmailClick = () => {
    setFormOpen(true);
  };

  const handleEmailCopy = async () => {
    const fallbackCopy = () => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = SUPPORT_EMAIL;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);

        const selection = window.getSelection();
        const selectedRange =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0)
            : null;

        let successful = false;
        try {
          textarea.focus();
          textarea.select();
          successful = document.execCommand("copy");
        } catch {
          successful = false;
        } finally {
          document.body.removeChild(textarea);
          if (selectedRange && selection) {
            selection.removeAllRanges();
            selection.addRange(selectedRange);
          }
        }

        return successful;
      } catch {
        return false;
      }
    };

    let copied = false;
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      copied = true;
    } catch (err) {
      console.error('Failed to copy email:', err)
      copied = fallbackCopy();
    }

    if (copied) {
      setCopyState("copied");
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => {
        setCopyState("idle");
        copyResetRef.current = null;
      }, 1600);
    } else {
      console.error("Failed to copy email address");
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) {
      setFormStatus("idle")
      setFormErrorMessage(null)
      setFormValues({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    }
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormStatus("loading")
    setFormErrorMessage(null)

    const trimmedData = {
      name: formValues.name.trim(),
      email: formValues.email.trim(),
      subject: formValues.subject.trim(),
      message: formValues.message.trim(),
    }

    if (!trimmedData.name || !trimmedData.email || !trimmedData.subject || !trimmedData.message) {
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke(SUPPORT_FUNCTION, {
        body: {
          ...trimmedData,
          submittedAt: new Date().toISOString(),
        },
      })

      if (error || data?.error) {
        console.error('Failed to submit contact form', error ?? data?.error)
        setFormStatus("error")
        setFormErrorMessage(data?.message ?? error?.message ?? t('contactUs.form.errorMessage'))
        return
      }

      setFormStatus("success")
      setFormValues({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    } catch (err) {
      console.error('Unexpected error submitting contact form', err)
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
    }
  }

  const inputsDisabled = formStatus === "loading" || formStatus === "success"

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
                <p
                  className="text-lg font-medium text-emerald-600 dark:text-emerald-400 break-all select-all cursor-text"
                  aria-label={SUPPORT_EMAIL}
                >
                  {SUPPORT_EMAIL}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEmailClick} className="rounded-2xl">
                  <Mail className="h-4 w-4 mr-2" />
                  {t('contactUs.sendEmail')}
                </Button>
                <Button
                  onClick={handleEmailCopy}
                  variant="outline"
                  className={`relative overflow-hidden rounded-2xl border transition ${
                    copyState === "copied"
                      ? "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-600"
                      : ""
                  }`}
                >
                  {copyState === "copied" && (
                    <motion.span
                      className="absolute inset-0 rounded-2xl bg-emerald-500/30"
                      initial={{ scale: 0.2, opacity: 0.8 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  )}
                  <motion.span
                    className="relative inline-flex items-center gap-2"
                    animate={
                      copyState === "copied"
                        ? { scale: [1, 1.08, 1], rotate: [0, -1.5, 0] }
                        : { scale: 1, rotate: 0 }
                    }
                    transition={{ duration: 0.4 }}
                  >
                    {copyState === "copied" ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{t('contactUs.copySuccess')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>{t('contactUs.copyEmail')}</span>
                      </>
                    )}
                  </motion.span>
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
            <p className="text-sm opacity-70">{t('contactUs.responseTime.description')}</p>
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
            <p className="text-sm opacity-70">{t('contactUs.helpfulInfo.description')}</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('contactUs.form.title')}</DialogTitle>
            <DialogDescription>{t('contactUs.form.description')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            {formStatus === "success" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-700">
                <p className="font-medium">{t('contactUs.form.successTitle')}</p>
                <p className="mt-1 text-emerald-600">
                  {t('contactUs.form.successDescription')}
                </p>
              </div>
            )}
            {formStatus === "error" && formErrorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                {formErrorMessage}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="contact-name">{t('contactUs.form.nameLabel')}</Label>
              <Input
                id="contact-name"
                name="name"
                placeholder={t('contactUs.form.namePlaceholder')}
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((prev: DialogFormState) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">{t('contactUs.form.emailLabel')}</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                required
                placeholder={t('contactUs.form.emailPlaceholder')}
                value={formValues.email}
                onChange={(event) =>
                  setFormValues((prev: DialogFormState) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-subject">{t('contactUs.form.subjectLabel')}</Label>
              <Input
                id="contact-subject"
                name="subject"
                required
                placeholder={t('contactUs.form.subjectPlaceholder')}
                value={formValues.subject}
                onChange={(event) =>
                  setFormValues((prev: DialogFormState) => ({
                    ...prev,
                    subject: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-message">{t('contactUs.form.messageLabel')}</Label>
              <Textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                placeholder={t('contactUs.form.messagePlaceholder')}
                value={formValues.message}
                onChange={(event) =>
                  setFormValues((prev: DialogFormState) => ({
                    ...prev,
                    message: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => handleDialogOpenChange(false)}
                disabled={formStatus === "loading"}
              >
                {t('contactUs.form.cancelButton')}
              </Button>
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={formStatus === "loading" || formStatus === "success"}
              >
                {formStatus === "loading"
                  ? t('contactUs.form.submitSending')
                  : t('contactUs.form.submitButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

