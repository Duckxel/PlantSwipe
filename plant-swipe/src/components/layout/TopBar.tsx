import React from "react"
import { createPortal } from "react-dom"
import { Link } from "@/components/i18n/Link"
import { Sprout, Sparkles, Search, LogIn, UserPlus, User, LogOut, ChevronDown, Shield, HeartHandshake, Settings, Crown, CreditCard, LayoutGrid, Route, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

interface TopBarProps {
  openLogin: () => void
  openSignup: () => void
  user?: { id: string | null } | null
  displayName?: string | null
  onProfile?: () => void | Promise<void>
  onLogout?: () => void | Promise<void>
}

import { useAuth } from "@/context/AuthContext"
import { useTaskNotification } from "@/hooks/useTaskNotification"
import { usePathWithoutLanguage, useLanguageNavigate } from "@/lib/i18nRouting"

export const TopBar: React.FC<TopBarProps> = ({ openLogin, openSignup, user, displayName, onProfile, onLogout }) => {
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()
  const { profile } = useAuth()
  const { t } = useTranslation('common')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [menuPosition, setMenuPosition] = React.useState<{ top: number; right: number } | null>(null)
  const { hasUnfinished } = useTaskNotification(user?.id ?? null, { channelKey: "topbar" })

  const recomputeMenuPosition = React.useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const top = rect.bottom + 8 // align below trigger with small gap
    const right = Math.max(0, window.innerWidth - rect.right)
    setMenuPosition({ top, right })
  }, [])

  React.useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && menuRef.current.contains(target)) return
      if (anchorRef.current && anchorRef.current.contains(target)) return
      setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    // keep menu aligned to trigger on resize/scroll
    const onReposition = () => recomputeMenuPosition()
    recomputeMenuPosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [menuOpen, recomputeMenuPosition])

  const label = displayName && displayName.trim().length > 0 ? displayName : t('common.profile')
    return (
      <>
        <style>{`
          .plant-icon-theme {
            filter: brightness(0) saturate(100%);
          }
          .dark .plant-icon-theme {
            filter: brightness(0) saturate(100%) invert(100%);
          }
        `}</style>
        <header className="hidden md:flex max-w-6xl mx-auto w-full items-center gap-3 px-2 overflow-x-hidden overflow-y-visible desktop-drag-region" style={{ paddingTop: '1.5rem', paddingBottom: '0.5rem', marginTop: '0' }}>
          <Link
            to={user ? "/discovery" : "/"}
            className="flex-shrink-0 no-underline cursor-pointer"
            style={{ marginTop: '-1.25rem', WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
          >
            <img 
              src="/icons/plant-swipe-icon.svg" 
              alt="Aphylia" 
              className="h-16 w-14 plant-icon-theme"
              draggable="false"
              style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
            />
          </Link>
      <Link
        to={user ? "/discovery" : "/"}
        className="font-brand text-[1.925rem] md:text-[2.625rem] leading-none font-semibold tracking-tight no-underline text-black dark:text-white hover:text-black dark:hover:text-white visited:text-black dark:visited:text-white active:text-black dark:active:text-white focus:text-black dark:focus:text-white focus-visible:outline-none outline-none hover:opacity-90 whitespace-nowrap shrink-0"
        style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      >
        {t('common.appName')}
      </Link>
      <nav className="ml-4 hidden md:flex gap-2 items-center">
        {user ? (
          // Logged-in navigation: Discovery, Gardens, Encyclopedia (always normal)
          <>
            <NavPill to="/discovery" isActive={pathWithoutLang === '/discovery' || pathWithoutLang.startsWith('/discovery/')} icon={<Sparkles className="h-4 w-4" />} label={t('common.discovery')} />
            <NavPill to="/gardens" isActive={pathWithoutLang.startsWith('/gardens') || pathWithoutLang.startsWith('/garden/')} icon={<Sprout className="h-4 w-4" />} label={t('common.garden')} showDot={hasUnfinished} />
            <NavPill to="/search" isActive={pathWithoutLang.startsWith('/search')} icon={<Search className="h-4 w-4" />} label={t('common.encyclopedia')} />
          </>
        ) : (
          // Logged-out navigation: Features, How it works, FAQ, Encyclopedia, Pricing (same on all pages)
          <>
            <NavPillAnchor to="/#features" icon={<LayoutGrid className="h-4 w-4" />} label={t('common.landingFeatures', { defaultValue: 'Features' })} />
            <NavPillAnchor to="/#how-it-works" icon={<Route className="h-4 w-4" />} label={t('common.landingHowItWorks', { defaultValue: 'How it works' })} />
            <NavPillAnchor to="/#faq" icon={<HelpCircle className="h-4 w-4" />} label={t('common.landingFaq', { defaultValue: 'FAQ' })} />
            <NavPill to="/search" isActive={pathWithoutLang.startsWith('/search')} icon={<Search className="h-4 w-4" />} label={t('common.encyclopedia')} />
            <NavPill to="/pricing" isActive={pathWithoutLang === '/pricing'} icon={<CreditCard className="h-4 w-4" />} label={t('common.pricing', { defaultValue: 'Pricing' })} />
          </>
        )}
      </nav>
  <div className="ml-auto flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0 justify-end">
        {!user ? (
          // Logged-out: show Sign up and Login buttons on all pages
          <>
            <Button className="rounded-2xl" variant="secondary" onClick={openSignup}>
              <UserPlus className="h-4 w-4 mr-2" /> {t('common.signup')}
            </Button>
            <Button className="rounded-2xl" variant="default" onClick={openLogin}>
              <LogIn className="h-4 w-4 mr-2" /> {t('common.login')}
            </Button>
          </>
        ) : (
          <div className="relative" ref={anchorRef}>
            <Button className="rounded-2xl" variant="secondary" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); setMenuOpen((o) => !o); }} aria-label="Profile menu" aria-haspopup="menu" aria-expanded={menuOpen}>
              <User className="h-4 w-4 mr-2 shrink-0" />
              <span className="hidden sm:inline max-w-[40vw] truncate min-w-0">{label}</span>
              <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
            </Button>
            {menuOpen && menuPosition && createPortal(
              <div
                ref={menuRef}
                className="w-40 rounded-xl border bg-white dark:bg-[#252526] dark:border-[#3e3e42] shadow z-[60] p-1"
                style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }}
                role="menu"
              >
                {profile?.is_admin && (
                  <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/admin') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] flex items-center gap-2" role="menuitem">
                    <Shield className="h-4 w-4" /> {t('common.admin')}
                  </button>
                )}
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); (onProfile ? onProfile : () => navigate('/profile'))() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] flex items-center gap-2" role="menuitem">
                  <User className="h-4 w-4" /> {t('common.profile')}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/friends') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] flex items-center gap-2" role="menuitem">
                  <HeartHandshake className="h-4 w-4" /> {t('common.friends')}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/settings') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] flex items-center gap-2" role="menuitem">
                  <Settings className="h-4 w-4" /> {t('common.settings')}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/pricing') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] flex items-center gap-2 text-emerald-600 dark:text-emerald-400" role="menuitem">
                  <Crown className="h-4 w-4" /> {t('common.membership', { defaultValue: 'Membership' })}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); if (onLogout) { onLogout() } }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400 flex items-center gap-2" role="menuitem">
                  <LogOut className="h-4 w-4" /> {t('common.logout')}
                </button>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </header>
      </>
  )
}

