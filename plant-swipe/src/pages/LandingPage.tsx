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
  Check,
  Star,
  Sparkles,
  ArrowRight,
  Shield,
  Heart,
  TrendingUp,
  Globe,
  Bookmark,
  Share2,
  Thermometer,
  ChevronLeft,
  Plus,
  Smartphone,
  Tv,
  Monitor,
  Sprout,
  Instagram,
  Twitter,
  Mail,
  GraduationCap,
  HandHeart,
  Search,
  CheckCircle2,
  CircleDot,
  Target,
  Flame,
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

/* ─── PlantImage — wrapper around <img> with a built-in skeleton shimmer
   that crossfades to the photo on load. Use everywhere a real plant image
   is rendered so the page reads as "loading" instead of "broken" while
   bytes come in. Falls back gracefully when src is null/empty. ──────── */
const PlantImage: React.FC<{
  src?: string | null
  alt: string
  className?: string
  /** Use eager loading for above-the-fold critical images (hero). */
  eager?: boolean
  /** Optional fallback rendered when src is missing — typically a leaf icon. */
  fallback?: React.ReactNode
}> = React.memo(({ src, alt, className = "absolute inset-0 w-full h-full object-cover", eager = false, fallback = null }) => {
  const [loaded, setLoaded] = React.useState(false)

  // If src is missing entirely, render fallback only — no skeleton (which
  // would imply something is on its way).
  if (!src) {
    return <>{fallback}</>
  }

  return (
    <>
      {/* Skeleton shimmer — sits behind the <img> and is hidden once it loads.
          Uses the existing tailwind animate-shimmer (backgroundPosition cycle)
          on a horizontal stone-tinted gradient so it reads as a placeholder
          surface, not decoration. */}
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-stone-200/80 via-stone-100/60 to-stone-200/80 dark:from-stone-800/80 dark:via-stone-700/60 dark:to-stone-800/80 bg-[length:200%_100%] animate-shimmer"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  )
})

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

        // Warm the browser cache: as soon as the URLs are known, fire off
        // Image() requests so the bytes are already in transit by the time
        // each <img> mounts. This eliminates the "text first, photos pop in
        // a moment later" flash. Hero image (slot 0) is requested first.
        if (typeof window !== "undefined" && approvedPlants.length > 0) {
          // Defer slightly so we don't compete with the initial paint.
          requestAnimationFrame(() => {
            for (const p of approvedPlants) {
              const preload = new Image()
              preload.decoding = "async"
              preload.src = p.image_url
            }
          })
        }
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

/* ─── LiveJoinAvatars — conveyor-belt of "people just joining". A new
   avatar slides in from the LEFT, pushing the row to the right; the
   rightmost one fades off the edge. New arrivals show their first name
   for a beat, then collapse to just the initial. The cadence is
   randomized (1.8–4.5s) so it doesn't feel metronomic.

   Implemented with absolute positioning + CSS transition on `transform`
   so each avatar smoothly transitions from slot N to slot N+1 when a
   new one is inserted. New avatars start at slot=-1 (off-canvas left,
   opacity 0) and animate to slot=0 on the next frame; leaving avatars
   exit at slot=SLOTS and are removed after the transition. ──────── */
const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-teal-500',  'bg-lime-500',     'bg-rose-500',
  'bg-amber-500',   'bg-violet-500','bg-sky-500',      'bg-pink-500',
  'bg-cyan-500',    'bg-orange-500','bg-indigo-500',   'bg-fuchsia-500',
  'bg-green-500',   'bg-blue-500',  'bg-yellow-500',   'bg-purple-500',
]
// Mixed pool of common English + French first names. Letter for the
// avatar comes from name[0], so the visual letter is always tied to a
// real-feeling name.
const AVATAR_NAMES = [
  // English
  'Sarah', 'Mark', 'Liam', 'Olivia', 'Emma', 'James', 'Ava', 'Henry',
  'Charlotte', 'Daniel', 'Emily', 'Lucas', 'Sophia', 'Owen', 'Mia',
  'Noah', 'Hannah', 'Oscar', 'Zoe', 'Grace', 'Ben', 'Ruby',
  // French
  'Léa', 'Hugo', 'Camille', 'Louis', 'Manon', 'Julien', 'Chloé',
  'Théo', 'Inès', 'Antoine', 'Margaux', 'Élodie', 'Pierre', 'Justine',
  'Romain', 'Clara', 'Nicolas', 'Amélie', 'Maxime', 'Yasmine',
]

type Avatar = {
  id: number
  letter: string
  color: string
  slot: number       // -1 = entering off-left; 0..SLOTS-1 = visible; SLOTS = leaving off-right
}

type JoinToast = { id: number; name: string; variantIdx: number }

const SLOT_OFFSET = 22   // px between avatar centers (creates an 8px overlap on a 28px circle)
const AVATAR_SIZE = 28
const TRANSITION_MS = 700
const TOAST_LIFETIME_MS = 3200
const SLOTS = 4
// Probability that a given avatar swap also surfaces a "X just joined"
// toast. Higher than before — at 0.22 the row could go 30–50s between
// toasts, long enough that visitors often missed any. With cadence at
// 6–12s and probability 0.6, a visitor sees a toast every 10–20s on
// average, which is rare enough to feel like an event but reliable
// enough that nobody scrolls past without seeing one. The very first
// tick after mount uses a near-certain probability so the row visibly
// announces itself the moment the visitor arrives.
const TOAST_PROBABILITY = 0.6

// Gardening-flavored copy variants for the join toast. Picked at random
// each time a toast fires so the surfacing reads as varied real activity
// instead of the same "X just joined" line on repeat. Rendered as
// `${prefix}{name}${suffix}` — name is bolded inside the toast.
const JOIN_TOAST_VARIANTS: Array<{ prefix?: string; suffix: string }> = [
  { suffix: " just joined" },
  { suffix: " entered the community" },
  { suffix: " is growing their first garden" },
  { suffix: " is starting their plant journey" },
  { prefix: "Welcome ", suffix: " 🌱" },
]

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
const makeAvatar = (id: number, slot: number): { avatar: Avatar; name: string } => {
  const name = pick(AVATAR_NAMES)
  return {
    avatar: {
      id,
      letter: name.charAt(0).toUpperCase(),
      color: pick(AVATAR_COLORS),
      slot,
    },
    name,
  }
}

