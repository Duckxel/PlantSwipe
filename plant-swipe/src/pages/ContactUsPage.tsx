import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Mail,
  MessageCircle,
  Clock,
  HelpCircle,
  Copy as CopyIcon,
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

const SUPPORT_EMAIL = "support@aphylia.app";

type ContactUsSectionCopy = {
  title?: string;
  description?: string;
};

export default function ContactUsPage() {
  const { t, ready } = useTranslation("common", { keyPrefix: "contactUs" });
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

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
      resetForm();
    }
  };

  const handleEmailClick = () => {
    setFormOpen(true);
  };

  const handleEmailCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      // You could add a toast notification here if needed
    } catch (err) {
      console.error("Failed to copy email:", err);
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
  const formCancelLabel = t("form.cancelButton", { defaultValue: "Cancel" });
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

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <MessageCircle className="h-6 w-6" />
          {title}
        </h1>
        <p className="text-sm opacity-70 mt-2">{description}</p>
      </div>

      {/* Main Contact Card */}
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
                  className="rounded-2xl"
                >
                  <CopyIcon className="h-4 w-4 mr-2" />
                  {copyEmailLabel}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
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
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();

              const name = formValues.name.trim();
              const email = formValues.email.trim();
              const subject = formValues.subject.trim();
              const message = formValues.message.trim();

              const mailSubject =
                subject || `Support request from ${name || "Plant Swipe user"}`;
              const bodyLines = [
                `Name: ${name || "N/A"}`,
                `Email: ${email || "N/A"}`,
                "",
                message || "No additional message provided.",
              ];

              const params = new URLSearchParams({
                subject: mailSubject,
                body: bodyLines.join("\n"),
              });

              handleDialogOpenChange(false);
              window.location.href = `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
            }}
          >
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
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => handleDialogOpenChange(false)}
              >
                {formCancelLabel}
              </Button>
              <Button type="submit" className="rounded-2xl">
                {formSubmitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
