import { useMemo } from "react"
import DOMPurify from "dompurify"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import termsHtml from "@/content/terms-of-service.html?raw"
import termsVersion from "@/content/terms-version.json"

export default function TermsPage() {
  const { t, i18n } = useTranslation("common")
  const currentYear = new Date().getFullYear()
  const seoTitle = t("seo.terms.title", { defaultValue: "Aphylia Terms of Service & GDPR notice" })
  const seoDescription = t("seo.terms.description", {
    defaultValue: "Read the full Aphylia Terms of Service, GDPR commitments, and legal disclosures in one place.",
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })

  // Get version and format date from JSON
  const version = termsVersion.version
  const lastUpdated = useMemo(() => {
    const date = new Date(termsVersion.lastUpdated)
    return date.toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [i18n.language])

  const sanitizedTermsHtml = useMemo(() => {
    const withoutEditorArtifacts = termsHtml.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/?bdt[^>]*>/gi, "")

    return DOMPurify.sanitize(withoutEditorArtifacts, {
      USE_PROFILES: { html: true },
      FORBID_ATTR: ["style"],
      FORBID_TAGS: ["style"],
    })
  }, [])

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-20 space-y-10">
      <section className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] p-8 md:p-12 space-y-4 shadow-sm shadow-emerald-500/5">
        <Badge className="rounded-2xl px-4 py-1 w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {t("termsPage.hero.eyebrow", { defaultValue: "Official legal terms" })}
        </Badge>
        <h1 className="text-3xl font-semibold">
          {t("termsPage.hero.title", { defaultValue: "Aphylia Terms of Service" })}
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-300 max-w-2xl">
          {t("termsPage.hero.subtitle", {
            defaultValue: "Review the official Aphylia Terms of Service and GDPR disclosures. These terms apply to every internal and external environment.",
          })}
        </p>
        <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {t("termsPage.hero.updated", { defaultValue: "Last updated" })}: {lastUpdated || currentYear} · {t("termsPage.hero.version", { defaultValue: "Version" })} {version}
        </p>
      </section>

      <section className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] p-6 md:p-10 shadow-sm shadow-emerald-500/5">
        <div
          className="legal-content"
          dangerouslySetInnerHTML={{ __html: sanitizedTermsHtml }}
          aria-label={t("termsPage.legalContent.label", { defaultValue: "Full Terms of Service" })}
        />
      </section>

      <section className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] px-8 py-6 bg-stone-50/70 dark:bg-[#1f1f1f] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{t("termsPage.contact.title", { defaultValue: "Questions about these terms?" })}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-xl">
            {t("termsPage.contact.subtitle", { defaultValue: "Ping the team via the Contact page or your internal channel. We can clarify permitted uses, access levels, and rollout timelines." })}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-2xl">
          {t("termsPage.contact.badge", { defaultValue: "We reply fast" })}
        </Badge>
      </section>
    </div>
  )
}
