import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Smartphone, MonitorDown, Sparkles, Download, Apple, Store, Heart, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Link } from "@/components/i18n/Link"
import { usePageMetadata } from "@/hooks/usePageMetadata"

const deviceGuides = [
  {
    title: "Phones",
    icon: Smartphone,
    steps: [
      "Open Aphylia in your mobile browser.",
      "Tap the share or menu icon and choose Add to Home Screen.",
      "Look for the Aphylia leaf icon on your home screen and launch it like any other app.",
    ],
    helper: "This takes less than a minute and keeps you logged in.",
  },
  {
    title: "Tablets",
    icon: Heart,
    steps: [
      "Visit Aphylia on your tablet and tap the share/menu button.",
      "Pick Add to Home Screen so the shortcut lands next to your favorite apps.",
      "Enjoy the app in full-screen mode with bigger photos and cards.",
    ],
    helper: "Perfect for greenhouse check-ins or planning on the couch.",
  },
  {
    title: "Computers",
    icon: MonitorDown,
    steps: [
      "Open Aphylia in Chrome or Edge on your laptop or desktop.",
      "Click the install icon in the address bar and confirm.",
      "Aphylia will now have its own window, just like a native desktop app.",
    ],
    helper: "Great for wide screens, photo reviews, and admin work.",
  },
] as const

const friendlyReminders = [
  {
    title: "No downloads needed",
    description:
      "The PWA updates itself. Add it once and it will always pick up the freshest version when you come back.",
  },
  {
    title: "Works offline",
    description:
      "If you lose connection for a moment, Aphylia keeps running. Your changes sync as soon as you are back online.",
  },
  {
    title: "Looks and feels native",
    description:
      "Launch Aphylia from your home screen icon and it opens full screen without any browser chrome in the way.",
  },
] as const

export default function DownloadPage() {
  const { t } = useTranslation("common")
  const seoTitle = t("seo.download.title", { defaultValue: "Download the Aphylia PWA" })
  const seoDescription = t("seo.download.description", {
    defaultValue: "Learn how to add the Aphylia app to your phone, tablet, or computer in just a few taps.",
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-16 space-y-12">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-100/70 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.12),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.18),_transparent_65%)]"
          aria-hidden="true"
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative p-8 md:p-16 space-y-6"
        >
          <Badge className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur flex items-center gap-2 w-fit">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            {t("downloadPage.hero.eyebrow", { defaultValue: "Install Aphylia in a minute" })}
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight"
          >
            {t("downloadPage.hero.title", { defaultValue: "Make Aphylia part of your daily routine" })}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-base md:text-lg max-w-2xl text-stone-600 dark:text-stone-300"
          >
            {t("downloadPage.hero.subtitle", {
              defaultValue:
                "Adding the PWA puts Aphylia beside your other apps so you can check on plants, share updates, and log photos without digging through tabs.",
            })}
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
                {t("downloadPage.hero.ctaPrimary", { defaultValue: "Need a quick walkthrough?" })}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/faq">
                <ShieldCheck className="h-4 w-4 mr-2" />
                {t("downloadPage.hero.ctaSecondary", { defaultValue: "FAQ" })}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">{t("downloadPage.steps.title", { defaultValue: "Your device, your flow" })}</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            {t("downloadPage.steps.subtitle", {
              defaultValue: "Follow the short guide for the device you have in hand. No tech experience required.",
            })}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {deviceGuides.map(({ title, icon: Icon, steps, helper }) => (
            <Card key={title} className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
              <CardHeader className="space-y-3">
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

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("downloadPage.reminders.title", { defaultValue: "Why install the PWA?" })}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {friendlyReminders.map(({ title, description }) => (
            <Card key={title} className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-sm text-stone-600 dark:text-stone-400">{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">{t("downloadPage.storePreview.title", { defaultValue: "Native store listings" })}</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            {t("downloadPage.storePreview.subtitle", {
              defaultValue: "Prefer a classic download? We are preparing official listings so you can grab Aphylia just like any other app.",
            })}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="rounded-2xl w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                Coming soon
              </Badge>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                App Store
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-stone-400">
                We are polishing the App Store build. Until it ships, add the PWA to your home screen to enjoy the same smooth experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="rounded-2xl w-full">
                <a href="https://www.apple.com/app-store/" target="_blank" rel="noreferrer">
                  <Apple className="h-4 w-4 mr-2" />
                  App Store · Coming soon
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="rounded-2xl w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                Coming soon
              </Badge>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Google Play
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-stone-400">
                The Google Play listing is in review. You can still save the PWA to your Android device with just a couple taps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="rounded-2xl w-full">
                <a href="https://play.google.com/store/apps" target="_blank" rel="noreferrer">
                  <Store className="h-4 w-4 mr-2" />
                  Google Play · Coming soon
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
