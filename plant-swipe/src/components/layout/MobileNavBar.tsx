import React from "react"
import { createPortal } from "react-dom"
import { Link } from "@/components/i18n/Link"
import { usePathWithoutLanguage, useLanguageNavigate } from "@/lib/i18nRouting"
import { Sparkles, Sprout, Search, Plus, User, Shield, HeartHandshake, Settings, LogOut, Crown, CreditCard, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useTaskNotification } from "@/hooks/useTaskNotification"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface MobileNavBarProps {
  canCreate?: boolean
  onProfile?: () => void | Promise<void>
  onLogout?: () => void | Promise<void>
  onLogin?: () => void
  /** When true, shows landing page variant: Encyclopedia only for logged-out, "Return to app" for logged-in */
  landingMode?: boolean
}

const MOBILE_NAV_HOST_ATTR = "data-mobile-nav-root"
const MOBILE_NAV_HOST_ID = "mobile-nav-root"

const isBrowser = typeof window !== "undefined"
const useIsomorphicLayoutEffect = isBrowser ? React.useLayoutEffect : React.useEffect

let mobileNavHost: HTMLElement | null = null
let mobileNavHostUsers = 0

const useMobileNavHost = () => {
  const [host, setHost] = React.useState<HTMLElement | null>(() => {
    if (typeof document === "undefined") return null
    const existing = document.querySelector<HTMLElement>(`[${MOBILE_NAV_HOST_ATTR}="true"]`)
    return existing ?? null
  })

  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return undefined

    let element = mobileNavHost
    if (!element) {
      element = document.querySelector<HTMLElement>(`[${MOBILE_NAV_HOST_ATTR}="true"]`) ?? null
    }

    if (!element) {
      element = document.createElement("div")
      element.id = MOBILE_NAV_HOST_ID
      element.setAttribute(MOBILE_NAV_HOST_ATTR, "true")
      element.style.position = "relative"
      document.body.appendChild(element)
    }

    mobileNavHost = element
    mobileNavHostUsers += 1
    setHost(element)

    return () => {
      mobileNavHostUsers -= 1
      if (mobileNavHostUsers <= 0 && mobileNavHost?.parentElement) {
        mobileNavHost.parentElement.removeChild(mobileNavHost)
        mobileNavHost = null
      }
      setHost(null)
    }
  }, [])

  return host
}

