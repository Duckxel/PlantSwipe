import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Smartphone, Apple, MonitorDown, Sparkles, Download, ShieldCheck, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Link } from "@/components/i18n/Link"

const platformGuides = [
  {
    key: "ios",
    title: "iOS & iPadOS",
    badge: "Safari",
    icon: Apple,
    steps: [
      "Open PlantSwipe in Safari on your iPhone or iPad.",
      "Tap the Share icon, then choose “Add to Home Screen”.",
      "Confirm the name (PlantSwipe) and tap Add. The PWA opens full screen like a native app."
    ],
    helper: "Requires iOS 16+ for the best offline support."
  },
  {
    key: "android",
    title: "Android",
    badge: "Chrome / Edge / Brave",
    icon: Smartphone,
    steps: [
      "Visit PlantSwipe in your preferred Chromium-based browser.",
      "Look for the Install banner or open the ⋮ menu and tap “Add to Home screen”.",
      "Confirm Install. A launcher icon appears alongside your native apps."
    ],
    helper: "If you miss the banner, clear the tab and revisit once to trigger it again."
  },
  {
    key: "desktop",
    title: "Desktop",
    badge: "Chrome / Edge",
    icon: MonitorDown,
    steps: [
      "Open PlantSwipe on your laptop or desktop browser.",
      "Click the Install icon in the address bar (looks like a monitor with a download arrow).",
      "Accept the prompt. PlantSwipe opens in its own window and can auto-start on login."
    ],
    helper: "Perfect for kiosks or internal QA devices."
  }
] as const

const releaseTracks = [
  {
    title: "Preview builds",
    description: "Spin up as many environments as you need (e.g., staging, QA, beta). Each clone of the repo can run its own `setup.sh` + nginx site so different squads can dogfood upcoming features."
  },
  {
    title: "Production",
    description: "When you are happy with a build, run `scripts/refresh-plant-swipe.sh` on the production host. The script rebuilds the PWA, reloads nginx, and gently asks active users to refresh."
  },
  {
    title: "Device refresh cadence",
    description: "Installed PWAs automatically fetch updates. Testers just tap the in-app “Reload now” prompt whenever you ship a new bundle."
  }
] as const

const supportTips = [
  {
    title: "Stay on HTTPS",
    description: "Both iOS and Android require secure origins for installation banners and offline caching. Keep your internal domains behind valid certificates (Let’s Encrypt works great)."
  },
  {
    title: "Clear older builds",
    description: "If someone can’t see the install banner, ask them to clear the card from their recent apps, close the tab, and try again. Browsers cache the decision for a short period."
  },
  {
    title: "Use the refresh helper",
    description: "The `Refresh` button in your admin tools should call `scripts/refresh-plant-swipe.sh`. That ensures `npm run build` runs every time, so the service worker packages the latest assets."
  }
] as const

export default function DownloadPage() {
  const { t } = useTranslation("common")

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 pb-16 space-y-12">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.12),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.18),_transparent_65%)]" aria-hidden="true" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative p-8 md:p-16 space-y-6"
        >
          <Badge className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur flex items-center gap-2 w-fit">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            {t("downloadPage.hero.eyebrow", { defaultValue: "Ready for install" })}
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight"
          >
            {t("downloadPage.hero.title", { defaultValue: "Download PlantSwipe to every device" })}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-base md:text-lg max-w-2xl text-stone-600 dark:text-stone-300"
          >
            {t("downloadPage.hero.subtitle", { defaultValue: "Our PWA installs in seconds on phones, tablets, and desktops. Follow the guides below to equip your testers, growers, and teammates with the latest internal build." })}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-wrap gap-3 pt-2"
          >
            <Button asChild className="rounded-2xl">
              <Link to="/contact">
                <Download className="h-4 w-4 mr-2" />
                {t("downloadPage.hero.ctaPrimary", { defaultValue: "Need install help?" })}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/terms">
                <ShieldCheck className="h-4 w-4 mr-2" />
                {t("downloadPage.hero.ctaSecondary", { defaultValue: "Review terms" })}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">{t("downloadPage.platforms.title", { defaultValue: "Choose your platform" })}</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            {t("downloadPage.platforms.subtitle", { defaultValue: "Each platform uses its own Add to Home Screen flow. Share these steps with your testers." })}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {platformGuides.map(({ key, title, badge, icon: Icon, steps, helper }) => (
            <Card key={key} className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
              <CardHeader className="space-y-3">
                <Badge variant="secondary" className="rounded-2xl w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  {badge}
                </Badge>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </div>
                <CardDescription className="text-sm text-stone-600 dark:text-stone-400">
                  <ol className="space-y-2 list-decimal list-inside">
                    {steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-stone-500 dark:text-stone-400">{helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("downloadPage.releases.title", { defaultValue: "Internal release tracks" })}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-3xl">
              {t("downloadPage.releases.subtitle", { defaultValue: "Keep development, QA, and production worlds separate while reusing the same install experience." })}
            </p>
          </div>
          <Badge variant="outline" className="rounded-2xl border-dashed">
            <RefreshCw className="h-4 w-4 mr-1" />
            {t("downloadPage.releases.badge", { defaultValue: "One build command" })}
          </Badge>
        </div>
          <div className="grid gap-4 md:grid-cols-3">
            {releaseTracks.map(({ title, description }) => (
            <Card key={title} className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">{t("downloadPage.support.title", { defaultValue: "Troubleshooting tips" })}</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t("downloadPage.support.subtitle", { defaultValue: "Most install hiccups stem from caching or certificate issues. Start here before filing bugs." })}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {supportTips.map(({ title, description }) => (
            <Card key={title} className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-sm text-stone-600 dark:text-stone-400">{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
