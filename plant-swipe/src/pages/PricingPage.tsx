import React from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import {
  Check,
  X,
  Leaf,
  Sparkles,
  Heart,
  Crown,
  Zap,
  Shield,
  Bell,
  Camera,
  Cloud,
  Users,
  BarChart3,
  Clock,
  Infinity,
  Gift,
  ArrowRight,
  BookMarked,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Link } from "@/components/i18n/Link"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"

// Feature comparison data
const featureCategories = [
  {
    name: "Gardens & Plants",
    features: [
      { name: "Gardens you can create", free: "Up to 5", plus: "Unlimited", icon: Leaf },
      { name: "Plants per garden", free: "Unlimited", plus: "Unlimited", icon: Sparkles },
      { name: "Plant identification (AI)", free: false, plus: "Unlimited", icon: Camera },
      { name: "Bookmark collections", free: "Unlimited", plus: "Unlimited", icon: Heart },
    ],
  },
  {
    name: "Core Features",
    features: [
      { name: "Plant library & encyclopedia", free: true, plus: true, icon: BookMarked },
      { name: "Care reminders & tasks", free: true, plus: true, icon: Bell },
      { name: "Task progress tracking", free: true, plus: true, icon: Clock },
      { name: "Garden sharing & collaboration", free: true, plus: true, icon: Users },
    ],
  },
  {
    name: "Advanced & Support",
    features: [
      { name: "Garden analytics & insights", free: false, plus: true, icon: BarChart3 },
      { name: "Export garden data", free: false, plus: true, icon: Cloud },
      { name: "Priority support", free: false, plus: true, icon: Shield },
      { name: "Early access to features", free: false, plus: true, icon: Gift },
    ],
  },
] as const