function NavPill({ to, isActive, icon, label, showDot }: { to: string; isActive: boolean; icon: React.ReactNode; label: string; showDot?: boolean }) {
  return (
    <div className="relative inline-block align-middle overflow-visible">
      <Button
        asChild
        variant={'secondary'}
        className={isActive ? "rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 hover:text-white dark:hover:text-black" : "rounded-2xl bg-white dark:bg-[#252526] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#2d2d30] hover:text-black dark:hover:text-white"}
      >
        <Link to={to} className="no-underline">
          <span className="inline-flex items-center gap-2">
            {icon}
            <span>{label}</span>
          </span>
        </Link>
      </Button>
      {showDot && (
        <span
          className="pointer-events-none absolute -top-[2px] -right-[2px] z-20 h-2.5 w-2.5 rounded-full bg-red-600 dark:bg-red-500 ring-2 ring-white dark:ring-[#252526]"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

/** NavPillAnchor - like NavPill but for anchor links that navigate to landing page sections */
function NavPillAnchor({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const [path, hash] = to.split('#')
    const targetPath = path || '/'
    
    // If we're already on the landing page, just scroll to the section
    if (pathWithoutLang === '/' || pathWithoutLang === '') {
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      // Navigate to landing page with hash
      navigate(targetPath)
      // After navigation, scroll to section (need small delay for page to load)
      setTimeout(() => {
        const el = document.getElementById(hash)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }

  return (
    <div className="relative inline-block align-middle overflow-visible">
      <Button
        variant="secondary"
        className="rounded-2xl bg-white dark:bg-[#252526] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#2d2d30] hover:text-black dark:hover:text-white"
        onClick={handleClick}
      >
        <span className="inline-flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </span>
      </Button>
    </div>
  )
}
