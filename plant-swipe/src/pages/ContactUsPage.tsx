import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Mail,
  MessageCircle,
  Clock,
  HelpCircle,
  Copy as CopyIcon,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";

const SUPPORT_EMAIL = "support@aphylia.app";

type ContactUsSectionCopy = {
  title?: string;
  description?: string;
};

type ContactFormStatus = "idle" | "loading" | "success" | "error";
type CopyState = "idle" | "copied";

export default function ContactUsPage() {
  const { t, ready } = useTranslation("common", { keyPrefix: "contactUs" });
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [formStatus, setFormStatus] = useState<ContactFormStatus>("idle");
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copyResetRef = useRef<number | null>(null);
  const formCloseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
      if (formCloseTimeoutRef.current)
        window.clearTimeout(formCloseTimeoutRef.current);
    };
  }, []);

  const resetForm = () => {
    setFormValues({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  const handleDialogOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
      if (formCloseTimeoutRef.current) {
        window.clearTimeout(formCloseTimeoutRef.current);
        formCloseTimeoutRef.current = null;
      }
      resetForm();
      setFormStatus("idle");
      setFormErrorMessage(null);
    } else {
      setFormStatus("idle");
      setFormErrorMessage(null);
    }
  };

  const handleEmailClick = () => {
    setFormOpen(true);
  };

  const handleEmailCopy = async () => {
    const email = SUPPORT_EMAIL;

    const fallbackCopy = () => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = email;
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
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
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

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0 space-y-6 animate-pulse">
        <div className="space-y-3">
          <div className="h-9 w-2/3 rounded-xl bg-stone-200 dark:bg-[#252526]" />
          <div className="h-4 w-3/4 rounded-xl bg-stone-200 dark:bg-[#252526]" />
        </div>
        <div className="h-48 rounded-3xl bg-stone-200 dark:bg-[#252526]" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-40 rounded-3xl bg-stone-200 dark:bg-[#252526]" />
          <div className="h-40 rounded-3xl bg-stone-200 dark:bg-[#252526]" />
        </div>
      </div>
    );
  }

  const title = t("title", { defaultValue: "Contact Us" });
  const description = t("description", {
    defaultValue: "We're here to help! Get in touch with our support team.",
  });
  const copySuccessLabel = t("copySuccess", { defaultValue: "Copied!" });
  const formTitle = t("form.title", { defaultValue: "Send a message" });
  const formDescription = t("form.description", {
    defaultValue: "Fill out the form and we'll reach out soon.",
  });
  const formNameLabel = t("form.nameLabel", { defaultValue: "Your name" });
  const formNamePlaceholder = t("form.namePlaceholder", {
    defaultValue: "Jane Doe",
  });
  const formEmailLabel = t("form.emailLabel", { defaultValue: "Your email" });
  const formEmailPlaceholder = t("form.emailPlaceholder", {
    defaultValue: "you@example.com",
  });
  const formSubjectLabel = t("form.subjectLabel", { defaultValue: "Subject" });
  const formSubjectPlaceholder = t("form.subjectPlaceholder", {
    defaultValue: "How can we help?",
  });
  const formMessageLabel = t("form.messageLabel", { defaultValue: "Message" });
  const formMessagePlaceholder = t("form.messagePlaceholder", {
    defaultValue: "Tell us a bit more about what you need...",
  });
  const formSubmitLabel = t("form.submitButton", {
    defaultValue: "Send message",
  });
  const formSubmitSendingLabel = t("form.submitSending", {
    defaultValue: "Sending...",
  });
  const formCancelLabel = t("form.cancelButton", { defaultValue: "Cancel" });
  const formSuccessTitle = t("form.successTitle", {
    defaultValue: "Message sent",
  });
  const formSuccessDescription = t("form.successDescription", {
    defaultValue: "Thanks for your message! We'll reach out soon.",
  });
  const formErrorFallback = t("form.errorMessage", {
    defaultValue:
      "We couldn't send your message. Please try again in a moment.",
  });
  const formRateLimitedMessage = t("form.rateLimitedMessage", {
    defaultValue: "Please wait a little before sending another message.",
  });

  const supportEmailTitle = t("supportEmail", {
    defaultValue: "Support Email",
  });
  const supportEmailDescription = t("supportEmailDescription", {
    defaultValue:
      "Send us an email and we'll get back to you as soon as possible.",
  });
  const emailLabel = t("emailLabel", { defaultValue: "Email Address" });
  const sendEmailLabel = t("sendEmail", { defaultValue: "Send Email" });
  const copyEmailLabel = t("copyEmail", { defaultValue: "Copy" });

  const responseTime = t("responseTime", {
    returnObjects: true,
  }) as ContactUsSectionCopy;
  const helpfulInfo = t("helpfulInfo", {
    returnObjects: true,
  }) as ContactUsSectionCopy;

  const responseTimeTitle = responseTime?.title ?? "Response Time";
  const responseTimeDescription =
    responseTime?.description ??
    "We typically respond within 24-48 hours during business days.";
  const helpfulInfoTitle = helpfulInfo?.title ?? "Helpful Information";
  const helpfulInfoDescription =
    helpfulInfo?.description ??
    "Please include details about your question or issue to help us assist you better.";

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formStatus === "loading") return;

    setFormStatus("loading");
    setFormErrorMessage(null);

    let closeTimer: number | null = null;

    try {
      const payload = {
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        subject: formValues.subject.trim(),
        message: formValues.message.trim(),
      };

      if (!payload.email || !payload.message) {
        setFormStatus("error");
        setFormErrorMessage(formErrorFallback);
        return;
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let body: any = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        const message =
          response.status === 429
            ? formRateLimitedMessage
            : typeof body?.error === "string" && body.error.trim().length > 0
              ? body.error
              : formErrorFallback;

        throw new Error(message);
      }

      const result = await response.json().catch(() => ({}));
      if (!result?.ok) {
        throw new Error(formErrorFallback);
      }

      setFormStatus("success");
      setFormErrorMessage(null);
      if (formCloseTimeoutRef.current) {
        window.clearTimeout(formCloseTimeoutRef.current);
        formCloseTimeoutRef.current = null;
      }
      closeTimer = window.setTimeout(() => {
        handleDialogOpenChange(false);
      }, 1500);
      formCloseTimeoutRef.current = closeTimer;
    } catch (error) {
      if (closeTimer) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
      const message =
        (error as Error)?.message &&
        (error as Error).message !== "Failed to send message"
          ? (error as Error).message
          : formErrorFallback;
      setFormErrorMessage(message);
      setFormStatus("error");
    }
  };

  const inputsDisabled = formStatus === "loading" || formStatus === "success";

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <MessageCircle className="h-6 w-6" />
          {title}
        </h1>
        <p className="text-sm opacity-70 mt-2">{description}</p>
      </div>

      <Card className="rounded-3xl mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
              <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle>{supportEmailTitle}</CardTitle>
              <CardDescription className="mt-1">
                {supportEmailDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#252526] border border-stone-200 dark:border-[#3e3e42]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm opacity-70 mb-1">{emailLabel}</p>
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
                  {sendEmailLabel}
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
                        <span>{copySuccessLabel}</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="h-4 w-4" />
                        <span>{copyEmailLabel}</span>
                      </>
                    )}
                  </motion.span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 opacity-60" />
              <CardTitle className="text-lg">{responseTimeTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-70">{responseTimeDescription}</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 opacity-60" />
              <CardTitle className="text-lg">{helpfulInfoTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-70">{helpfulInfoDescription}</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{formDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            {formStatus === "success" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-700">
                <p className="font-medium">{formSuccessTitle}</p>
                <p className="mt-1 text-emerald-600">
                  {formSuccessDescription}
                </p>
              </div>
            )}
            {formStatus === "error" && formErrorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                {formErrorMessage}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="contact-name">{formNameLabel}</Label>
              <Input
                id="contact-name"
                name="name"
                placeholder={formNamePlaceholder}
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">{formEmailLabel}</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                required
                placeholder={formEmailPlaceholder}
                value={formValues.email}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-subject">{formSubjectLabel}</Label>
              <Input
                id="contact-subject"
                name="subject"
                required
                placeholder={formSubjectPlaceholder}
                value={formValues.subject}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    subject: event.target.value,
                  }))
                }
                disabled={inputsDisabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-message">{formMessageLabel}</Label>
              <Textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                placeholder={formMessagePlaceholder}
                value={formValues.message}
                onChange={(event) =>
                  setFormValues((prev) => ({
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
                {formCancelLabel}
              </Button>
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={formStatus === "loading" || formStatus === "success"}
              >
                {formStatus === "loading"
                  ? formSubmitSendingLabel
                  : formSubmitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
