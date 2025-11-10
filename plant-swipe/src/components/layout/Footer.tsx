import React from "react"
import { Link } from "@/components/i18n/Link"
import { Youtube, Twitter, Instagram } from "lucide-react"
import { useTranslation } from "react-i18next"

const footerLinks = [
  { to: '/about', labelKey: 'about', fallback: 'About' },
  { to: '/blog', labelKey: 'blog', fallback: 'Blog' },
  { to: '/contact', labelKey: 'contactUs', fallback: 'Contact Us' },
  { to: '/terms', labelKey: 'termsOfServices', fallback: 'Terms of Services' },
] as const

export const Footer: React.FC = () => {
  const { t } = useTranslation('common')
  const currentYear = new Date().getFullYear()

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
        </nav>

        {/* Copyright */}
        <div className="text-xs text-stone-500 dark:text-stone-500 text-center md:text-right">
          © {currentYear} {t('common.appName')}. {t('common.allRightsReserved')}.
        </div>
      </div>
    </footer>
  )
}
