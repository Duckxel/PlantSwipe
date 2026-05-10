import React from "react"
import { Typewriter } from "@/components/ui/typewriter"
import { Link } from "@/components/i18n/Link"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import {
  organizationSchema,
  softwareApplicationSchema,
  webSiteSearchActionSchema,
  faqSchema,
} from "@/lib/seo/schemas"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "react-i18next"
import { TopBar } from "@/components/layout/TopBar"
import { Footer } from "@/components/layout/Footer"
import MobileNavBar from "@/components/layout/MobileNavBar"
import { useAuthActions } from "@/context/AuthActionsContext"
import { useLanguageNavigate, usePathWithoutLanguage } from "@/lib/i18nRouting"
import { supabase } from "@/lib/supabaseClient"
import i18n from "@/lib/i18n"
import { PixelSprite } from "@/components/ui/pixel-sprite"
import "./LandingPage.css"

// Intersection Observer hook: defers rendering of below-fold sections until they approach the viewport.
// rootMargin="400px" triggers 400px before the section scrolls into view for seamless UX.
const useLazySection = (rootMargin = "400px") => {
  const ref = React.useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return { ref, isVisible }
}
import {
  Leaf,
  Droplets,
  Sun,
  Bell,
  BookMarked,
  Camera,
  NotebookPen,
  Wifi,
  ChevronDown,
  Star,
  Sparkles,
  ArrowRight,
  Zap,
  Shield,
  Heart,
  TrendingUp,
  Globe,
  Smartphone,
  Flower2,
  TreeDeciduous,
  Sprout,
  Instagram,
  Twitter,
  Mail,
  GraduationCap,
  HandHeart,
  Search,
  CheckCircle2,
  CircleDot,
  BarChart3,
  Target,
  Flame,
  Calendar,
  PawPrint,
  Gamepad2,
  ExternalLink,
} from "lucide-react"

// Aphydle (sister daily plant guessing game) is served on `aphydle.<primary>`
// per plant-swipe.conf / setup.sh. Derive the URL from the current host (or
// VITE_SITE_URL when SSRing) so each environment links to its own subdomain.
// VITE_APHYDLE_URL overrides everything for special builds.
const APHYDLE_LOGO_URL =
  "https://media.aphylia.app/UTILITY/admin/aphydle/webp/final-c031f1aa-619f-440e-b748-291f29c8987b.webp"
const getAphydleUrl = (): string => {
  const override = (import.meta.env.VITE_APHYDLE_URL as string | undefined)?.trim()
  if (override) {
    try { return new URL(override).origin + "/" } catch { /* fall through */ }
  }
  const candidate =
    (typeof window !== "undefined" && window.location?.origin) ||
    (import.meta.env.VITE_SITE_URL as string | undefined) ||
    "https://aphylia.app"
  try {
    const parsed = new URL(candidate)
    let host = parsed.hostname
    if (host.startsWith("www.")) host = host.slice(4)
    if (!host.startsWith("aphydle.")) host = `aphydle.${host}`
    return `${parsed.protocol}//${host}/`
  } catch {
    return "https://aphydle.aphylia.app/"
  }
}

// Types for database data
type HeroCard = {
  id: string
  plant_name: string
  plant_scientific_name: string | null
  image_url: string | null
  water_frequency: string
  light_level: string
  reminder_text: string
}

type LandingStats = {
  plants_count: string
  plants_label: string
  users_count: string
  users_label: string
  tasks_count: string
  tasks_label: string
  rating_value: string
  rating_label: string
}

type Testimonial = {
  id: string
  author_name: string
  author_role: string | null
  quote: string
  rating: number
}

type FAQ = {
  id: string
  question: string
  answer: string
}

type DemoFeature = {
  id: string
  icon_name: string
  label: string
  color: string
}

type ShowcaseCard = {
  id: string
  card_type: 'main' | 'garden' | 'analytics' | 'tasks' | 'toxicity' | 'encyclopedia'
  badge_text?: string
  title?: string
  garden_name?: string
  plants_count?: number
  species_count?: number
  streak_count?: number
  progress_percent?: number
  cover_image_url?: string
  plant_images?: Array<{ url: string; name: string }>
  selected_garden_ids?: string[]
}

type ShowcaseGarden = {
  id: string
  name: string
  plantCount: number
  streak: number
  coverImageUrl?: string
  ownerDisplayName?: string
  previewPlants: Array<{
    id: string
    name: string
    nickname?: string
    imageUrl?: string
  }>
}

// Showcase Configuration from Admin Panel
type ShowcaseTask = {
  id: string
  text: string
  completed: boolean
}

type ShowcaseMember = {
  id: string
  name: string
  role: 'owner' | 'member'
  avatar_url: string | null
  color: string
}

type ShowcasePlantCard = {
  id: string
  plant_id: string | null
  name: string
  image_url: string | null
  gradient: string
  tasks_due: number
}

type ShowcaseConfig = {
  id: string
  garden_name: string
  plants_count: number
  species_count: number
  streak_count: number
  progress_percent: number
  cover_image_url: string | null
  tasks: ShowcaseTask[]
  members: ShowcaseMember[]
  plant_cards: ShowcasePlantCard[]
  completion_rate: number
  analytics_streak: number
  chart_data: number[]
  calendar_data: CalendarDay[]
}

type CalendarDay = {
  date: string
  status: 'completed' | 'missed' | 'none'
}

type LandingPageSettings = {
  // Hero Section
  hero_badge_text: string
  hero_title: string
  hero_title_highlight: string
  hero_title_end: string
  hero_description: string
  hero_cta_primary_text: string
  hero_cta_primary_link: string
  hero_cta_secondary_text: string
  hero_cta_secondary_link: string
  hero_social_proof_text: string
  // Section Visibility
  show_hero_section: boolean
  show_stats_section: boolean
  show_beginner_section: boolean
  show_features_section: boolean
  show_demo_section: boolean
  show_how_it_works_section: boolean
  show_showcase_section: boolean
  show_testimonials_section: boolean
  show_faq_section: boolean
  show_final_cta_section: boolean
  // Social Links
  instagram_url: string
  twitter_url: string
  support_email: string
  // Final CTA
  final_cta_badge: string
  final_cta_title: string
  final_cta_subtitle: string
  final_cta_button_text: string
  final_cta_secondary_text: string
  // Beginner Section
  beginner_badge: string
  beginner_title: string
  beginner_title_highlight: string
  beginner_subtitle: string
  // Meta/SEO
  meta_title: string
  meta_description: string
}

// Approved plant — used for tour screens and hero gallery, sourced from
// the `plants` table with a primary image. Selecting status='approved'
// guarantees the asset and metadata have passed editorial review.
type ApprovedPlant = {
  id: string
  name: string
  scientific_name: string | null
  image_url: string
}

// Context for landing page data
type LandingDataContextType = {
  heroCards: HeroCard[]
  stats: LandingStats | null
  testimonials: Testimonial[]
  faqItems: FAQ[]
  demoFeatures: DemoFeature[]
  showcaseCards: ShowcaseCard[]
  showcaseGardens: ShowcaseGarden[]
  showcaseConfig: ShowcaseConfig | null
  settings: LandingPageSettings | null
  approvedPlants: ApprovedPlant[]
  loading: boolean
}

const LandingDataContext = React.createContext<LandingDataContextType>({
  heroCards: [],
  stats: null,
  testimonials: [],
  faqItems: [],
  demoFeatures: [],
  showcaseCards: [],
  showcaseGardens: [],
  showcaseConfig: null,
  settings: null,
  approvedPlants: [],
  loading: true,
})

const useLandingData = () => React.useContext(LandingDataContext)

// LazySection wrapper: renders a placeholder until the section approaches the viewport,
// then mounts the actual component. Prevents rendering heavy below-fold content on initial load.
const LazySection: React.FC<{ children: React.ReactNode; minHeight?: string }> = ({ children, minHeight = "200px" }) => {
  const { ref, isVisible } = useLazySection()
  return (
    <div ref={ref}>
      {isVisible ? children : <div style={{ minHeight }} />}
    </div>
  )
}

