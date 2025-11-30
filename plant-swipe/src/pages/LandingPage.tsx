import React from "react"
import { Link } from "@/components/i18n/Link"
import { usePageMetadata } from "@/hooks/usePageMetadata"
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
} from "lucide-react"

// Lightweight landing page - no heavy dependencies for fast LCP
const LandingPage: React.FC = () => {
  usePageMetadata({
    title: "Aphylia – Your companion for happier plants",
    description:
      "Know your plants. Learn how to take care of them. Aphylia is a smart plant & garden companion that tracks care, reminds you, and helps you learn.",
  })

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-50 via-white to-stone-100 dark:from-[#0f0f10] dark:via-[#151516] dark:to-[#1a1a1b] overflow-x-hidden">
      {/* Sticky Navigation */}
      <LandingNav />

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

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA */}
      <FinalCTASection />

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────────────────────────────────────────── */
const LandingNav: React.FC = () => {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 dark:bg-[#0f0f10]/80 backdrop-blur-xl border-b border-stone-200/50 dark:border-white/5 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="font-brand text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Aphylia
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection("features")}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection("how-it-works")}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection("pricing")}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            Pricing
          </button>
          <button
            onClick={() => scrollToSection("faq")}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            FAQ
          </button>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/discovery"
            className="hidden sm:inline-flex text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            to="/discovery"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 hover:-translate-y-0.5"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>
    </header>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HERO SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const HeroSection: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-emerald-400/20 via-emerald-300/5 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-40 right-0 w-[400px] h-[400px] bg-gradient-radial from-green-300/15 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Your companion for happier plants
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Know your plants.{" "}
              <span className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 bg-clip-text text-transparent">
                Learn how to care
              </span>{" "}
              for them.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Aphylia is a smart plant & garden app that tracks care schedules, sends timely reminders,
              and teaches you everything about your green companions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Leaf className="h-5 w-5" />
                Download Aphylia
              </Link>
              <Link
                to="/discovery"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-900 dark:text-white text-base font-semibold border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-200"
              >
                Try it in your browser
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Built for plant lovers, beginners and experts alike.
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
  return (
    <div className="relative">
      {/* Glow behind card */}
      <div
        className="absolute inset-0 -m-8 bg-gradient-radial from-emerald-400/30 via-green-400/10 to-transparent blur-2xl"
        aria-hidden="true"
      />

      {/* Phone Frame */}
      <div className="relative w-[280px] sm:w-[320px] bg-slate-900 rounded-[3rem] p-3 shadow-2xl shadow-slate-900/50">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] overflow-hidden">
          {/* Status bar */}
          <div className="h-8 flex items-center justify-center">
            <div className="w-20 h-5 bg-slate-800 rounded-full" />
          </div>

          {/* Content */}
          <div className="px-4 pb-6 space-y-4">
            {/* Plant Image Placeholder */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400/20 to-green-600/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <Leaf className="h-16 w-16 text-emerald-400/40" />
              </div>
              {/* Overlay info */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 space-y-1">
                  <p className="text-white font-semibold text-sm">Monstera deliciosa</p>
                  <p className="text-white/70 text-xs italic">Swiss Cheese Plant</p>
                </div>
              </div>
            </div>

            {/* Care Info Pills */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <Droplets className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-white/80">Every 7 days</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-white/80">Bright indirect</span>
              </div>
            </div>

            {/* Reminder Pill */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Bell className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/80">Next reminder</p>
                <p className="text-sm font-medium text-white">Water in 2 days</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute -top-4 -right-4 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 animate-float-slow">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Care logged!</span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURES SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const features = [
  {
    icon: BookMarked,
    title: "Smart Plant Library",
    description:
      "Access a comprehensive database with detailed care info—sunlight needs, watering schedules, soil preferences, and toxicity warnings.",
    color: "emerald",
  },
  {
    icon: Bell,
    title: "Care Reminders",
    description:
      "Never forget to water, mist, or fertilize. Get personalized notifications based on each plant's unique needs.",
    color: "blue",
  },
  {
    icon: BookMarked,
    title: "Collections & Bookmarks",
    description:
      "Organize plants by room, garden, or mood. Create custom collections and save your favorites for quick access.",
    color: "purple",
  },
  {
    icon: Camera,
    title: "Visual Plant ID",
    description:
      "Snap a photo and let Aphylia identify your mystery plant. Get instant care recommendations.",
    color: "pink",
  },
  {
    icon: NotebookPen,
    title: "Garden Journal",
    description:
      "Track growth milestones, log repotting dates, add notes, and document your plant journey with photos.",
    color: "amber",
  },
  {
    icon: Wifi,
    title: "Offline-Friendly PWA",
    description:
      "Works beautifully on mobile and desktop. Install once—it runs offline and syncs when you're back online.",
    color: "teal",
  },
] as const

const colorMap = {
  emerald: "from-emerald-400 to-green-500 shadow-emerald-500/25",
  blue: "from-blue-400 to-cyan-500 shadow-blue-500/25",
  purple: "from-purple-400 to-violet-500 shadow-purple-500/25",
  pink: "from-pink-400 to-rose-500 shadow-pink-500/25",
  amber: "from-amber-400 to-orange-500 shadow-amber-500/25",
  teal: "from-teal-400 to-cyan-500 shadow-teal-500/25",
} as const

const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-20 lg:py-32 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Everything your garden needs, in one app.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            From tracking watering schedules to identifying unknown species, Aphylia has you covered.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={i} {...feature} />
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
    <div className="group relative rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] p-6 hover:border-emerald-300/50 dark:hover:border-emerald-500/20 hover:bg-white dark:hover:bg-white/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5">
      {/* Icon */}
      <div
        className={`inline-flex h-12 w-12 rounded-xl bg-gradient-to-br ${colorMap[color]} shadow-lg items-center justify-center mb-4`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{description}</p>

      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-green-500/0 group-hover:from-emerald-500/5 group-hover:to-green-500/5 transition-all duration-300 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HOW IT WORKS
   ───────────────────────────────────────────────────────────────────────────── */
const steps = [
  {
    num: 1,
    title: "Add your plants",
    description: "Search our library or snap a photo to identify and add plants to your collection.",
  },
  {
    num: 2,
    title: "Set your conditions",
    description: "Tell us about your space—light levels, humidity, and location—for tailored advice.",
  },
  {
    num: 3,
    title: "Let Aphylia remind you",
    description: "Sit back while we send timely reminders for watering, feeding, and more.",
  },
] as const

const HowItWorksSection: React.FC = () => {
  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-32 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-900/5 dark:to-transparent scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            From seedling to jungle, in 3 steps.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Getting started is simple. Set up once, and Aphylia handles the rest.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-1/2 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-emerald-300 via-green-400 to-teal-300 dark:from-emerald-600 dark:via-green-500 dark:to-teal-600"
            aria-hidden="true"
          />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                {/* Number badge */}
                <div className="relative z-10 mx-auto mb-6 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <span className="text-2xl font-bold text-white">{step.num}</span>
                </div>

                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs mx-auto">{step.description}</p>
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
  return (
    <section className="py-20 lg:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Designed for your shelf, balcony, or jungle.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Whether you have one succulent or a hundred tropicals, Aphylia adapts to your style.
          </p>
        </div>

        {/* Showcase Grid */}
        <div className="relative">
          {/* Background glow */}
          <div
            className="absolute inset-0 -m-20 bg-gradient-radial from-emerald-400/10 to-transparent blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative grid md:grid-cols-3 gap-6">
            {/* Main card */}
            <div className="md:col-span-2 md:row-span-2 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-8 overflow-hidden relative group">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
              <div className="relative h-full min-h-[300px] flex flex-col justify-end">
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                    Dashboard Preview
                  </span>
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">Your garden at a glance</h3>
                  <p className="text-slate-400 max-w-md">
                    See all your plants, upcoming tasks, and care history in one beautiful dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Small cards */}
            <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-6 flex flex-col justify-between">
              <Droplets className="h-8 w-8 text-blue-400 mb-4" />
              <div>
                <p className="text-sm font-medium text-blue-300 mb-1">Watering Reminder</p>
                <p className="text-xs text-blue-300/70">Your Pothos needs water today</p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-6 flex flex-col justify-between">
              <Sun className="h-8 w-8 text-amber-400 mb-4" />
              <div>
                <p className="text-sm font-medium text-amber-300 mb-1">Light Check</p>
                <p className="text-xs text-amber-300/70">Move Fern to brighter spot</p>
              </div>
            </div>

            <div className="md:col-span-1 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-xs text-rose-300/80">Toxicity Alert</span>
              </div>
              <div>
                <p className="text-sm font-medium text-rose-300 mb-1">Pet Warning</p>
                <p className="text-xs text-rose-300/70">Dieffenbachia is toxic to cats</p>
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
const testimonials = [
  {
    name: "Sarah M.",
    role: "Plant Parent",
    quote: "Aphylia saved my monstera! The reminders are a lifesaver for someone as forgetful as me.",
    avatar: "S",
  },
  {
    name: "James K.",
    role: "Urban Gardener",
    quote: "Finally an app that understands balcony gardening. The light recommendations are spot on.",
    avatar: "J",
  },
  {
    name: "Mia T.",
    role: "Succulent Collector",
    quote: "I've tried many plant apps, but Aphylia's journal feature is perfect for tracking my 50+ succulents.",
    avatar: "M",
  },
  {
    name: "David L.",
    role: "Beginner",
    quote: "As a complete newbie, the plant ID feature taught me so much about caring for my first plants.",
    avatar: "D",
  },
] as const

const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-20 lg:py-32 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/20 dark:to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Loved by plant people.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Join thousands of happy gardeners growing healthier plants with Aphylia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] p-6 hover:shadow-lg transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-slate-700 dark:text-slate-300 text-sm mb-6 leading-relaxed">"{t.quote}"</p>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white font-semibold text-sm">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{t.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{t.role}</p>
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
   PRICING SECTION
   ───────────────────────────────────────────────────────────────────────────── */
const plans = [
  {
    name: "Free",
    price: "0",
    description: "Perfect for getting started",
    features: ["Up to 10 plants", "Basic care reminders", "Plant library access", "Community support"],
    cta: "Get started free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "4.99",
    description: "For serious plant parents",
    features: [
      "Unlimited plants",
      "Advanced analytics",
      "Priority reminders",
      "Export garden data",
      "Early access to features",
    ],
    cta: "Start Pro trial",
    highlighted: true,
  },
  {
    name: "Garden Club",
    price: "9.99",
    description: "For families & communities",
    features: [
      "Everything in Pro",
      "Up to 5 members",
      "Shared gardens",
      "Collaborative journals",
      "Priority support",
    ],
    cta: "Join the Club",
    highlighted: false,
  },
] as const

const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-20 lg:py-32 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Start for free. Grow as you grow.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Choose a plan that matches your garden size. Upgrade anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-3xl p-8 ${
                plan.highlighted
                  ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-2xl shadow-emerald-500/30 scale-105 z-10"
                  : "bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-400 text-amber-900 text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3
                  className={`text-xl font-bold mb-2 ${
                    plan.highlighted ? "text-white" : "text-slate-900 dark:text-white"
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm ${plan.highlighted ? "text-white/80" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span
                  className={`text-4xl font-bold ${
                    plan.highlighted ? "text-white" : "text-slate-900 dark:text-white"
                  }`}
                >
                  ${plan.price}
                </span>
                <span
                  className={`text-sm ${plan.highlighted ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}
                >
                  /month
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm">
                    <Check
                      className={`h-4 w-4 flex-shrink-0 ${
                        plan.highlighted ? "text-white" : "text-emerald-500"
                      }`}
                    />
                    <span className={plan.highlighted ? "text-white/90" : "text-slate-700 dark:text-slate-300"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/discovery"
                className={`block w-full py-3 rounded-xl text-center font-semibold transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-white text-emerald-600 hover:bg-slate-100"
                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                }`}
              >
                {plan.cta}
              </Link>
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
const faqs = [
  {
    q: "Is Aphylia free to use?",
    a: "Yes! Our free plan lets you track up to 10 plants with basic reminders. Upgrade anytime for unlimited plants and advanced features.",
  },
  {
    q: "Does it work offline?",
    a: "Absolutely. Aphylia is a Progressive Web App (PWA) that works offline. Your changes sync automatically when you're back online.",
  },
  {
    q: "Can I sync across devices?",
    a: "Yes. Create an account and your garden syncs seamlessly between your phone, tablet, and computer.",
  },
  {
    q: "How accurate is the plant identification?",
    a: "Our AI identifies thousands of common houseplants and garden species with high accuracy. If unsure, it suggests similar matches.",
  },
  {
    q: "Is my data private?",
    a: "Your privacy is our priority. We never sell your data. All garden data is encrypted and only accessible to you.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes, cancel anytime from your settings. You'll keep Pro features until the end of your billing period.",
  },
] as const

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)

  return (
    <section id="faq" className="py-20 lg:py-32 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/20 dark:to-transparent scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Everything you need to know about Aphylia.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
                aria-expanded={openIndex === i}
              >
                <span className="font-medium text-slate-900 dark:text-white">{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === i ? "max-h-40" : "max-h-0"
                }`}
              >
                <p className="px-6 pb-4 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FINAL CTA
   ───────────────────────────────────────────────────────────────────────────── */
const FinalCTASection: React.FC = () => {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-12 lg:p-20">
          {/* Background pattern */}
          <div
            className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"
            aria-hidden="true"
          />

          <div className="relative text-center space-y-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white max-w-2xl mx-auto leading-tight">
              Ready to grow happier plants?
            </h2>
            <p className="text-lg text-white/80 max-w-xl mx-auto">
              Join thousands of plant lovers who trust Aphylia to keep their gardens thriving.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-emerald-600 text-base font-semibold shadow-xl hover:bg-slate-50 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Leaf className="h-5 w-5" />
                Download Aphylia
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-base font-semibold border border-white/20 transition-all duration-200"
              >
                View docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FOOTER
   ───────────────────────────────────────────────────────────────────────────── */
const LandingFooter: React.FC = () => {
  return (
    <footer className="border-t border-slate-200/50 dark:border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-brand text-xl font-semibold text-slate-900 dark:text-white">Aphylia</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              About
            </Link>
            <Link to="/blog" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Blog
            </Link>
            <Link to="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Terms
            </Link>
            <Link to="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Contact
            </Link>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-500">
            © {new Date().getFullYear()} Aphylia. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default LandingPage