const MobileNavBarComponent: React.FC<MobileNavBarProps> = ({ canCreate, onProfile, onLogout, onLogin, landingMode }) => {
  const host = useMobileNavHost()
  const pathWithoutLang = usePathWithoutLanguage()
  const navigate = useLanguageNavigate()
  const { user, profile } = useAuth()
  const { hasUnfinished } = useTaskNotification(user?.id ?? null, { channelKey: "mobile" })
  const { t } = useTranslation("common")
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const navRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined
    document.body.classList.add("mobile-nav-mounted")
    return () => {
      document.body.classList.remove("mobile-nav-mounted")
    }
  }, [])
  
  const currentView: "discovery" | "gardens" | "search" | "create" | "profile" | "pricing" =
    pathWithoutLang === "/discovery" || pathWithoutLang.startsWith("/discovery/") ? "discovery" :
    pathWithoutLang.startsWith("/gardens") || pathWithoutLang.startsWith('/garden/') ? "gardens" :
    pathWithoutLang.startsWith("/search") ? "search" :
    pathWithoutLang.startsWith("/create") ? "create" :
    pathWithoutLang === "/pricing" ? "pricing" :
    pathWithoutLang.startsWith("/profile") || pathWithoutLang.startsWith("/u/") || pathWithoutLang.startsWith("/friends") || pathWithoutLang.startsWith("/settings") ? "profile" :
    "discovery"

  const displayName = profile?.display_name || null
  const label = displayName && displayName.trim().length > 0 ? displayName : t('common.profile')

  const navMarkup = (
    <>
      <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t border-stone-200 dark:border-[#3e3e42] bg-white/70 dark:bg-[#252526]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-[#252526]/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.3)] pb-[max(env(safe-area-inset-bottom),0px)]"
      role="navigation"
      aria-label="Primary"
      style={{ transform: "translateZ(0)", contain: "layout paint" }}
    >
      <div className="relative mx-auto max-w-6xl px-6 pt-3 pb-3">
        {/* Center floating create button */}
        {canCreate && (
          <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2">
            <Button asChild variant={"default"} size={"icon"} className="pointer-events-auto h-14 w-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black shadow-xl ring-1 ring-black/10 dark:ring-white/20">
              <Link to="/create" aria-label="Add Plant" className="no-underline flex items-center justify-center">
                <Plus className="h-7 w-7" />
              </Link>
            </Button>
          </div>
        )}
        {/* Icon-only nav items - different for logged in vs logged out, and landing mode */}
        <div className="flex items-center justify-around gap-8">
          {landingMode ? (
            // Landing page mode
            user ? (
              // Logged-in on landing: Encyclopedia, Pricing, Return to app
              <>
                <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'search' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                  <Link to="/search" aria-label="Encyclopedia" className="no-underline flex items-center justify-center">
                    <Search className="h-6 w-6" />
                  </Link>
                </Button>
                <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'pricing' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                  <Link to="/pricing" aria-label="Pricing" className="no-underline flex items-center justify-center">
                    <CreditCard className="h-6 w-6" />
                  </Link>
                </Button>
                <Button asChild variant={"default"} size={"icon"} className="h-12 w-12 rounded-2xl">
                  <Link to="/discovery" aria-label={t('common.returnToApp', { defaultValue: 'Return to app' })} className="no-underline flex items-center justify-center">
                    <Home className="h-6 w-6" />
                  </Link>
                </Button>
              </>
            ) : (
              // Logged-out on landing: Encyclopedia, Pricing, Login
              <>
                <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'search' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                  <Link to="/search" aria-label="Encyclopedia" className="no-underline flex items-center justify-center">
                    <Search className="h-6 w-6" />
                  </Link>
                </Button>
                <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'pricing' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                  <Link to="/pricing" aria-label="Pricing" className="no-underline flex items-center justify-center">
                    <CreditCard className="h-6 w-6" />
                  </Link>
                </Button>
                <Button
                  variant={"secondary"}
                  size={"icon"}
                  className="h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"
                  type="button"
                  onClick={() => {
                    if (onLogin) {
                      onLogin()
                    } else {
                      navigate('/')
                    }
                  }}
                  aria-label={t('common.login')}
                >
                  <User className="h-6 w-6" />
                </Button>
              </>
            )
          ) : user ? (
            // Logged-in navigation: Discovery, Gardens, Search, Profile
            <>
              <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'discovery' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                <Link to="/discovery" aria-label="Discover" className="no-underline flex items-center justify-center">
                  <Sparkles className="h-6 w-6" />
                </Link>
              </Button>
              <div className="relative overflow-visible">
                <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'gardens' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                  <Link to="/gardens" aria-label="Garden" className="no-underline flex items-center justify-center">
                    <Sprout className="h-6 w-6" />
                  </Link>
                </Button>
                {hasUnfinished && (
                  <span
                    className="pointer-events-none absolute -top-[2px] -right-[2px] z-20 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#252526]"
                    aria-hidden="true"
                  />
                )}
              </div>
              <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'search' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                <Link to="/search" aria-label="Search" className="no-underline flex items-center justify-center">
                  <Search className="h-6 w-6" />
                </Link>
              </Button>
              <Button
                variant={"secondary"}
                size={"icon"}
                className={currentView === 'profile' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}
                onClick={() => setProfileMenuOpen(true)}
                aria-label="Profile"
              >
                <User className="h-6 w-6" />
              </Button>
            </>
          ) : (
            // Logged-out navigation: Search, Pricing, Login
            <>
              <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'search' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                <Link to="/search" aria-label="Search" className="no-underline flex items-center justify-center">
                  <Search className="h-6 w-6" />
                </Link>
              </Button>
              <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'pricing' ? "h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90" : "h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"}>
                <Link to="/pricing" aria-label="Pricing" className="no-underline flex items-center justify-center">
                  <CreditCard className="h-6 w-6" />
                </Link>
              </Button>
              <Button
                variant={"secondary"}
                size={"icon"}
                className="h-12 w-12 rounded-2xl bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-100 dark:hover:bg-[#3e3e42]"
                type="button"
                onClick={() => {
                  if (onLogin) {
                    onLogin()
                  } else {
                    navigate('/')
                  }
                }}
                aria-label={t('common.login')}
              >
                <User className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </div>
      </nav>
      <Sheet open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {profile?.is_admin && (
              <button
                onClick={() => {
                  setProfileMenuOpen(false)
                  navigate("/admin")
                }}
                className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3"
              >
                <Shield className="h-5 w-5" />
                <span>{t("common.admin")}</span>
              </button>
            )}
            <button
              onClick={() => {
                setProfileMenuOpen(false)
                if (onProfile) {
                  onProfile()
                } else {
                  navigate("/profile")
                }
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3"
            >
              <User className="h-5 w-5" />
              <span>{t("common.profile")}</span>
            </button>
            <button
              onClick={() => {
                setProfileMenuOpen(false)
                navigate("/friends")
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3"
            >
              <HeartHandshake className="h-5 w-5" />
              <span>{t("common.friends")}</span>
            </button>
            <button
              onClick={() => {
                setProfileMenuOpen(false)
                navigate("/settings")
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3"
            >
              <Settings className="h-5 w-5" />
              <span>{t("common.settings")}</span>
            </button>
            <button
              onClick={() => {
                setProfileMenuOpen(false)
                navigate("/pricing")
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3 text-emerald-600 dark:text-emerald-400"
            >
              <Crown className="h-5 w-5" />
              <span>{t("common.membership", { defaultValue: "Membership" })}</span>
            </button>
            <button
              onClick={() => {
                setProfileMenuOpen(false)
                if (onLogout) {
                  onLogout()
                }
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400 flex items-center gap-3"
            >
              <LogOut className="h-5 w-5" />
              <span>{t("common.logout")}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )

  if (host) {
    return createPortal(navMarkup, host)
  }

  return navMarkup
}

export const MobileNavBar = React.memo(MobileNavBarComponent)

export default MobileNavBar

