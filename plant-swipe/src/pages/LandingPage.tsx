import React from "react"
import { Link } from "@/components/i18n/Link"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "react-i18next"
import { TopBar } from "@/components/layout/TopBar"
import { Footer } from "@/components/layout/Footer"
import MobileNavBar from "@/components/layout/MobileNavBar"
import { useAuthActions } from "@/context/AuthActionsContext"
import { useLanguageNavigate, usePathWithoutLanguage } from "@/lib/i18nRouting"
import { supabase } from "@/lib/supabaseClient"
import i18n from "@/lib/i18n"
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
  Check,
  Sparkles,
  ArrowRight,
  Users,
  Zap,
  Shield,
  Heart,
  TrendingUp,
  Globe,
  Smartphone,
  Clock,
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
} from "lucide-react"

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
  loading: true,
})

const useLandingData = () => React.useContext(LandingDataContext)

// CSS Animations
const animationStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(3deg); }
  }
  @keyframes float-slow {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  @keyframes float-delayed {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(-2deg); }
  }
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes counter-spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }
  @keyframes bounce-subtle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
  .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite 1s; }
  .animate-pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
  .animate-gradient { animation: gradient-shift 8s ease infinite; background-size: 200% 200%; }
  .animate-marquee { animation: marquee 30s linear infinite; }
  .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
  .animate-scale-in { animation: scale-in 0.5s ease-out forwards; }
  .animate-spin-slow { animation: spin-slow 20s linear infinite; }
  .animate-counter-spin-slow { animation: counter-spin-slow 20s linear infinite; }
  .animate-bounce-subtle { animation: bounce-subtle 2s ease-in-out infinite; }
  .plant-icon-theme { filter: brightness(0) saturate(100%); }
  .dark .plant-icon-theme { filter: brightness(0) saturate(100%) invert(100%); }
  .gradient-text {
    background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .glass-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .dark .glass-card {
    background: rgba(30, 30, 30, 0.7);
  }
`

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
    loading: true,
  })

  // Track current language for FAQ translations
  const currentLang = i18n.language || 'en'

  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Execute all queries in parallel, but handle errors individually
        // Some tables may not exist yet (404), which is fine - we fall back to defaults
        const results = await Promise.allSettled([
          supabase.from("landing_page_settings").select("*").limit(1).maybeSingle(),
          supabase.from("landing_hero_cards").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_stats").select("*").limit(1).maybeSingle(),
          supabase.from("landing_testimonials").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_faq").select("*").eq("is_active", true).order("position"),
          supabase.from("landing_demo_features").select("*").eq("is_active", true).order("position"),
        ])

        // Extract data safely, using null/empty array as fallback for any failures
        const getData = <T,>(result: PromiseSettledResult<{ data: T | null; error: unknown }>, defaultValue: T): T => {
          if (result.status === 'rejected') return defaultValue
          const { data, error } = result.value
          // Treat any error (including 404 for missing tables) as "use default"
          if (error || data === null) return defaultValue
          return data
        }

        const settings = getData(results[0], null)
        const heroCards = getData(results[1], [])
        const stats = getData(results[2], null)
        const testimonials = getData(results[3], [])
        let faqItems = getData(results[4], []) as FAQ[]
        let demoFeatures = getData(results[5], []) as DemoFeature[]
        
        // Load FAQ translations for current language (if not English)
        if (currentLang !== 'en' && faqItems.length > 0) {
          try {
            const { data: translations } = await supabase
              .from("landing_faq_translations")
              .select("*")
              .eq("language", currentLang)
            
            if (translations && translations.length > 0) {
              // Create a map of translations by faq_id
              const translationMap = new Map<string, { question: string; answer: string }>()
              translations.forEach((t: { faq_id: string; question: string; answer: string }) => {
                translationMap.set(t.faq_id, { question: t.question, answer: t.answer })
              })
              
              // Apply translations to FAQ items
              faqItems = faqItems.map(faq => {
                const translation = translationMap.get(faq.id)
                if (translation) {
                  return { ...faq, question: translation.question, answer: translation.answer }
                }
                return faq
              })
            }
          } catch (e) {
            console.error("Failed to load FAQ translations:", e)
          }
        }

        // Load Demo Feature translations for current language (if not English)
        if (currentLang !== 'en' && demoFeatures.length > 0) {
          try {
            const { data: translations } = await supabase
              .from("landing_demo_feature_translations")
              .select("*")
              .eq("language", currentLang)
            
            if (translations && translations.length > 0) {
              // Create a map of translations by feature_id
              const translationMap = new Map<string, string>()
              translations.forEach((t: { feature_id: string; label: string }) => {
                translationMap.set(t.feature_id, t.label)
              })
              
              // Apply translations to demo features
              demoFeatures = demoFeatures.map(feature => {
                const translatedLabel = translationMap.get(feature.id)
                if (translatedLabel) {
                  return { ...feature, label: translatedLabel }
                }
                return feature
              })
            }
          } catch (e) {
            console.error("Failed to load demo feature translations:", e)
          }
        }

        // Load Stats translations for current language (if not English)
        let translatedStats = stats
        if (currentLang !== 'en' && stats) {
          try {
            const { data: statsTranslation } = await supabase
              .from("landing_stats_translations")
              .select("*")
              .eq("stats_id", stats.id)
              .eq("language", currentLang)
              .maybeSingle()
            
            if (statsTranslation) {
              // Apply translations to stats labels
              translatedStats = {
                ...stats,
                plants_label: statsTranslation.plants_label || stats.plants_label,
                users_label: statsTranslation.users_label || stats.users_label,
                tasks_label: statsTranslation.tasks_label || stats.tasks_label,
                rating_label: statsTranslation.rating_label || stats.rating_label,
              }
            }
          } catch (e) {
            console.error("Failed to load stats translations:", e)
          }
        }

        // Load Showcase Configuration
        let showcaseConfig: ShowcaseConfig | null = null
        try {
          const { data: showcaseData } = await supabase
            .from("landing_showcase_config")
            .select("*")
            .limit(1)
            .maybeSingle()
          
          if (showcaseData) {
            showcaseConfig = showcaseData
          }
        } catch (e) {
          // Table may not exist yet, use defaults in component
          console.error("Failed to load showcase config:", e)
        }
        
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

  // Page metadata from translations
  usePageMetadata({
    title: "Aphylia – " + t("hero.badge"),
    description: t("hero.description"),
  })

  return (
    <LandingDataContext.Provider value={landingData}>
    <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50/50 via-white to-stone-100 dark:from-[#0a0f0a] dark:via-[#111714] dark:to-[#0d1210] overflow-x-hidden">
      <style>{animationStyles}</style>
      
      {/* Ambient Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative">
        {/* Mobile Logo Header */}
        <header className="md:hidden flex items-center justify-center py-6 mb-2 px-4">
          <Link to={user ? "/discovery" : "/"} className="flex items-center gap-3 no-underline group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-lg group-hover:bg-emerald-500/30 transition-colors" />
              <img src="/icons/plant-swipe-icon.svg" alt="Aphylia" className="relative h-11 w-10 plant-icon-theme" draggable="false" />
            </div>
            <span className="font-brand text-[1.75rem] font-bold tracking-tight text-stone-900 dark:text-white">
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

        {/* Stats Banner */}
        {(landingData.settings?.show_stats_section ?? true) && <StatsBanner />}

        {/* Beginner Friendly Section */}
        {(landingData.settings?.show_beginner_section ?? true) && <BeginnerFriendlySection />}

        {/* Features Grid */}
        {(landingData.settings?.show_features_section ?? true) && <FeaturesSection />}

        {/* Interactive Demo - Feature Wheel */}
        {(landingData.settings?.show_demo_section ?? true) && <InteractiveDemoSection />}

        {/* Showcase Section */}
        {(landingData.settings?.show_showcase_section ?? true) && <ShowcaseSection />}

        {/* How It Works */}
        {(landingData.settings?.show_how_it_works_section ?? true) && <HowItWorksSection />}

        {/* Testimonials */}
        {(landingData.settings?.show_testimonials_section ?? true) && <TestimonialsSection />}

        {/* FAQ */}
        {(landingData.settings?.show_faq_section ?? true) && <FAQSection />}

        {/* Final CTA */}
        {(landingData.settings?.show_final_cta_section ?? true) && <FinalCTASection />}

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
const HeroSection: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { stats } = useLandingData()

  // All text content from translations (not editable via admin)
  const badgeText = t("hero.badge")
  const titleStart = t("hero.title")
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
    <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 px-4 sm:px-6 lg:px-8 overflow-visible">
      {/* Floating Plant Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[10%] opacity-20 dark:opacity-10 animate-float">
          <Leaf className="h-12 w-12 text-emerald-500 rotate-[-15deg]" />
        </div>
        <div className="absolute top-40 right-[15%] opacity-15 dark:opacity-10 animate-float-delayed">
          <Flower2 className="h-16 w-16 text-pink-400 rotate-12" />
        </div>
        <div className="absolute bottom-32 left-[20%] opacity-20 dark:opacity-10 animate-float-slow">
          <TreeDeciduous className="h-14 w-14 text-emerald-600 rotate-[-8deg]" />
        </div>
        <div className="absolute top-60 left-[5%] opacity-10 dark:opacity-5 animate-float-delayed">
          <Sprout className="h-10 w-10 text-green-500" />
        </div>
        <div className="absolute bottom-20 right-[10%] opacity-15 dark:opacity-10 animate-float">
          <Droplets className="h-8 w-8 text-blue-400" />
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Hero Content */}
          <div className="text-center lg:text-left space-y-8 animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
              <div className="relative">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <div className="absolute inset-0 animate-ping">
                  <Sparkles className="h-4 w-4 text-emerald-500 opacity-50" />
                </div>
              </div>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {badgeText}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1]">
              <span className="text-stone-900 dark:text-white">{titleStart}</span>{" "}
              <span className="gradient-text">{titleHighlight}</span>{" "}
              <span className="text-stone-900 dark:text-white">{titleEnd}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-stone-600 dark:text-stone-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {description}
            </p>

            {/* CTA Buttons - Enhanced with stronger visual emphasis */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to={ctaPrimaryLink}
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 text-white text-lg font-bold overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-1 animate-gradient"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity animate-gradient" />
                <Sparkles className="relative h-5 w-5" />
                <span className="relative">{ctaPrimaryText}</span>
                <ArrowRight className="relative h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to={ctaSecondaryLink}
                className="group inline-flex items-center justify-center gap-2 px-8 py-5 rounded-2xl bg-white/90 dark:bg-white/10 backdrop-blur-sm text-stone-900 dark:text-white text-base font-semibold border-2 border-emerald-500/30 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>{ctaSecondaryText}</span>
                <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Social Proof Pills */}
            <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start pt-4">
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
}

const HeroVisual: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { heroCards: dbHeroCards } = useLandingData()
  
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
  // Plant name and image come from database, but all other fields use translations for proper localization
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

  return (
    <div className="relative">
      {/* Glow Effects */}
      <div className="absolute inset-0 -m-12 bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-green-500/30 rounded-full blur-3xl animate-pulse-glow" />
      
      {/* Main Phone Frame */}
      <div className="relative w-[300px] sm:w-[340px] animate-float-slow">
        <div className="relative bg-stone-900 dark:bg-stone-950 rounded-[3rem] p-3 shadow-2xl shadow-emerald-900/20">
          {/* Screen */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-[#0f1a14] dark:to-[#0a1510] rounded-[2.5rem] overflow-hidden">
            {/* Dynamic Island */}
            <div className="h-10 flex items-center justify-center pt-2">
              <div className="w-24 h-7 bg-stone-900 dark:bg-black rounded-full" />
            </div>

            {/* App Content */}
            <div className="px-5 pb-8 space-y-4">
              {/* Plant Image Area */}
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-400/20 to-teal-400/20">
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={plantName}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                      <Leaf className="relative h-20 w-20 text-emerald-500/60" />
                    </div>
                  </div>
                )}
                {/* Plant Info Overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="glass-card rounded-2xl p-3 space-y-1 border border-white/30 dark:border-white/10">
                    <p className="text-stone-900 dark:text-white font-semibold text-sm">{plantName}</p>
                    <p className="text-stone-600 dark:text-stone-400 text-xs italic">{plantScientific}</p>
                  </div>
                </div>
              </div>

              {/* Care Pills */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-white/10 border border-stone-200/50 dark:border-white/10">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Droplets className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-xs text-stone-600 dark:text-stone-300">{waterFrequency}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-white/10 border border-stone-200/50 dark:border-white/10">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Sun className="h-4 w-4 text-amber-500" />
                  </div>
                  <span className="text-xs text-stone-600 dark:text-stone-300">{lightLevel}</span>
                </div>
              </div>

              {/* Reminder Card */}
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center animate-bounce-subtle">
                  <Bell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wide">{t("heroCard.nextReminder")}</p>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">{reminderText}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-500" />
              </div>

              {/* Card Indicators - show if multiple cards */}
              {dbHeroCards.length > 1 && (
                <div className="flex justify-center gap-1.5 pt-2">
                  {dbHeroCards.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveCardIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeCardIndex 
                          ? 'w-6 bg-emerald-500' 
                          : 'w-1.5 bg-stone-300 dark:bg-stone-600 hover:bg-stone-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Cards */}
      <div className="absolute -top-4 -left-8 px-4 py-3 rounded-2xl glass-card shadow-lg border border-white/30 dark:border-white/10 animate-float" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm font-medium text-stone-900 dark:text-white">{t("heroCard.careLogged")}</span>
        </div>
      </div>

      <div className="absolute -bottom-2 -right-6 px-4 py-3 rounded-2xl glass-card shadow-lg border border-white/30 dark:border-white/10 animate-float-delayed">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-pink-500/20 flex items-center justify-center">
            <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
          </div>
          <span className="text-sm font-medium text-stone-900 dark:text-white">{t("floatingCards.newLikes", { defaultValue: "+42 today" })}</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STATS BANNER - Animated Counter Section
   ═══════════════════════════════════════════════════════════════════════════════ */
const StatsBanner: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { stats: dbStats } = useLandingData()
  
  // Use database values if available, otherwise fallback to translations
  const stats = [
    { 
      value: dbStats?.plants_count || "10K+", 
      label: dbStats?.plants_label || t("stats.plants", { defaultValue: "Plant Species" }), 
      icon: Leaf 
    },
    { 
      value: dbStats?.users_count || "50K+", 
      label: dbStats?.users_label || t("stats.users", { defaultValue: "Happy Gardeners" }), 
      icon: Users 
    },
    { 
      value: dbStats?.tasks_count || "100K+", 
      label: dbStats?.tasks_label || t("stats.tasks", { defaultValue: "Care Tasks Done" }), 
      icon: Check 
    },
    { 
      value: dbStats?.rating_value || "4.9", 
      label: dbStats?.rating_label || t("stats.rating", { defaultValue: "App Store Rating" }), 
      icon: Star 
    },
  ]

  return (
    <section className="relative py-12 lg:py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 p-[1px]">
          <div className="rounded-3xl bg-white/95 dark:bg-stone-950/95 backdrop-blur-xl px-8 py-10 lg:px-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-emerald-500/10 mb-4 group-hover:scale-110 transition-transform">
                    <stat.icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-3xl lg:text-4xl font-bold text-stone-900 dark:text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-stone-600 dark:text-stone-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BEGINNER FRIENDLY SECTION - New Gardeners Welcome
   ═══════════════════════════════════════════════════════════════════════════════ */
const BeginnerFriendlySection: React.FC = () => {
  const { t } = useTranslation("Landing")

  // All text content from translations (not editable via admin)
  const badge = t("beginner.badge", { defaultValue: "Perfect for Beginners" })
  const title = t("beginner.title", { defaultValue: "Know Nothing About Gardening?" })
  const titleHighlight = t("beginner.titleHighlight", { defaultValue: "That's Exactly Why We Built This" })
  const subtitle = t("beginner.subtitle", { defaultValue: "Everyone starts somewhere. Aphylia turns complete beginners into confident plant parents with gentle guidance, smart reminders, and a helpful assistant that speaks your language — not complicated botany." })

  const beginnerFeatures = [
    {
      icon: GraduationCap,
      title: t("beginner.feature1Title", { defaultValue: "Learn as You Grow" }),
      description: t("beginner.feature1Desc", { defaultValue: "No gardening experience? No problem! Our app teaches you everything step by step." }),
      color: "emerald",
    },
    {
      icon: Sparkles,
      title: t("beginner.feature2Title", { defaultValue: "Your Plant Assistant" }),
      description: t("beginner.feature2Desc", { defaultValue: "Not sure what's wrong? Just ask Aphylia - your friendly assistant that explains plant care in simple terms." }),
      color: "purple",
    },
    {
      icon: Bell,
      title: t("beginner.feature3Title", { defaultValue: "Never Forget to Water" }),
      description: t("beginner.feature3Desc", { defaultValue: "Get gentle reminders exactly when your plants need attention. We'll help you build the habit." }),
      color: "blue",
    },
    {
      icon: Camera,
      title: t("beginner.feature4Title", { defaultValue: "Identify Any Plant" }),
      description: t("beginner.feature4Desc", { defaultValue: "Found a plant but don't know what it is? Snap a photo and we'll tell you everything about it." }),
      color: "pink",
    },
  ]

  return (
    <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Sprout className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {badge}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-6">
            {title}
            <br />
            <span className="gradient-text">{titleHighlight}</span>
          </h2>
          <p className="text-lg sm:text-xl text-stone-600 dark:text-stone-400 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {beginnerFeatures.map((feature, i) => (
            <div
              key={i}
              className="group relative rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5"
            >
              <div className={`h-14 w-14 rounded-2xl bg-${feature.color}-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`h-7 w-7 text-${feature.color}-500`} />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-green-500/5 border border-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Heart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-stone-900 dark:text-white">
                  {t("beginner.ctaTitle", { defaultValue: "Join thousands of first-time plant parents" })}
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  {t("beginner.ctaSubtitle", { defaultValue: "Start your green journey today — we'll guide you every step of the way" })}
                </p>
              </div>
            </div>
            <Link
              to="/discovery"
              className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              {t("beginner.ctaButton", { defaultValue: "Get Started Free" })}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FEATURES SECTION - Bento Grid Style
   ═══════════════════════════════════════════════════════════════════════════════ */
const FeaturesSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  return (
    <section id="features" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Zap className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t("features.badge", { defaultValue: "Powerful Features" })}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("features.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("features.subtitle")}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Large Feature Card */}
          <div className="md:col-span-2 lg:col-span-2 group relative rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 p-8 overflow-hidden hover:border-emerald-500/40 transition-all duration-500">
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

          {/* Regular Feature Cards */}
          <FeatureCard icon={Bell} title={t("features.careReminders.title")} description={t("features.careReminders.description")} gradient="from-blue-500/10 to-indigo-500/10" iconBg="bg-blue-500" />
          <FeatureCard icon={Camera} title={t("features.plantId.title")} description={t("features.plantId.description")} gradient="from-pink-500/10 to-rose-500/10" iconBg="bg-pink-500" />
          <FeatureCard icon={NotebookPen} title={t("features.journal.title")} description={t("features.journal.description")} gradient="from-amber-500/10 to-orange-500/10" iconBg="bg-amber-500" />
          
          {/* Wide Feature Card */}
          <div className="md:col-span-2 lg:col-span-2 group relative rounded-3xl bg-gradient-to-r from-purple-500/10 via-violet-500/5 to-transparent border border-purple-500/20 p-8 overflow-hidden hover:border-purple-500/40 transition-all duration-500">
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
}