const LandingPage: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { user, profile, signOut } = useAuth()
  const { openLogin, openSignup } = useAuthActions()
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()

  // Load landing page data from database
  const [landingData, setLandingData] = React.useState<LandingDataContextType>({
    heroCards: [],
    stats: null,
    testimonials: [],
    faqItems: [],
    demoFeatures: [],
    showcaseCards: [],
    showcaseGardens: [],
    showcaseConfig: null,
    settings: null,
    approvedPlants: [],
    loading: true,
  })

  // Track current language for FAQ translations
  const currentLang = i18n.language || 'en'

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const needsTranslation = currentLang !== 'en'

        // Execute ALL queries in a single parallel batch — including translations and showcase.
        // Previously, translations were fetched sequentially after the main batch, adding latency.
        const results = await Promise.allSettled([
          supabase.from("landing_page_settings").select("*").limit(1).maybeSingle(),
          supabase.from("landing_hero_cards").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_stats").select("*").limit(1).maybeSingle(),
          supabase.from("landing_testimonials").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_faq").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_demo_features").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_showcase_config").select("*").limit(1).maybeSingle(),
          // Translation queries — fire in parallel even if not needed (no-op if English)
          needsTranslation
            ? supabase.from("landing_faq_translations").select("*").eq("language", currentLang)
            : Promise.resolve({ data: null, error: null }),
          needsTranslation
            ? supabase.from("landing_demo_feature_translations").select("*").eq("language", currentLang)
            : Promise.resolve({ data: null, error: null }),
          needsTranslation
            ? supabase.from("landing_stats_translations").select("*").eq("language", currentLang)
            : Promise.resolve({ data: null, error: null }),
          // Approved plants with images — used by the live tour & hero gallery.
          // Limit kept tight; each row includes its plant_images relation so we
          // can pick the primary image client-side without an extra round-trip.
          supabase
            .from("plants")
            .select("id, name, scientific_name_species, plant_images(link, use)")
            .eq("status", "approved")
            .order("name")
            .limit(40),
        ])

        // Extract data safely, using null/empty array as fallback for any failures
        const getData = <T,>(result: PromiseSettledResult<{ data: T | null; error: unknown }>, defaultValue: T): T => {
          if (result.status === 'rejected') return defaultValue
          const { data, error } = result.value
          if (error || data === null) return defaultValue
          return data
        }

        const settings = getData(results[0], null)
        const heroCards = getData(results[1], [])
        const stats = getData(results[2], null)
        const testimonials = getData(results[3], [])
        let faqItems = getData(results[4], []) as FAQ[]
        let demoFeatures = getData(results[5], []) as DemoFeature[]
        const showcaseConfig = getData<ShowcaseConfig | null>(results[6], null)

        // Apply FAQ translations
        const faqTranslations = getData(results[7], null) as Array<{ faq_id: string; question: string; answer: string }> | null
        if (faqTranslations && faqTranslations.length > 0 && faqItems.length > 0) {
          const translationMap = new Map(faqTranslations.map(t => [t.faq_id, { question: t.question, answer: t.answer }]))
          faqItems = faqItems.map(faq => {
            const tr = translationMap.get(faq.id)
            return tr ? { ...faq, question: tr.question, answer: tr.answer } : faq
          })
        }

        // Apply Demo Feature translations
        const featureTranslations = getData(results[8], null) as Array<{ feature_id: string; label: string }> | null
        if (featureTranslations && featureTranslations.length > 0 && demoFeatures.length > 0) {
          const translationMap = new Map(featureTranslations.map(t => [t.feature_id, t.label]))
          demoFeatures = demoFeatures.map(f => {
            const label = translationMap.get(f.id)
            return label ? { ...f, label } : f
          })
        }

        // Apply Stats translations
        let translatedStats = stats
        const statsTranslations = getData(results[9], null) as Array<{ stats_id: string; plants_label: string; users_label: string; tasks_label: string; rating_label: string }> | null
        if (statsTranslations && statsTranslations.length > 0 && stats) {
          // Find the matching stats translation
          const st = statsTranslations.find(t => t.stats_id === stats.id)
          if (st) {
            translatedStats = {
              ...stats,
              plants_label: st.plants_label || stats.plants_label,
              users_label: st.users_label || stats.users_label,
              tasks_label: st.tasks_label || stats.tasks_label,
              rating_label: st.rating_label || stats.rating_label,
            }
          }
        }

        // Map approved plants — pick a primary image, fall back to first available.
        // Plants without any usable image are dropped so the UI never has to
        // decide what to render in their place.
        type RawPlantImage = { link: string | null; use: string | null }
        type RawPlant = {
          id: string
          name: string | null
          scientific_name_species: string | null
          plant_images: RawPlantImage[] | null
        }
        const rawPlants = getData<RawPlant[]>(results[10], []) as RawPlant[]
        const approvedPlants: ApprovedPlant[] = rawPlants
          .map((p) => {
            const images = p.plant_images || []
            const primary = images.find((img) => img.use === 'primary' || img.use === 'main')
            const link = (primary || images[0])?.link
            if (!link || !p.name) return null
            return {
              id: p.id,
              name: p.name,
              scientific_name: p.scientific_name_species || null,
              image_url: link,
            }
          })
          .filter((p): p is ApprovedPlant => p !== null)

        setLandingData({
          heroCards: heroCards || [],
          stats: translatedStats || null,
          testimonials: testimonials || [],
          faqItems: faqItems || [],
          demoFeatures: demoFeatures || [],
          showcaseCards: [],
          showcaseGardens: [],
          showcaseConfig,
          settings: settings || null,
          approvedPlants,
          loading: false,
        })
      } catch (e) {
        console.error("Failed to load landing data:", e)
        setLandingData(prev => ({ ...prev, loading: false }))
      }
    }
    loadData()
  }, [currentLang])

  const handleProfileNavigation = React.useCallback(() => {
    navigate('/profile')
  }, [navigate])

  const handleLogout = React.useCallback(async () => {
    await signOut()
    const protectedPrefixes = ['/profile', '/friends', '/settings', '/admin', '/create']
    const isOnProtectedPage = protectedPrefixes.some(prefix => 
      pathWithoutLang === prefix || pathWithoutLang.startsWith(prefix + '/')
    ) || pathWithoutLang.match(/^\/plants\/[^/]+\/edit$/)
    
    if (isOnProtectedPage) {
      navigate('/')
    }
  }, [signOut, navigate, pathWithoutLang])

  // Page metadata from translations + Schema.org JSON-LD for the homepage.
  // FAQ entries below ride on the existing translations so they switch with i18n.
  // Add real Q&A copy in src/locales/{lang}/Landing.json under the "faq.items" key
  // (q + a per item) — until that exists, the FAQ schema falls back to a single seed entry.
  const homepageJsonLd = React.useMemo(() => {
    const rawFaqs = t("faq.items", { returnObjects: true, defaultValue: [] }) as
      | Array<{ q?: string; a?: string }>
      | unknown
    const faqEntries = Array.isArray(rawFaqs)
      ? rawFaqs
          .filter((entry): entry is { q: string; a: string } => Boolean(entry?.q && entry?.a))
          .map((entry) => ({ question: entry.q, answer: entry.a }))
      : []

    const blocks: object[] = [
      softwareApplicationSchema(),
      organizationSchema(),
      webSiteSearchActionSchema(),
    ]
    if (faqEntries.length > 0) blocks.push(faqSchema(faqEntries))
    return blocks
  }, [t])

  usePageMetadata({
    title: "Aphylia – " + t("hero.badge"),
    description: t("hero.description"),
    type: "website",
    jsonLd: homepageJsonLd,
  })

  return (
    <LandingDataContext.Provider value={landingData}>
    <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50/50 via-white to-stone-100 dark:from-[#0a0f0a] dark:via-[#111714] dark:to-[#0d1210] overflow-x-hidden pb-24 lg:pb-0">
      {/* Ambient Background — two soft, static washes. Calm > busy. */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-20 w-[600px] h-[600px] bg-emerald-500/[0.05] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] bg-teal-500/[0.04] rounded-full blur-3xl" />
      </div>

      <div className="relative">
        {/* Mobile Logo Header */}
        <header className="md:hidden flex items-center justify-center pt-5 pb-3 px-4">
          <Link to={user ? "/discovery" : "/"} className="flex items-center gap-3 no-underline group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-lg group-hover:bg-emerald-500/30 transition-colors" />
              <img src="/icons/plant-swipe-icon.svg" alt="Aphylia" className="relative h-14 w-[3.25rem] plant-icon-theme" draggable="false" />
            </div>
            <span className="text-[1.625rem] font-bold tracking-tight text-stone-900 dark:text-white lowercase">
              {t("common.appName", { ns: "common", defaultValue: "Aphylia" })}
            </span>
          </Link>
        </header>

        {/* Navigation */}
        <div className="relative z-50">
          <TopBar
            openLogin={openLogin}
            openSignup={openSignup}
            user={user}
            displayName={profile?.display_name || null}
            onProfile={handleProfileNavigation}
            onLogout={handleLogout}
          />
        </div>
        <MobileNavBar canCreate={false} onLogin={openLogin} onSignup={openSignup} onProfile={handleProfileNavigation} onLogout={handleLogout} />

        {/* Hero Section */}
        {(landingData.settings?.show_hero_section ?? true) && <HeroSection />}

        {/* Below-fold sections: lazily rendered via IntersectionObserver */}
        {/* Merged "Get started" — combines old How It Works + Beginner Friendly */}
        {(landingData.settings?.show_beginner_section ?? true) && (
          <LazySection minHeight="400px"><GetStartedSection /></LazySection>
        )}

        {/* Live Tour: animated, interactive feature showcase that replaces the spinning wheel */}
        {(landingData.settings?.show_demo_section ?? true) && (
          <LazySection minHeight="600px"><LiveTourSection /></LazySection>
        )}

        {(landingData.settings?.show_features_section ?? true) && (
          <LazySection minHeight="500px"><FeaturesSection /></LazySection>
        )}

        {(landingData.settings?.show_showcase_section ?? true) && (
          <LazySection minHeight="600px"><ShowcaseSection /></LazySection>
        )}

        {(landingData.settings?.show_testimonials_section ?? true) && (
          <LazySection minHeight="400px"><TestimonialsSection /></LazySection>
        )}

        {(landingData.settings?.show_faq_section ?? true) && (
          <LazySection minHeight="400px"><FAQSection /></LazySection>
        )}

        {(landingData.settings?.show_final_cta_section ?? true) && (
          <LazySection minHeight="300px"><FinalCTASection /></LazySection>
        )}

        {/* Sister-app card: Aphydle (daily plant guessing game). Placed near the
            bottom because it's a side project, not the main product. */}
        <LazySection minHeight="180px"><AphydleSection /></LazySection>

        {/* Footer */}
        <Footer />
      </div>
    </div>
    </LandingDataContext.Provider>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HERO SECTION - Completely Redesigned
   ═══════════════════════════════════════════════════════════════════════════════ */
const HeroSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")
  const { stats } = useLandingData()

  // All text content from translations (not editable via admin)
  const badgeText = t("hero.badge")
  const titleStart = t("hero.title")
  const titleRotating = t("hero.titleRotating", { returnObjects: true }) as string[]
  const titleHighlight = t("hero.titleHighlight")
  const titleEnd = t("hero.titleEnd")
  const description = t("hero.description")
  const ctaPrimaryText = t("hero.ctaDownload")
  const ctaPrimaryLink = "/download"
  const ctaSecondaryText = t("hero.ctaTryBrowser")
  const ctaSecondaryLink = "/discovery"
  const socialProofText = t("hero.socialProof")
  
  // Stats from database for social proof (rating is editable via Stats tab)
  const ratingValue = stats?.rating_value || "4.9"

  return (
    <section className="relative pt-6 pb-10 lg:pt-32 lg:pb-24 px-4 sm:px-6 lg:px-8 overflow-visible">
      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
          {/* Left: Hero Content */}
          <div className="text-center lg:text-left space-y-5 lg:space-y-8 animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {badgeText}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[2rem] sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1]">
              <span className="gradient-text-title">{titleStart}</span>{" "}
              {Array.isArray(titleRotating) && titleRotating.length > 0 && (
                <Typewriter
                  text={titleRotating}
                  speed={80}
                  deleteSpeed={50}
                  waitTime={2000}
                  className="gradient-text"
                  cursorChar="|"
                  cursorClassName="ml-0.5 font-light gradient-text"
                />
              )}
              <br />
              <span className="gradient-text-title">{titleHighlight}</span>{" "}
              <span className="gradient-text-title">{titleEnd}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-xl text-stone-600 dark:text-stone-300 max-w-xl mx-auto lg:mx-0 leading-snug sm:leading-relaxed">
              {description}
            </p>

            {/* CTA Buttons - Enhanced with stronger visual emphasis */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <Link
                to={ctaPrimaryLink}
                className="group relative inline-flex w-full sm:w-auto items-center justify-center gap-2 sm:gap-3 px-6 py-3.5 sm:px-10 sm:py-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 text-white text-base sm:text-lg font-bold overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-1 animate-gradient"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity animate-gradient" />
                <Sparkles className="relative h-5 w-5" />
                <span className="relative">{ctaPrimaryText}</span>
                <ArrowRight className="relative h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to={ctaSecondaryLink}
                className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-5 rounded-2xl bg-white/90 dark:bg-white/10 backdrop-blur-sm text-stone-900 dark:text-white text-sm sm:text-base font-semibold border-2 border-emerald-500/30 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>{ctaSecondaryText}</span>
                <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Social Proof Pills */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-center lg:justify-start pt-1 sm:pt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10">
                <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-6 w-6 rounded-full border-2 border-white dark:border-stone-800 ${['bg-emerald-400', 'bg-teal-400', 'bg-green-400', 'bg-lime-400'][i]}`} />
                  ))}
                </div>
                <span className="text-sm text-stone-600 dark:text-stone-300">{socialProofText}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-sm font-medium text-stone-600 dark:text-stone-300 ml-1">{ratingValue}</span>
              </div>
            </div>
          </div>

          {/* Right: Hero Visual */}
          <div className="relative flex justify-center lg:justify-end animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
})

const HeroVisual: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { heroCards: dbHeroCards, approvedPlants } = useLandingData()

  // Start with a random card for variety across different page loads
  const [activeCardIndex, setActiveCardIndex] = React.useState(() =>
    dbHeroCards.length > 0 ? Math.floor(Math.random() * dbHeroCards.length) : 0
  )

  // Reset to random when cards are loaded
  React.useEffect(() => {
    if (dbHeroCards.length > 0) {
      setActiveCardIndex(Math.floor(Math.random() * dbHeroCards.length))
    }
  }, [dbHeroCards.length])

  // Use first hero card from database if available, otherwise use translation defaults
  const activeCard = dbHeroCards[activeCardIndex] || null
  const plantName = activeCard?.plant_name || t("heroCard.plantName")
  const plantScientific = activeCard?.plant_scientific_name || t("heroCard.plantSubname")
  const waterFrequency = t("heroCard.waterFrequency")
  const lightLevel = t("heroCard.lightLevel")
  const reminderText = t("heroCard.waterIn")
  const imageUrl = activeCard?.image_url

  // Auto-cycle through cards if multiple exist
  React.useEffect(() => {
    if (dbHeroCards.length <= 1) return
    const interval = setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % dbHeroCards.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [dbHeroCards.length])

  // Water progress animation (simulate filling to ~70%)
  // REMOVED — reverted per user request

  return (
    <div className="relative">
      {/* One soft, static glow behind the composition */}
      <div className="absolute inset-0 -m-12 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 rounded-[40%] blur-3xl pointer-events-none" />

      {/* Mobile (< lg): phone only. Desktop (lg+): browser only.
          Each visitor sees the device they're using. */}

      {/* Phone — mobile only */}
      <div className="lg:hidden relative w-[260px] sm:w-[290px] mx-auto">
        <div className="relative bg-gradient-to-b from-stone-700 to-stone-800 dark:from-stone-800 dark:to-stone-900 rounded-[2.6rem] p-[2px] shadow-xl shadow-black/20 ring-1 ring-white/10">
          <div className="bg-stone-800 dark:bg-stone-900 rounded-[2.55rem] p-1.5">
            <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#0f1a14] dark:via-[#111714] dark:to-[#0a1510] rounded-[2.2rem] overflow-hidden">
              <div className="flex items-center justify-between px-7 pt-2.5 pb-0.5">
                <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">9:41</span>
                <div className="w-24 h-[26px] bg-stone-900 dark:bg-black rounded-full" />
                <Wifi className="h-3 w-3 text-stone-400 dark:text-stone-500" />
              </div>

              <div className="px-3 pb-2 pt-2 space-y-2.5">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30" />
                  {imageUrl ? (
                    <img src={imageUrl} alt={plantName} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Leaf className="h-16 w-16 text-emerald-500/50" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="glass-card rounded-xl p-2 border border-white/30 dark:border-white/10">
                      <p className="text-stone-900 dark:text-white font-bold text-xs">{plantName}</p>
                      <p className="text-stone-600 dark:text-stone-300 text-[10px] italic">{plantScientific}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/80 dark:bg-white/5 border border-stone-200/60 dark:border-white/10">
                    <Droplets className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    <span className="text-[9px] leading-tight text-stone-600 dark:text-stone-300 truncate">{waterFrequency}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/80 dark:bg-white/5 border border-stone-200/60 dark:border-white/10">
                    <Sun className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    <span className="text-[9px] leading-tight text-stone-600 dark:text-stone-300 truncate">{lightLevel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500">
                  <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="h-3.5 w-3.5 text-white animate-bounce-subtle" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white/70 uppercase tracking-wider font-medium">{t("heroCard.nextReminder")}</p>
                    <p className="text-xs font-semibold text-white truncate">{reminderText}</p>
                  </div>
                </div>

                {dbHeroCards.length > 1 && (
                  <div className="flex justify-center gap-1 pt-0.5">
                    {dbHeroCards.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveCardIndex(i)}
                        aria-label={`Show plant ${i + 1}`}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          i === activeCardIndex ? 'w-5 bg-emerald-500' : 'w-1 bg-stone-300 dark:bg-stone-600'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-center pb-1.5 pt-0.5">
                <div className="w-20 h-0.5 rounded-full bg-stone-300 dark:bg-stone-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop browser — desktop only, larger and richer. Cursor parallax on hover. */}
      <CursorParallax className="hidden lg:block relative" max={3}>
        <div className="rounded-2xl bg-stone-800 dark:bg-stone-900 shadow-2xl shadow-emerald-900/20 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-700/80 dark:bg-stone-800/80">
            <div className="h-3 w-3 rounded-full bg-rose-400/80" />
            <div className="h-3 w-3 rounded-full bg-amber-400/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
            <div className="ml-3 flex-1 h-6 rounded-md bg-stone-600/40 dark:bg-stone-700/60 flex items-center px-2.5 gap-1.5">
              <Globe className="h-3 w-3 text-stone-300/70" />
              <span className="text-[11px] text-stone-300/80 truncate">aphylia.app/garden</span>
            </div>
          </div>
          {/* Viewport */}
          <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#0f1a14] dark:via-[#111714] dark:to-[#0a1510] aspect-[16/10] overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/50 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
                  <Leaf className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">{t("heroCard.gardenName", { defaultValue: "My Indoor Jungle" })}</p>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400">12 plants · 7 day streak</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">85% on track</div>
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-500" />
              </div>
            </div>

            {/* Body: plants gallery + sidebar */}
            <div className="grid grid-cols-3 gap-4 p-5">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-semibold text-stone-700 dark:text-stone-200 uppercase tracking-wider">Plants</p>
                  <span className="text-[10px] text-stone-400">view all</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { g: 'from-emerald-400 to-teal-500', name: 'Monstera', due: 0 },
                    { g: 'from-lime-400 to-green-500', name: 'Pothos', due: 1 },
                    { g: 'from-green-400 to-emerald-500', name: 'Snake', due: 0 },
                    { g: 'from-teal-400 to-cyan-500', name: 'Fern', due: 2 },
                    { g: 'from-emerald-500 to-green-600', name: 'Lily', due: 0 },
                    { g: 'from-green-500 to-teal-600', name: 'Calathea', due: 0 },
                    { g: 'from-amber-400 to-orange-500', name: 'Succulent', due: 0 },
                    { g: 'from-pink-400 to-rose-500', name: 'Anthurium', due: 0 },
                  ].map((p, i) => {
                    const real = approvedPlants[i]
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-xl bg-gradient-to-br ${p.g} relative overflow-hidden flex items-center justify-center animate-stagger-up transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
                        style={{ animationDelay: `${0.15 + i * 0.07}s` }}
                      >
                        {real?.image_url ? (
                          <img src={real.image_url} alt={real.name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <Leaf className="h-5 w-5 text-white/70" />
                        )}
                        {p.due > 0 && (
                          <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-amber-400 text-[8px] font-bold text-white flex items-center justify-center shadow">
                            {p.due}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
                          <p className="text-[8px] text-white truncate font-medium">{real?.name || p.name}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-stone-700 dark:text-stone-200 uppercase tracking-wider">Today</p>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 animate-stagger-up" style={{ animationDelay: '0.7s' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bell className="h-3 w-3 text-emerald-600 animate-bounce-subtle" />
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Water Pothos</span>
                  </div>
                  <p className="text-[9px] text-stone-600 dark:text-stone-300">in 2 hours</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 animate-stagger-up" style={{ animationDelay: '0.85s' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sun className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Rotate Fern</span>
                  </div>
                  <p className="text-[9px] text-stone-600 dark:text-stone-300">tomorrow</p>
                </div>
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 animate-stagger-up" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Droplets className="h-3 w-3 text-blue-500" />
                    <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">Mist Calathea</span>
                  </div>
                  <p className="text-[9px] text-stone-600 dark:text-stone-300">Friday</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CursorParallax>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GET STARTED SECTION - Merged "How It Works" + "Beginner Friendly"
   One editorial moment: 3 numbered steps as the spine, with a quieter
   trio of beginner-friendly beats underneath. No mid-page CTA card —
   the page already has a Final CTA.
   ═══════════════════════════════════════════════════════════════════════════════ */
const GetStartedSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")

  const steps = [
    {
      num: "01",
      icon: Search,
      title: t("getStarted.step1.title", { defaultValue: t("howItWorks.step1.title", { defaultValue: "Snap a photo" }) }),
      description: t("getStarted.step1.description", { defaultValue: t("howItWorks.step1.description", { defaultValue: "Identify any plant in seconds — no botany degree needed." }) }),
    },
    {
      num: "02",
      icon: Sprout,
      title: t("getStarted.step2.title", { defaultValue: t("howItWorks.step2.title", { defaultValue: "Add it to your garden" }) }),
      description: t("getStarted.step2.description", { defaultValue: t("howItWorks.step2.description", { defaultValue: "We'll set up a care schedule based on your plant and your home." }) }),
    },
    {
      num: "03",
      icon: Bell,
      title: t("getStarted.step3.title", { defaultValue: t("howItWorks.step3.title", { defaultValue: "Get gentle reminders" }) }),
      description: t("getStarted.step3.description", { defaultValue: t("howItWorks.step3.description", { defaultValue: "Water, light, repot — only when it actually matters." }) }),
    },
  ]

  const beats = [
    {
      icon: GraduationCap,
      title: t("getStarted.beat1.title", { defaultValue: t("beginner.feature1Title", { defaultValue: "Built for first-timers" }) }),
      description: t("getStarted.beat1.description", { defaultValue: t("beginner.feature1Desc", { defaultValue: "Every term is plain English. No jargon, no shame." }) }),
    },
    {
      icon: Sparkles,
      title: t("getStarted.beat2.title", { defaultValue: t("beginner.feature2Title", { defaultValue: "An assistant on call" }) }),
      description: t("getStarted.beat2.description", { defaultValue: t("beginner.feature2Desc", { defaultValue: "Ask Aphylia anything — yellow leaves, pests, repotting." }) }),
    },
    {
      icon: Heart,
      title: t("getStarted.beat3.title", { defaultValue: "Forgive-as-you-grow" }),
      description: t("getStarted.beat3.description", { defaultValue: "Miss a day? We'll re-route the schedule. No streak shame." }),
    },
  ]

  return (
    <section id="how-it-works" className="py-12 lg:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Editorial header — kicker + tight headline + one supporting line */}
        <div className="max-w-3xl mb-10 lg:mb-16">
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-medium mb-3">
            {t("getStarted.kicker", { defaultValue: "Get started" })}
          </div>
          <h2 className="text-[1.875rem] sm:text-4xl lg:text-[3.25rem] font-bold tracking-tight text-stone-900 dark:text-white leading-[1.1] mb-4">
            {t("getStarted.titleA", { defaultValue: "From " })}
            <span className="italic text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30 decoration-2 underline-offset-[6px]">{t("getStarted.titleEm", { defaultValue: "first plant" })}</span>
            {t("getStarted.titleB", { defaultValue: " to thriving garden in three steps." })}
          </h2>
          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 max-w-xl leading-relaxed">
            {t("getStarted.subtitle", { defaultValue: "Most plant apps assume you already know what you're doing. We don't." })}
          </p>
        </div>

        {/* Steps — numbered list with scroll-reveal stagger and hover micro-interactions.
            Numbers grow + tilt slightly on hover; the connector line under each row
            sweeps emerald → transparent left-to-right. */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-10 mb-16 lg:mb-24">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative group animate-stagger-up"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div className="flex items-start gap-4">
                <span className="font-mono tabular-nums text-3xl lg:text-4xl font-bold text-emerald-500/30 dark:text-emerald-400/25 leading-none flex-shrink-0 transition-all duration-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:scale-110 before:content-['['] before:mr-0.5 before:opacity-50 after:content-[']'] after:ml-0.5 after:opacity-50">
                  {step.num}
                </span>
                <div className="pt-1">
                  <div className="inline-flex h-9 w-9 rounded-lg bg-emerald-500/10 items-center justify-center mb-3 transition-all duration-300 group-hover:bg-emerald-500 group-hover:rotate-6">
                    <step.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 transition-colors group-hover:text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-1.5">
                    {step.title}
                  </h3>
                  <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
              {/* Connector line — extends from the right edge toward the next step. */}
              {i < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-6 -right-4 lg:-right-6 h-[2px] w-6 lg:w-10 bg-gradient-to-r from-emerald-500/50 to-transparent rounded-full"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        {/* Supporting beats — text-only, no card chrome, no glow. Stagger-reveal. */}
        <div className="border-t border-stone-200/60 dark:border-stone-800/60 pt-10 lg:pt-12">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {beats.map((beat, i) => (
              <div
                key={i}
                className="flex items-start gap-3 animate-stagger-up"
                style={{ animationDelay: `${0.4 + i * 0.1}s` }}
              >
                <beat.icon className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5 transition-transform duration-300 hover:scale-110 hover:rotate-6" strokeWidth={1.75} />
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 dark:text-white mb-1">
                    {beat.title}
                  </h4>
                  <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    {beat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════════
   FEATURES SECTION - Bento Grid Style
   ═══════════════════════════════════════════════════════════════════════════════ */
const FeaturesSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")

  return (
    <section id="features" className="py-12 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 mb-6">
            <Zap className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t("features.badge", { defaultValue: "Powerful Features" })}
            </span>
          </div>
          <h2 className="text-[1.75rem] sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("features.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("features.subtitle")}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Large Feature Card */}
          <div className="md:col-span-2 lg:col-span-2 group relative rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent backdrop-blur-sm border border-emerald-500/20 p-8 overflow-hidden hover:border-emerald-500/40 transition-all duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="relative">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-emerald-500 items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <BookMarked className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-3">{t("features.smartLibrary.title")}</h3>
              <p className="text-stone-600 dark:text-stone-400 text-base leading-relaxed max-w-lg">{t("features.smartLibrary.description")}</p>
              
              {/* Mini preview */}
              <div className="mt-8 flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-400/20 border border-emerald-500/20 flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-emerald-500/50" />
                  </div>
                ))}
                <div className="h-16 w-16 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-stone-400">{t("floatingCards.morePlants", { defaultValue: "+10K" })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Care Reminders - Enhanced Card */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-blue-500 items-center justify-center mb-4 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{t("features.careReminders.title")}</h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">{t("features.careReminders.description")}</p>
            
            {/* Visual Preview - Mini Notification Stack */}
            <div className="space-y-2">
              {/* Notification 1 */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-blue-200/50 dark:border-blue-500/20 backdrop-blur-sm group-hover:translate-x-1 transition-transform">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Droplets className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">{t("features.careReminders.notification1Title")}</p>
                  <p className="text-[10px] text-stone-500">{t("features.careReminders.notification1Time")}</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
              
              {/* Notification 2 */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/40 dark:bg-white/5 border border-amber-200/50 dark:border-amber-500/20 backdrop-blur-sm group-hover:translate-x-1 transition-transform delay-75">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Sun className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">{t("features.careReminders.notification2Title")}</p>
                  <p className="text-[10px] text-stone-500">{t("features.careReminders.notification2Time")}</p>
                </div>
              </div>
              
              {/* Notification 3 - Faded */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/20 dark:bg-white/5 border border-emerald-200/30 dark:border-emerald-500/10 backdrop-blur-sm opacity-60 group-hover:translate-x-1 transition-transform delay-100">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Leaf className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">{t("features.careReminders.notification3Title")}</p>
                  <p className="text-[10px] text-stone-500">{t("features.careReminders.notification3Time")}</p>
                </div>
              </div>
            </div>
          </div>
          <FeatureCard icon={Camera} title={t("features.plantId.title")} description={t("features.plantId.description")} gradient="from-pink-500/10 to-rose-500/10" iconBg="bg-pink-500" />
          <FeatureCard icon={NotebookPen} title={t("features.journal.title")} description={t("features.journal.description")} gradient="from-amber-500/10 to-orange-500/10" iconBg="bg-amber-500" />
          
          {/* Wide Feature Card */}
          <div className="md:col-span-2 lg:col-span-2 group relative rounded-3xl bg-gradient-to-r from-purple-500/10 via-violet-500/5 to-transparent backdrop-blur-sm border border-purple-500/20 p-8 overflow-hidden hover:border-purple-500/40 transition-all duration-500">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-purple-500 items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Wifi className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">{t("features.pwa.title")}</h3>
                <p className="text-stone-600 dark:text-stone-400">{t("features.pwa.description")}</p>
              </div>
              <div className="flex gap-3 md:ml-auto">
                <div className="h-12 w-12 rounded-xl bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-stone-600 dark:text-stone-300" />
                </div>
                <div className="h-12 w-12 rounded-xl bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-stone-600 dark:text-stone-300" />
                </div>
              </div>
            </div>
          </div>

          <FeatureCard icon={BookMarked} title={t("features.collections.title")} description={t("features.collections.description")} gradient="from-teal-500/10 to-cyan-500/10" iconBg="bg-teal-500" />
        </div>
      </div>
    </section>
  )
})

const FeatureCard: React.FC<{
  icon: React.ElementType
  title: string
  description: string
  gradient: string
  iconBg: string
}> = ({ icon: Icon, title, description, gradient, iconBg }) => (
  <div className={`group relative rounded-3xl bg-gradient-to-br ${gradient} backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
    <div className={`inline-flex h-12 w-12 rounded-xl ${iconBg} items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{title}</h3>
    <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">{description}</p>
  </div>
)

/* ═══════════════════════════════════════════════════════════════════════════════
   LIVE TOUR SECTION - Replaces the spinning-wheel demo.
   One big device frame (browser on lg+, phone on < lg) cycles through 4
   feature screens. Each screen has its own bespoke motion (swipe gesture,
   stagger fill, notification stack, scan beam). Visitors can click the
   thumbnail tabs to switch manually; auto-advance pauses on hover.
   ═══════════════════════════════════════════════════════════════════════════════ */
type TourFeature = {
  id: 'discover' | 'garden' | 'care' | 'identify'
  label: string
  caption: string
  icon: React.ElementType
  accent: { bg: string; text: string; ring: string }
  // Per-feature dwell time. Some screens (notably Identify) need longer
  // because the scan animation runs ~1.6s and the result needs time to
  // be appreciated before the auto-advance fires.
  cycleMs?: number
}

// Auto-cycle pacing — short enough that visitors see every feature within
// ~12-13s of dwelling on the section. Each manual click resets the timer
// (see useEffect on `active` below) so the user always gets a full window
// to look at what they picked.
const TOUR_CYCLE_MS = 3500

const LiveTourSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")
  const { approvedPlants } = useLandingData()
  const [active, setActive] = React.useState(0)

  const features: TourFeature[] = React.useMemo(() => [
    {
      id: 'discover',
      label: t("liveTour.discover.label", { defaultValue: "Discover" }),
      caption: t("liveTour.discover.caption", { defaultValue: "Swipe through thousands of plants. Save the ones you love." }),
      icon: Heart,
      accent: { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/40' },
    },
    {
      id: 'garden',
      label: t("liveTour.garden.label", { defaultValue: "My Garden" }),
      caption: t("liveTour.garden.caption", { defaultValue: "Your plants in one place — watch your collection grow." }),
      icon: Sprout,
      accent: { bg: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400', ring: 'ring-lime-500/40' },
    },
    {
      id: 'care',
      label: t("liveTour.care.label", { defaultValue: "Reminders" }),
      caption: t("liveTour.care.caption", { defaultValue: "Smart, gentle nudges. Water, light, repot — only when needed." }),
      icon: Bell,
      accent: { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/40' },
    },
    {
      id: 'identify',
      label: t("liveTour.identify.label", { defaultValue: "Identify" }),
      caption: t("liveTour.identify.caption", { defaultValue: "Snap any plant. Get its name and care plan in seconds." }),
      icon: Camera,
      accent: { bg: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/40' },
      // Identify needs longer: scan ~1.6s + result pop ~0.7s = ~2.3s of intro
      // before there's anything for the visitor to read. Give it ~5.5s total.
      cycleMs: 5500,
    },
  ], [t])

  const current = features[active]
  const currentCycle = current.cycleMs ?? TOUR_CYCLE_MS

  // Auto-advance: schedule the next switch via setTimeout keyed on `active`.
  // Every state change (auto-fire OR manual tab click) cancels the pending
  // timeout and starts a fresh one — so the cycle never stalls and a manual
  // click gives the visitor a full window to look. Crucially we do NOT pause
  // on hover, because most desktop visitors hover the demo the whole time
  // they're reading it; pause-on-hover effectively froze the showcase.
  React.useEffect(() => {
    const id = setTimeout(() => {
      setActive((a) => (a + 1) % features.length)
    }, currentCycle)
    return () => clearTimeout(id)
  }, [active, currentCycle, features.length])

  const cycleStyle = { '--tour-cycle': `${currentCycle}ms` } as React.CSSProperties

  // Live-activity ticker items. Cycles through real approved plants when present
  // so the ticker references species the visitor will actually see in the demo.
  const tickerItems: Array<{ icon: React.ElementType; text: string }> = React.useMemo(() => {
    const names = approvedPlants.slice(0, 8).map((p) => p.name)
    const fallback = ['Monstera', 'Pothos', 'Snake Plant', 'Fern', 'Calathea', 'Anthurium']
    const pick = (i: number) => names[i] || fallback[i % fallback.length]
    return [
      { icon: Camera, text: `Sarah identified ${pick(0)}` },
      { icon: Heart, text: `Marcus saved 3 plants` },
      { icon: Sprout, text: `Lina added ${pick(1)} to her garden` },
      { icon: Sparkles, text: `Aphylia answered 124 care questions today` },
      { icon: Bell, text: `Sophie hit a 14-day care streak` },
      { icon: Droplets, text: `Watered ${pick(2)} on time` },
      { icon: Leaf, text: `New: ${pick(3)} in the encyclopedia` },
      { icon: BookMarked, text: `${pick(4)} added to Pet-Safe collection` },
    ]
  }, [approvedPlants])

  return (
    <section className="py-14 lg:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-emerald-50/30 to-transparent dark:via-emerald-950/20">
      <div className="max-w-6xl mx-auto">
        {/* Editorial header */}
        <div className="max-w-2xl mb-8 lg:mb-10 text-center mx-auto">
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-medium mb-3">
            {t("liveTour.kicker", { defaultValue: "A live tour" })}
          </div>
          <h2 className="text-[1.875rem] sm:text-4xl lg:text-[3rem] font-bold tracking-tight text-stone-900 dark:text-white leading-[1.1] mb-3">
            {t("liveTour.titleA", { defaultValue: "Watch the app " })}
            <span className="italic text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30 decoration-2 underline-offset-[6px]">{t("liveTour.titleEm", { defaultValue: "do its thing" })}</span>
            {t("liveTour.titleB", { defaultValue: "." })}
          </h2>
          {/* Caption swaps between features — keyed so it fades on switch. */}
          <p key={`caption-${current.id}`} className="animate-tour-screen-slide text-sm sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed">
            {current.caption}
          </p>
        </div>

        {/* Live-activity ticker — small, single line, signals "this app is alive". */}
        <div className="mb-6 lg:mb-8 mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-full border border-emerald-500/15 bg-white/40 dark:bg-white/[0.03] backdrop-blur-sm">
            {/* Edge fade masks */}
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white dark:from-stone-950 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white dark:from-stone-950 to-transparent z-10 pointer-events-none" />
            <div className="flex w-max animate-ticker-scroll py-1.5">
              {[...tickerItems, ...tickerItems].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-center gap-2 px-5 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/15">
                      <Icon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2.25} />
                    </span>
                    <span className="text-xs text-stone-600 dark:text-stone-400 font-medium">{item.text}</span>
                    <span className="text-emerald-500/40 mx-2">•</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Big device — phone on mobile, browser on desktop. */}
        <div className="relative mb-8 lg:mb-10">
          {/* PHONE — visible only on mobile */}
          <div className="lg:hidden mx-auto w-[280px] sm:w-[320px]">
            <div className="relative bg-gradient-to-b from-stone-700 to-stone-800 dark:from-stone-800 dark:to-stone-900 rounded-[2.6rem] p-[2px] shadow-2xl shadow-emerald-900/15 ring-1 ring-white/10">
              <div className="bg-stone-800 dark:bg-stone-900 rounded-[2.55rem] p-1.5">
                <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#0f1a14] dark:via-[#111714] dark:to-[#0a1510] rounded-[2.2rem] overflow-hidden aspect-[9/19]">
                  <div className="flex items-center justify-between px-7 pt-2.5 pb-0.5">
                    <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">9:41</span>
                    <div className="w-24 h-[26px] bg-stone-900 dark:bg-black rounded-full" />
                    <Wifi className="h-3 w-3 text-stone-400 dark:text-stone-500" />
                  </div>
                  <div key={current.id} className="animate-tour-screen-slide px-3 py-3 h-[calc(100%-2rem)]">
                    <TourScreen feature={current} compact />
                  </div>
                  <div className="absolute bottom-1.5 left-0 right-0 flex justify-center">
                    <div className="w-20 h-0.5 rounded-full bg-stone-300 dark:bg-stone-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BROWSER — visible only on desktop. Cursor parallax: tilt slightly with mouse. */}
          <CursorParallax className="hidden lg:block max-w-4xl mx-auto">
            <div className="rounded-2xl bg-stone-800 dark:bg-stone-900 shadow-2xl shadow-emerald-900/20 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-700/80 dark:bg-stone-800/80">
                <div className="h-3 w-3 rounded-full bg-rose-400/80" />
                <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <div className="ml-3 flex-1 h-6 rounded-md bg-stone-600/40 dark:bg-stone-700/60 flex items-center px-2.5 gap-1.5">
                  <Globe className="h-3 w-3 text-stone-300/70" />
                  <span className="text-[11px] text-stone-300/80 truncate">aphylia.app/{current.id}</span>
                </div>
              </div>
              <div key={current.id} className="animate-tour-screen-slide relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#0f1a14] dark:via-[#111714] dark:to-[#0a1510] aspect-[16/9]">
                <TourScreen feature={current} />
              </div>
            </div>
          </CursorParallax>
        </div>

        {/* Tabs with per-tab progress fill — visible feedback for the auto-advance.
            Active tab fills its bottom rule from 0→100% over the cycle, restarts
            when active changes (key=active+id forces re-mount of the bar). */}
        <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
          {features.map((f, i) => {
            const isActive = i === active
            const Icon = f.icon
            return (
              <button
                key={f.id}
                onClick={() => setActive(i)}
                className={`group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? `${f.accent.bg} text-white shadow-lg ring-2 ${f.accent.ring} ring-offset-2 ring-offset-white dark:ring-offset-stone-950 scale-105`
                    : 'bg-white/80 dark:bg-white/5 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 hover:border-emerald-500/40 hover:-translate-y-0.5 hover:bg-white dark:hover:bg-white/10'
                }`}
                aria-pressed={isActive}
              >
                <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : f.accent.text}`} strokeWidth={isActive ? 2.25 : 2} />
                <span className="text-sm font-semibold">{f.label}</span>
                {/* Per-tab progress fill — keyed on `active` so it restarts in
                    sync with the setTimeout that drives auto-advance. */}
                {isActive && (
                  <span
                    key={`progress-${active}`}
                    className="absolute left-0 bottom-0 h-0.5 bg-white/70 animate-tour-tab-progress"
                    style={cycleStyle}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
})

/* ─── CursorParallax — small mouse-follow tilt on a child container.
   Disabled on touch devices and reduced-motion preference. ───────────────── */
const CursorParallax: React.FC<{ children: React.ReactNode; className?: string; max?: number }> = ({
  children, className, max = 4,
}) => {
  const ref = React.useRef<HTMLDivElement>(null)

  const handleMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width   // 0..1
    const py = (e.clientY - r.top)  / r.height  // 0..1
    const rx = (0.5 - py) * max     // tilt X
    const ry = (px - 0.5) * max     // tilt Y
    el.style.setProperty('--tilt', `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`)
  }, [max])

  const handleLeave = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tilt', 'perspective(1200px) rotateX(0deg) rotateY(0deg)')
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transform: 'var(--tilt, perspective(1200px))', transition: 'transform 250ms ease-out', willChange: 'transform' }}
    >
      {children}
    </div>
  )
}

