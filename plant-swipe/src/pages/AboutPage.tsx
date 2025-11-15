import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Sparkles, PartyPopper, Leaf, HeartHandshake, MapPin } from "lucide-react"
import { Link } from "@/components/i18n/Link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

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

const memberProfiles: Record<string, { pseudo: string; fullName: string; role: string }> = {
  xavier: {
    pseudo: "Psykokwak",
    fullName: "Xaver Sabar",
    role: "CCO / CEO / Founder",
  },
  five: {
    pseudo: "FIVE",
    fullName: "Chan AH-HONG",
    role: "CTO / Co-Founder",
  },
}

export default function AboutPage() {
  const { t } = useTranslation("About")
  const serviceItems = (t("services.items", { returnObjects: true }) as string[]) ?? []
  const pillars = t("pillars", { returnObjects: true }) as {
    title: string
    subtitle: string
    cards?: Record<string, PillarCard>
  }
  const pillarCards = Object.values(pillars?.cards ?? {})
  const meetMembers = (t("meet.members", { returnObjects: true }) as Record<string, MemberCard>) ?? {}
  const meetOrder =
    (t("meet.order", { returnObjects: true }) as string[]) ?? Object.keys(meetMembers)
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
              .map((key) => ({ key, member: meetMembers[key] }))
              .filter((entry): entry is { key: string; member: MemberCard } => Boolean(entry.member))
              .map(({ key, member }, index) => {
                const profile = memberProfiles[key]
                const displayName = profile ? `${profile.pseudo} - ${profile.fullName}` : member.name
                const roleLabel = profile?.role ?? member.role

                return (
                  <Card
                    key={`${member.name}-${index}`}
                    className="rounded-[30px] border border-stone-200/80 dark:border-[#3e3e42]/80 overflow-hidden"
                  >
                    <div className="p-6 pb-0">
                      <div className="relative">
                        <div className="h-48 rounded-2xl border border-dashed border-stone-300 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#1f1f1f]/60 flex flex-col items-center justify-center text-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                            {member.placeholder}
                          </span>
                          <Button variant="outline" size="sm" className="rounded-full">
                            {member.placeholderCta}
                          </Button>
                        </div>
                        {member.adjectives?.length ? (
                          <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-2 pointer-events-none">
                            {member.adjectives.map((adj) => (
                              <Badge
                                key={adj}
                                variant="secondary"
                                className="rounded-full px-3 py-0.5 text-xs bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100 shadow-sm"
                              >
                                {adj}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <CardHeader className="space-y-1">
                      <CardTitle>{displayName}</CardTitle>
                      <CardDescription>{roleLabel}</CardDescription>
                    </CardHeader>
                  </Card>
                )
              })}
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
