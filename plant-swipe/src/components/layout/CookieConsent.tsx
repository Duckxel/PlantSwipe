import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Cookie, X, Settings } from 'lucide-react'

// Cookie consent storage key and version
const COOKIE_CONSENT_KEY = 'cookie_consent'
const CONSENT_VERSION = '1.0'

export type ConsentLevel = 'essential' | 'analytics' | 'all' | 'rejected'

export interface CookieConsentData {
  level: ConsentLevel
  date: string
  version: string
}

// Helper to check if analytics is allowed
export function isAnalyticsAllowed(): boolean {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) return false
    const consent: CookieConsentData = JSON.parse(stored)
    return consent.level === 'analytics' || consent.level === 'all'
  } catch {
    return false
  }
}

// Helper to check if marketing cookies are allowed  
export function isMarketingAllowed(): boolean {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) return false
    const consent: CookieConsentData = JSON.parse(stored)
    return consent.level === 'all'
  } catch {
    return false
  }
}

// Helper to get current consent data
export function getConsentData(): CookieConsentData | null {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

// Helper to clear consent (for testing or user reset)
export function clearConsent(): void {
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY)
  } catch {}
}

export function CookieConsent() {
  const { t } = useTranslation('common')
  const [show, setShow] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Check if consent has been given
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (!consent) {
        // Small delay to avoid layout shift on initial load
        const timer = setTimeout(() => setShow(true), 500)
        return () => clearTimeout(timer)
      }
      // Check if consent version is outdated
      const parsed: CookieConsentData = JSON.parse(consent)
      if (parsed.version !== CONSENT_VERSION) {
        const timer = setTimeout(() => setShow(true), 500)
        return () => clearTimeout(timer)
      }
    } catch {
      const timer = setTimeout(() => setShow(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = (level: ConsentLevel) => {
    const consentData: CookieConsentData = {
      level,
      date: new Date().toISOString(),
      version: CONSENT_VERSION,
    }
    
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData))
    } catch {
      // Silently fail if localStorage is not available
    }
    
    setShow(false)

    // Dispatch custom event for analytics initialization
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cookie-consent-changed', { 
        detail: consentData 
      }))
    }
  }

  if (!show) return null

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div className="mx-auto max-w-6xl px-4 pb-4">
        <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow-2xl dark:shadow-[0_-4px_30px_rgba(0,0,0,0.3)]">
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Cookie className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 
                    id="cookie-consent-title" 
                    className="font-semibold text-stone-900 dark:text-white"
                  >
                    {t('cookie.title', 'Cookie Preferences')}
                  </h2>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {t('cookie.subtitle', 'Manage your privacy settings')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                aria-expanded={showDetails}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {showDetails ? t('cookie.hideDetails', 'Hide details') : t('cookie.showDetails', 'Details')}
                </span>
              </button>
            </div>

            {/* Description */}
            <p 
              id="cookie-consent-description"
              className="text-sm text-stone-600 dark:text-stone-300 mb-4"
            >
              {t('cookie.description', 'We use cookies and similar technologies to improve your experience, analyze traffic, and for personalization. You can choose which cookies you allow.')}
            </p>

            {/* Details section */}
            {showDetails && (
              <div className="mb-4 space-y-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#1e1e1e] p-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="font-medium text-stone-900 dark:text-white">
                      {t('cookie.essential', 'Essential')}
                    </span>
                    <p className="text-stone-500 dark:text-stone-400">
                      {t('cookie.essentialDesc', 'Required for the app to function. Cannot be disabled.')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <span className="font-medium text-stone-900 dark:text-white">
                      {t('cookie.analytics', 'Analytics')}
                    </span>
                    <p className="text-stone-500 dark:text-stone-400">
                      {t('cookie.analyticsDesc', 'Help us understand how you use the app to improve it.')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                  <div>
                    <span className="font-medium text-stone-900 dark:text-white">
                      {t('cookie.marketing', 'Marketing')}
                    </span>
                    <p className="text-stone-500 dark:text-stone-400">
                      {t('cookie.marketingDesc', 'Used for personalized content and advertisements.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons - GDPR France compliant: Reject must be as prominent as Accept */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleAccept('rejected')}
                className="rounded-xl order-3 sm:order-1"
              >
                {t('cookie.rejectAll', 'Reject All')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAccept('essential')}
                className="rounded-xl order-2"
              >
                {t('cookie.essentialOnly', 'Essential Only')}
              </Button>
              <Button 
                onClick={() => handleAccept('all')}
                className="rounded-xl order-1 sm:order-3"
              >
                {t('cookie.acceptAll', 'Accept All')}
              </Button>
            </div>

            {/* Privacy link */}
            <p className="mt-4 text-xs text-center text-stone-400 dark:text-stone-500">
              {t('cookie.learnMore', 'Learn more about how we use cookies in our')}{' '}
              <a 
                href="/terms#privacy" 
                className="underline hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                {t('cookie.privacyPolicy', 'Privacy Policy')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