/* ─── TOUR SCREEN — bespoke animated content per feature ─────────────────── */
const TourScreen: React.FC<{ feature: TourFeature; compact?: boolean }> = ({ feature, compact }) => {
  if (feature.id === 'discover') return <DiscoverTourScreen compact={compact} />
  if (feature.id === 'garden') return <GardenTourScreen compact={compact} />
  if (feature.id === 'care') return <CareTourScreen compact={compact} />
  return <IdentifyTourScreen compact={compact} />
}

/* DISCOVER — a foreground card swipes right on a loop, a new card emerges behind it.
   Uses real approved plants when available, with gradient fallbacks. */
const DiscoverTourScreen: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { approvedPlants } = useLandingData()
  const fallbackGradients = [
    'from-emerald-300 to-teal-500',
    'from-lime-300 to-green-500',
    'from-green-300 to-emerald-500',
  ]
  const cards = [0, 1, 2].map((i) => {
    const plant = approvedPlants[i]
    return {
      name: plant?.name || ['Monstera Deliciosa', 'Philodendron', 'Pothos'][i],
      sub: plant?.scientific_name || ['Swiss cheese plant', 'Heartleaf', "Devil's ivy"][i],
      image: plant?.image_url,
      g: fallbackGradients[i],
    }
  })

  return (
    <div className={`relative h-full w-full flex items-center justify-center ${compact ? 'p-2' : 'p-6 lg:p-10'}`}>
      <div className={`relative ${compact ? 'w-44 h-56' : 'w-72 h-80 lg:w-80 lg:h-96'}`}>
        {/* Back stack — static, gives sense of more cards behind */}
        <div className="absolute inset-x-3 top-3 bottom-0 rounded-3xl bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-800 opacity-60" />
        <div className="absolute inset-x-1.5 top-1.5 bottom-0 rounded-3xl bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-800 opacity-80" />

        {/* Emerging card (becomes the next foreground) */}
        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${cards[1].g} shadow-lg overflow-hidden animate-tour-card-emerge`}>
          {cards[1].image ? (
            <img src={cards[1].image} alt={cards[1].name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Leaf className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${compact ? 'h-12 w-12' : 'h-20 w-20'} text-white/40`} />
          )}
          <div className={`absolute bottom-0 left-0 right-0 ${compact ? 'p-2' : 'p-4'}`}>
            <div className="rounded-xl bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm px-2.5 py-1.5">
              <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-bold text-stone-900 dark:text-white truncate`}>{cards[1].name}</p>
              <p className={`${compact ? 'text-[9px]' : 'text-xs'} italic text-stone-500 dark:text-stone-400 truncate`}>{cards[1].sub}</p>
            </div>
          </div>
        </div>

        {/* Foreground card swiping right */}
        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${cards[0].g} shadow-xl overflow-hidden animate-tour-swipe-right`}>
          {cards[0].image ? (
            <img src={cards[0].image} alt={cards[0].name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Leaf className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${compact ? 'h-14 w-14' : 'h-24 w-24'} text-white/50`} />
          )}
          <div className={`absolute top-2 right-2 ${compact ? 'h-6 w-6' : 'h-7 w-7'} rounded-full bg-emerald-500 flex items-center justify-center shadow-lg`}>
            <Heart className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-white fill-white`} />
          </div>
          <div className={`absolute bottom-0 left-0 right-0 ${compact ? 'p-2' : 'p-4'}`}>
            <div className="rounded-xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm px-2.5 py-1.5">
              <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-bold text-stone-900 dark:text-white truncate`}>{cards[0].name}</p>
              <p className={`${compact ? 'text-[9px]' : 'text-xs'} italic text-stone-500 dark:text-stone-400 truncate`}>{cards[0].sub}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`absolute ${compact ? '-bottom-9' : '-bottom-14'} left-1/2 -translate-x-1/2 flex gap-3`}>
          <div className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-md flex items-center justify-center`}>
            <span className={`${compact ? 'text-base' : 'text-xl'} text-rose-500 font-bold`}>×</span>
          </div>
          <div className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center`}>
            <Heart className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white fill-white`} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* GARDEN — real plant tiles fade-in with stagger; streak chip drops in last.
   Tries to use approved plant photos; falls back to gradient + leaf icon. */
