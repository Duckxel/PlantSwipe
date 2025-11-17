import React from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Home, LifeBuoy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { PageHead } from "@/components/layout/PageHead"

type ErrorPageProps = {
  code?: string
}

const TIP_KEYS = ["errorPage.tips.checkUrl", "errorPage.tips.refresh", "errorPage.tips.contact"] as const

export function ErrorPage({ code: providedCode }: ErrorPageProps) {
  const params = useParams<{ code?: string }>()
  const { t, i18n } = useTranslation("common")
  const navigate = useLanguageNavigate()

  const rawCode = providedCode ?? params.code ?? "404"
  const normalizedCode = React.useMemo(() => {
    const value = `${rawCode}`.trim()
    if (!value) return "404"
    if (/^[0-9]{3}$/.test(value)) return value
    return value.toUpperCase().slice(0, 8)
  }, [rawCode])

  const translationKey = i18n.exists(`errorPage.codes.${normalizedCode}.title`) ? normalizedCode : "default"
  const title = t(`errorPage.codes.${translationKey}.title`)
  const description = t(`errorPage.codes.${translationKey}.description`)

  const tips = TIP_KEYS.map((key) => t(key))
  const canonicalPath = `/error/${encodeURIComponent(normalizedCode)}`
  const pageTitle = `${title} – ${normalizedCode}`
  const pageDescription = description

  const handleHome = () => navigate("/")
  const handleContact = () => navigate("/contact")

  return (
    <section className="flex min-h-[60vh] w-full items-center justify-center py-12">
      <PageHead title={pageTitle} description={pageDescription} path={canonicalPath} type="article" />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/50 bg-white/80 px-8 py-12 text-center shadow-2xl backdrop-blur dark:border-white/5 dark:bg-[#1f1f23]/80">
        <div className="absolute inset-x-6 top-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-200">
            {t("errorPage.codeLabel")}
            <span className="text-base tracking-normal text-emerald-900 dark:text-emerald-100">#{normalizedCode}</span>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-6 text-center">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">{title}</h1>
            <p className="text-base text-stone-600 dark:text-stone-300">{description}</p>
          </div>
          <div className="w-full rounded-2xl border border-stone-200/80 bg-white/80 p-6 text-left shadow-sm dark:border-white/5 dark:bg-[#121214]/80">
            <p className="text-sm font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
              {t("errorPage.tipsTitle")}
            </p>
            <ul className="mt-4 space-y-3 text-stone-700 dark:text-stone-200">
              {tips.map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:justify-center">
            <Button className="rounded-2xl" onClick={handleHome}>
              <Home className="mr-2 size-4" aria-hidden="true" />
              {t("errorPage.actions.home")}
            </Button>
            <Button variant="outline" className="rounded-2xl border-stone-300 dark:border-white/15" onClick={handleContact}>
              <LifeBuoy className="mr-2 size-4" aria-hidden="true" />
              {t("errorPage.actions.contact")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ErrorPage
