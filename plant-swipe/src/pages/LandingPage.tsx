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
  MessageCircle,
} from "lucide-react"

// Lightweight landing page - no heavy dependencies for fast LCP
const LandingPage: React.FC = () => {
  const { t } = useTranslation("Landing")
  const { user, profile, signOut } = useAuth()
  const { openLogin, openSignup } = useAuthActions()
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()

  const handleProfileNavigation = React.useCallback(() => {
    navigate('/profile')
  }, [navigate])

  const handleLogout = React.useCallback(async () => {
    await signOut()
    // Stay on current page unless it requires authentication
    const protectedPrefixes = ['/profile', '/friends', '/settings', '/admin', '/create']
    const isOnProtectedPage = protectedPrefixes.some(prefix => 
      pathWithoutLang === prefix || pathWithoutLang.startsWith(prefix + '/')
    ) || pathWithoutLang.match(/^\/plants\/[^/]+\/edit$/)
    
    if (isOnProtectedPage) {
      navigate('/')
    }
  }, [signOut, navigate, pathWithoutLang])

  usePageMetadata({
    title: "Aphylia – " + t("hero.badge"),
    description: t("hero.description"),
  })

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] px-4 pb-24 pt-2 md:px-8 md:pb-8 md:pt-4 overflow-x-hidden overflow-y-visible">
      {/* Mobile Logo Header - only shown on mobile, only on landing page */}
      <header className="md:hidden flex items-center justify-center py-4">
        <Link
          to={user ? "/discovery" : "/"}
          className="flex items-center gap-2 no-underline"
        >
          <img 
            src="/icons/plant-swipe-icon.svg" 
            alt="Aphylia" 
            className="h-10 w-9 plant-icon-theme"
            draggable="false"
          />
          <span className="font-brand text-2xl font-semibold tracking-tight text-black dark:text-white">
            {t("common.appName", { ns: "common", defaultValue: "Aphylia" })}
          </span>
        </Link>
      </header>

      {/* Style for plant icon to work in dark mode */}
      <style>{`
        .plant-icon-theme {
          filter: brightness(0) saturate(100%);
        }
        .dark .plant-icon-theme {
          filter: brightness(0) saturate(100%) invert(100%);
        }
      `}</style>

      {/* Desktop Navigation - uses the real TopBar */}
      <div className="overflow-y-visible">
        <TopBar
          openLogin={openLogin}
          openSignup={openSignup}
          user={user}
          displayName={profile?.display_name || null}
          onProfile={handleProfileNavigation}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Navigation - uses the real MobileNavBar */}
      <MobileNavBar
        canCreate={false}
        onLogin={openLogin}
        onSignup={openSignup}
        onProfile={handleProfileNavigation}
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <HeroSection />

      {/* Feature Grid */}
      <FeaturesSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Showcase */}
      <ShowcaseSection />

      {/* Social Proof */}
      <TestimonialsSection />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA */}
      <FinalCTASection />

      {/* Footer - same as the rest of the app */}
      <Footer />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HERO SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const HeroSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-emerald-500/10 via-emerald-400/5 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {t("hero.badge")}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              {t("hero.title")}{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                {t("hero.titleHighlight")}
              </span>{" "}
              {t("hero.titleEnd")}
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t("hero.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground text-base font-semibold hover:opacity-90 transition-all"
              >
                <Leaf className="h-5 w-5" />
                {t("hero.ctaDownload")}
              </Link>
              <Link
                to="/discovery"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-secondary text-secondary-foreground text-base font-semibold border border-border hover:bg-secondary/80 transition-all"
              >
                {t("hero.ctaTryBrowser")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("hero.socialProof")}
            </p>
          </div>

          {/* Right: Hero Card / Phone Mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <HeroCard />
          </div>
        </div>
      </div>
    </section>
  )
}

const HeroCard: React.FC = () => {
  const { t } = useTranslation("Landing")

  return (
    <div className="relative">
      {/* Glow behind card */}
      <div
        className="absolute inset-0 -m-8 bg-gradient-radial from-emerald-500/20 via-emerald-400/5 to-transparent blur-2xl"
        aria-hidden="true"
      />

      {/* Phone Frame */}
      <div className="relative w-[280px] sm:w-[320px] bg-card rounded-[3rem] p-3 shadow-2xl border border-border">
        <div className="bg-secondary rounded-[2.5rem] overflow-hidden">
          {/* Status bar */}
          <div className="h-8 flex items-center justify-center">
            <div className="w-20 h-5 bg-muted rounded-full" />
          </div>

          {/* Content */}
          <div className="px-4 pb-6 space-y-4">
            {/* Plant Image Placeholder */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-emerald-500/10">
              <div className="absolute inset-0 flex items-center justify-center">
                <Leaf className="h-16 w-16 text-emerald-500/30" />
              </div>
              {/* Overlay info */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="bg-background/90 backdrop-blur-md rounded-xl p-3 space-y-1 border border-border">
                  <p className="text-foreground font-semibold text-sm">{t("heroCard.plantName")}</p>
                  <p className="text-muted-foreground text-xs italic">{t("heroCard.plantSubname")}</p>
                </div>
              </div>
            </div>

            {/* Care Info Pills */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border">
                <Droplets className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">{t("heroCard.waterFrequency")}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">{t("heroCard.lightLevel")}</span>
              </div>
            </div>

            {/* Reminder Pill */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">{t("heroCard.nextReminder")}</p>
                <p className="text-sm font-medium text-foreground">{t("heroCard.waterIn")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute -top-4 -right-4 px-3 py-2 rounded-xl bg-card shadow-lg border border-border animate-float-slow">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-xs font-medium text-foreground">{t("heroCard.careLogged")}</span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURES SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const colorMap = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
} as const

const FeaturesSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  const features = [
    {
      icon: BookMarked,
      titleKey: "features.smartLibrary.title",
      descKey: "features.smartLibrary.description",
      color: "emerald" as const,
    },
    {
      icon: Bell,
      titleKey: "features.careReminders.title",
      descKey: "features.careReminders.description",
      color: "blue" as const,
    },
    {
      icon: BookMarked,
      titleKey: "features.collections.title",
      descKey: "features.collections.description",
      color: "purple" as const,
    },
    {
      icon: Camera,
      titleKey: "features.plantId.title",
      descKey: "features.plantId.description",
      color: "pink" as const,
    },
    {
      icon: NotebookPen,
      titleKey: "features.journal.title",
      descKey: "features.journal.description",
      color: "amber" as const,
    },
    {
      icon: Wifi,
      titleKey: "features.pwa.title",
      descKey: "features.pwa.description",
      color: "teal" as const,
    },
  ]

  return (
    <section id="features" className="py-20 lg:py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            {t("features.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <FeatureCard
              key={i}
              icon={feature.icon}
              title={t(feature.titleKey)}
              description={t(feature.descKey)}
              color={feature.color}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const FeatureCard: React.FC<{
  icon: React.ElementType
  title: string
  description: string
  color: keyof typeof colorMap
}> = ({ icon: Icon, title, description, color }) => {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-6 hover:border-emerald-500/30 hover:bg-card/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Icon */}
      <div
        className={`inline-flex h-12 w-12 rounded-xl ${colorMap[color]} items-center justify-center mb-4`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HOW IT WORKS
   ───────────────────────────────────────────────────────────────────────────── */
const HowItWorksSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  const steps = [
    { num: 1, titleKey: "howItWorks.step1.title", descKey: "howItWorks.step1.description" },
    { num: 2, titleKey: "howItWorks.step2.title", descKey: "howItWorks.step2.description" },
    { num: 3, titleKey: "howItWorks.step3.title", descKey: "howItWorks.step3.description" },
  ]

  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-32 bg-secondary/30 scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            {t("howItWorks.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        <div className="relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-1/2 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400"
            aria-hidden="true"
          />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                {/* Number badge */}
                <div className="relative z-10 mx-auto mb-6 h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                  <span className="text-2xl font-bold text-white">{step.num}</span>
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2">{t(step.titleKey)}</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHOWCASE SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const ShowcaseSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  return (
    <section className="py-20 lg:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            {t("showcase.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("showcase.subtitle")}
          </p>
        </div>

        {/* Showcase Grid */}
        <div className="relative">
          {/* Background glow */}
          <div
            className="absolute inset-0 -m-20 bg-gradient-radial from-emerald-500/5 to-transparent blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative grid md:grid-cols-3 gap-6">
            {/* Main card */}
            <div className="md:col-span-2 md:row-span-2 rounded-3xl bg-card border border-border p-8 overflow-hidden relative group">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxMjgsMTI4LDEyOCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
              <div className="relative h-full min-h-[300px] flex flex-col justify-end">
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    {t("showcase.dashboardPreview")}
                  </span>
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-foreground">{t("showcase.dashboardTitle")}</h3>
                  <p className="text-muted-foreground max-w-md">
                    {t("showcase.dashboardDescription")}
                  </p>
                </div>
              </div>
            </div>

            {/* Small cards */}
            <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-6 flex flex-col justify-between">
              <Droplets className="h-8 w-8 text-blue-500 mb-4" />
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">{t("showcase.wateringReminder")}</p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">{t("showcase.wateringText")}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-6 flex flex-col justify-between">
              <Sun className="h-8 w-8 text-amber-500 mb-4" />
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">{t("showcase.lightCheck")}</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">{t("showcase.lightText")}</p>
              </div>
            </div>

            <div className="md:col-span-1 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs text-rose-600/80 dark:text-rose-400/80">{t("showcase.toxicityAlert")}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">{t("showcase.petWarning")}</p>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/70">{t("showcase.petWarningText")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   TESTIMONIALS
   ───────────────────────────────────────────────────────────────────────────── */
const TestimonialsSection: React.FC = () => {
  const { t } = useTranslation("Landing")

  const rawTestimonials = t("testimonials.items", { returnObjects: true })
  const testimonials = Array.isArray(rawTestimonials) ? rawTestimonials as Array<{
    name: string
    role: string
    quote: string
  }> : []

  return (
    <section className="py-20 lg:py-32 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            {t("testimonials.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-foreground text-sm mb-6 leading-relaxed">"{testimonial.quote}"</p>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{testimonial.name}</p>
                  <p className="text-muted-foreground text-xs">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FAQ SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)
  const { t } = useTranslation("Landing")

  const rawFaqs = t("faq.items", { returnObjects: true })
  const faqs = Array.isArray(rawFaqs) ? rawFaqs as Array<{ q: string; a: string }> : []

  return (
    <section id="faq" className="py-20 lg:py-32 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            {t("faq.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("faq.subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
                aria-expanded={openIndex === i}
              >
                <span className="font-medium text-foreground">{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === i ? "max-h-40" : "max-h-0"
                }`}
              >
                <p className="px-6 pb-4 text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Support CTA */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-col items-center gap-4 p-6 rounded-2xl bg-card border border-border">
            <MessageCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {t("faq.supportTitle", { defaultValue: "We're here to answer your questions" })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("faq.supportSubtitle", { defaultValue: "Let us know any question you have" })}
              </p>
            </div>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
            >
              {t("faq.supportButton", { defaultValue: "Contact Support" })}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FINAL CTA
   ───────────────────────────────────────────────────────────────────────────── */
const FinalCTASection: React.FC = () => {
  const { t } = useTranslation("Landing")

  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-emerald-500 p-12 lg:p-20">
          {/* Background pattern */}
          <div
            className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"
            aria-hidden="true"
          />

          <div className="relative text-center space-y-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white max-w-2xl mx-auto leading-tight">
              {t("finalCta.title")}
            </h2>
            <p className="text-lg text-white/80 max-w-xl mx-auto">
              {t("finalCta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-emerald-600 text-base font-semibold hover:bg-white/90 transition-all"
              >
                <Leaf className="h-5 w-5" />
                {t("finalCta.ctaDownload")}
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-base font-semibold border border-white/20 transition-all"
              >
                {t("finalCta.ctaDocs")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LandingPage
