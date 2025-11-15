import React from "react"
import { Link } from "@/components/i18n/Link"
import { Youtube, Twitter, Instagram, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"

const footerLinks = [
  { to: '/about', labelKey: 'about', fallback: 'About' },
  { to: '/blog', labelKey: 'blog', fallback: 'Blog' },
  { to: '/contact', labelKey: 'contactUs', fallback: 'Contact Us' },
] as const

const moreLinks = [
  { to: '/download', labelKey: 'downloadApp', fallback: 'Download' },
  { to: '/terms', labelKey: 'termsOfServices', fallback: 'Terms of Services' },
] as const

export const Footer: React.FC = () => {
  const { t } = useTranslation('common')
  const currentYear = new Date().getFullYear()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <footer className="max-w-6xl mx-auto mt-10 pt-8 pb-6 px-2 border-t border-stone-300 dark:border-[#3e3e42]">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Social Media Icons */}
        <div className="flex items-center gap-4">
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
            aria-label="YouTube"
          >
            <Youtube className="h-5 w-5" />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors"
            aria-label="X (Twitter)"
          >
            <Twitter className="h-5 w-5" />
          </a>
          <a
            href="https://instagram.com"
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
              {t(`common.footer.${labelKey}`, { defaultValue: fallback })}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className="flex items-center gap-1 text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              {t('common.footer.more', { defaultValue: 'More' })}
              <ChevronDown className={`h-4 w-4 transition duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
              className={`absolute left-0 mt-2 min-w-[180px] rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] shadow-lg shadow-emerald-500/10 p-3 transition-all duration-150 ${
                moreOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-1'
              }`}
              role="menu"
            >
              {moreLinks.map(({ to, labelKey, fallback }) => (
                <Link
                  key={labelKey}
                  to={to}
                  className="block px-2 py-2 rounded-xl text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#2d2d30]"
                  onClick={() => setMoreOpen(false)}
                >
                  {labelKey === 'downloadApp'
                    ? t('common.footer.downloadApp', { defaultValue: fallback })
                    : t(`common.footer.${labelKey}`, { defaultValue: fallback })}
                </Link>
              ))}
            </div>
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
