import React from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, MessageCircle, Clock, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const SUPPORT_EMAIL = "support@aphylia.app"

export default function ContactUsPage() {
  const { t } = useTranslation('common')

  const handleEmailClick = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}`
  }

  const handleEmailCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      // You could add a toast notification here if needed
    } catch (err) {
      console.error('Failed to copy email:', err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <MessageCircle className="h-6 w-6" />
          {t('contactUs.title')}
        </h1>
        <p className="text-sm opacity-70 mt-2">{t('contactUs.description')}</p>
      </div>

      {/* Main Contact Card */}
      <Card className="rounded-3xl mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
              <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle>{t('contactUs.supportEmail')}</CardTitle>
              <CardDescription className="mt-1">
                {t('contactUs.supportEmailDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#252526] border border-stone-200 dark:border-[#3e3e42]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm opacity-70 mb-1">{t('contactUs.emailLabel')}</p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-lg font-medium text-emerald-600 dark:text-emerald-400 hover:underline break-all"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEmailClick}
                  className="rounded-2xl"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t('contactUs.sendEmail')}
                </Button>
                <Button
                  onClick={handleEmailCopy}
                  variant="outline"
                  className="rounded-2xl"
                >
                  {t('contactUs.copyEmail')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 opacity-60" />
              <CardTitle className="text-lg">{t('contactUs.responseTime.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-70">
              {t('contactUs.responseTime.description')}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 opacity-60" />
              <CardTitle className="text-lg">{t('contactUs.helpfulInfo.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-70">
              {t('contactUs.helpfulInfo.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
