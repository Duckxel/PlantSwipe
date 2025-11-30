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
  Shield,
  Bell,
  Camera,
  Cloud,
  Users,
  BarChart3,
  Clock,
  Gift,
  ArrowRight,
  BookMarked,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Link } from "@/components/i18n/Link"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"

// Feature type definition
type FeatureItem = {
  nameKey: string
  free: boolean | string
  plus: boolean | string
  icon: React.ElementType
}

type FeatureCategory = {
  nameKey: string
  features: FeatureItem[]
}

// Feature comparison data with icon references
const featureCategoriesConfig: FeatureCategory[] = [
  {
    nameKey: "pricing.comparison.categories.gardensPlants",
    features: [
      { nameKey: "pricing.comparison.featureNames.gardensCreate", free: "pricing.comparison.values.upTo5", plus: "pricing.comparison.values.unlimited", icon: Leaf },
      { nameKey: "pricing.comparison.featureNames.plantsPerGarden", free: "pricing.comparison.values.unlimited", plus: "pricing.comparison.values.unlimited", icon: Sparkles },
      { nameKey: "pricing.comparison.featureNames.plantId", free: false, plus: "pricing.comparison.values.unlimited", icon: Camera },
      { nameKey: "pricing.comparison.featureNames.bookmarks", free: "pricing.comparison.values.unlimited", plus: "pricing.comparison.values.unlimited", icon: Heart },
    ],
  },
  {
    nameKey: "pricing.comparison.categories.coreFeatures",
    features: [
      { nameKey: "pricing.comparison.featureNames.plantLibrary", free: true, plus: true, icon: BookMarked },
      { nameKey: "pricing.comparison.featureNames.careReminders", free: true, plus: true, icon: Bell },
      { nameKey: "pricing.comparison.featureNames.taskTracking", free: true, plus: true, icon: Clock },
      { nameKey: "pricing.comparison.featureNames.gardenSharing", free: true, plus: true, icon: Users },
    ],
  },
  {
    nameKey: "pricing.comparison.categories.advancedSupport",
    features: [
      { nameKey: "pricing.comparison.featureNames.analytics", free: false, plus: true, icon: BarChart3 },
      { nameKey: "pricing.comparison.featureNames.exportData", free: false, plus: true, icon: Cloud },
      { nameKey: "pricing.comparison.featureNames.prioritySupport", free: false, plus: true, icon: Shield },
      { nameKey: "pricing.comparison.featureNames.earlyAccess", free: false, plus: true, icon: Gift },
    ],
  },
]