const FeatureCard: React.FC<{
  icon: React.ElementType
  title: string
  description: string
  gradient: string
  iconBg: string
}> = ({ icon: Icon, title, description, gradient, iconBg }) => (
  <div className={`group relative rounded-3xl bg-gradient-to-br ${gradient} border border-stone-200/50 dark:border-white/10 p-6 overflow-hidden hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
    <div className={`inline-flex h-12 w-12 rounded-xl ${iconBg} items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">{title}</h3>
    <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">{description}</p>
  </div>
)

/* ═══════════════════════════════════════════════════════════════════════════════
   INTERACTIVE DEMO SECTION - Feature Wheel
   ═══════════════════════════════════════════════════════════════════════════════ */
// Icon mapping for database features
const demoIconMap: Record<string, React.ElementType> = {
  Leaf, Clock, TrendingUp, Shield, Camera, NotebookPen, Users, Sparkles,
  Bell, Heart, Star, Zap, Globe, Search, BookMarked, Flower2, TreeDeciduous, Sprout, Sun, Droplets
}

const InteractiveDemoSection: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { demoFeatures } = useLandingData()
  const [activeFeature, setActiveFeature] = React.useState(0)

  // Default features from translations (fallback if no database features)
  const defaultFeatures = [
    { icon: Leaf, label: t("demo.discover", { defaultValue: "Discover Plants" }), color: "emerald" },
    { icon: Clock, label: t("demo.schedule", { defaultValue: "Schedule Care" }), color: "blue" },
    { icon: TrendingUp, label: t("demo.track", { defaultValue: "Track Growth" }), color: "purple" },
    { icon: Shield, label: t("demo.protect", { defaultValue: "Get Alerts" }), color: "rose" },
    { icon: Camera, label: t("demo.identify", { defaultValue: "Identify Plants" }), color: "pink" },
    { icon: NotebookPen, label: t("demo.journal", { defaultValue: "Keep Journal" }), color: "amber" },
    { icon: Users, label: t("demo.community", { defaultValue: "Join Community" }), color: "teal" },
    { icon: Sparkles, label: t("demo.assistant", { defaultValue: "Smart Assistant" }), color: "indigo" },
  ]

  // Use database features if available, otherwise use defaults
  const features = demoFeatures.length > 0
    ? demoFeatures.map(f => ({
        icon: demoIconMap[f.icon_name] || Leaf,
        label: f.label,
        color: f.color,
      }))
    : defaultFeatures

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [features.length])

  return (
    <section className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-emerald-50/30 to-transparent dark:via-emerald-950/20">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Demo Visual */}
          <div className="relative order-2 lg:order-1">
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Center Circle */}
              <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30" />
              <div className="absolute inset-[25%] rounded-full bg-white dark:bg-stone-900 shadow-2xl shadow-emerald-500/20 flex items-center justify-center">
                <div className="text-center p-4 sm:p-6">
                  {features[activeFeature] && (
                    <>
                      <div className={`inline-flex h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-${features[activeFeature].color}-500 items-center justify-center mb-3`}>
                        {React.createElement(features[activeFeature].icon, { className: "h-7 w-7 sm:h-8 sm:w-8 text-white" })}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-stone-900 dark:text-white">{features[activeFeature].label}</p>
                    </>
                  )}
                </div>
              </div>
              
              {/* Orbiting Elements - Ferris wheel style: icons stay upright */}
              <div className="absolute inset-0 animate-spin-slow" style={{ transformOrigin: 'center center' }}>
                {features.map((feature, i) => {
                  const angleStep = 360 / features.length
                  const angle = (i * angleStep - 90) * (Math.PI / 180) // Start from top
                  const x = 50 + 42 * Math.cos(angle)
                  const y = 50 + 42 * Math.sin(angle)
                  const IconComponent = feature.icon
                  const colorClass = `bg-${feature.color}-500`
                  return (
                    <div
                      key={i}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <button
                        onClick={() => setActiveFeature(i)}
                        className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-all duration-300 animate-counter-spin-slow ${
                          activeFeature === i 
                            ? `${colorClass} scale-110 shadow-lg` 
                            : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:scale-105'
                        }`}
                      >
                        <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${activeFeature === i ? 'text-white' : 'text-stone-600 dark:text-stone-400'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-6">
              {t("demo.title", { defaultValue: "Your Complete Plant Care Companion" })}
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-400 mb-8 max-w-lg mx-auto lg:mx-0">
              {t("demo.description", { defaultValue: "From discovery to daily care, we've got everything you need to help your plants thrive." })}
            </p>
            
            {/* Feature Tabs */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              {features.map((feature, i) => (
                <button
                  key={i}
                  onClick={() => setActiveFeature(i)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    activeFeature === i
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-white dark:bg-white/10 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-white/10 hover:border-emerald-500/30'
                  }`}
                >
                  <feature.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{feature.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHOWCASE SECTION - Realistic UI Previews matching actual app components
   Fully configurable via Admin Panel
   ═══════════════════════════════════════════════════════════════════════════════ */
const ShowcaseSection: React.FC = () => {
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
    <section className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-stone-100/50 to-transparent dark:via-stone-900/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
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
                    <img src={config.cover_image_url} alt={config.garden_name} className="w-full h-full object-cover" />
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Owner</span>
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
                      <img src={plant.image_url} alt={plant.name} className="w-full h-full object-cover group-hover/plant:scale-110 transition-transform" />
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
                  <Calendar className="h-4 w-4" /> Last 30 days
                </h4>
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-stone-500">Completed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-stone-300 dark:bg-stone-600" />
                    <span className="text-stone-500">Missed</span>
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
          <div className="group rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1 dark:bg-stone-900/50">
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
                <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-white dark:bg-stone-700 shadow-sm text-emerald-600 dark:text-emerald-400">Overview</span>
                <span className="px-2 py-1 text-[10px] font-medium text-stone-500">Tasks</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-[20px] bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-3 relative overflow-hidden border border-stone-200/50 dark:border-stone-700/50">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 mb-1">
                    <Target className="w-3 h-3" />
                    <span>Completion Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{config.completion_rate}%</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500">+8%</span>
                    <span className="text-[9px] text-stone-400">vs last week</span>
                  </div>
                </div>
              </div>
              
              <div className="rounded-[20px] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-3 relative overflow-hidden border border-stone-200/50 dark:border-stone-700/50">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-1 text-[10px] text-orange-700 dark:text-orange-300 mb-1">
                    <Flame className="w-3 h-3" />
                    <span>Current Streak</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{config.analytics_streak}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">Best: 21 days</div>
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
          <div className="group rounded-3xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 p-6 hover:border-rose-500/40 transition-all duration-300 hover:-translate-y-1 dark:bg-stone-900/50">
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
              <span className="text-xs text-rose-600 dark:text-rose-400">Keep away from pets</span>
            </div>
          </div>

          {/* Encyclopedia Card */}
          <div className="md:col-span-2 group rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6 hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1 dark:bg-stone-900/50">
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
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HOW IT WORKS - Redesigned
   ═══════════════════════════════════════════════════════════════════════════════ */
const HowItWorksSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  const steps = [
    { num: 1, icon: Search, titleKey: "howItWorks.step1.title", descKey: "howItWorks.step1.description" },
    { num: 2, icon: Sprout, titleKey: "howItWorks.step2.title", descKey: "howItWorks.step2.description" },
    { num: 3, icon: Bell, titleKey: "howItWorks.step3.title", descKey: "howItWorks.step3.description" },
  ]

  return (
    <section id="how-it-works" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("howItWorks.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-24 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 rounded-full" />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center group">
                {/* Step Number with Icon */}
                <div className="relative z-10 mx-auto mb-8">
                  <div className="relative inline-flex">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                      <step.icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white dark:bg-stone-900 border-2 border-emerald-500 flex items-center justify-center">
                      <span className="text-sm font-bold text-emerald-600">{step.num}</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-3">{t(step.titleKey)}</h3>
                <p className="text-stone-600 dark:text-stone-400 max-w-xs mx-auto">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TESTIMONIALS - Redesigned with Marquee
   ═══════════════════════════════════════════════════════════════════════════════ */
const TestimonialsSection: React.FC = () => {
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
    <section className="py-20 lg:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
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
              <div className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 h-full hover:shadow-xl transition-shadow">
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
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FAQ SECTION - Redesigned
   ═══════════════════════════════════════════════════════════════════════════════ */
const FAQSection: React.FC = () => {
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
    <section id="faq" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4">
            {t("faq.title")}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            {t("faq.subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden hover:border-emerald-500/30 transition-colors">
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
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-emerald-400/40 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-cyan-400/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
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
                    <span className="relative">Email Us</span>
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
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FINAL CTA - Enhanced
   ═══════════════════════════════════════════════════════════════════════════════ */
const FinalCTASection: React.FC = () => {
  const { t } = useTranslation("Landing")

  // All text content from translations (not editable via admin)
  const badge = t("finalCta.badge", { defaultValue: "No experience needed" })
  const title = t("finalCta.title", { defaultValue: "Ready to Start Your Plant Journey?" })
  const subtitle = t("finalCta.subtitle", { defaultValue: "Whether it's your first succulent or you're building a jungle, Aphylia grows with you. Join thousands who went from plant newbies to proud plant parents." })
  const primaryButtonText = t("finalCta.ctaDownload", { defaultValue: "Start Growing" })
  const secondaryButtonText = t("finalCta.ctaDocs", { defaultValue: "Explore Plants" })

  return (
    <section className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-[2.5rem] overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-green-600" />
          
          {/* Animated Orbs */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '2s' }} />
          
          {/* Pattern Overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />

          <div className="relative px-8 py-16 lg:px-16 lg:py-24 text-center">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Beginner Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                <Sprout className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white">
                  {badge}
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
                {title}
              </h2>
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto">
                {subtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link
                  to="/download"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-emerald-600 text-base font-bold hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                  <Leaf className="h-5 w-5" />
                  {primaryButtonText}
                </Link>
                <Link
                  to="/discovery"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-base font-semibold border border-white/30 transition-all hover:-translate-y-0.5"
                >
                  {secondaryButtonText}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Social Links */}
              <div className="pt-8 border-t border-white/20">
                <p className="text-white/70 text-sm mb-4">
                  {t("finalCta.socialText", { defaultValue: "Let's connect! We love hearing from you" })}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="https://instagram.com/aphylia_app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-5 w-5 text-white" />
                  </a>
                  <a
                    href="https://twitter.com/aphylia_app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label="Twitter"
                  >
                    <Twitter className="h-5 w-5 text-white" />
                  </a>
                  <a
                    href="mailto:hello@aphylia.app"
                    className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label="Email"
                  >
                    <Mail className="h-5 w-5 text-white" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LandingPage
