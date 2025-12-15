import { useState, useRef, useEffect } from "react"
import type { FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Clock, HelpCircle, Mail, MessageCircle, Check, Copy, UploadCloud, X, Loader2, Image, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabaseClient"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"

const CHANNEL_EMAILS = {
  support: "support@aphylia.app",
  business: "contact@aphylia.app",
  bug: "support@aphylia.app",
} as const
const SUPPORT_FUNCTION = "contact-support"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FormStatus = "idle" | "success" | "error" | "loading"

type DialogFormState = {
  name: string
  email: string
  subject: string
  message: string
}

type CopyState = "idle" | "copied"
type ContactChannel = keyof typeof CHANNEL_EMAILS
const CHANNEL_ORDER: ContactChannel[] = ["support", "business", "bug"]

type ContactUsPageProps = {
  defaultChannel?: ContactChannel
}

export default function ContactUsPage({ defaultChannel = "support" }: ContactUsPageProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // If requesting bug report but not logged in, redirect to login via home or just fallback to support
  useEffect(() => {
    if (defaultChannel === "bug" && !user) {
      // For now, silently fallback to support if not logged in, user can login elsewhere
      setSelectedChannel("support")
    }
  }, [defaultChannel, user])

  const { t } = useTranslation('common')
  const seoKey = defaultChannel === "business" ? "contactBusiness" : "contactSupport"
  const seoTitle = t(`seo.${seoKey}.title`, {
    defaultValue: defaultChannel === "business" ? "Contact Aphylia business team" : "Contact Aphylia support",
  })
  const seoDescription = t(`seo.${seoKey}.description`, {
    defaultValue:
      defaultChannel === "business"
        ? "Start partnership, press, or enterprise deployment conversations with the core team."
        : "Reach the team for product questions, onboarding help, or to report an issue.",
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })
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
  const [selectedChannel, setSelectedChannel] = useState<ContactChannel>(defaultChannel)

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (defaultChannel === "bug" && !user) {
        setSelectedChannel("support")
    } else {
        setSelectedChannel(defaultChannel)
    }
  }, [defaultChannel, user])

  // Cleanup screenshot if form closed or cancelled
  useEffect(() => {
    if (!formOpen && screenshotUrl) {
      // Best effort cleanup
      const cleanup = async () => {
        try {
          const session = (await supabase.auth.getSession()).data.session
          if (!session) return
          await fetch('/api/contact/upload-screenshot', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: screenshotUrl.split('/').pop() ? `BugReport/${screenshotUrl.split('/').pop()}` : '' })
          })
        } catch {}
      }
      cleanup()
      setScreenshotUrl(null)
    }
  }, [formOpen])

    const channelOptions = {
    support: {
      label: t('contactUs.channelSelector.options.support.name'),
      description: t('contactUs.channelSelector.options.support.description'),
    },
    business: {
      label: t('contactUs.channelSelector.options.business.name'),
      description: t('contactUs.channelSelector.options.business.description'),
    },
    bug: {
      label: t('contactUs.channelSelector.options.bug.name', { defaultValue: "Bug Report" }),
      description: t('contactUs.channelSelector.options.bug.description', { defaultValue: "Report a technical issue or bug." }),
    },
  }

  const currentChannelLabel = channelOptions[selectedChannel]?.label ?? channelOptions.support.label
  const currentChannelDescription = channelOptions[selectedChannel]?.description ?? channelOptions.support.description
    const currentEmail = CHANNEL_EMAILS[selectedChannel]
  const recipientCardTitle = t('contactUs.recipientCardTitle', { defaultValue: t('contactUs.supportEmail') })
  const recipientCardDescription = t('contactUs.recipientCardDescription', { defaultValue: t('contactUs.supportEmailDescription') })
    const heroHeading = t('contactUs.heroHeading', { defaultValue: t('contactUs.title') })

  const handleEmailClick = () => {
    setFormOpen(true);
  };

  const handleEmailCopy = async () => {
    const emailToCopy = currentEmail
    const fallbackCopy = () => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = emailToCopy;
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
        await navigator.clipboard.writeText(emailToCopy)
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

  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingScreenshot(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session) throw new Error("Not authenticated")

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/contact/upload-screenshot', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const data = await response.json()
      if (data.url) {
        setScreenshotUrl(data.url)
      }
    } catch (err) {
      console.error("Screenshot upload failed", err)
      // Optionally show error toast
    } finally {
      setUploadingScreenshot(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveScreenshot = async () => {
    if (!screenshotUrl) return
    try {
        const session = (await supabase.auth.getSession()).data.session
        if (!session) return

        // Extract path from URL roughly or pass URL if endpoint handles it
        // The endpoint expects { path: ... } relative to bucket or full if handled logic
        // But our endpoint logic uses path.basename(objectPath) in response... wait, the endpoint returns `path` in response.
        // But we only stored URL. Let's assume we can derive or just fire-and-forget delete on submit success/cancel.
        // For explicit remove button, we try to call delete.
        // Construct path: "BugReport/<filename>"
        const filename = screenshotUrl.split('/').pop()
        if (filename) {
            await fetch('/api/contact/upload-screenshot', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: `BugReport/${filename}` })
            })
        }
    } catch (e) {
        console.warn("Failed to delete screenshot", e)
    }
    setScreenshotUrl(null)
  }

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
      // Clear screenshot state (useEffect handles deletion)
    } else {
        // If opening directly to bug channel, prepopulate subject
        if (selectedChannel === 'bug') {
            setFormValues(prev => ({ ...prev, subject: "Bug Report: " }))
        }
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

    // Validation
    if (!trimmedData.name) {
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
      return
    }
    if (trimmedData.name.length > 120) {
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
      return
    }
    if (!trimmedData.email || !EMAIL_PATTERN.test(trimmedData.email)) {
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
      return
    }
    if (!trimmedData.subject) {
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
      return
    }
    if (!trimmedData.message || trimmedData.message.length < 10 || trimmedData.message.length > 4000) {
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
      return
    }

    try {
        const { data, error } = await supabase.functions.invoke(SUPPORT_FUNCTION, {
          body: {
            ...trimmedData,
            submittedAt: new Date().toISOString(),
            audience: selectedChannel,
            screenshotUrl: screenshotUrl || undefined,
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
      setScreenshotUrl(null) // Clear so we don't delete it on close
    } catch (err) {
      console.error('Unexpected error submitting contact form', err)
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
    }
  }

  const inputsDisabled = formStatus === "loading" || formStatus === "success"
  const glassCard =
    "rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/85 dark:bg-[#1a1a1d]/85 backdrop-blur shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)]"
  const dialogSurface =
    "rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#111112]/95 backdrop-blur"

    return (
      <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
        <div className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#1b1b1f] dark:via-[#131314] dark:to-[#070708] p-6 md:p-10 shadow-[0_35px_60px_-15px_rgba(16,185,129,0.35)] flex flex-col gap-3">
          <div className="absolute -right-20 top-0 h-40 w-40 rounded-full bg-emerald-200/60 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-emerald-100/70 dark:bg-emerald-500/5 blur-3xl" aria-hidden="true" />
            <div className="flex items-center gap-3 text-sm font-medium text-emerald-700 dark:text-emerald-400 relative z-10">
            <MessageCircle className="h-5 w-5" />
            {t('contactUs.title')}
          </div>
            <div className="relative z-10 text-3xl font-semibold tracking-tight">{heroHeading}</div>
          <p className="relative z-10 text-sm text-stone-600 dark:text-stone-300 max-w-2xl">{t('contactUs.description')}</p>
        </div>

        <Card className={glassCard}>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>{recipientCardTitle}</CardTitle>
                  <CardDescription className="mt-1">
                    {recipientCardDescription}
                  </CardDescription>
                </div>
              </div>
              <div className="min-w-[220px] space-y-2 text-left md:text-right">
                <Label htmlFor="contact-channel" className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {t('contactUs.channelSelector.label')}
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between rounded-2xl border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]">
                      {currentChannelLabel}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[220px] rounded-xl">
                    {CHANNEL_ORDER.map((key) => {
                        // Skip bug option if user not logged in
                        if (key === 'bug' && !user) return null;
                        return (
                            <DropdownMenuItem
                                key={key}
                                onClick={() => {
                                    setSelectedChannel(key);
                                    if (key === 'bug') {
                                        setFormOpen(true);
                                        setFormValues(prev => ({ ...prev, subject: "Bug Report: " }));
                                    }
                                }}
                                className="cursor-pointer rounded-lg"
                            >
                                {channelOptions[key]?.label}
                            </DropdownMenuItem>
                        )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {currentChannelDescription || t('contactUs.channelSelector.helper')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#252526] border border-stone-200 dark:border-[#3e3e42]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 min-w-[220px] space-y-1">
                  <p className="text-sm opacity-70">{t('contactUs.emailLabel')}</p>
                  <p
                    className="text-lg font-medium text-emerald-600 dark:text-emerald-400 break-all select-all cursor-text"
                    aria-label={currentEmail}
                  >
                    {currentEmail}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t('contactUs.channelSelectedLabel', { channel: currentChannelLabel })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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

        {/* Additional Information */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className={glassCard}>
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

          <Card className={glassCard}>
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
          <DialogContent className={dialogSurface}>
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

            {selectedChannel === 'bug' && (
              <div className="space-y-2">
                <Label>{t('contactUs.form.screenshotLabel', { defaultValue: "Screenshot (optional)" })}</Label>
                <div className="flex flex-col gap-3">
                  {!screenshotUrl ? (
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full h-24 border-dashed border-2 rounded-2xl flex flex-col gap-2 items-center justify-center hover:bg-stone-50 dark:hover:bg-[#252526] transition-colors"
                        disabled={uploadingScreenshot || inputsDisabled}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploadingScreenshot ? (
                            <>
                                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                                <span className="text-xs text-stone-500">{t('common.uploading', { defaultValue: "Uploading..." })}</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
                                <div className="text-center">
                                    <span className="text-sm font-medium">{t('contactUs.form.uploadScreenshot', { defaultValue: "Click to upload" })}</span>
                                    <p className="text-xs text-stone-400 mt-1">PNG, JPG, WebP (max 10MB)</p>
                                </div>
                            </>
                        )}
                    </Button>
                  ) : (
                    <div className="relative rounded-2xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden group bg-stone-100 dark:bg-black/20">
                        <div className="aspect-video w-full flex items-center justify-center bg-[url('/transparent-pattern.png')]">
                            <img
                                src={screenshotUrl}
                                alt="Screenshot preview"
                                className="max-h-48 max-w-full object-contain"
                            />
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="rounded-full"
                                onClick={handleRemoveScreenshot}
                            >
                                <X className="h-4 w-4 mr-1" />
                                {t('common.remove', { defaultValue: "Remove" })}
                            </Button>
                        </div>
                        <div className="absolute top-2 right-2">
                             <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                                <Check className="h-3 w-3 inline mr-1" />
                                {t('common.uploaded', { defaultValue: "Uploaded" })}
                             </span>
                        </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleScreenshotUpload}
                  />
                </div>
              </div>
            )}

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