const GardenTourScreen: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { approvedPlants } = useLandingData()
  const fallback = [
    { g: 'from-emerald-400 to-teal-500', name: 'Monstera' },
    { g: 'from-lime-400 to-green-500', name: 'Pothos' },
    { g: 'from-green-400 to-emerald-500', name: 'Snake' },
    { g: 'from-teal-400 to-cyan-500', name: 'Fern' },
    { g: 'from-emerald-500 to-green-600', name: 'Lily' },
    { g: 'from-green-500 to-teal-600', name: 'Calathea' },
    { g: 'from-amber-400 to-orange-500', name: 'Aloe' },
    { g: 'from-pink-400 to-rose-500', name: 'Anthurium' },
    { g: 'from-emerald-300 to-teal-400', name: 'Ivy' },
  ]
  const tiles = fallback.map((f, i) => {
    const plant = approvedPlants[i]
    return {
      g: f.g,
      name: plant?.name || f.name,
      image: plant?.image_url,
    }
  })
  const visible = compact ? tiles.slice(0, 6) : tiles
  return (
    <div className={`h-full w-full ${compact ? 'p-2' : 'p-6 lg:p-10'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        <div>
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-bold text-stone-900 dark:text-white`}>My Indoor Jungle</p>
          <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-stone-500 dark:text-stone-400`}>{visible.length} plants</p>
        </div>
        <span
          className={`${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold animate-tour-tile-in`}
          style={{ animationDelay: '1.8s' }}
        >
          🔥 7 day streak
        </span>
      </div>
      <div className={`grid ${compact ? 'grid-cols-3 gap-1.5' : 'grid-cols-3 gap-3'}`}>
        {visible.map((tile, i) => (
          <div
            key={i}
            className={`relative aspect-square rounded-xl bg-gradient-to-br ${tile.g} flex items-center justify-center overflow-hidden animate-tour-tile-in`}
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            {tile.image ? (
              <img src={tile.image} alt={tile.name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Leaf className={`${compact ? 'h-4 w-4' : 'h-6 w-6 lg:h-7 lg:w-7'} text-white/60`} />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
              <p className={`${compact ? 'text-[7px]' : 'text-[10px]'} text-white truncate font-medium`}>{tile.name}</p>
            </div>
          </div>
        ))}
      </div>
      <div
        className={`${compact ? 'mt-2 text-[9px] px-2 py-1' : 'mt-4 text-xs px-3 py-2'} rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5 animate-tour-tile-in`}
        style={{ animationDelay: '2.2s' }}
      >
        <CheckCircle2 className={`${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} text-emerald-500 flex-shrink-0`} />
        <span className="text-emerald-700 dark:text-emerald-300 font-medium">85% of today's tasks done</span>
      </div>
    </div>
  )
}

/* CARE — notifications stack in from the top with stagger. */
const CareTourScreen: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const items = [
    { icon: Droplets, color: 'bg-blue-500', text: 'Water Pothos', meta: 'in 2 hours', accent: 'border-blue-500/30 bg-blue-500/5' },
    { icon: Sun, color: 'bg-amber-500', text: 'Rotate Fern', meta: 'tomorrow', accent: 'border-amber-500/30 bg-amber-500/5' },
    { icon: Sprout, color: 'bg-emerald-500', text: 'Fertilize Monstera', meta: 'Friday', accent: 'border-emerald-500/30 bg-emerald-500/5' },
    { icon: NotebookPen, color: 'bg-purple-500', text: 'Log new growth', meta: 'next week', accent: 'border-purple-500/30 bg-purple-500/5' },
  ]
  return (
    <div className={`h-full w-full ${compact ? 'p-2' : 'p-6 lg:p-10'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        <div>
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-bold text-stone-900 dark:text-white`}>Today's care</p>
          <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-stone-500 dark:text-stone-400`}>4 reminders queued</p>
        </div>
        <Bell className={`${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-blue-500 animate-bounce-subtle`} />
      </div>
      <div className={`space-y-${compact ? '1.5' : '2.5'}`}>
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div
              key={i}
              className={`flex items-center gap-${compact ? '2' : '3'} ${compact ? 'p-2' : 'p-3'} rounded-xl border ${item.accent} animate-tour-notif-in`}
              style={{ animationDelay: `${i * 0.45}s` }}
            >
              <div className={`${compact ? 'h-7 w-7' : 'h-10 w-10'} rounded-lg ${item.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon className={`${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-semibold text-stone-900 dark:text-white truncate`}>{item.text}</p>
                <p className={`${compact ? 'text-[9px]' : 'text-xs'} text-stone-500 dark:text-stone-400`}>{item.meta}</p>
              </div>
              {i === 0 && (
                <span className={`${compact ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'} rounded-full bg-blue-500 text-white font-semibold`}>
                  due
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* IDENTIFY — scan beam sweeps the plant photo, then a result card pops in
   and stays visible for the rest of the tour dwell. The scan and result
   are one-shot animations (see CSS) so on each tab activation the user
   sees: scan ~1.5s, then result holds until the tour switches.
   Layout differs by viewport: mobile stacks (camera on top, result below);
   desktop puts a constrained camera left + a wider info panel right —
   matching how the real app shows plant detail next to the capture. */
const IdentifyTourScreen: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { approvedPlants } = useLandingData()
  const target = approvedPlants[0]
  const targetName = target?.name || 'Snake Plant'
  const targetSci = target?.scientific_name || 'Sansevieria trifasciata'
  const targetImage = target?.image_url

  // Camera viewport: an actual capture frame, NOT a giant hero.
  // Mobile keeps the original 4:3 stack; desktop is a constrained square.
  const CameraFrame = (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-300 via-green-400 to-teal-500 ${
      compact ? 'aspect-[4/3] w-full' : 'aspect-square w-full max-w-[260px] mx-auto'
    }`}>
      {targetImage ? (
        <img src={targetImage} alt={targetName} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Leaf className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${compact ? 'h-16 w-16' : 'h-20 w-20'} text-white/60`} />
      )}

      {/* Frame brackets */}
      <div className="absolute top-2.5 left-2.5 w-5 h-5 border-t-2 border-l-2 border-white/85 rounded-tl-md" />
      <div className="absolute top-2.5 right-2.5 w-5 h-5 border-t-2 border-r-2 border-white/85 rounded-tr-md" />
      <div className="absolute bottom-2.5 left-2.5 w-5 h-5 border-b-2 border-l-2 border-white/85 rounded-bl-md" />
      <div className="absolute bottom-2.5 right-2.5 w-5 h-5 border-b-2 border-r-2 border-white/85 rounded-br-md" />

      {/* Scan beam — one-shot (1.6s) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-x-0 bg-gradient-to-b from-transparent via-emerald-200 to-transparent shadow-[0_0_22px_rgba(16,185,129,0.85)] animate-tour-scan-beam"
          style={{ height: compact ? '32px' : '40px' }}
        />
      </div>

      {/* Status pill */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 ${compact ? 'text-[8px] px-2 py-0.5' : 'text-[10px] px-2.5 py-0.5'} rounded-full bg-black/55 text-white backdrop-blur-sm flex items-center gap-1.5`}>
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        <span>Scanning…</span>
      </div>
    </div>
  )

  // Result card — appears after scan and STAYS (animation-fill: forwards).
  const ResultCard = (
    <div className={`rounded-xl bg-white dark:bg-stone-900 border-2 border-emerald-500/40 shadow-lg animate-tour-result-pop ${compact ? 'p-2' : 'p-3.5'}`}>
      <div className="flex items-start gap-3">
        <div className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} rounded-lg overflow-hidden flex-shrink-0 ${targetImage ? '' : 'bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center'}`}>
          {targetImage ? (
            <img src={targetImage} alt={targetName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <Sprout className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`${compact ? 'text-[12px]' : 'text-sm'} font-bold text-stone-900 dark:text-white truncate`}>{targetName}</p>
            <span className={`${compact ? 'text-[8px] px-1.5' : 'text-[10px] px-1.5'} py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold flex-shrink-0`}>98%</span>
          </div>
          <p className={`${compact ? 'text-[9px]' : 'text-[11px]'} italic text-stone-500 dark:text-stone-400 mb-1.5 truncate`}>{targetSci}</p>
          <div className="flex flex-wrap gap-1">
            <span className={`${compact ? 'text-[8px] px-1' : 'text-[10px] px-1.5'} py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400`}>Easy</span>
            <span className={`${compact ? 'text-[8px] px-1' : 'text-[10px] px-1.5'} py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400`}>Low water</span>
            <span className={`${compact ? 'text-[8px] px-1' : 'text-[10px] px-1.5'} py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`}>Pet-safe</span>
          </div>
        </div>
      </div>
    </div>
  )

  if (compact) {
    // MOBILE: vertical stack — camera on top, result below
    return (
      <div className="h-full w-full p-2 flex flex-col gap-2">
        {CameraFrame}
        {ResultCard}
      </div>
    )
  }

  // DESKTOP: side-by-side — constrained camera left, info panel right
  return (
    <div className="h-full w-full px-6 py-5 lg:px-10 lg:py-8 grid grid-cols-2 gap-6 items-center">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-medium mb-2">
          Plant ID
        </div>
        {CameraFrame}
        <p className="mt-2 text-center text-[10px] text-stone-500 dark:text-stone-400">
          Drag a photo or use your camera
        </p>
      </div>
      <div className="space-y-3">
        {ResultCard}
        {/* Care preview rows — fade in alongside the result, completing the
            "scan → identified → here's what to do" narrative. */}
        <div className="rounded-xl border border-stone-200/70 dark:border-stone-700/60 bg-white/60 dark:bg-white/[0.03] p-3 animate-tour-result-pop" style={{ animationDelay: '1.7s' }}>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Care plan</p>
          <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 mb-1">
            <Droplets className="h-3 w-3 text-blue-500" />
            <span>Water every 2-3 weeks</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
            <Sun className="h-3 w-3 text-amber-500" />
            <span>Bright indirect light</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHOWCASE SECTION - Realistic UI Previews matching actual app components
   Fully configurable via Admin Panel
   ═══════════════════════════════════════════════════════════════════════════════ */
const ShowcaseSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")
  const { showcaseConfig } = useLandingData()

  // Generate default calendar (last 30 days, all completed)
  const defaultCalendar = React.useMemo((): CalendarDay[] => {
    const days: CalendarDay[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      days.push({
        date: date.toISOString().split('T')[0],
        status: 'completed'
      })
    }
    return days
  }, [])

  // Default values if config is not loaded
  const rawConfig = showcaseConfig || {
    garden_name: "My Indoor Jungle",
    plants_count: 12,
    species_count: 8,
    streak_count: 7,
    progress_percent: 85,
    cover_image_url: null,
    tasks: [
      { id: '1', text: "Water your Pothos", completed: true },
      { id: '2', text: "Fertilize Monstera", completed: false },
      { id: '3', text: "Mist your Fern", completed: false },
    ],
    members: [
      { id: '1', name: "Sophie", role: 'owner' as const, avatar_url: null, color: "#10b981" },
      { id: '2', name: "Marcus", role: 'member' as const, avatar_url: null, color: "#3b82f6" },
    ],
    plant_cards: [
      { id: '1', plant_id: null, name: "Monstera", image_url: null, gradient: "from-emerald-400 to-teal-500", tasks_due: 1 },
      { id: '2', plant_id: null, name: "Pothos", image_url: null, gradient: "from-lime-400 to-green-500", tasks_due: 2 },
      { id: '3', plant_id: null, name: "Snake Plant", image_url: null, gradient: "from-green-400 to-emerald-500", tasks_due: 0 },
      { id: '4', plant_id: null, name: "Fern", image_url: null, gradient: "from-teal-400 to-cyan-500", tasks_due: 0 },
      { id: '5', plant_id: null, name: "Peace Lily", image_url: null, gradient: "from-emerald-500 to-green-600", tasks_due: 0 },
      { id: '6', plant_id: null, name: "Calathea", image_url: null, gradient: "from-green-500 to-teal-600", tasks_due: 0 },
    ],
    completion_rate: 92,
    analytics_streak: 14,
    chart_data: [3, 5, 2, 6, 4, 5, 6],
    calendar_data: defaultCalendar,
  }

  // Calculate plants_count from plant_cards length (auto-calculated)
  const config = {
    ...rawConfig,
    plants_count: rawConfig.plant_cards?.length || rawConfig.plants_count || 0,
  }

  // Use calendar_data from config or default
  const calendarData = config.calendar_data?.length > 0 ? config.calendar_data : defaultCalendar

  // Generate chart points from config data
  const chartPoints = React.useMemo(() => {
    const data = config.chart_data.length === 7 ? config.chart_data : [3, 5, 2, 6, 4, 5, 6]
    const maxVal = Math.max(...data, 1)
    return data.map((val, i) => {
      const x = (i / 6) * 280
      const y = 70 - (val / maxVal) * 60
      return [x, y]
    })
  }, [config.chart_data])

  const chartPath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ')
  const areaPath = `${chartPath} L 280,80 L 0,80 Z`

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <section className="py-12 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-stone-100/50 to-transparent dark:via-stone-900/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-16">
          <h2 className="text-[1.75rem] sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("showcase.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("showcase.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Garden Dashboard Card */}
          <div className="md:col-span-2 md:row-span-2 group relative rounded-[32px] overflow-hidden border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur shadow-[0_35px_95px_-45px_rgba(15,23,42,0.65)]">
            {/* Hero Section with optional cover image */}
            <div className="relative overflow-hidden">
              {config.cover_image_url ? (
                <>
                  <div className="absolute inset-0">
                    <img src={config.cover_image_url} alt={config.garden_name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                  </div>
                  <div className="relative z-10 p-6 md:p-8 min-h-[200px] flex flex-col justify-end">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                      <div className="space-y-3">
                        <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                          {config.garden_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <span className="text-base">🌱</span>
                            <span className="font-semibold text-white text-sm">{config.plants_count}</span>
                            <span className="text-xs text-white/80">plants</span>
                          </div>
                          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <span className="text-base">🔥</span>
                            <span className="font-semibold text-white text-sm">{config.streak_count}</span>
                            <span className="text-xs text-white/80">day streak</span>
                          </div>
                          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <span className="text-base">🌿</span>
                            <span className="font-semibold text-white text-sm">{config.species_count}</span>
                            <span className="text-xs text-white/80">species</span>
                          </div>
                        </div>
                      </div>
                      {/* Progress Ring */}
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                            <circle cx="32" cy="32" r="26" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(config.progress_percent / 100) * 163.4} 163.4`} className="drop-shadow-lg" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-bold text-white">{config.progress_percent}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50 dark:from-[#1a2e1a] dark:via-[#1a1a1a] dark:to-[#2a1f0a]">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-3xl" />
                  <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-3xl" />
                  <div className="relative z-10 p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-3">
                        <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                          {config.garden_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-emerald-200/50 dark:border-emerald-500/20">
                            <span className="text-base">🌱</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">{config.plants_count}</span>
                            <span className="text-xs text-stone-600 dark:text-stone-300">plants</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-orange-200/50 dark:border-orange-500/20">
                            <span className="text-base">🔥</span>
                            <span className="font-semibold text-orange-600 dark:text-orange-400 text-sm">{config.streak_count}</span>
                            <span className="text-xs text-stone-600 dark:text-stone-300">day streak</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-stone-200/50 dark:border-stone-500/20">
                            <span className="text-base">🌿</span>
                            <span className="font-semibold text-stone-700 dark:text-stone-300 text-sm">{config.species_count}</span>
                            <span className="text-xs text-stone-600 dark:text-stone-300">species</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" className="text-stone-200 dark:text-stone-700" strokeWidth="6" />
                            <circle cx="32" cy="32" r="26" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(config.progress_percent / 100) * 163.4} 163.4`} className="drop-shadow-sm" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{config.progress_percent}%</span>
                          </div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs text-stone-500 dark:text-stone-400">Today's progress</div>
                          <div className="font-semibold text-stone-700 dark:text-stone-200 text-sm">{Math.round(config.plants_count * config.progress_percent / 100)}/{config.plants_count} tasks</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Members Section */}
            {config.members.length > 0 && (
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">👥</span>
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-400">Garden members ({config.members.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {config.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 px-2 py-1 rounded-full bg-stone-100 dark:bg-stone-800">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs text-stone-700 dark:text-stone-300">{member.name}</span>
                      {member.role === 'owner' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{t("showcase.owner")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plants Gallery */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <span>🌿</span> Plants in Garden
                </h4>
                <span className="text-xs text-stone-500">{config.plants_count} plants</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {config.plant_cards.slice(0, 6).map((plant) => (
                  <div key={plant.id} className="relative aspect-square rounded-2xl overflow-hidden group/plant">
                    {plant.image_url ? (
                      <img src={plant.image_url} alt={plant.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover/plant:scale-110 transition-transform" />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${plant.gradient}`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Leaf className="h-6 w-6 text-white/60" />
                        </div>
                      </div>
                    )}
                    {plant.tasks_due > 0 && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg">
                        {plant.tasks_due}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                      <span className="text-[9px] text-white font-medium truncate block">{plant.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last 30 Days Calendar */}
            <div className="p-5 border-t border-stone-200/50 dark:border-stone-700/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <Calendar className="h-4 w-4" /> {t("showcase.last30Days")}
                </h4>
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-stone-500">{t("showcase.completed")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-stone-300 dark:bg-stone-600" />
                    <span className="text-stone-500">{t("showcase.missed")}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {calendarData.map((day) => {
                  const date = new Date(day.date)
                  const dayNum = date.getDate()
                  const isToday = day.date === new Date().toISOString().split('T')[0]
                  
                  return (
                    <div
                      key={day.date}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-medium ${
                        day.status === 'completed' 
                          ? 'bg-emerald-500 text-white' 
                          : day.status === 'missed'
                          ? 'bg-stone-300 dark:bg-stone-600 text-stone-600 dark:text-stone-300'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                      } ${isToday ? 'ring-2 ring-emerald-400 ring-offset-1 dark:ring-offset-stone-900' : ''}`}
                      title={day.date}
                    >
                      {dayNum}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Badge */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white text-xs font-medium backdrop-blur-sm shadow-lg">
                <Globe className="h-3 w-3" />
                Garden Dashboard
              </span>
            </div>
          </div>

          {/* Tasks Card */}
          <div className="group rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1 dark:bg-stone-900/50">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
                {config.tasks.filter(t => !t.completed).length} plants need attention
              </span>
            </div>
            <p className="font-semibold text-stone-900 dark:text-white mb-3">{t("showcase.tasksReminder", { defaultValue: "Today's Tasks" })}</p>
            
            <div className="space-y-2">
              {config.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 dark:bg-white/5 border border-blue-500/10">
                  {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <CircleDot className="h-4 w-4 text-blue-500" />
                  )}
                  <span className={`text-xs ${task.completed ? 'text-stone-600 dark:text-stone-400 line-through' : 'text-stone-700 dark:text-stone-300'}`}>
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Analytics Card */}
          <div className="group rounded-[28px] bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur border border-stone-200/70 dark:border-[#3e3e42]/70 p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                <span className="font-semibold text-stone-900 dark:text-white text-sm">{t("showcase.analyticsTitle", { defaultValue: "Analytics" })}</span>
              </div>
              <div className="flex bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
                <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-white dark:bg-stone-700 shadow-sm text-emerald-600 dark:text-emerald-400">{t("showcase.overview")}</span>
                <span className="px-2 py-1 text-[10px] font-medium text-stone-500">{t("showcase.tasks")}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-[20px] bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-3 relative overflow-hidden border border-stone-200/50 dark:border-stone-700/50">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 mb-1">
                    <Target className="w-3 h-3" />
                    <span>{t("showcase.completionRate")}</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{config.completion_rate}%</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500">+8%</span>
                    <span className="text-[9px] text-stone-400">{t("showcase.vsLastWeek")}</span>
                  </div>
                </div>
              </div>
              
              <div className="rounded-[20px] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-3 relative overflow-hidden border border-stone-200/50 dark:border-stone-700/50">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-1 text-[10px] text-orange-700 dark:text-orange-300 mb-1">
                    <Flame className="w-3 h-3" />
                    <span>{t("showcase.currentStreak")}</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{config.analytics_streak}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">{t("showcase.bestStreak")}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] bg-stone-50 dark:bg-stone-800/50 p-3 border border-stone-200/50 dark:border-stone-700/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-stone-600 dark:text-stone-400 flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3" />
                  Activity History
                </span>
                <span className="text-[9px] text-stone-400">Last 7 days</span>
              </div>
              
              <div className="relative h-20">
                <svg viewBox="0 0 280 80" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="showcaseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#showcaseAreaGradient)" />
                  <path d={chartPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {chartPoints.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="3" fill="#10b981" className="drop-shadow-sm" />
                  ))}
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 -mb-4">
                  {dayLabels.map((d, i) => (
                    <span key={i} className="text-[8px] text-stone-400">{d}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-200/50 dark:border-stone-700/50">
              <div className="flex gap-3">
                {[
                  { color: 'bg-blue-500', label: 'Water', count: 12 },
                  { color: 'bg-green-500', label: 'Fertilize', count: 4 },
                  { color: 'bg-amber-500', label: 'Other', count: 3 },
                ].map(({ color, label, count }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-[9px] text-stone-600 dark:text-stone-400">{label}</span>
                    <span className="text-[9px] font-medium text-stone-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pet Safety Card */}
          <div className="group rounded-3xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 backdrop-blur-sm border border-rose-500/20 p-6 hover:border-rose-500/40 transition-all duration-300 hover:-translate-y-1 dark:bg-stone-900/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">{t("showcase.toxicityAlert")}</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <PawPrint className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="font-semibold text-stone-900 dark:text-white text-sm">{t("showcase.petWarning")}</p>
                <p className="text-xs text-stone-600 dark:text-stone-400">{t("showcase.petWarningText")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <Shield className="h-4 w-4 text-rose-500" />
              <span className="text-xs text-rose-600 dark:text-rose-400">{t("showcase.keepAwayFromPets")}</span>
            </div>
          </div>

          {/* Encyclopedia Card */}
          <div className="md:col-span-2 group rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-sm border border-amber-500/20 p-6 hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1 dark:bg-stone-900/50">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                  <BookMarked className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-stone-900 dark:text-white mb-1">{t("showcase.encyclopediaTitle", { defaultValue: "Plant Encyclopedia" })}</p>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">{t("showcase.encyclopediaText", { defaultValue: "10,000+ species with care guides" })}</p>
                
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60 dark:bg-white/5 border border-amber-500/20 max-w-md">
                  <Search className="h-4 w-4 text-stone-400" />
                  <span className="text-sm text-stone-400">{t("showcase.encyclopediaSearch", { defaultValue: "Search any plant..." })}</span>
                </div>
              </div>
              <div className="flex gap-2 md:ml-auto">
                {[Leaf, Flower2, TreeDeciduous, Sprout].map((Icon, i) => (
                  <div key={i} className="h-10 w-10 rounded-xl bg-white/60 dark:bg-white/5 border border-amber-500/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════════
   TESTIMONIALS - Redesigned with Marquee
   ═══════════════════════════════════════════════════════════════════════════════ */
const TestimonialsSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")
  const { testimonials: dbTestimonials } = useLandingData()

  // Use database testimonials if available, otherwise fallback to translations
  const rawTestimonials = t("testimonials.items", { returnObjects: true })
  const fallbackTestimonials = Array.isArray(rawTestimonials) 
    ? rawTestimonials as Array<{ name: string; role: string; quote: string }> 
    : []

  const testimonials = dbTestimonials.length > 0 
    ? dbTestimonials.map(t => ({
        name: t.author_name,
        role: t.author_role || "",
        quote: t.quote,
        rating: t.rating,
      }))
    : fallbackTestimonials.map(t => ({ ...t, rating: 5 }))

  if (testimonials.length === 0) return null

  return (
    <section className="py-12 lg:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-16">
          <h2 className="text-[1.75rem] sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("testimonials.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("testimonials.subtitle")}
          </p>
        </div>
      </div>

      {/* Marquee Container */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-emerald-50 dark:from-[#0a0f0a] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-emerald-50 dark:from-[#0a0f0a] to-transparent z-10" />
        
        <div className="flex animate-marquee">
          {[...testimonials, ...testimonials].map((testimonial, i) => (
            <div key={i} className="flex-shrink-0 w-[350px] mx-3">
              <div className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm p-6 h-full hover:shadow-xl transition-shadow">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star 
                      key={j} 
                      className={`h-4 w-4 ${j < (testimonial.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`} 
                    />
                  ))}
                </div>
                <p className="text-stone-700 dark:text-stone-300 text-sm mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900 dark:text-white text-sm">{testimonial.name}</p>
                    <p className="text-stone-500 dark:text-stone-400 text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════════
   FAQ SECTION - Redesigned
   ═══════════════════════════════════════════════════════════════════════════════ */
const FAQSection: React.FC = React.memo(() => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)
  const { t } = useTranslation("Landing")
  const { faqItems: dbFaqItems } = useLandingData()

  // Use database FAQ items if available, otherwise fallback to translations
  const rawFaqs = t("faq.items", { returnObjects: true })
  const fallbackFaqs = Array.isArray(rawFaqs) ? rawFaqs as Array<{ q: string; a: string }> : []

  const faqs = dbFaqItems.length > 0 
    ? dbFaqItems.map(f => ({ q: f.question, a: f.answer }))
    : fallbackFaqs

  if (faqs.length === 0) return null

  return (
    <section id="faq" className="py-12 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10 lg:mb-16">
          <h2 className="text-[1.75rem] sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("faq.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("faq.subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm overflow-hidden hover:border-emerald-500/30 transition-colors">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
                aria-expanded={openIndex === i}
              >
                <span className="font-semibold text-stone-900 dark:text-white pr-4">{faq.q}</span>
                <div className={`h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}>
                  <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openIndex === i ? 'max-h-96' : 'max-h-0'}`}>
                <p className="px-6 pb-5 text-stone-600 dark:text-stone-400 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Support CTA - Enhanced with Vibrant Gradients */}
        <div className="mt-16">
          <div className="relative rounded-[32px] overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-pink-500/30 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-purple-500/30 via-transparent to-transparent" />
            
            {/* Glowing orbs */}
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-emerald-400/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-cyan-400/30 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl" />
            
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
            
            <div className="relative z-10 p-8 lg:p-12">
              <div className="text-center max-w-2xl mx-auto space-y-8">
                {/* Icon with glow */}
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-white/30 rounded-3xl blur-xl scale-150" />
                  <div className="relative inline-flex h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 items-center justify-center shadow-2xl">
                    <HandHeart className="h-10 w-10 text-white drop-shadow-lg" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-3xl lg:text-4xl font-bold text-white drop-shadow-lg">
                    {t("faq.supportTitle", { defaultValue: "We're here to help!" })}
                  </h3>
                  <p className="text-white/90 text-lg max-w-xl mx-auto">
                    {t("faq.supportSubtitle", { defaultValue: "Questions, feedback, or just want to say hi? We'd love to connect with fellow plant enthusiasts!" })}
                  </p>
                </div>

                {/* Social Links - Glass morphism cards */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <a
                    href="https://instagram.com/aphylia_app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold hover:bg-white/20 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-300"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-500/50 to-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
                      <Instagram className="h-5 w-5 text-white" />
                    </div>
                    <span className="relative">Instagram</span>
                  </a>
                  <a
                    href="https://twitter.com/aphylia_app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold hover:bg-white/20 hover:scale-105 hover:shadow-2xl hover:shadow-sky-500/20 transition-all duration-300"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500/50 to-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
                      <Twitter className="h-5 w-5 text-white" />
                    </div>
                    <span className="relative">Twitter</span>
                  </a>
                  <a
                    href="mailto:hello@aphylia.app"
                    className="group relative flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold hover:bg-white/20 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/50 to-orange-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Mail className="h-5 w-5 text-white" />
                    </div>
                    <span className="relative">{t("faq.emailUs", { defaultValue: "Email Us" })}</span>
                  </a>
                </div>

                <div className="pt-6">
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white font-medium hover:bg-white/30 transition-all group"
                  >
                    {t("faq.supportButton", { defaultValue: "Contact Support" })}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════════
   APHYDLE SISTER-APP CARD - compact cross-link to the daily plant guessing game
   Sized intentionally smaller than the main CTAs since Aphydle is a side project.
   ═══════════════════════════════════════════════════════════════════════════════ */
const AphydleSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")
  const aphydleUrl = React.useMemo(() => getAphydleUrl(), [])

  const eyebrow = t("aphydle.eyebrow", { defaultValue: "From the Aphylia team" })
  const title = t("aphydle.title", { defaultValue: "Aphydle" })
  const tagline = t("aphydle.tagline", { defaultValue: "Daily plant guessing game" })
  const description = t("aphydle.description", {
    defaultValue:
      "A new mystery plant every day. Use progressive botanical clues — foliage, habitat, family — to guess the species before you run out of tries.",
  })
  const cta = t("aphydle.cta", { defaultValue: "Play Aphydle" })
  const tease = t("aphydle.tease", { defaultValue: "Can you guess what's growing today?" })

  // Show the URL as it appears in the browser address bar (host only, no scheme)
  // so the favicon-flanked tab preview reads naturally.
  const aphydleHostLabel = React.useMemo(() => {
    try { return new URL(aphydleUrl).host } catch { return "aphydle" }
  }, [aphydleUrl])

  // Decorative pixel-plant strip — five plants in a procession of growth stages
  // mixed across the three available sprite sheets. The last slot is left as
  // "???" to tease that today's plant could be anything.
  const teaseSprites: Array<{ name: "Growing_Plant_00" | "Growing_Plant_01" | "Growing_Plant_03"; state: number }> = [
    { name: "Growing_Plant_00", state: 0 },
    { name: "Growing_Plant_01", state: 1 },
    { name: "Growing_Plant_00", state: 2 },
    { name: "Growing_Plant_03", state: 3 },
  ]

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <a
          href={aphydleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block no-underline"
          aria-label={`${title} — ${tagline}`}
        >
          <div className="relative overflow-hidden rounded-3xl border border-stone-200/70 dark:border-stone-800/70 bg-white/70 dark:bg-stone-900/60 backdrop-blur-sm shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
            {/* Subtle accent gradient (violet/emerald) to set Aphydle apart from the main palette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-emerald-500/[0.06]" />
            <div className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />

            <div className="relative p-6 sm:p-8">
              {/* Top row: logo + text + CTA */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Logo block — official Aphydle brand mark */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-emerald-500/30 rounded-2xl blur-lg group-hover:from-violet-500/40 group-hover:to-emerald-500/40 transition-colors" />
                  <div className="relative h-20 w-20 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex items-center justify-center shadow-sm">
                    <img
                      src={APHYDLE_LOGO_URL}
                      alt="Aphydle"
                      className="h-16 w-16 object-contain rounded-xl"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                    <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-stone-950">
                      <Gamepad2 className="h-3.5 w-3.5 text-white" />
                    </span>
                  </div>
                </div>

                {/* Text + browser-tab style URL preview (favicon flanks the host) */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    {eyebrow}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2 justify-center sm:justify-start flex-wrap">
                    <span className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white lowercase">
                      {title}
                    </span>
                    <span className="text-sm text-stone-500 dark:text-stone-400">
                      · {tagline}
                    </span>
                  </div>
                  <p className="mt-2 text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                    {description}
                  </p>
                  {/* Browser-tab style URL chip — Aphydle favicon next to the host */}
                  <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800/70 border border-stone-200/70 dark:border-stone-700/70 text-xs text-stone-600 dark:text-stone-300 font-mono">
                    <img
                      src={APHYDLE_LOGO_URL}
                      alt=""
                      className="h-3.5 w-3.5 object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      aria-hidden="true"
                    />
                    <span className="truncate">{aphydleHostLabel}</span>
                  </div>
                </div>

                {/* CTA */}
                <div className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-sm font-semibold shadow-sm group-hover:bg-stone-800 dark:group-hover:bg-stone-100 transition-colors">
                  {cta}
                  <ExternalLink className="h-4 w-4 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Pixel-plant tease strip — growth-stage procession + a hidden "today's plant" */}
              <div className="mt-6 pt-5 border-t border-stone-200/70 dark:border-stone-800/70 flex items-center gap-4 sm:gap-6 justify-center sm:justify-start">
                <div
                  className="flex items-end gap-3 sm:gap-4"
                  aria-hidden="true"
                >
                  {teaseSprites.map((s, i) => (
                    <PixelSprite
                      key={`${s.name}-${i}`}
                      name={s.name}
                      state={s.state}
                      scale={3}
                      className="aphydle-tease-sprite"
                    />
                  ))}
                  {/* Mystery plant: a real sprite turned into a silhouette with a "?" overlay */}
                  <div className="relative inline-flex items-end justify-center">
                    <PixelSprite
                      name="Growing_Plant_03"
                      state={3}
                      scale={3}
                      className="aphydle-tease-sprite aphydle-tease-mystery"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white drop-shadow">
                      ?
                    </span>
                  </div>
                </div>
                <span className="text-sm text-stone-500 dark:text-stone-400 italic">
                  {tease}
                </span>
              </div>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════════
   FINAL CTA - Slim banner. The page already sold the user; this is the close.
   ═══════════════════════════════════════════════════════════════════════════════ */
const FinalCTASection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")

  const title = t("finalCta.titleShort", { defaultValue: t("finalCta.title", { defaultValue: "Ready when you are." }) })
  const primaryButtonText = t("finalCta.ctaDownload", { defaultValue: "Start growing" })

  return (
    <section className="py-10 lg:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-2xl lg:rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600">
          <div className="relative px-6 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex h-12 w-12 rounded-xl bg-white/15 items-center justify-center flex-shrink-0">
                <Leaf className="h-6 w-6 text-white" strokeWidth={1.75} />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-[1.75rem] font-semibold text-white tracking-tight leading-tight text-center sm:text-left">
                {title}
              </h2>
            </div>
            <Link
              to="/download"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-700 text-sm font-semibold hover:bg-white/95 transition-all shadow-lg hover:shadow-xl flex-shrink-0"
            >
              {primaryButtonText}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
})

export default LandingPage
