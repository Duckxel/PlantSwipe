import { useMemo } from "react"
import DOMPurify from "dompurify"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import privacyHtml from "@/content/privacy-policy.html?raw"

export default function PrivacyPage() {
  const { t } = useTranslation("common")
  const currentYear = new Date().getFullYear()
  const seoTitle = t("seo.privacy.title", { defaultValue: "Aphylia Privacy Policy & GDPR Rights" })
  const seoDescription = t("seo.privacy.description", {
    defaultValue: "Learn how Aphylia protects your personal data and your GDPR rights including data access, export, and deletion.",
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })

  const lastUpdated = "January 31, 2026"

  const sanitizedPrivacyHtml = useMemo(() => {
    const withoutEditorArtifacts = privacyHtml.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/?bdt[^>]*>/gi, "")

    return DOMPurify.sanitize(withoutEditorArtifacts, {
      USE_PROFILES: { html: true },
      FORBID_ATTR: ["style"],
      FORBID_TAGS: ["style"],
    })
  }, [privacyHtml])

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-20 space-y-10">
      <section className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] p-8 md:p-12 space-y-4 shadow-sm shadow-emerald-500/5">
        <Badge className="rounded-2xl px-4 py-1 w-fit bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          {t("privacyPage.hero.eyebrow", { defaultValue: "Your data, your rights" })}
        </Badge>
        <h1 className="text-3xl font-semibold">
          {t("privacyPage.hero.title", { defaultValue: "Aphylia Privacy Policy" })}
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-300 max-w-2xl">
          {t("privacyPage.hero.subtitle", {
            defaultValue: "Learn how we collect, use, and protect your personal data. Your privacy is important to us and we are committed to GDPR compliance.",
          })}
        </p>
        <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {t("privacyPage.hero.updated", { defaultValue: "Last updated" })}: {lastUpdated || currentYear}
        </p>
      </section>

      <section className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] p-6 md:p-10 shadow-sm shadow-emerald-500/5">
        <div
          className="legal-content"
          dangerouslySetInnerHTML={{ __html: sanitizedPrivacyHtml }}
          aria-label={t("privacyPage.legalContent.label", { defaultValue: "Full Privacy Policy" })}
        />
      </section>

      <section className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] px-8 py-6 bg-stone-50/70 dark:bg-[#1f1f1f] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{t("privacyPage.contact.title", { defaultValue: "Questions about your data?" })}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-xl">
            {t("privacyPage.contact.subtitle", { defaultValue: "Contact us via the Contact page if you have any questions about how we handle your data or to exercise your GDPR rights." })}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-2xl">
          {t("privacyPage.contact.badge", { defaultValue: "GDPR Compliant" })}
        </Badge>
      </section>
    </div>
  )
}
