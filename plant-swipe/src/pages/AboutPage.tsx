import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Sparkles, Wand2, PartyPopper, CalendarClock, Users } from "lucide-react"
import { Link } from "@/components/i18n/Link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

type HighlightKey = "origin" | "impact" | "culture"
type TimelineKey = "chapterZero" | "chapterOne" | "chapterTwo"

const highlights: HighlightKey[] = ["origin", "impact", "culture"]
const timeline: TimelineKey[] = ["chapterZero", "chapterOne", "chapterTwo"]

export default function AboutPage() {
  const { t } = useTranslation("common")

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-12">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-16 bottom-[-30%] h-72 w-72 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative p-8 md:p-16 space-y-6"
        >
          <Badge className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur">
            {t("aboutPage.hero.eyebrow")}
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight"
          >
            {t("aboutPage.hero.title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-base md:text-lg max-w-2xl text-stone-600 dark:text-stone-300"
          >
            {t("aboutPage.hero.subtitle")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-wrap gap-3 pt-2"
          >
            <Button asChild className="rounded-2xl">
              <Link to="/contact">
                <Sparkles className="h-4 w-4 mr-2" />
                {t("aboutPage.hero.ctaPrimary")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/">
                {t("aboutPage.hero.ctaSecondary")}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("aboutPage.highlights.title")}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">{t("aboutPage.highlights.subtitle")}</p>
          </div>
          <Badge variant="outline" className="rounded-2xl border-dashed">
            <Wand2 className="h-4 w-4 mr-1" />
            {t("aboutPage.highlights.badge")}
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((key, index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.6 }}
            >
              <Card className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">
                      {t(`aboutPage.highlights.cards.${key}.tagline`)}
                    </span>
                  </div>
                  <CardTitle>{t(`aboutPage.highlights.cards.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`aboutPage.highlights.cards.${key}.description`)}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("aboutPage.timeline.title")}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">{t("aboutPage.timeline.subtitle")}</p>
          </div>
          <Badge variant="secondary" className="rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
            <CalendarClock className="h-4 w-4 mr-1" />
            {t("aboutPage.timeline.status")}
          </Badge>
        </div>
        <div className="relative">
          <div className="absolute left-[14px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-emerald-300 via-emerald-200 to-transparent dark:from-emerald-700 dark:via-emerald-800/60 dark:to-transparent" aria-hidden="true" />
          <div className="space-y-4">
            {timeline.map((key, index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.6 }}
                className="relative pl-12"
              >
                <div className="absolute left-0 top-2 h-8 w-8 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-[#1f1f1f] flex items-center justify-center shadow-sm">
                  <PartyPopper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <Card className="rounded-3xl border-stone-200/70 dark:border-[#3e3e42]/70">
                  <CardHeader>
                    <CardTitle className="text-lg">{t(`aboutPage.timeline.items.${key}.title`)}</CardTitle>
                    <CardDescription>{t(`aboutPage.timeline.items.${key}.caption`)}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("aboutPage.team.title")}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-xl">{t("aboutPage.team.subtitle")}</p>
          </div>
          <Badge variant="secondary" className="rounded-2xl bg-white dark:bg-[#252526]">
            <Users className="h-4 w-4 mr-1" />
            {t("aboutPage.team.badge")}
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              viewport={{ once: true, amount: 0.6 }}
            >
              <Card className="rounded-3xl h-full border-dashed border-stone-200 dark:border-[#3e3e42] bg-stone-50/60 dark:bg-[#1f1f1f]/60 backdrop-blur-sm">
                <CardHeader className="space-y-2">
                  <Badge variant="outline" className="rounded-2xl w-fit">
                    {t("aboutPage.team.cardTitle")}
                  </Badge>
                  <CardTitle className="text-lg">{t("aboutPage.team.cardHeading")}</CardTitle>
                  <CardDescription>{t("aboutPage.team.cardDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-28 rounded-2xl bg-gradient-to-r from-stone-200 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#252526] dark:to-[#2d2d30] animate-pulse" />
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {t("aboutPage.team.cardPlaceholder")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] px-8 py-10 md:px-12 md:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.12),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.18),_transparent_60%)]" aria-hidden="true" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">{t("aboutPage.cta.title")}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">{t("aboutPage.cta.subtitle")}</p>
          </div>
          <Button asChild className="rounded-2xl">
            <Link to="/search">
              {t("aboutPage.cta.button")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
