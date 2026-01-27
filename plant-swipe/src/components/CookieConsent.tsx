import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/i18n/Link'
import { Cookie, Shield, BarChart3, X } from 'lucide-react'

type ConsentLevel = 'essential' | 'analytics' | 'all' | 'rejected'

type ConsentData = {
  level: ConsentLevel
  date: string
  version: string
}

// Check if analytics should be enabled based on consent
export function hasAnalyticsConsent(): boolean {
  try {
    const stored = localStorage.getItem('cookie_consent')
    if (!stored) return false
    const consent = JSON.parse(stored) as ConsentData
    return consent.level === 'analytics' || consent.level === 'all'
  } catch {
    return false
  }
}

// Check if user has given any consent (to hide banner)
export function hasGivenConsent(): boolean {
  try {
    const stored = localStorage.getItem('cookie_consent')
    return stored !== null
  } catch {
    return false
  }
}

// Get the current consent level
export function getConsentLevel(): ConsentLevel | null {
  try {
    const stored = localStorage.getItem('cookie_consent')
    if (!stored) return null
    const consent = JSON.parse(stored) as ConsentData
    return consent.level
  } catch {
    return null
  }
}

// Clear consent (for testing or allowing user to re-consent)
export function clearConsent(): void {
  try {
    localStorage.removeItem('cookie_consent')
  } catch {
    // Ignore localStorage errors
  }
}

export function CookieConsent() {
  const { t } = useTranslation('common')
  const [show, setShow] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Only show on client-side and if no consent given yet
    if (typeof window === 'undefined') return
    
    // Small delay to avoid flash on page load
    const timer = setTimeout(() => {
      const consent = localStorage.getItem('cookie_consent')
      if (!consent) {
        setShow(true)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])

  const handleAccept = (level: ConsentLevel) => {
    const consentData: ConsentData = {
      level,
      date: new Date().toISOString(),
      version: '1.0'
    }
    
    try {
      localStorage.setItem('cookie_consent', JSON.stringify(consentData))
    } catch {
      // Ignore localStorage errors
    }
    
    setShow(false)
    
    // Dispatch event for analytics initialization
    if (level === 'analytics' || level === 'all') {
      window.dispatchEvent(new CustomEvent('cookie_consent_granted', { detail: { level } }))
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-4xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-2xl">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <Cookie className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-lg">
                {t('cookieConsent.title', 'Cookie Preferences')}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                {t('cookieConsent.description', 'We use cookies to improve your experience. You can choose which cookies to accept.')}
              </p>
            </div>
          </div>

          {/* Details toggle */}
          {showDetails && (
            <div className="mb-4 space-y-3 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-stone-800 dark:text-stone-200 text-sm">
                    {t('cookieConsent.essentialTitle', 'Essential Cookies')}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    {t('cookieConsent.essentialDesc', 'Required for basic site functionality. These cannot be disabled.')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-stone-800 dark:text-stone-200 text-sm">
                    {t('cookieConsent.analyticsTitle', 'Analytics Cookies')}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    {t('cookieConsent.analyticsDesc', 'Help us understand how visitors interact with our website.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions - Equal prominence for all buttons (French GDPR compliance) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Reject All - Equally prominent as Accept All (French GDPR requirement) */}
            <Button
              variant="outline"
              className="rounded-xl flex-1 sm:flex-none order-3 sm:order-1"
              onClick={() => handleAccept('rejected')}
            >
              <X className="w-4 h-4 mr-2" />
              {t('cookieConsent.rejectAll', 'Reject All')}
            </Button>

            {/* Essential Only */}
            <Button
              variant="outline"
              className="rounded-xl flex-1 sm:flex-none order-2 sm:order-2"
              onClick={() => handleAccept('essential')}
            >
              {t('cookieConsent.essentialOnly', 'Essential Only')}
            </Button>

            {/* Accept All */}
            <Button
              className="rounded-xl flex-1 sm:flex-none order-1 sm:order-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAccept('all')}
            >
              {t('cookieConsent.acceptAll', 'Accept All')}
            </Button>
          </div>

          {/* Footer links */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="underline hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              {showDetails 
                ? t('cookieConsent.hideDetails', 'Hide details') 
                : t('cookieConsent.showDetails', 'Show details')
              }
            </button>
            <div className="flex gap-3">
              <Link
                to="/terms"
                className="underline hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              >
                {t('cookieConsent.privacyPolicy', 'Privacy Policy')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
