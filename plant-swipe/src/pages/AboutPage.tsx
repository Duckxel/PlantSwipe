import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import {
  Sparkles,
  Wand2,
  PartyPopper,
  CalendarClock,
  Quote,
  Leaf,
  HeartHandshake,
  MapPin,
} from "lucide-react"
import { Link } from "@/components/i18n/Link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

type StoryBeatKey = "spark" | "dare" | "momentum"
type OfferingKey = "encyclopedia" | "monthly" | "gardenPlanner" | "photoId" | "swap" | "seeds"
type PillarCard = { eyebrow: string; title: string; description: string }
type MemberCard = {
  name: string
  role: string
  adjectives: string[]
  description: string
  ritual: string
  placeholder: string
  placeholderCta: string
}
type CommunityContent = {
  badge: string
  title: string
  description: string
  helper: string
  button: string
}
type FeedbackContent = {
  title: string
  subtitle: string
  list: string[]
  lauCredit: string
  button: string
}

const storyBeatKeys: StoryBeatKey[] = ["spark", "dare", "momentum"]
const offeringKeys: OfferingKey[] = ["encyclopedia", "monthly", "gardenPlanner", "photoId", "swap", "seeds"]

export default function AboutPage() {
  const { t } = useTranslation("About")
  const definitionParagraphs = (t("definition.paragraphs", { returnObjects: true }) as string[]) ?? []
  const serviceItems = (t("services.items", { returnObjects: true }) as string[]) ?? []
  const pillars = t("pillars", { returnObjects: true }) as {
    title: string
    subtitle: string
    cards?: Record<string, PillarCard>
  }
  const pillarCards = Object.values(pillars?.cards ?? {})
  const community = t("community", { returnObjects: true }) as CommunityContent
  const feedback = t("feedback", { returnObjects: true }) as FeedbackContent
  const feedbackList = (feedback?.list ?? []) as string[]
  const meetMembers = (t("meet.members", { returnObjects: true }) as Record<string, MemberCard>) ?? {}
  const meetOrder =
    (t("meet.order", { returnObjects: true }) as string[]) ?? Object.keys(meetMembers)
  const ritualLabel = t("meet.ritualLabel")
  const meetBadge = t("meet.badge")

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
          <Badge className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("hero.eyebrow")}
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight"
          >
            {t("hero.title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-base md:text-lg max-w-2xl text-stone-600 dark:text-stone-300"
          >
            {t("hero.subtitle")}
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
                {t("hero.ctaPrimary")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/">
                {t("hero.ctaSecondary")}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section>
        <Card className="rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-white/95 dark:bg-[#1b1b1f]/95 shadow-[0_25px_55px_rgba(16,185,129,0.12)]">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit rounded-2xl px-3 py-1 flex items-center gap-2">
                <PartyPopper className="h-4 w-4" />
                {t("story.badge")}
              </Badge>
              <h2 className="text-2xl font-semibold">{t("story.title")}</h2>
              <p className="text-sm text-stone-600 dark:text-stone-300 max-w-3xl">{t("story.subtitle")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {storyBeatKeys.map((key, index) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
                  viewport={{ once: true, amount: 0.4 }}
                >
                  <Card className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50/60 dark:bg-[#1f1f1f]/60 backdrop-blur">
                    <CardHeader className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Wand2 className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wide">
                          {index + 1}
                        </span>
                      </div>
                      <CardTitle className="text-lg">{t(`story.beats.${key}.title`)}</CardTitle>
                      <CardDescription>{t(`story.beats.${key}.description`)}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
            <Card className="rounded-3xl border-dashed border-stone-200 dark:border-[#3e3e42]/70 bg-transparent">
              <CardContent className="p-6 flex flex-col gap-2">
                <Quote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-base md:text-lg font-medium text-stone-900 dark:text-stone-100">
                  {t("story.quote.text")}
                </p>
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  {t("story.quote.attribution")}
                </span>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white/90 dark:bg-[#18181c]/90">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Badge variant="outline" className="rounded-2xl w-fit flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              {t("definition.title")}
            </Badge>
            <div className="space-y-3">
              {definitionParagraphs.map((paragraph, index) => (
                <p key={index} className="text-sm md:text-base text-stone-700 dark:text-stone-300">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-900/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
              {t("definition.helper")}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("offerings.title")}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">{t("offerings.subtitle")}</p>
          </div>
          <Badge variant="outline" className="rounded-2xl border-dashed flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            {t("services.title")}
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {offeringKeys.map((key, index) => {
            const item = t(`offerings.items.${key}`, { returnObjects: true }) as {
              title: string
              description: string
              status?: string
            }
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.4 }}
              >
                <Card className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wide">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      {item?.status && (
                        <Badge variant="secondary" className="rounded-2xl px-2 py-0.5">
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    <CardTitle>{item?.title ?? ""}</CardTitle>
                    <CardDescription>{item?.description ?? ""}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </section>

      {pillarCards.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{pillars?.title}</h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
                {pillars?.subtitle}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {pillarCards.map((card, index) => (
              <Card
                key={`${card.title}-${index}`}
                className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70"
              >
                <CardHeader className="space-y-3">
                  {card.eyebrow && (
                    <Badge variant="secondary" className="rounded-2xl w-fit">
                      {card.eyebrow}
                    </Badge>
                  )}
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42]">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <PartyPopper className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">{t("services.title")}</span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300">{t("services.subtitle")}</p>
            <ul className="space-y-3">
              {serviceItems.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-3">
                  <Leaf className="h-4 w-4 mt-1 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-stone-700 dark:text-stone-200">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42]">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <MapPin className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t("practical.title")}</span>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-300">{t("practical.description")}</p>
              <Badge variant="secondary" className="rounded-2xl w-fit">
                {t("practical.status")}
              </Badge>
              <p className="text-sm text-stone-500 dark:text-stone-400">{t("practical.address")}</p>
            </div>
            <div className="border-t border-stone-200 dark:border-[#3e3e42]/80 pt-6 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <HeartHandshake className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t("collaboration.title")}</span>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {t("collaboration.description")}
              </p>
              <Button asChild className="rounded-2xl w-full sm:w-auto">
                <Link to="/contact">
                  {t("collaboration.cta")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42]">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Badge variant="secondary" className="w-fit rounded-2xl px-3 py-1">
              {community?.badge}
            </Badge>
            <h2 className="text-xl font-semibold">{community?.title}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-300">{community?.description}</p>
            <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
              {community?.helper}
            </div>
            <Button asChild className="rounded-2xl">
              <Link to="/contact">{community?.button}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border border-stone-200 dark:border-[#3e3e42]">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{feedback?.title}</h2>
              <p className="text-sm text-stone-600 dark:text-stone-300">{feedback?.subtitle}</p>
            </div>
            <ul className="space-y-2">
              {feedbackList.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-200">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-500 dark:text-stone-400 italic">{feedback?.lauCredit}</p>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/contact">{feedback?.button}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {meetOrder.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{t("meet.title")}</h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
                {t("meet.subtitle")}
              </p>
            </div>
            <Badge variant="secondary" className="rounded-2xl bg-white dark:bg-[#252526]">
              {meetBadge}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {meetOrder
              .map((key) => meetMembers[key])
              .filter(Boolean)
              .map((member, index) => (
                <Card
                  key={`${member!.name}-${index}`}
                  className="rounded-[30px] border border-stone-200/80 dark:border-[#3e3e42]/80 overflow-hidden"
                >
                  <div className="p-6 pb-0">
                    <div className="h-48 rounded-2xl border border-dashed border-stone-300 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#1f1f1f]/60 flex flex-col items-center justify-center text-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {member!.placeholder}
                      </span>
                      <Button variant="outline" size="sm" className="rounded-full">
                        {member!.placeholderCta}
                      </Button>
                    </div>
                  </div>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {member!.adjectives?.map((adj) => (
                        <Badge
                          key={adj}
                          variant="secondary"
                          className="rounded-full px-3 py-0.5 text-xs bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-200"
                        >
                          {adj}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle>{member!.name}</CardTitle>
                    <CardDescription>{member!.role}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-stone-700 dark:text-stone-200">{member!.description}</p>
                    <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42]/80 bg-stone-50 dark:bg-[#1f1f1f] px-4 py-3 space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {ritualLabel}
                      </span>
                      <p className="text-sm text-stone-700 dark:text-stone-200">{member!.ritual}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[28px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] px-8 py-10 md:px-12 md:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.12),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.18),_transparent_60%)]" aria-hidden="true" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">{t("cta.title")}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">{t("cta.subtitle")}</p>
          </div>
          <Button asChild className="rounded-2xl">
            <Link to="/search">
              {t("cta.button")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