const PricingPage: React.FC = () => {
  const { user } = useAuth()
  const { t } = useTranslation("common")

  usePageMetadata({
    title: t("pricing.pageTitle"),
    description: t("pricing.pageDescription"),
  })

  const freeFeatures = t("pricing.free.features", { returnObjects: true }) as string[]
  const plusFeatures = t("pricing.plus.features", { returnObjects: true }) as string[]
  const faqItems = t("pricing.faq.items", { returnObjects: true }) as Array<{ q: string; a: string }>

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
          {t("pricing.hero.badge")}
        </Badge>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t("pricing.hero.title")}
        </h1>

        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {t("pricing.hero.subtitle")}
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
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t("pricing.free.name")}</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {t("pricing.free.description")}
            </p>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-slate-900 dark:text-white">${t("pricing.free.price")}</span>
            <span className="text-slate-500 dark:text-slate-400">{t("pricing.free.period")}</span>
          </div>

          <ul className="space-y-3">
            {freeFeatures.map((feature, i) => (
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
              {user ? t("pricing.free.ctaCurrent") : t("pricing.free.cta")}
            </Link>
          </Button>
        </div>

        {/* Plus Tier */}
        <div className="relative rounded-3xl border-2 border-emerald-500 dark:border-emerald-400 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800/50 p-8 space-y-6 shadow-xl shadow-emerald-500/10">
          {/* Popular badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <Badge className="rounded-full px-4 py-1.5 bg-emerald-500 text-white border-0 shadow-lg">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t("pricing.plus.badge")}
            </Badge>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t("pricing.plus.name")}</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {t("pricing.plus.description")}
            </p>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-slate-900 dark:text-white">${t("pricing.plus.price")}</span>
            <span className="text-slate-500 dark:text-slate-400">{t("pricing.plus.period")}</span>
          </div>

          <ul className="space-y-3">
            {plusFeatures.map((feature, i) => (
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
              {t("pricing.plus.cta")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            {t("pricing.plus.cancelNote")}
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
              {t("pricing.philosophy.title")}
            </h2>
          </div>

          <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong className="text-slate-900 dark:text-white">{t("pricing.philosophy.p1")}</strong>{" "}
              {t("pricing.philosophy.p1cont")}
            </p>

            <p>
              {t("pricing.philosophy.p2start")}{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">{t("pricing.philosophy.p2highlight")}</strong>
              {t("pricing.philosophy.p2end")}
            </p>

            <p>
              <strong className="text-slate-900 dark:text-white">{t("pricing.philosophy.p3question")}</strong>{" "}
              {t("pricing.philosophy.p3answer")}
            </p>

            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
              {t("pricing.philosophy.p3note")}
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
            {t("pricing.comparison.title")}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {t("pricing.comparison.subtitle")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden bg-white dark:bg-slate-800/50">
          {/* Table Header */}
          <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50">
            <div className="p-4 md:p-6 font-medium text-slate-700 dark:text-slate-300">
              {t("pricing.comparison.features")}
            </div>
            <div className="p-4 md:p-6 text-center border-l border-slate-200 dark:border-slate-700/50">
              <span className="font-semibold text-slate-900 dark:text-white">{t("pricing.free.name")}</span>
            </div>
            <div className="p-4 md:p-6 text-center border-l border-slate-200 dark:border-slate-700/50 bg-emerald-50/50 dark:bg-emerald-900/10">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <Crown className="h-4 w-4" />
                {t("pricing.plus.name")}
              </span>
            </div>
          </div>

          {/* Feature Categories */}
          {featureCategoriesConfig.map((category, catIdx) => (
            <div key={catIdx}>
              {/* Category Header */}
              <div className="px-4 md:px-6 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t(category.nameKey)}
                </span>
              </div>

              {/* Features */}
              {category.features.map((feature, featIdx) => (
                <div
                  key={featIdx}
                  className={`grid grid-cols-3 ${
                    featIdx !== category.features.length - 1
                      ? "border-b border-slate-100 dark:border-slate-700/30"
                      : catIdx !== featureCategoriesConfig.length - 1
                      ? "border-b border-slate-200 dark:border-slate-700/50"
                      : ""
                  }`}
                >
                  <div className="p-4 md:p-5 flex items-center gap-3">
                    <feature.icon className="h-4 w-4 text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:block" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{t(feature.nameKey)}</span>
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center border-l border-slate-100 dark:border-slate-700/30">
                    <FeatureValue 
                      value={typeof feature.free === "boolean" ? feature.free : t(feature.free)} 
                    />
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center border-l border-slate-100 dark:border-slate-700/30 bg-emerald-50/30 dark:bg-emerald-900/5">
                    <FeatureValue 
                      value={typeof feature.plus === "boolean" ? feature.plus : t(feature.plus)} 
                      isPlus 
                    />
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
            {t("pricing.faq.title")}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {faqItems.map((faq, i) => (
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
          {t("pricing.bottomCta.title")}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          {t("pricing.bottomCta.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="outline" className="rounded-xl h-12 px-8">
            <Link to="/discovery">
              <Leaf className="h-4 w-4 mr-2" />
              {t("pricing.bottomCta.ctaFree")}
            </Link>
          </Button>
          <Button asChild className="rounded-xl h-12 px-8 bg-emerald-500 hover:bg-emerald-600">
            <Link to="/contact">
              <Crown className="h-4 w-4 mr-2" />
              {t("pricing.bottomCta.ctaPlus")}
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
