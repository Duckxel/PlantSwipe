import React from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Sparkles, PartyPopper, Leaf, HeartHandshake, MapPin, BookOpenCheck, CalendarDays, Loader2 } from "lucide-react"
import { Link } from "@/components/i18n/Link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers"
import { supabase } from "@/lib/supabaseClient"

type PillarCard = { eyebrow: string; title: string; description: string | string[] }

// Fallback team members in case DB is not available
const fallbackTeamMembers: TeamMember[] = [
  {
    id: "fallback-lauryne",
    name: "lauryne",
    display_name: "Lauryne Gaignard",
    role: "CEO",
    tag: null,
    image_url: null,
    user_id: null,
    position: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-xavier",
    name: "xavier",
    display_name: "Xavier Sabar",
    role: "Co-Founder",
    tag: "Psychokwak",
    image_url: "https://media.aphylia.app/UTILITY/admin/uploads/webp/img-0151-ab46ee91-19d9-4c9f-9694-8c975c084cf1.webp",
    user_id: null,
    position: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-five",
    name: "five",
    display_name: "Chan AH-HONG",
    role: "Co-Founder",
    tag: "Five",
    image_url: "https://media.aphylia.app/UTILITY/admin/uploads/webp/img-0414-2-low-0a499a50-08a7-4615-834d-288b179e628e.webp",
    user_id: null,
    position: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
]

export default function AboutPage() {
  const { t } = useTranslation("About")
  const { t: tCommon } = useTranslation("common")
  const seoTitle = tCommon("seo.about.title", { defaultValue: "About Aphylia" })
  const seoDescription = tCommon("seo.about.description", {
    defaultValue: "Meet the founders, rituals, and creative ambition behind Aphylia's augmented plant lab.",
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })
  
  // Fetch team members from database
  const { teamMembers: dbTeamMembers, loading: teamLoading, error: teamError } = useTeamMembers()
  
  // Use DB team members or fallback
  const teamMembers = React.useMemo(
    () => dbTeamMembers.length > 0 ? dbTeamMembers : (teamError ? fallbackTeamMembers : []),
    [dbTeamMembers, teamError],
  )

  // Resolve linked user profiles (user_id → display_name for clickable links)
  const [linkedProfiles, setLinkedProfiles] = React.useState<Record<string, { display_name: string }>>({})

  React.useEffect(() => {
    const userIds = teamMembers
      .map((m) => m.user_id)
      .filter((id): id is string => !!id)
    if (userIds.length === 0) return

    const fetchProfiles = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds)
        if (fetchErr || !data) return
        const map: Record<string, { display_name: string }> = {}
        for (const row of data) {
          if (row.display_name) {
            map[row.id] = { display_name: row.display_name }
          }
        }
        setLinkedProfiles(map)
      } catch {
        // Silently fail
      }
    }
    fetchProfiles()
  }, [teamMembers])
  
  const featureItems = (t("services.items", { returnObjects: true }) as string[]) ?? []
  const pillars = t("pillars", { returnObjects: true }) as {
    title: string
    subtitle: string
    cards?: Record<string, PillarCard>
    nameOrigin?: {
      title: string
      description: string
    }
  }
  const pillarCards = Object.values(pillars?.cards ?? {}) as PillarCard[]
  const nameOrigin = pillars?.nameOrigin
  const meetBadge = t("meet.badge")

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-12">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-16 bottom-[-30%] h-72 w-72 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
          className="absolute -right-2 -bottom-8 md:-right-4 md:-bottom-12 z-0"
        >
          <style>{`
            .about-logo {
              filter: brightness(0) saturate(100%);
              transform: scaleX(-1);
            }
            .dark .about-logo {
              filter: brightness(0) saturate(100%) invert(100%);
            }
          `}</style>
          <img 
            src="/icons/plant-swipe-icon.svg" 
            alt="Aphylia Logo" 
            className="about-logo relative h-64 w-64 md:h-96 md:w-96 opacity-60 dark:opacity-50"
          />
        </motion.div>
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
              <Link to="/contact/business">
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
          <Card className="rounded-[32px] border border-stone-200 dark:border-[#3e3e42] overflow-hidden">
            <div className="grid md:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
              <div className="p-6 md:p-10 space-y-8 border-b md:border-b-0 md:border-r border-stone-200 dark:border-[#3e3e42]">
                {pillarCards.map((card, index) => (
                  <div key={`${card.title}-${index}`} className="space-y-5">
                    <div className="flex items-start gap-3 text-emerald-700 dark:text-emerald-300">
                      <div className="rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/30 p-2">
                        <BookOpenCheck className="h-5 w-5" />
                      </div>
                      <div>
                        {card.eyebrow && (
                          <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                            {card.eyebrow}
                          </p>
                        )}
                        <CardTitle className="text-xl">{card.title}</CardTitle>
                      </div>
                    </div>
                    {Array.isArray(card.description) ? (
                      <div className="space-y-4">
                        {card.description.map((line, lineIndex) => (
                          <div key={`${card.title}-line-${lineIndex}`} className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-xs font-semibold">
                              {String(lineIndex + 1).padStart(2, "0")}
                            </div>
                            <p className="text-sm text-stone-700 dark:text-stone-200">{line}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <CardDescription>{card.description}</CardDescription>
                    )}
                  </div>
                ))}
              </div>
              {nameOrigin?.description && (
                <div className="p-6 md:p-10 space-y-4 bg-emerald-50/40 dark:bg-[#0f1a14] h-full">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/80 dark:bg-white/10 p-2 shadow-sm">
                      <Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                        {nameOrigin.title}
                      </p>
                      <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                        {t("pillars.nameOriginHeading", "Where Aphylia comes from")}
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-stone-700 dark:text-stone-200">{nameOrigin.description}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {["Montpellier", "Aphyllante", "Origins"].map((chip) => (
                      <Badge
                        key={chip}
                        variant="secondary"
                        className="rounded-full bg-white/80 dark:bg-white/5 text-stone-700 dark:text-stone-100 px-3 py-1 text-xs"
                      >
                        <CalendarDays className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-300" />
                        {chip}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
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
              {featureItems.map((item, index) => (
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
                <Link to="/contact/business">
                  {t("collaboration.cta")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

        {/* Team Section */}
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
          
          {teamLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-[900px] mx-auto justify-items-center">
              {teamMembers.map((member) => (
                <Card
                  key={member.id}
                  className="rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 overflow-hidden text-sm w-fit"
                >
                  <div className="p-3 pb-0 flex justify-center">
                    <div className="relative w-[260px] max-w-full">
                      {member.image_url ? (
                        <div className="w-full aspect-square rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden bg-stone-100 dark:bg-[#1f1f1f]/60">
                          <img
                            src={member.image_url}
                            alt={`${member.display_name} portrait`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded-xl border border-dashed border-stone-300 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#1f1f1f]/60 flex items-center justify-center text-center px-4">
                          <span className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                            Photo coming soon
                          </span>
                        </div>
                      )}
                      {member.tag ? (
                        <div className="absolute inset-x-3 bottom-3 flex justify-center pointer-events-none">
                          <Badge
                            variant="secondary"
                            className="rounded-full px-3 py-0.5 text-[11px] bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100 shadow-sm"
                          >
                            {member.tag}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <CardHeader className="px-4 pb-4 pt-3 space-y-1 text-center">
                    {member.user_id && linkedProfiles[member.user_id] ? (
                      <CardTitle className="text-base">
                        <Link
                          to={`/u/${encodeURIComponent(linkedProfiles[member.user_id].display_name)}`}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors underline decoration-emerald-500/30 underline-offset-2 hover:decoration-emerald-500"
                        >
                          {linkedProfiles[member.user_id].display_name}
                        </Link>
                      </CardTitle>
                    ) : (
                      <CardTitle className="text-base">{member.display_name}</CardTitle>
                    )}
                    <CardDescription className="text-xs">{member.role}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 dark:text-stone-400">
              <p className="text-sm">Team information coming soon...</p>
            </div>
          )}
        </section>

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
