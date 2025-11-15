import { ShieldCheck, Scale, Repeat, Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const sections = [
  {
    icon: ShieldCheck,
    title: "Your access & responsibilities",
    description: "Aphylia is currently an internal tool. Keep your credentials private, avoid sharing screenshots outside approved channels, and report incidents immediately."
  },
  {
    icon: Scale,
    title: "Acceptable use",
    description: "Do not reverse engineer, scrape, or automate Aphylia without written permission. Respect other testers by avoiding spammy actions, fake data floods, or attempts to bypass role-based limits."
  },
  {
    icon: Repeat,
    title: "Updates & downtime",
    description: "We redeploy frequently. Features may appear unfinished or change without notice. By using the app you agree to refresh when prompted and provide feedback when something looks off."
  },
  {
    icon: Info,
    title: "Support & questions",
    description: "Need clarification? Reach the core team via the Contact page or your dedicated Slack channel. We will keep this document updated as we inch closer to public release."
  }
] as const

export default function TermsPage() {
  const { t } = useTranslation("common")
  const currentYear = new Date().getFullYear()

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-20 space-y-10">
      <section className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] p-8 md:p-12 space-y-4 shadow-sm shadow-emerald-500/5">
        <Badge className="rounded-2xl px-4 py-1 w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {t("termsPage.hero.eyebrow", { defaultValue: "Internal policies" })}
        </Badge>
          <h1 className="text-3xl font-semibold">
            {t("termsPage.hero.title", { defaultValue: "Aphylia Terms of Services" })}
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-300 max-w-2xl">
          {t("termsPage.hero.subtitle", { defaultValue: "This summary is intentionally lightweight while we iterate quickly. By using our internal environments you agree to the guidelines below. We will share the full legal document before the public launch." })}
        </p>
        <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {t("termsPage.hero.updated", { defaultValue: "Last updated" })}: {currentYear}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">
          {t("termsPage.sections.title", { defaultValue: "Key points" })}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="rounded-3xl border-stone-200/70 dark:border-[#3e3e42]/70 h-full">
              <CardHeader className="flex flex-row items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="text-sm text-stone-600 dark:text-stone-400">
                    {description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
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
