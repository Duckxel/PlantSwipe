import { useState, useRef, useEffect } from "react"
import type { FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Clock, HelpCircle, Mail, MessageCircle, Check, Copy, UploadCloud, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabaseClient"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"

const CHANNEL_EMAILS = {
  support: "support@aphylia.app",
  business: "contact@aphylia.app",
  bug: "dev@aphylia.app",
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
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
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

  // Bug reporting specific state
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    setSelectedChannel(defaultChannel)
  }, [defaultChannel])

  // Cleanup screenshot if user cancels or closes dialog
  const handleCleanupScreenshot = async () => {
    if (screenshotUrl && !formStatus.startsWith('success')) {
      try {
        await fetch('/api/contact/delete-screenshot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': (await supabase.auth.getSession()).data.session?.access_token ? `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` : ''
          },
          body: JSON.stringify({ url: screenshotUrl })
        })
      } catch (e) {
        console.error('Failed to cleanup screenshot', e)
      }
      setScreenshotUrl(null)
    }
  }

  const channelOptions: Record<ContactChannel, { label: string; description: string; authRequired?: boolean }> = {
    support: {
      label: t('contactUs.channelSelector.options.support.name'),
      description: t('contactUs.channelSelector.options.support.description'),
    },
    business: {
      label: t('contactUs.channelSelector.options.business.name'),
      description: t('contactUs.channelSelector.options.business.description'),
    },
    bug: {
      label: t('contactUs.channelSelector.options.bug.name'),
      description: t('contactUs.channelSelector.options.bug.description'),
      authRequired: true,
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

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      handleCleanupScreenshot()
      setFormStatus("idle")
      setFormErrorMessage(null)
      setFormValues({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    } else {
      // Prefill with user data if logged in
      if (user && profile) {
        setFormValues({
          name: profile.display_name || "",
          email: user.email || "",
          subject: "",
          message: "",
        })
      }
    }
    setFormOpen(open)
  }

  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFormErrorMessage("Image too large. Max 5MB.")
      return
    }

    setIsUploading(true)
    setFormErrorMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const session = (await supabase.auth.getSession()).data.session
      const res = await fetch('/api/contact/upload-screenshot', {
        method: 'POST',
        headers: {
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
        },
        body: formData
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      // If there was an existing screenshot, delete it
      if (screenshotUrl) {
         try {
           await fetch('/api/contact/delete-screenshot', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
              },
              body: JSON.stringify({ url: screenshotUrl })
           })
         } catch(_e) {
           // ignore delete error
         }
      }

      setScreenshotUrl(data.url)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error('Screenshot upload failed', e)
      setFormErrorMessage(e.message || "Screenshot upload failed")
    } finally {
      setIsUploading(false)
      // Reset input
      event.target.value = ''
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
        // Build user info if logged in
        const userInfo = user && profile ? {
          userId: user.id,
          username: profile.username || undefined,
          displayName: profile.display_name || undefined,
          roles: profile.roles || undefined,
          country: profile.country || undefined,
          timezone: profile.timezone || undefined,
          language: profile.language || undefined,
          experienceYears: profile.experience_years || undefined,
        } : undefined

        const { data, error } = await supabase.functions.invoke(SUPPORT_FUNCTION, {
          body: {
            ...trimmedData,
            submittedAt: new Date().toISOString(),
            audience: selectedChannel,
            screenshotUrl: screenshotUrl || undefined,
            userInfo,
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
      // Clear screenshot state without deleting from server (since it's now submitted)
      setScreenshotUrl(null)
    } catch (err) {
      console.error('Unexpected error submitting contact form', err)
      setFormStatus("error")
      setFormErrorMessage(t('contactUs.form.errorMessage'))
    }
  }

  const inputsDisabled = formStatus === "loading" || formStatus === "success" || isUploading
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
                    <Button
                      variant="outline"
                      id="contact-channel"
                      className="w-full justify-between rounded-2xl border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30]"
                    >
                      {currentChannelLabel}
                      <span className="opacity-50 text-[10px]">▼</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[240px] rounded-2xl">
                    {CHANNEL_ORDER.map((key) => {
                      const option = channelOptions[key]
                      const isDisabled = option.authRequired && !user
                      return (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => setSelectedChannel(key)}
                          disabled={isDisabled}
                          className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                        >
                          <span className="font-medium">
                            {option.label}
                            {isDisabled && " (Login required)"}
                          </span>
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

        {/* Discord Community Card */}
        <Card className={glassCard}>
          <CardContent className="flex flex-col sm:flex-row items-center gap-5 p-6">
            <div className="shrink-0 p-3.5 rounded-2xl bg-[#5865F2]/10 dark:bg-[#5865F2]/15">
              <svg className="h-7 w-7 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h3 className="font-semibold text-lg">
                {t('contactUs.discord.title', { defaultValue: 'Join our Discord community' })}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {t('contactUs.discord.description', { defaultValue: 'Chat with us and other plant lovers, get quick answers, and stay up to date.' })}
              </p>
            </div>
            <Button
              asChild
              className="shrink-0 rounded-2xl gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white"
            >
              <a href="https://discord.gg/SRt74hDESC" target="_blank" rel="noopener noreferrer">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                {t('contactUs.discord.button', { defaultValue: 'Join Discord' })}
              </a>
            </Button>
          </CardContent>
        </Card>

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

            {/* Screenshot upload for Bug Reports */}
            {selectedChannel === 'bug' && (
              <div className="grid gap-2">
                <Label htmlFor="contact-screenshot">Screenshot (Optional)</Label>

                {screenshotUrl ? (
                   <div className="relative group w-fit">
                      <img src={screenshotUrl} alt="Screenshot" className="h-24 w-auto rounded-lg border border-stone-200" />
                      <button
                        type="button"
                        onClick={handleCleanupScreenshot}
                        aria-label={t('contactUs.form.removeScreenshot')}
                        title={t('contactUs.form.removeScreenshot')}
                        className="absolute -top-2 -right-2 bg-stone-100 hover:bg-red-100 text-stone-500 hover:text-red-500 rounded-full p-1 border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                         <X className="h-3 w-3" />
                      </button>
                   </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-2xl gap-2"
                      onClick={() => document.getElementById('contact-screenshot')?.click()}
                      disabled={inputsDisabled}
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {isUploading ? "Uploading..." : "Upload Screenshot"}
                    </Button>
                    <Input
                      id="contact-screenshot"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotUpload}
                      disabled={inputsDisabled}
                    />
                    <span className="text-xs text-stone-500">Max 5MB (JPG, PNG, WebP)</span>
                  </div>
                )}
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
                {formStatus === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('contactUs.form.submitSending')}
                  </>
                ) : (
                  t('contactUs.form.submitButton')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