const PricingPage: React.FC = () => {
  const { t } = useTranslation("common")
  const { user } = useAuth()

  usePageMetadata({
    title: "Pricing – Aphylia",
    description:
      "Choose the plan that fits your garden. Aphylia is free forever with optional Plus features for serious plant parents.",
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-16">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-6"
      >
        <Badge className="rounded-full px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0">
          <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
          Free forever, by design
        </Badge>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
          Simple, transparent pricing
        </h1>

        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Aphylia is built for plant lovers, not profit. Our core features are free and always will be.
          Plus is for those who want to go further.
        </p>
      </motion.section>

      {/* Pricing Cards */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto"
      >
        {/* Free Tier */}
        <div className="relative rounded-3xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Leaf className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Free</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Everything you need to start your plant journey
            </p>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-slate-900 dark:text-white">$0</span>
            <span className="text-slate-500 dark:text-slate-400">/forever</span>
          </div>

          <ul className="space-y-3">
            {[
              "Up to 5 gardens",
              "Unlimited plants per garden",
              "Full plant library & encyclopedia",
              "Care reminders & task tracking",
              "Bookmark collections",
              "Garden sharing with friends",
              "Cross-device sync",
              "Offline access (PWA)",
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            asChild
            variant="outline"
            className="w-full rounded-xl h-12 text-base font-medium"
          >
            <Link to={user ? "/discovery" : "/discovery"}>
              {user ? "Current Plan" : "Get Started Free"}
            </Link>
          </Button>
        </div>

        {/* Plus Tier */}
        <div className="relative rounded-3xl border-2 border-emerald-500 dark:border-emerald-400 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800/50 p-8 space-y-6 shadow-xl shadow-emerald-500/10">
          {/* Popular badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <Badge className="rounded-full px-4 py-1.5 bg-emerald-500 text-white border-0 shadow-lg">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Recommended
            </Badge>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Plus</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              For dedicated plant parents who want it all
            </p>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-slate-900 dark:text-white">$5</span>
            <span className="text-slate-500 dark:text-slate-400">/month</span>
          </div>

          <ul className="space-y-3">
            {[
              "Everything in Free",
              "Unlimited gardens",
              "AI plant identification",
              "Garden analytics & insights",
              "Export your garden data",
              "Priority support",
              "Early access to new features",
              "Support Aphylia's development",
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            asChild
            className="w-full rounded-xl h-12 text-base font-medium bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25"
          >
            <Link to="/contact">
              Upgrade to Plus
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </motion.section>

      {/* Our Philosophy Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative rounded-3xl border border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 p-8 md:p-12 overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-emerald-200/30 to-transparent dark:from-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-green-200/20 to-transparent dark:from-green-500/5 blur-2xl" />

        <div className="relative space-y-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Heart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Why we keep Aphylia free
            </h2>
          </div>

          <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong className="text-slate-900 dark:text-white">We believe plant care should be accessible to everyone.</strong>{" "}
              Whether you're nurturing your first succulent or managing a thriving indoor jungle, you deserve 
              tools that help you succeed—without breaking the bank.
            </p>

            <p>
              That's why Aphylia's core features are <strong className="text-emerald-600 dark:text-emerald-400">free forever</strong>. 
              No trials, no hidden limits that make the app unusable. Just genuine, useful tools for plant lovers.
            </p>

            <p>
              <strong className="text-slate-900 dark:text-white">So why Plus?</strong>{" "}
              Running Aphylia costs real money—servers, development, plant databases, AI for identification. 
              Plus lets passionate plant parents who want advanced features help us keep the lights on and 
              continue building something special.
            </p>

            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
              Think of Plus as your way of supporting the Aphylia community while unlocking extra superpowers 
              for your garden.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Feature Comparison Table */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-8"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Compare plans in detail
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            See exactly what you get with each plan
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden bg-white dark:bg-slate-800/50">
          {/* Table Header */}
          <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50">
            <div className="p-4 md:p-6 font-medium text-slate-700 dark:text-slate-300">
              Features
            </div>
            <div className="p-4 md:p-6 text-center border-l border-slate-200 dark:border-slate-700/50">
              <span className="font-semibold text-slate-900 dark:text-white">Free</span>
            </div>
            <div className="p-4 md:p-6 text-center border-l border-slate-200 dark:border-slate-700/50 bg-emerald-50/50 dark:bg-emerald-900/10">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <Crown className="h-4 w-4" />
                Plus
              </span>
            </div>
          </div>

          {/* Feature Categories */}
          {featureCategories.map((category, catIdx) => (
            <div key={catIdx}>
              {/* Category Header */}
              <div className="px-4 md:px-6 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {category.name}
                </span>
              </div>

              {/* Features */}
              {category.features.map((feature, featIdx) => (
                <div
                  key={featIdx}
                  className={`grid grid-cols-3 ${
                    featIdx !== category.features.length - 1
                      ? "border-b border-slate-100 dark:border-slate-700/30"
                      : catIdx !== featureCategories.length - 1
                      ? "border-b border-slate-200 dark:border-slate-700/50"
                      : ""
                  }`}
                >
                  <div className="p-4 md:p-5 flex items-center gap-3">
                    <feature.icon className="h-4 w-4 text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:block" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{feature.name}</span>
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center border-l border-slate-100 dark:border-slate-700/30">
                    <FeatureValue value={feature.free} />
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center border-l border-slate-100 dark:border-slate-700/30 bg-emerald-50/30 dark:bg-emerald-900/5">
                    <FeatureValue value={feature.plus} isPlus />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.section>

      {/* FAQ Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-8"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Common questions
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {[
            {
              q: "Can I use Aphylia completely free?",
              a: "Absolutely! Our free tier includes up to 5 gardens with unlimited plants each, care reminders, the full plant encyclopedia, bookmark collections, and more. No credit card required.",
            },
            {
              q: "What happens if I reach 5 gardens?",
              a: "You'll see a friendly prompt to upgrade or manage your existing gardens. We never delete your gardens or plants. Your data is always safe.",
            },
            {
              q: "Can I cancel Plus anytime?",
              a: "Yes, cancel with one click from your settings. You'll keep Plus features until your billing period ends, then seamlessly return to Free.",
            },
            {
              q: "What is AI plant identification?",
              a: "Plus members can snap a photo of any plant and our AI will identify the species and provide care recommendations. It's a powerful tool for discovering unknown plants.",
            },
          ].map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 p-6 space-y-2"
            >
              <h3 className="font-semibold text-slate-900 dark:text-white">{faq.q}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Bottom CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="text-center space-y-6 pb-8"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Ready to grow with Aphylia?
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Start free and upgrade when you're ready. Your plants will thank you.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="outline" className="rounded-xl h-12 px-8">
            <Link to="/discovery">
              <Leaf className="h-4 w-4 mr-2" />
              Start Free
            </Link>
          </Button>
          <Button asChild className="rounded-xl h-12 px-8 bg-emerald-500 hover:bg-emerald-600">
            <Link to="/contact">
              <Crown className="h-4 w-4 mr-2" />
              Get Plus
            </Link>
          </Button>
        </div>
      </motion.section>
    </div>
  )
}

// Helper component for feature values
const FeatureValue: React.FC<{ value: boolean | string; isPlus?: boolean }> = ({ value, isPlus }) => {
  if (typeof value === "boolean") {
    return value ? (
      <Check className={`h-5 w-5 ${isPlus ? "text-emerald-500" : "text-slate-400"}`} />
    ) : (
      <X className="h-5 w-5 text-slate-300 dark:text-slate-600" />
    )
  }

  return (
    <span
      className={`text-sm font-medium ${
        isPlus ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"
      }`}
    >
      {value}
    </span>
  )
}

export default PricingPage
