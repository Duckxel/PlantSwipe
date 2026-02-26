import React from "react"
import { Link } from "@/components/i18n/Link"
import { Youtube, Twitter, Instagram, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"

const footerLinks = [
  { to: '/about', labelKey: 'about', fallback: 'About' },
  { to: '/blog', labelKey: 'blog', fallback: 'Blog' },
  { to: '/contact', labelKey: 'contactUs', fallback: 'Contact Us' },
  { to: '/download', labelKey: 'downloadApp', fallback: 'Download' },
] as const

const legalLinks = [
  { to: '/terms', labelKey: 'termsOfServices', fallback: 'Terms of Service' },
  { to: '/privacy', labelKey: 'privacyPolicy', fallback: 'Privacy Policy' },
] as const

const FooterComponent: React.FC = () => {
  const { t } = useTranslation('common')
  const currentYear = new Date().getFullYear()
  const [legalOpen, setLegalOpen] = React.useState(false)
  const legalRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (legalRef.current && !legalRef.current.contains(event.target as Node)) {
        setLegalOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <footer className="max-w-6xl mx-auto mt-10 pt-8 pb-6 px-2 border-t border-stone-300 dark:border-[#3e3e42]">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Social Media Icons */}
          <div className="flex items-center gap-4">
            <a
              href="https://www.youtube.com/@aphylia_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
              aria-label="YouTube"
            >
              <Youtube className="h-5 w-5" />
            </a>
            <a
              href="https://x.com/aphylia_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors"
              aria-label="X (Twitter)"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="https://www.instagram.com/aphylia_app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 dark:text-stone-400 hover:text-pink-600 dark:hover:text-pink-500 transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>

        {/* Footer Links */}
        <nav className="flex flex-wrap items-center justify-center gap-4 text-sm">
          {footerLinks.map(({ to, labelKey, fallback }) => (
            <Link
              key={labelKey}
              to={to}
              className="text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors no-underline"
            >
              {labelKey === 'downloadApp'
                ? t('common.footer.downloadApp', { defaultValue: fallback })
                : t(`common.footer.${labelKey}`, { defaultValue: fallback })}
            </Link>
          ))}
          
          {/* Legal Dropdown */}
          <div ref={legalRef} className="relative">
            <button
              onClick={() => setLegalOpen(!legalOpen)}
              className="flex items-center gap-1 text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors"
            >
              {t('common.footer.legal', { defaultValue: 'Legal' })}
              <ChevronDown className={`h-4 w-4 transition-transform ${legalOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {legalOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 py-2 px-1 bg-white dark:bg-[#2d2d30] border border-stone-200 dark:border-[#3e3e42] rounded-xl shadow-lg min-w-[160px] z-50">
                {legalLinks.map(({ to, labelKey, fallback }) => (
                  <Link
                    key={labelKey}
                    to={to}
                    onClick={() => setLegalOpen(false)}
                    className="block px-3 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42] rounded-lg transition-colors no-underline"
                  >
                    {t(`common.footer.${labelKey}`, { defaultValue: fallback })}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Copyright */}
        <div className="text-xs text-stone-500 dark:text-stone-500 text-center md:text-right">
          © {currentYear} {t('common.appName')}. {t('common.allRightsReserved')}.
        </div>
      </div>
    </footer>
  )
}

// ⚡ Bolt: Memoize Footer to prevent re-renders when parent state (like swipe index) changes.
// Footer is static and doesn't depend on parent state, so re-renders are unnecessary.
export const Footer = React.memo(FooterComponent)