const LiveJoinAvatars: React.FC = () => {
  const nextId = React.useRef(SLOTS)
  const [avatars, setAvatars] = React.useState<Avatar[]>(() =>
    Array.from({ length: SLOTS }, (_, i) => makeAvatar(i, i).avatar)
  )
  const [toast, setToast] = React.useState<JoinToast | null>(null)

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let nextTimeout: number | undefined
    let cleanupTimeout: number | undefined
    let toastTimeout: number | undefined

    const tick = (isFirst: boolean) => {
      const id = nextId.current++
      const { avatar: newAvatar, name } = makeAvatar(id, -1)

      // Step 1: shift everyone right by one slot, append the new one
      // at slot=-1 (off-canvas left, opacity 0).
      setAvatars((prev) => [
        ...prev.map((a) => ({ ...a, slot: a.slot + 1 })),
        newAvatar,
      ])

      // Step 2: next frame, animate the new one from slot=-1 to slot=0.
      // The transition on `transform` carries the existing avatars from
      // their N→N+1 positions during the same window.
      requestAnimationFrame(() => {
        setAvatars((prev) =>
          prev.map((a) => (a.id === id ? { ...a, slot: 0 } : a))
        )
      })

      // Step 3: after the transition completes, drop avatars that have
      // slid past the right edge.
      cleanupTimeout = window.setTimeout(() => {
        setAvatars((prev) => prev.filter((a) => a.slot < SLOTS))
      }, TRANSITION_MS)

      // Step 4: announce the join with a toast. The very first tick after
      // mount almost always announces (so visitors see the row is alive
      // immediately); subsequent ticks announce on a moderate-probability
      // basis so the row reads as "live" without firing on every single
      // swap.
      const probability = isFirst ? 0.9 : TOAST_PROBABILITY
      if (Math.random() < probability) {
        if (toastTimeout) window.clearTimeout(toastTimeout)
        setToast({ id, name, variantIdx: Math.floor(Math.random() * JOIN_TOAST_VARIANTS.length) })
        toastTimeout = window.setTimeout(() => {
          setToast((prev) => (prev?.id === id ? null : prev))
        }, TOAST_LIFETIME_MS)
      }

      scheduleNext(false)
    }

    const scheduleNext = (isFirst: boolean) => {
      // First tick fires within 1.5–3s of mount so visitors immediately see
      // the row is alive. After that, cadence is 6–12s — slow enough that
      // each join feels real rather than a churn of fake activity.
      const delay = isFirst
        ? (1500 + Math.random() * 1500)
        : (6000 + Math.random() * 6000)
      nextTimeout = window.setTimeout(() => tick(isFirst), delay)
    }

    scheduleNext(true)

    return () => {
      if (nextTimeout)    window.clearTimeout(nextTimeout)
      if (cleanupTimeout) window.clearTimeout(cleanupTimeout)
      if (toastTimeout)   window.clearTimeout(toastTimeout)
    }
  }, [])

  // Container width holds SLOTS visible avatars with overlap.
  const trackWidth = (SLOTS - 1) * SLOT_OFFSET + AVATAR_SIZE

  return (
    <div
      className="relative"
      style={{ width: trackWidth, height: AVATAR_SIZE }}
      aria-label="Recent community joins"
    >
      {/* Join toast — surfaces above the row when a new member joins.
          Single instance, keyed on toast.id so animation re-runs cleanly. */}
      {toast && (
        <div
          key={toast.id}
          className="absolute -top-9 left-0 z-30 animate-join-toast pointer-events-none"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 text-[10px] font-semibold whitespace-nowrap">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
            <span>
              {JOIN_TOAST_VARIANTS[toast.variantIdx].prefix ?? ''}
              {toast.name}
              {JOIN_TOAST_VARIANTS[toast.variantIdx].suffix}
            </span>
            {/* Subtle tail pointing to the leftmost avatar */}
            <span className="absolute top-full left-3 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-emerald-500" />
          </div>
        </div>
      )}

      {/* Anonymous avatar dots — letter only, no per-avatar names. */}
      {avatars.map((a) => {
        const isVisible = a.slot >= 0 && a.slot < SLOTS
        return (
          <div
            key={a.id}
            className="absolute top-0 left-0"
            style={{
              transform: `translateX(${a.slot * SLOT_OFFSET}px)`,
              opacity: isVisible ? 1 : 0,
              transition: `transform ${TRANSITION_MS}ms cubic-bezier(.2,.7,.2,1), opacity ${TRANSITION_MS}ms ease-out`,
              zIndex: SLOTS - a.slot,
              willChange: 'transform, opacity',
            }}
          >
            <span
              className={`relative h-7 w-7 rounded-full border-2 border-white dark:border-stone-800 ${a.color} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
            >
              {a.letter}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HERO SECTION - Completely Redesigned
   ═══════════════════════════════════════════════════════════════════════════════ */
const HeroSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")

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

            {/* Social Proof — animated "live join" avatar feed.
                Avatars cycle in/out as if people were joining right now. */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-center lg:justify-start pt-1 sm:pt-4">
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10">
                <LiveJoinAvatars />
                <span className="text-sm text-stone-600 dark:text-stone-300">{socialProofText}</span>
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

/* ─── Floating chips around the hero device ─────────────────────────────
   These bring back the small "Care logged / +42 likes / 10K+ plants /
   5-day streak" pills that used to live around the hero phone, but with
   two upgrades:
     1. Cursor parallax — chips drift opposite to the cursor when the
        visitor hovers the hero, with each chip having its own depth so
        they parallax at slightly different speeds.
     2. Idle float — chips also have a slow continuous float (one of the
        existing animate-float* variants) regardless of cursor activity.
   The two transforms stack via outer (parallax) + inner (idle keyframe)
   wrappers, which CSS handles cleanly without conflict. ────────────── */
type FloatingChipDef = {
  /** Tailwind classes positioning this chip within the device wrapper. */
  position: string
  /** Per-axis drift in px at full cursor offset (1.0).
      Different x/y values give each chip its own direction, so they don't
      all slide along the same vector when the cursor moves. */
  xDepth: number
  yDepth: number
  /** Sign multipliers (-1 for inverted parallax). Letting some chips drift
      WITH the cursor and others AGAINST it adds to the "independent" feel. */
  xSign?: 1 | -1
  ySign?: 1 | -1
  /** Optional rotation (degrees) per unit of cursor X — tilt with cursor. */
  rotate?: number
  /** Transition timing — different durations stop the lockstep settling. */
  durationMs?: number
  ease?: string
  /** Idle CSS animation class — float-slow / float / float-delayed. */
  idle: string
  icon: React.ElementType
  iconBg: string
  /** Primary text. */
  text: string
  /** Optional secondary text shown smaller below. */
  detail?: string
}

const useFloatingChipsParallax = (ref: React.RefObject<HTMLElement | null>) => {
  const [coords, setCoords] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      // Normalize cursor to -0.5..0.5 relative to the container.
      setCoords({
        x: ((e.clientX - rect.left) / rect.width) - 0.5,
        y: ((e.clientY - rect.top) / rect.height) - 0.5,
      })
    }
    const onLeave = () => setCoords({ x: 0, y: 0 })

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [ref])

  // Returns the per-chip transform style. Each chip resolves its own
  // x/y drift, sign, rotation, and timing — so chips no longer slide as
  // a single rigid layer. Default sign is -1 (chip drifts opposite to the
  // cursor, classic parallax) but individual chips can flip it.
  return React.useCallback((chip: FloatingChipDef): React.CSSProperties => {
    const xs = chip.xSign ?? -1
    const ys = chip.ySign ?? -1
    const tx = coords.x * chip.xDepth * xs
    const ty = coords.y * chip.yDepth * ys
    const rot = chip.rotate ? coords.x * chip.rotate : 0
    return {
      transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
      transition: `transform ${chip.durationMs ?? 450}ms ${chip.ease ?? 'cubic-bezier(.2,.7,.2,1)'}`,
    }
  }, [coords])
}

const FloatingChip: React.FC<{ chip: FloatingChipDef; parallax: (c: FloatingChipDef) => React.CSSProperties }> = ({ chip, parallax }) => {
  const Icon = chip.icon
  return (
    <div
      className={`absolute ${chip.position} pointer-events-none z-20`}
      style={parallax(chip)}
      aria-hidden="true"
    >
      <div className={chip.idle}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 dark:bg-stone-800/95 backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-lg shadow-emerald-900/15 dark:shadow-black/40">
          <div className={`h-6 w-6 rounded-full ${chip.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className="h-3 w-3 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-stone-800 dark:text-white">{chip.text}</span>
            {chip.detail && (
              <span className="text-[9px] text-stone-500 dark:text-stone-400">{chip.detail}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const HeroVisual: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { heroCards: dbHeroCards } = useLandingData()
  const heroRef = React.useRef<HTMLDivElement>(null)
  const chipParallax = useFloatingChipsParallax(heroRef)

  // Mobile phone chip placements — each chip has its own x/y bias, optional
  // rotation, and transition timing so they no longer slide as a rigid layer.
  const phoneChips: FloatingChipDef[] = [
    // Care logged — drifts mostly diagonally up-right, snappy timing, no rotation.
    { position: '-top-3 -left-3 sm:-left-6', xDepth: 14, yDepth: 22, rotate: -1.5, durationMs: 380, ease: 'cubic-bezier(.18,.9,.25,1)',  idle: 'animate-float-slow',    icon: Check, iconBg: 'bg-emerald-500',                                  text: 'Care logged' },
    // Likes — drifts mostly horizontally, slower timing, tilts noticeably with cursor.
    { position: 'top-16 -right-2 sm:-right-6', xDepth: 32, yDepth:  8, rotate:  3,   durationMs: 620, ease: 'cubic-bezier(.3,.7,.2,1)',    idle: 'animate-float',         icon: Heart, iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',     text: '+42 today', detail: 'new likes' },
    // 10K plants — almost vertical drift, medium timing, slight counter-tilt.
    { position: 'bottom-12 -left-3 sm:-left-8', xDepth:  6, yDepth: 24, rotate: -2,   durationMs: 540, ease: 'cubic-bezier(.2,.7,.2,1)',    idle: 'animate-float-delayed', icon: Leaf,  iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',  text: '10K+ plants' },
    // Streak — wide diagonal drift WITH the cursor (xSign flipped) so it feels like a follower, not a parallax.
    { position: 'bottom-2 -right-3 sm:-right-4', xDepth: 20, yDepth: 18, rotate:  4,   durationMs: 480, ease: 'cubic-bezier(.4,.6,.3,1)',    idle: 'animate-float-slow',    icon: Flame, iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500',  text: '5-day streak', xSign: 1 },
  ]

  // Desktop browser chip placements — each chip drifts on a different axis,
  // with its own rotation and timing, so the four no longer move in lockstep.
  const browserChips: FloatingChipDef[] = [
    // Care logged — primarily vertical, snappy, slight counter-tilt.
    { position: '-top-5 -left-6 xl:-left-10',     xDepth: 12, yDepth: 28, rotate: -2,    durationMs: 400, ease: 'cubic-bezier(.18,.9,.25,1)', idle: 'animate-float-slow',    icon: Check, iconBg: 'bg-emerald-500',                                 text: 'Care logged' },
    // Likes — strongly horizontal, slow & languid, larger tilt.
    { position: 'top-1/4 -right-8 xl:-right-12',  xDepth: 38, yDepth: 10, rotate:  4,    durationMs: 700, ease: 'cubic-bezier(.3,.7,.2,1)',   idle: 'animate-float',         icon: Heart, iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',    text: '+42 today', detail: 'new likes' },
    // 10K plants — nearly all-Y drift WITH the cursor (ySign flipped),
    // medium timing, no rotation. Reads as anchored to the floor.
    { position: '-bottom-3 left-1/4 xl:left-1/3', xDepth:  4, yDepth: 26, rotate:  0,    durationMs: 560, ease: 'cubic-bezier(.2,.7,.2,1)',   idle: 'animate-float-delayed', icon: Leaf,  iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500', text: '10K+ plants', ySign: 1 },
    // Streak — diagonal, fast settle, follows cursor on X (xSign flipped).
    { position: 'top-2/3 -right-4 xl:-right-8',   xDepth: 26, yDepth: 22, rotate:  6,    durationMs: 460, ease: 'cubic-bezier(.4,.6,.3,1)',   idle: 'animate-float-slow',    icon: Flame, iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500', text: '5-day streak', xSign: 1 },
  ]
  // Below: the rendered output reuses the existing phone/browser content
  // and overlays the chips inside each breakpoint's wrapper so positions
  // are relative to the actual device, not the section.


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
    <div ref={heroRef} className="relative">
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
                  <PlantImage
                    src={imageUrl}
                    alt={plantName}
                    eager
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Leaf className="h-16 w-16 text-emerald-500/50" />
                      </div>
                    }
                  />
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

        {/* Floating chips around the phone — mobile only. */}
        {phoneChips.map((chip, i) => (
          <FloatingChip key={i} chip={chip} parallax={chipParallax} />
        ))}
      </div>

      {/* Desktop browser — plant detail / encyclopedia view. Showcases the
          information depth users get on a single plant, which is unique to
          the app and not pitched anywhere else on the page. Cursor parallax
          on hover. Wrapping div carries the floating chips so positions
          are relative to the browser, not the section. */}
      <div className="hidden lg:block relative">
        <HeroPlantDetailBrowser />
        {browserChips.map((chip, i) => (
          <FloatingChip key={i} chip={chip} parallax={chipParallax} />
        ))}
      </div>
    </div>
  )
}

/* ─── HeroPlantDetailBrowser — simplified miniature of the real PlantInfoPage.
   Top: app nav row with back / share / save / Add to Garden. Body: hero on the
   left (square image with carousel dots), text column on the right with name,
   scientific, common-name pills, type/utility tags, and the 5 care-stat pills
   that are the iconic feature of the real page. Verbatim labels
   ("Sun Level", "Watering Need", "Humidity", "Maintenance", "Temperature")
   match plantInfo locale strings so the mockup reads true. ──────────────── */
const HeroPlantDetailBrowser: React.FC = () => {
  const { approvedPlants } = useLandingData()
  const plant = approvedPlants[0]
  const name = plant?.name || 'Aglaonema'
  const sci = plant?.scientific_name || 'Aglaonema commutatum'
  const image = plant?.image_url
  // Real app uses UUID-based plant URLs (/plants/:id), not slugs. Show the
  // real id when we have it, fall back to a plausible-looking placeholder.
  const plantId = plant?.id || 'a1b2c3d4-5e6f-7g8h-9i0j-1k2l3m4n5o6p'

  // Real PlantInfoPage stat colors (per /src/components/plant/PlantDetails.tsx):
  // Sun=amber, Water=blue, Humidity=cyan, Maintenance=emerald, Temp=rose.
  const stats = [
    { icon: Sun,        label: 'Sun Level',     value: 'Bright indirect', iconCls: 'text-amber-500',   tint: 'from-amber-500/10 to-orange-500/5',    border: 'border-amber-500/20' },
    { icon: Droplets,   label: 'Watering Need', value: 'Weekly',          iconCls: 'text-blue-500',    tint: 'from-blue-500/10 to-cyan-500/5',       border: 'border-blue-500/20' },
    { icon: Sparkles,   label: 'Humidity',      value: 'Medium-high',     iconCls: 'text-cyan-500',    tint: 'from-cyan-500/10 to-teal-500/5',       border: 'border-cyan-500/20' },
    { icon: Heart,      label: 'Maintenance',   value: 'Easy',            iconCls: 'text-emerald-500', tint: 'from-emerald-500/10 to-green-500/5',   border: 'border-emerald-500/20' },
    { icon: Thermometer,label: 'Temperature',   value: '18 – 27°C',       iconCls: 'text-rose-500',    tint: 'from-rose-500/10 to-pink-500/5',       border: 'border-rose-500/20' },
  ]

  return (
    <CursorParallax className="hidden lg:block relative" max={3}>
      <div className="rounded-2xl bg-stone-800 dark:bg-stone-900 shadow-2xl shadow-emerald-900/20 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-700/80 dark:bg-stone-800/80">
          <div className="h-3 w-3 rounded-full bg-rose-400/80" />
          <div className="h-3 w-3 rounded-full bg-amber-400/80" />
          <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <div className="ml-3 flex-1 h-6 rounded-md bg-stone-600/40 dark:bg-stone-700/60 flex items-center px-2.5 gap-1.5">
            <Globe className="h-3 w-3 text-stone-300/70" />
            <span className="text-[11px] text-stone-300/80 truncate">aphylia.app/plants/{plantId}</span>
          </div>
        </div>

        {/* Viewport — light/dark adaptive, mirrors actual PlantInfoPage chrome */}
        <div className="relative bg-white dark:bg-[#141417] aspect-[16/10] overflow-hidden flex flex-col">

          {/* App nav row — back, breadcrumb, action buttons (share / save / add) */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200/70 dark:border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400">
              <button className="h-7 w-7 rounded-lg bg-stone-100 dark:bg-white/5 flex items-center justify-center hover:bg-stone-200 dark:hover:bg-white/10 transition-colors" aria-label="Back">
                <ChevronLeft className="h-3.5 w-3.5 text-stone-600 dark:text-stone-300" />
              </button>
              <span className="font-medium">Encyclopedia</span>
              <span className="text-stone-300 dark:text-stone-600">/</span>
              <span className="text-stone-700 dark:text-stone-200 font-semibold truncate">{name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="h-7 w-7 rounded-lg bg-stone-100 dark:bg-white/5 flex items-center justify-center hover:bg-stone-200 dark:hover:bg-white/10 transition-colors" aria-label="Share">
                <Share2 className="h-3.5 w-3.5 text-stone-600 dark:text-stone-300" />
              </button>
              <button className="h-7 w-7 rounded-lg bg-stone-100 dark:bg-white/5 flex items-center justify-center hover:bg-stone-200 dark:hover:bg-white/10 transition-colors" aria-label="Save">
                <Bookmark className="h-3.5 w-3.5 text-stone-600 dark:text-stone-300" />
              </button>
              <button className="h-7 w-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center transition-colors" aria-label="Like">
                <Heart className="h-3.5 w-3.5 text-rose-500" />
              </button>
              <button className="ml-1 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold shadow-sm shadow-emerald-500/30 transition-colors">
                <Plus className="h-3 w-3" />
                <span>Add to Garden</span>
              </button>
            </div>
          </div>

          {/* Body: image on left, info on right (matches desktop PlantDetails) */}
          <div className="flex-1 grid grid-cols-5 min-h-0">

            {/* Image column — 4:3-feeling square with carousel dots overlay */}
            <div className="col-span-2 relative bg-gradient-to-br from-emerald-300 to-teal-500">
              <PlantImage
                src={image}
                alt={name}
                eager
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Leaf className="h-24 w-24 text-white/60" />
                  </div>
                }
              />
              {/* Carousel dots — matches PlantDetails image carousel */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
                <span className="h-1.5 w-5 rounded-full bg-white shadow" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              </div>
            </div>

            {/* Detail column */}
            <div className="col-span-3 p-5 lg:p-6 flex flex-col gap-3.5 overflow-hidden">

              {/* Title block */}
              <div className="animate-stagger-up" style={{ animationDelay: '0.1s' }}>
                <h3 className="text-xl lg:text-[1.65rem] font-bold text-stone-900 dark:text-white leading-tight truncate">
                  {name}
                </h3>
                <p className="text-[12px] italic text-stone-500 dark:text-stone-400 truncate">{sci}</p>
                {/* Common-name pills — uppercase compact badges per the real page */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-stone-400 border border-stone-200/70 dark:border-white/10">
                    Chinese Evergreen
                  </span>
                  <span className="text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-stone-400 border border-stone-200/70 dark:border-white/10">
                    Aglaonema
                  </span>
                </div>
              </div>

              {/* Type / utility / season tag row */}
              <div className="flex flex-wrap gap-1.5 animate-stagger-up" style={{ animationDelay: '0.18s' }}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Houseplant</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300">Ornamental</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300">Air-purifying</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">All seasons</span>
              </div>

              {/* The 5-stat care pills — iconic part of the real page */}
              <div className="grid grid-cols-3 gap-1.5 animate-stagger-up" style={{ animationDelay: '0.26s' }}>
                {stats.slice(0, 3).map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className={`relative overflow-hidden rounded-lg border ${s.border} bg-gradient-to-br ${s.tint} px-2 py-1.5`}>
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3 w-3 ${s.iconCls} flex-shrink-0`} />
                        <p className="text-[8.5px] uppercase tracking-wider text-stone-500 dark:text-stone-400 truncate">{s.label}</p>
                      </div>
                      <p className="text-[11px] font-semibold text-stone-800 dark:text-stone-100 truncate mt-0.5">{s.value}</p>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-1.5 -mt-2 animate-stagger-up" style={{ animationDelay: '0.34s' }}>
                {stats.slice(3).map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className={`relative overflow-hidden rounded-lg border ${s.border} bg-gradient-to-br ${s.tint} px-2 py-1.5`}>
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3 w-3 ${s.iconCls} flex-shrink-0`} />
                        <p className="text-[8.5px] uppercase tracking-wider text-stone-500 dark:text-stone-400 truncate">{s.label}</p>
                      </div>
                      <p className="text-[11px] font-semibold text-stone-800 dark:text-stone-100 truncate mt-0.5">{s.value}</p>
                    </div>
                  )
                })}
              </div>

              {/* Overview snippet — mimics expandable "Read more" overview */}
              <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2 animate-stagger-up" style={{ animationDelay: '0.42s' }}>
                A forgiving tropical foliage plant with striking variegated leaves. Tolerates low light and irregular watering — perfect for first-time plant parents.{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer">Read more</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </CursorParallax>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GET STARTED SECTION - Three illustrated stage cards.
   Each stage shows a small motion graphic of what that step actually does
   (Snap → Build → Thrive) instead of a paragraph of text. Text is reduced
   to step number + tight title + one-line caption.
   ═══════════════════════════════════════════════════════════════════════════════ */
type Stage = {
  num: string
  title: string
  caption: string
  Illustration: React.ComponentType
  accent: string  // emerald-500, lime-500, etc — accent color for the step
}

const GetStartedSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")

  const stages: Stage[] = [
    {
      num: "01",
      title: t("getStarted.step1.title", { defaultValue: "Snap any plant" }),
      caption: t("getStarted.step1.caption", { defaultValue: "Camera or upload — get the species in two seconds." }),
      Illustration: SnapIllustration,
      accent: "emerald",
    },
    {
      num: "02",
      title: t("getStarted.step2.title", { defaultValue: "Build your garden" }),
      caption: t("getStarted.step2.caption", { defaultValue: "Add it to your collection. Organize however you like." }),
      Illustration: BuildIllustration,
      accent: "lime",
    },
    {
      num: "03",
      title: t("getStarted.step3.title", { defaultValue: "Watch them thrive" }),
      caption: t("getStarted.step3.caption", { defaultValue: "Care reminders shaped to your plant and your home." }),
      Illustration: ThriveIllustration,
      accent: "blue",
    },
  ]

  return (
    <section id="how-it-works" className="py-12 lg:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Editorial header */}
        <div className="max-w-3xl mb-10 lg:mb-14">
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

        {/* Three illustrated stage cards. Each illustration is a unique
            looping motion graphic that demos the step. Cards lift on hover
            and a connector arrow appears between them on desktop. */}
        <div className="relative grid md:grid-cols-3 gap-5 lg:gap-6 mb-12 lg:mb-16">
          {stages.map((stage, i) => (
            <StageCard key={i} stage={stage} index={i} isLast={i === stages.length - 1} />
          ))}
        </div>

        {/* Promise strip — single line replacing the verbose beats */}
        <div className="border-t border-stone-200/60 dark:border-stone-800/60 pt-6 lg:pt-8">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-center gap-x-8 gap-y-3 text-sm text-stone-600 dark:text-stone-400">
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
              <span>{t("getStarted.promise1", { defaultValue: "Built for first-timers" })}</span>
            </span>
            <span className="hidden sm:inline text-stone-300 dark:text-stone-700">·</span>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
              <span>{t("getStarted.promise2", { defaultValue: "Friendly assistant on call" })}</span>
            </span>
            <span className="hidden sm:inline text-stone-300 dark:text-stone-700">·</span>
            <span className="inline-flex items-center gap-2">
              <Heart className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
              <span>{t("getStarted.promise3", { defaultValue: "No streak shame" })}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
})

/* ─── StageCard — wrapper for one illustrated step. Hover lifts the card,
   intensifies the accent border, and slightly scales the illustration to
   give visitors something to discover when they mouse over. ───────── */
const StageCard: React.FC<{ stage: Stage; index: number; isLast: boolean }> = ({ stage, index, isLast }) => {
  const { num, title, caption, Illustration, accent } = stage
  // Tailwind needs literal class strings — pre-compute them per accent.
  const accentClasses: Record<string, { bgFrom: string; ring: string; text: string }> = {
    emerald: { bgFrom: 'from-emerald-100/60 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-900/10', ring: 'group-hover:ring-emerald-500/40', text: 'text-emerald-600 dark:text-emerald-400' },
    lime:    { bgFrom: 'from-lime-100/60 to-lime-50/30 dark:from-lime-950/30 dark:to-lime-900/10',          ring: 'group-hover:ring-lime-500/40',    text: 'text-lime-600 dark:text-lime-400' },
    blue:    { bgFrom: 'from-blue-100/60 to-blue-50/30 dark:from-blue-950/30 dark:to-blue-900/10',          ring: 'group-hover:ring-blue-500/40',    text: 'text-blue-600 dark:text-blue-400' },
  }
  const a = accentClasses[accent] || accentClasses.emerald

  return (
    <div
      className="relative group animate-stagger-up"
      style={{ animationDelay: `${index * 0.12}s` }}
    >
      <div className={`relative overflow-hidden rounded-2xl border border-stone-200/70 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm ring-1 ring-transparent ${a.ring} transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/10`}>
        {/* Illustration — top 60-65% of the card, fixed aspect for consistency */}
        <div className={`relative aspect-[5/4] bg-gradient-to-br ${a.bgFrom} overflow-hidden`}>
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
            <Illustration />
          </div>
        </div>

        {/* Caption */}
        <div className="p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-2.5">
            <span className={`font-mono tabular-nums text-[11px] font-bold ${a.text} tracking-wider`}>
              {`[ ${num} ]`}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-stone-200 dark:from-stone-700 to-transparent" />
          </div>
          <h3 className="text-lg lg:text-xl font-bold text-stone-900 dark:text-white mb-1.5 leading-tight">
            {title}
          </h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            {caption}
          </p>
        </div>
      </div>

      {/* Connector arrow between cards — desktop only, sits between this card and the next */}
      {!isLast && (
        <div className="hidden md:flex absolute top-[28%] -right-4 lg:-right-5 z-10 items-center justify-center h-8 w-8 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-sm transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight className="h-3.5 w-3.5 text-emerald-500" />
        </div>
      )}
    </div>
  )
}

/* ─── SnapIllustration — viewfinder + plant photo + scan beam + result chip.
   All animations are CSS-driven loops; we sync the result chip's reveal
   roughly to the end of each scan cycle. ──────────────────────────── */
const SnapIllustration: React.FC = () => {
  const { approvedPlants } = useLandingData()
  const plant = approvedPlants[0]
  const name = plant?.name || 'Monstera'

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      {/* Plant photo with viewfinder */}
      <div className="relative w-3/5 aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-300 to-teal-500 shadow-xl shadow-emerald-900/10">
        <PlantImage
          src={plant?.image_url}
          alt={name}
          fallback={<Leaf className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 text-white/60" />}
        />
        {/* Viewfinder corners */}
        <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white/90 rounded-tl-md" />
        <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white/90 rounded-tr-md" />
        <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white/90 rounded-bl-md" />
        <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white/90 rounded-br-md" />
        {/* Scan beam */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-x-0 h-7 bg-gradient-to-b from-transparent via-emerald-200/95 to-transparent shadow-[0_0_22px_rgba(16,185,129,0.85)] animate-gs-scan" />
        </div>
        {/* Status pill */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <span className="text-[9px] text-white">Scanning…</span>
        </div>
      </div>

      {/* Result chip — appears after each scan, holds, fades */}
      <div className="absolute bottom-5 left-1/2 animate-gs-result">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-stone-900 shadow-xl border-2 border-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-stone-900 dark:text-white truncate max-w-[140px]">{name}</span>
          <span className="text-[10px] font-bold text-emerald-600">98%</span>
        </div>
      </div>
    </div>
  )
}

/* ─── BuildIllustration — 2x3 grid of garden tiles that fill in with stagger,
   loop, and reset. Mimics watching a garden being assembled plant by plant. */
const BuildIllustration: React.FC = () => {
  const { approvedPlants } = useLandingData()

  return (
    <div className="absolute inset-0 p-5">
      <div className="grid grid-cols-3 gap-2 h-full">
        {Array.from({ length: 6 }).map((_, i) => {
          const plant = approvedPlants[i + 2] || approvedPlants[i]
          return (
            <div
              key={i}
              className="relative rounded-xl border border-lime-500/25 bg-white/40 dark:bg-white/[0.03] overflow-hidden"
            >
              {/* Empty-slot grid pattern visible underneath */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, rgba(132,204,22,0.15) 25%, transparent 25%, transparent 75%, rgba(132,204,22,0.15) 75%), linear-gradient(45deg, rgba(132,204,22,0.15) 25%, transparent 25%, transparent 75%, rgba(132,204,22,0.15) 75%)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 4px 4px',
                }}
              />
              {/* Plant photo — fades in via stagger */}
              <div
                className="absolute inset-0 animate-gs-tile"
                style={{ animationDelay: `${i * 0.65}s` }}
              >
                <PlantImage
                  src={plant?.image_url}
                  alt={plant?.name || 'Plant'}
                  fallback={
                    <div className="absolute inset-0 bg-gradient-to-br from-lime-400 to-green-500 flex items-center justify-center">
                      <Leaf className="h-5 w-5 text-white/70" />
                    </div>
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
      {/* Tiny header inside the card to anchor it as "your garden" */}
      <div className="absolute top-2 left-3 flex items-center gap-1.5">
        <Sprout className="h-3 w-3 text-lime-600 dark:text-lime-400" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-lime-700 dark:text-lime-300">My garden</span>
      </div>
    </div>
  )
}

/* ─── ThriveIllustration — a "care dashboard" mini-mockup with multiple
   live elements: streak chip, week-of-care calendar that fills in with
   stagger, a plant that grows in its pot, three stat bars (Water / Light
   / Growth) with shimmer to feel live, a bell that rings, and a slide-in
   reminder chip. Designed to read as densely as Stage 2's garden grid. */
const ThriveIllustration: React.FC = () => {
  const { approvedPlants } = useLandingData()
  const plant = approvedPlants[1] || approvedPlants[0]

  // Mon-Sun. The last day is "in progress" (not yet completed) so the
  // visitor sees a 6-of-7 week, mirroring real plant-tracker UI where you
  // catch up by the end of the week.
  const days: Array<{ letter: string; done: boolean }> = [
    { letter: 'M', done: true },
    { letter: 'T', done: true },
    { letter: 'W', done: true },
    { letter: 'T', done: true },
    { letter: 'F', done: true },
    { letter: 'S', done: true },
    { letter: 'S', done: false },
  ]

  return (
    <div className="absolute inset-0 p-3 sm:p-4 flex flex-col gap-2.5">
      {/* Top row — streak chip on the left, bell on the right. */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/25">
          <Flame className="h-3 w-3 text-orange-500" />
          <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">14 day streak</span>
        </div>
        <div className="h-7 w-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-gs-bell" />
        </div>
      </div>

      {/* Week calendar — 7 day cells. Each cell scales+fades-in on a
          staggered loop so the week visibly "fills in" over and over. */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">{d.letter}</span>
            <div className="relative w-full h-5">
              {/* Empty slot — always visible underneath */}
              <div className="absolute inset-0 rounded-md border border-stone-300/40 dark:border-stone-600/40 bg-stone-100/40 dark:bg-stone-800/40" />
              {/* Filled state — animated for completed days */}
              {d.done && (
                <div
                  className="absolute inset-0 rounded-md bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center animate-gs-week-day"
                  style={{ animationDelay: `${0.2 + i * 0.4}s` }}
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Middle — plant on the left, three stat bars on the right.
          The bars use a shimmering gradient so they read as "live data"
          without an awkward fill/drain cycle. */}
      <div className="flex-1 grid grid-cols-2 gap-3 items-end min-h-0">
        {/* Plant + pot */}
        <div className="relative h-full flex items-end justify-center">
          {/* Pot */}
          <div className="relative w-16 h-5 rounded-b-xl rounded-t-md bg-gradient-to-b from-stone-600 to-stone-800 shadow-md" />
          {/* Plant grows from the pot's top edge */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 origin-bottom animate-gs-grow h-20 w-20">
            <PlantImage
              src={plant?.image_url}
              alt={plant?.name || 'Plant'}
              className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
              fallback={<Sprout className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 text-emerald-500" />}
            />
          </div>
        </div>

        {/* Stat bars */}
        <div className="flex flex-col gap-2 pb-1">
          <ThriveStatBar icon={Droplets} iconCls="text-blue-500"    label="Water"  value="75%"     barFrom="from-blue-500"    barTo="to-cyan-400"    width="75%" />
          <ThriveStatBar icon={Sun}       iconCls="text-amber-500"  label="Light"  value="82%"     barFrom="from-amber-400"   barTo="to-yellow-300"  width="82%" />
          <ThriveStatBar icon={TrendingUp}iconCls="text-emerald-500"label="Growth" value="+8 cm"   barFrom="from-emerald-500" barTo="to-green-400"   width="62%" />
        </div>
      </div>

      {/* Reminder chip — slides in from the right, holds, slides out. */}
      <div className="animate-gs-notif self-start">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 shadow-md border border-blue-500/30">
          <Droplets className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] font-semibold text-stone-800 dark:text-white">Water Pothos in 2h</span>
        </div>
      </div>
    </div>
  )
}

const ThriveStatBar: React.FC<{
  icon: React.ElementType
  iconCls: string
  label: string
  value: string
  barFrom: string
  barTo: string
  width: string
}> = ({ icon: Icon, iconCls, label, value, barFrom, barTo, width }) => (
  <div>
    <div className="flex items-center gap-1 mb-0.5">
      <Icon className={`h-2.5 w-2.5 ${iconCls}`} />
      <span className="text-[9px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400">{label}</span>
      <span className={`ml-auto text-[10px] font-bold ${iconCls}`}>{value}</span>
    </div>
    <div className="h-1.5 rounded-full bg-stone-200/60 dark:bg-stone-700/50 overflow-hidden">
      {/* Shimmer gradient on the fill — feels "live" without an explicit
          fill/drain animation that could be misread as the plant suffering. */}
      <div
        className={`h-full rounded-full bg-gradient-to-r ${barFrom} ${barTo} bg-[length:200%_100%] animate-shimmer`}
        style={{ width }}
      />
    </div>
  </div>
)

/* ═══════════════════════════════════════════════════════════════════════════════
   FEATURES SECTION - Bento Grid Style
   ═══════════════════════════════════════════════════════════════════════════════ */
const FeaturesSection: React.FC = React.memo(() => {
  const { t } = useTranslation("Landing")
  const { approvedPlants } = useLandingData()

  return (
    <section id="features" className="py-12 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Section header — left-aligned, editorial. Reframed as "the quiet
            tools" so it doesn't repeat the louder LiveTour pitch above. */}
        <div className="max-w-2xl mb-10 lg:mb-16">
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-medium mb-3">
            {t("features.kicker", { defaultValue: "Under the hood" })}
          </div>
          <h2 className="text-[1.875rem] sm:text-4xl lg:text-[3rem] font-bold tracking-tight text-stone-900 dark:text-white leading-[1.1] mb-4">
            {t("features.titleA", { defaultValue: "And a few " })}
            <span className="italic text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30 decoration-2 underline-offset-[6px]">
              {t("features.titleEm", { defaultValue: "quieter tools" })}
            </span>
            {t("features.titleB", { defaultValue: "." })}
          </h2>
          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 max-w-xl leading-relaxed">
            {t("features.subtitleNew", { defaultValue: "An offline-first library, a private journal, smart collections — the plumbing you don't notice until you need it." })}
          </p>
        </div>

        {/* Bento Grid — merged from the previous Showcase section. Each card
            now incorporates the visual element that made its showcase
            counterpart distinctive: the search bar (encyclopedia), the task
            checklist (tasks), the mini chart (analytics), the sample plant
            gallery (garden), plus a dedicated Pet Safety card that didn't
            exist here before. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">

          {/* Smart Plant Encyclopedia — large card, now with a search bar
              below the description (absorbed from the showcase encyclopedia
              card) on top of the existing plant thumbnails. */}
          <div className="md:col-span-2 lg:col-span-2 group relative rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent backdrop-blur-sm border border-emerald-500/20 p-8 overflow-hidden hover:border-emerald-500/40 transition-all duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="relative">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-emerald-500 items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <BookMarked className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-3">{t("features.smartLibrary.title")}</h3>
              <p className="text-stone-600 dark:text-stone-400 text-base leading-relaxed max-w-lg">{t("features.smartLibrary.description")}</p>

              {/* Search bar — pulled from the old Showcase encyclopedia card. */}
              <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60 dark:bg-white/5 border border-emerald-500/20 max-w-md">
                <Search className="h-4 w-4 text-stone-400" />
                <span className="text-sm text-stone-400">{t("features.smartLibrary.searchPlaceholder", { defaultValue: "Search any plant..." })}</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">⌘K</span>
              </div>

              {/* Mini preview — real approved plants. */}
              <div className="mt-5 flex gap-3 flex-wrap">
                {[0, 1, 2, 3].map((slot) => {
                  const plant = approvedPlants[slot + 4] || approvedPlants[slot]
                  return (
                    <div
                      key={slot}
                      className="relative h-16 w-16 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-400/20 to-teal-400/20 border border-emerald-500/20 transition-transform duration-200 group-hover:-translate-y-0.5 hover:scale-105 flex items-center justify-center"
                    >
                      <PlantImage
                        src={plant?.image_url}
                        alt={plant?.name || 'Plant'}
                        fallback={<Leaf className="h-6 w-6 text-emerald-500/50" />}
                      />
                      {plant?.image_url && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                          <p className="text-[8px] text-white truncate font-medium">{plant.name}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="h-16 w-16 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-stone-400">{t("floatingCards.morePlants", { defaultValue: "+10K" })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Care Reminders — now with a "Today's tasks" checklist appended
              below the notification stack (absorbed from the showcase
              tasks card). The notif stack is trimmed to 2 to make room. */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-blue-500 items-center justify-center mb-4 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{t("features.careReminders.title")}</h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">{t("features.careReminders.description")}</p>

            {/* Notifications */}
            <div className="space-y-2 mb-3">
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
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/40 dark:bg-white/5 border border-amber-200/50 dark:border-amber-500/20 backdrop-blur-sm group-hover:translate-x-1 transition-transform delay-75">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Sun className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">{t("features.careReminders.notification2Title")}</p>
                  <p className="text-[10px] text-stone-500">{t("features.careReminders.notification2Time")}</p>
                </div>
              </div>
            </div>

            {/* Task checklist — pulled from the old Showcase tasks card. */}
            <div className="pt-3 border-t border-blue-500/10">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400 mb-2">Today's tasks</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  <span className="text-stone-500 dark:text-stone-400 line-through">Water Pothos</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <CircleDot className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  <span className="text-stone-700 dark:text-stone-200">Fertilize Monstera</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <CircleDot className="h-3 w-3 text-stone-300 dark:text-stone-600 flex-shrink-0" />
                  <span className="text-stone-500 dark:text-stone-400">Mist Fern</span>
                </div>
              </div>
            </div>
          </div>

          {/* Plant ID — simple feature card */}
          {/* Visual Plant ID — camera viewfinder preview with scan beam +
              identified-result chip, mirroring the LiveTour Identify motion
              but compressed into a static-card preview. */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-pink-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-pink-500 items-center justify-center mb-4 shadow-lg shadow-pink-500/30 group-hover:scale-110 transition-transform">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{t("features.plantId.title")}</h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">{t("features.plantId.description")}</p>

            {/* Camera viewfinder preview — real plant photo with corner
                brackets, looping scan beam, and a result chip below. */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-emerald-300 via-green-400 to-teal-500 mb-2">
              <PlantImage
                src={approvedPlants[2]?.image_url}
                alt={approvedPlants[2]?.name || 'Plant'}
                fallback={<Leaf className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-white/60" />}
              />
              {/* Viewfinder corner brackets */}
              <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-white/90 rounded-tl" />
              <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white/90 rounded-tr" />
              <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-white/90 rounded-bl" />
              <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-white/90 rounded-br" />
              {/* Scan beam — looped */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-5 bg-gradient-to-b from-transparent via-emerald-200/95 to-transparent shadow-[0_0_18px_rgba(16,185,129,0.85)] animate-plantid-scan" />
              </div>
              {/* "Scanning..." pill at top */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/55 backdrop-blur-sm">
                <span className="h-1 w-1 rounded-full bg-emerald-300" />
                <span className="text-[7px] text-white font-medium">Scanning…</span>
              </div>
            </div>

            {/* Identified-result chip */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-white/5 border-2 border-emerald-500/40">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                {approvedPlants[2]?.name || 'Monstera'}
              </span>
              <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400">98%</span>
            </div>
          </div>

          {/* Garden Journal — upgraded with a mini activity chart pulled
              from the old Showcase analytics card. */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-amber-500 items-center justify-center mb-4 shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
              <NotebookPen className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{t("features.journal.title")}</h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">{t("features.journal.description")}</p>

            {/* Mini stats row + sparkline chart — absorbs the analytics card. */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-amber-500/20 px-2.5 py-2">
                <div className="flex items-center gap-1 text-[9px] text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  <Target className="h-2.5 w-2.5" />
                  <span>Completion</span>
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-none">92%</div>
              </div>
              <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-orange-500/20 px-2.5 py-2">
                <div className="flex items-center gap-1 text-[9px] text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  <Flame className="h-2.5 w-2.5" />
                  <span>Streak</span>
                </div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400 leading-none">14<span className="text-[10px] font-medium text-stone-500 ml-1">days</span></div>
              </div>
            </div>
            {/* Sparkline */}
            <div className="rounded-xl bg-white/40 dark:bg-white/5 px-2 pt-1.5 pb-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-medium">Last 7 days</span>
                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
              </div>
              <svg viewBox="0 0 200 40" className="w-full h-8" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="journalArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* 7 data points, normalized to viewBox */}
                <path d="M 0,28 L 33,18 L 66,32 L 100,12 L 133,22 L 166,8 L 200,16 L 200,40 L 0,40 Z" fill="url(#journalArea)" />
                <path d="M 0,28 L 33,18 L 66,32 L 100,12 L 133,22 L 166,8 L 200,16" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {[[0,28],[33,18],[66,32],[100,12],[133,22],[166,8],[200,16]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="2" fill="#f59e0b" />
                ))}
              </svg>
            </div>
          </div>

          {/* Aphylia Assistant */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 items-center justify-center mb-4 shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t("features.assistant.title", { defaultValue: "Aphylia Assistant" })}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">
              {t("features.assistant.description", { defaultValue: "Yellow leaves? Wilting? Repotting? Ask in plain English and get a clear answer in seconds." })}
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-end group-hover:-translate-x-1 transition-transform">
                <div className="px-2.5 py-1.5 rounded-xl rounded-br-sm bg-violet-500/15 border border-violet-500/20 max-w-[80%]">
                  <p className="text-[11px] text-stone-700 dark:text-stone-200">Why are my Pothos leaves yellow?</p>
                </div>
              </div>
              <div className="flex justify-start group-hover:translate-x-1 transition-transform delay-75">
                <div className="px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-white/70 dark:bg-white/5 border border-stone-200/50 dark:border-white/10 max-w-[85%]">
                  <p className="text-[11px] text-stone-700 dark:text-stone-200">
                    Likely overwatering. Let the top inch of soil dry out before the next drink — yellow leaves should stop after a week.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pet Safety — NEW card (absorbed from showcase). Toxicity warnings
              are a unique angle the page didn't pitch anywhere else. */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-rose-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-rose-500 items-center justify-center mb-4 shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
              <PawPrint className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t("features.petSafety.title", { defaultValue: "Pet-safety alerts" })}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">
              {t("features.petSafety.description", { defaultValue: "Every plant flagged for cats, dogs, and humans. We warn before it lands in your cart." })}
            </p>

            {/* Sample toxicity badges */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <Shield className="h-3 w-3 text-rose-500 flex-shrink-0" />
                <span className="text-[11px] text-stone-700 dark:text-stone-200 truncate flex-1">Lily — toxic to cats</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">High</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Shield className="h-3 w-3 text-amber-500 flex-shrink-0" />
                <span className="text-[11px] text-stone-700 dark:text-stone-200 truncate flex-1">Pothos — mild for pets</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold">Mild</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                <span className="text-[11px] text-stone-700 dark:text-stone-200 truncate flex-1">Spider Plant — pet-safe</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">Safe</span>
              </div>
            </div>
          </div>

          {/* Cross-Device Sync — central frame morphs between phone, TV,
              and laptop shapes on a 9s loop, with the same content
              ("Aphylia • 12 plants") staying consistent inside. The
              accompanying laptop base and TV stand fade in only during
              their respective windows. A row of device icons below tracks
              the active state with a small dot indicator. */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-purple-500 items-center justify-center mb-4 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
              <Wifi className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{t("features.pwa.title")}</h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">{t("features.pwa.description")}</p>

            {/* Morphing device stage */}
            <div className="relative h-28 flex items-center justify-center">
              {/* TV stand — only visible during TV window */}
              <div
                aria-hidden="true"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 animate-device-tv-stand"
                style={{ width: '40px', height: '6px' }}
              >
                <div className="h-1 w-full bg-stone-400 dark:bg-stone-500 rounded-full" />
                <div className="mx-auto mt-0.5 h-2 w-12 -translate-x-1/2 left-1/2 relative bg-stone-400/60 dark:bg-stone-500/60 rounded" />
              </div>

              {/* The morphing screen — contains a tiny consistent app preview.
                  Width / height / border-radius are animated by the keyframe. */}
              <div className="relative animate-device-morph bg-gradient-to-br from-stone-700 to-stone-900 dark:from-stone-800 dark:to-stone-950 ring-1 ring-purple-500/30 shadow-lg shadow-purple-900/20 overflow-hidden">
                {/* Inner viewport */}
                <div className="absolute inset-1 rounded-md bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/60 dark:to-teal-950/60 flex flex-col items-center justify-center gap-0.5">
                  <Leaf className="h-3 w-3 text-emerald-500" />
                  <p className="text-[7px] font-bold text-stone-700 dark:text-stone-200">Aphylia</p>
                  <p className="text-[6px] text-stone-500 dark:text-stone-400">12 plants</p>
                </div>
              </div>

              {/* Laptop base — only visible during laptop window */}
              <div
                aria-hidden="true"
                className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-44 rounded-b-md bg-gradient-to-b from-stone-600 to-stone-800 dark:from-stone-700 dark:to-stone-900 animate-device-laptop-base"
              />

              {/* Sync pulse — small badge that sits in the top-right and pulses */}
              <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] text-emerald-700 dark:text-emerald-300 font-semibold">Synced</span>
              </div>
            </div>

            {/* Device label crossfade — only one is opaque at a time. They stack
                in the same spot via absolute positioning. */}
            <div className="relative mt-3 h-5 flex items-center justify-center">
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 animate-device-label-mobile">
                <Smartphone className="h-3 w-3" />
                <span>Mobile</span>
              </span>
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 animate-device-label-tv">
                <Tv className="h-3 w-3" />
                <span>Television</span>
              </span>
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 animate-device-label-web">
                <Monitor className="h-3 w-3" />
                <span>Web</span>
              </span>
            </div>
          </div>

          {/* Collections & Bookmarks — enhanced with sample collection chips
              (drawn from the old Showcase garden plant gallery concept). */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 backdrop-blur-sm border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="inline-flex h-12 w-12 rounded-xl bg-teal-500 items-center justify-center mb-4 shadow-lg shadow-teal-500/30 group-hover:scale-110 transition-transform">
              <BookMarked className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{t("features.collections.title")}</h3>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4">{t("features.collections.description")}</p>

            {/* Sample collection rows with plant thumbnail stacks */}
            <div className="space-y-2">
              {[
                { label: 'Living room', count: 8, plantOffsets: [8, 9, 10] },
                { label: 'Pet-safe',    count: 5, plantOffsets: [11, 12, 13] },
                { label: 'Low light',   count: 12, plantOffsets: [14, 15, 16] },
              ].map((col, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-white/60 dark:bg-white/5 border border-teal-500/15">
                  {/* Tiny plant stack */}
                  <div className="flex -space-x-2 flex-shrink-0">
                    {col.plantOffsets.map((o, j) => {
                      const p = approvedPlants[o] || approvedPlants[j]
                      return (
                        <div key={j} className="relative h-6 w-6 rounded-full border-2 border-white dark:border-stone-800 overflow-hidden bg-gradient-to-br from-teal-300 to-cyan-400">
                          <PlantImage src={p?.image_url} alt="" fallback={<Leaf className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 text-white/70" />} />
                        </div>
                      )
                    })}
                  </div>
                  <span className="text-xs font-medium text-stone-700 dark:text-stone-200 flex-1 truncate">{col.label}</span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">{col.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})


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
  /** Real app route for the URL bar in the browser mockup. Must match
      a router path in PlantSwipe.tsx so visitors who click into the
      product land on a real page, not a 404. */
  urlPath: string
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
      urlPath: '/discovery',
    },
    {
      id: 'garden',
      label: t("liveTour.garden.label", { defaultValue: "My Garden" }),
      caption: t("liveTour.garden.caption", { defaultValue: "Your plants in one place — watch your collection grow." }),
      icon: Sprout,
      accent: { bg: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400', ring: 'ring-lime-500/40' },
      urlPath: '/gardens',
    },
    {
      id: 'care',
      label: t("liveTour.care.label", { defaultValue: "Reminders" }),
      caption: t("liveTour.care.caption", { defaultValue: "Smart, gentle nudges. Water, light, repot — only when needed." }),
      icon: Bell,
      accent: { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/40' },
      // No dedicated /care or /reminders route — care surfaces inside the
      // gardens overview, so /gardens is the closest accurate landing page.
      urlPath: '/gardens',
    },
    {
      id: 'identify',
      label: t("liveTour.identify.label", { defaultValue: "Identify" }),
      caption: t("liveTour.identify.caption", { defaultValue: "Snap any plant. Get its name and care plan in seconds." }),
      icon: Camera,
      accent: { bg: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/40' },
      urlPath: '/scan',
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
                  <span className="text-[11px] text-stone-300/80 truncate">aphylia.app{current.urlPath}</span>
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
          <PlantImage
            src={cards[1].image}
            alt={cards[1].name}
            fallback={<Leaf className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${compact ? 'h-12 w-12' : 'h-20 w-20'} text-white/40`} />}
          />
          <div className={`absolute bottom-0 left-0 right-0 ${compact ? 'p-2' : 'p-4'}`}>
            <div className="rounded-xl bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm px-2.5 py-1.5">
              <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-bold text-stone-900 dark:text-white truncate`}>{cards[1].name}</p>
              <p className={`${compact ? 'text-[9px]' : 'text-xs'} italic text-stone-500 dark:text-stone-400 truncate`}>{cards[1].sub}</p>
            </div>
          </div>
        </div>

        {/* Foreground card swiping right */}
        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${cards[0].g} shadow-xl overflow-hidden animate-tour-swipe-right`}>
          <PlantImage
            src={cards[0].image}
            alt={cards[0].name}
            fallback={<Leaf className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${compact ? 'h-14 w-14' : 'h-24 w-24'} text-white/50`} />}
          />
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
            <PlantImage
              src={tile.image}
              alt={tile.name}
              fallback={<Leaf className={`${compact ? 'h-4 w-4' : 'h-6 w-6 lg:h-7 lg:w-7'} text-white/60`} />}
            />
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
      <PlantImage
        src={targetImage}
        alt={targetName}
        fallback={<Leaf className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${compact ? 'h-16 w-16' : 'h-20 w-20'} text-white/60`} />}
      />

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
        <div className={`relative ${compact ? 'h-9 w-9' : 'h-11 w-11'} rounded-lg overflow-hidden flex-shrink-0 ${targetImage ? '' : 'bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center'}`}>
          <PlantImage
            src={targetImage}
            alt={targetName}
            fallback={<Sprout className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />}
          />
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
