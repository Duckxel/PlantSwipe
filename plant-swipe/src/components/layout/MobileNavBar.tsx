import React from "react"
import { Link } from "@/components/i18n/Link"
import { usePathWithoutLanguage, useLanguageNavigate } from "@/lib/i18nRouting"
import { 
  Sparkles, 
  Sprout, 
  Search, 
  Plus, 
  User, 
  Shield, 
  HeartHandshake, 
  Settings, 
  LogOut, 
  Crown, 
  Home,
  LogIn, 
  UserPlus, 
  Bell, 
  MessageCircle,
  ChevronRight,
  ScanLine,
  Bug
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useTaskNotification } from "@/hooks/useTaskNotification"
import { useNotifications } from "@/hooks/useNotifications"
import { useTranslation } from "react-i18next"
import { checkEditorAccess, checkBugCatcherAccess } from "@/constants/userRoles"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MobileNotificationSheet } from "@/components/layout/MobileNotificationSheet"

interface MobileNavBarProps {
  canCreate?: boolean
  onProfile?: () => void | Promise<void>
  onLogout?: () => void | Promise<void>
  onLogin?: () => void
  onSignup?: () => void
}

// No portal needed - the nav uses position:fixed which is relative to viewport
// Removing the portal simplifies the code and prevents potential rendering issues

const MobileNavBarComponent: React.FC<MobileNavBarProps> = ({ canCreate, onProfile, onLogout, onLogin, onSignup }) => {
  const pathWithoutLang = usePathWithoutLanguage()
  const navigate = useLanguageNavigate()
  const { user, profile } = useAuth()
  const { hasUnfinished } = useTaskNotification(user?.id ?? null, { channelKey: "mobile" })
  const { totalCount, counts, friendRequests, gardenInvites, refresh: refreshNotifications } = useNotifications(user?.id ?? null, { channelKey: "mobile" })
  const { t } = useTranslation("common")
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const [guestMenuOpen, setGuestMenuOpen] = React.useState(false)
  const [notificationSheetOpen, setNotificationSheetOpen] = React.useState(false)
  const navRef = React.useRef<HTMLElement | null>(null)

  // Helper to open notification sheet from profile menu.
  // Delays the notification sheet opening so the profile menu Sheet
  // fully closes first — avoids overlapping Radix Dialog transitions
  // which can break pointer-event handling on mobile.
  const openNotificationsFromMenu = React.useCallback(() => {
    setProfileMenuOpen(false)
    // Wait for the Sheet close animation (150ms) to finish before opening
    // the notification sheet so Radix Dialog can clean up properly.
    setTimeout(() => setNotificationSheetOpen(true), 180)
  }, [])

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined
    document.body.classList.add("mobile-nav-mounted")
    return () => {
      document.body.classList.remove("mobile-nav-mounted")
    }
  }, [])
  
  const currentView: "discovery" | "gardens" | "search" | "messages" | "create" | "profile" | "home" =
    pathWithoutLang === "/" ? "home" :
    pathWithoutLang === "/discovery" || pathWithoutLang.startsWith("/discovery/") ? "discovery" :
    pathWithoutLang.startsWith("/gardens") || pathWithoutLang.startsWith('/garden/') ? "gardens" :
    pathWithoutLang.startsWith("/search") ? "search" :
    pathWithoutLang.startsWith("/messages") ? "messages" :
    pathWithoutLang.startsWith("/create") ? "create" :
    pathWithoutLang.startsWith("/profile") || pathWithoutLang.startsWith("/u/") || pathWithoutLang.startsWith("/friends") || pathWithoutLang.startsWith("/settings") ? "profile" :
    "discovery"

  const displayName = profile?.display_name || null
  const label = displayName && displayName.trim().length > 0 ? displayName : t('common.profile')
  
  // Combined notification count (notifications + unread messages)
  const combinedNotificationCount = totalCount + (counts.unreadMessages || 0)

  const navMarkup = (
    <>
      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t border-stone-200/80 dark:border-[#3e3e42]/80 bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-[#1a1a1c]/70 pb-[max(env(safe-area-inset-bottom),0px)]"
        role="navigation"
        aria-label="Primary"
        style={{ 
          transform: "translate3d(0, 0, 0)", 
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <div className="relative mx-auto max-w-lg px-2 pt-2 pb-1">
          {/* Center floating create button */}
          {canCreate && (
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2">
              <Button 
                asChild 
                variant="default" 
                size="icon" 
                className="pointer-events-auto h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
              >
                <Link to="/create" aria-label="Add Plant" className="no-underline flex items-center justify-center">
                  <Plus className="h-6 w-6" />
                </Link>
              </Button>
            </div>
          )}
          
          {/* Navigation Items */}
          <div className="flex items-center justify-around">
            {user ? (
              // Logged-in navigation with labels - Search is now a primary nav item
              <>
                <NavItem 
                  to="/discovery" 
                  icon={<Sparkles className="h-5 w-5" />} 
                  label={t('common.discovery', { defaultValue: 'Discover' })}
                  isActive={currentView === 'discovery'}
                />
                <NavItem 
                  to="/gardens" 
                  icon={<Sprout className="h-5 w-5" />} 
                  label={t('common.garden', { defaultValue: 'Garden' })}
                  isActive={currentView === 'gardens'}
                  showDot={hasUnfinished || gardenInvites.length > 0}
                />
                <NavItem 
                  to="/search" 
                  icon={<Search className="h-5 w-5" />} 
                  label={t('common.search', { defaultValue: 'Search' })}
                  isActive={currentView === 'search'}
                />
                <NavItemButton
                  icon={<User className="h-5 w-5" />}
                  label={t('common.menu', { defaultValue: 'Menu' })}
                  isActive={currentView === 'profile' || currentView === 'messages'}
                  onClick={() => setProfileMenuOpen(true)}
                  badge={(totalCount + (counts.unreadMessages || 0)) > 0 ? (totalCount + (counts.unreadMessages || 0)) : undefined}
                />
              </>
            ) : (
              // Logged-out navigation with labels
              <>
                <NavItem 
                  to="/" 
                  icon={<Home className="h-5 w-5" />} 
                  label={t('common.home', { defaultValue: 'Home' })}
                  isActive={currentView === 'home'}
                />
                <NavItem 
                  to="/search" 
                  icon={<Search className="h-5 w-5" />} 
                  label={t('common.search', { defaultValue: 'Search' })}
                  isActive={currentView === 'search'}
                />
                <NavItemButton
                  icon={<LogIn className="h-5 w-5" />}
                  label={t('common.login', { defaultValue: 'Login' })}
                  isActive={false}
                  onClick={() => { if (onLogin) onLogin() }}
                />
                <NavItemButton
                  icon={<UserPlus className="h-5 w-5" />}
                  label={t('common.signup', { defaultValue: 'Sign up' })}
                  isActive={false}
                  onClick={() => { if (onSignup) onSignup() }}
                  highlight
                />
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Profile Menu Sheet */}
      <Sheet open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-8 max-h-[85vh]">
          <SheetHeader className="px-6 pb-4 border-b border-stone-100 dark:border-[#2a2a2d]">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xl font-semibold shadow-lg shadow-emerald-500/20">
                {(displayName || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left text-lg">{label}</SheetTitle>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false)
                    if (onProfile) onProfile()
                    else navigate("/profile")
                  }}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {t("common.viewProfile", { defaultValue: "View profile" })}
                </button>
              </div>
              {/* Notification Bell - matches web version style */}
              <div className="relative">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-2xl h-9 w-9"
                  onClick={openNotificationsFromMenu}
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {totalCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white dark:ring-[#252526]"
                    aria-hidden="true"
                  >
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </div>
            </div>
          </SheetHeader>
          
          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            {/* Notifications Section */}
            {combinedNotificationCount > 0 && (
              <div className="px-4 py-3">
                <button
                  onClick={openNotificationsFromMenu}
                  className="w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      {t("notifications.title", { defaultValue: "Notifications" })}
                    </p>
                    <p className="text-sm text-amber-700/70 dark:text-amber-300/70">
                      {combinedNotificationCount} {t("notifications.pending", { defaultValue: "pending" })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-600/50 dark:text-amber-400/50" />
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="px-4 py-2">
              <p className="px-2 py-2 text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                {t("common.quickActions", { defaultValue: "Quick Actions" })}
              </p>
              <div className="grid grid-cols-4 gap-2">
                <QuickActionButton
                  icon={<ScanLine className="h-5 w-5" />}
                  label={t("scan.title", { defaultValue: "Scan" })}
                  onClick={() => {
                    setProfileMenuOpen(false)
                    navigate("/scan")
                  }}
                  highlight
                />
                <QuickActionButton
                  icon={<HeartHandshake className="h-5 w-5" />}
                  label={t("common.friends", { defaultValue: "Friends" })}
                  onClick={() => {
                    setProfileMenuOpen(false)
                    navigate("/friends")
                  }}
                />
                <QuickActionButton
                  icon={<MessageCircle className="h-5 w-5" />}
                  label={t("common.messages", { defaultValue: "Chats" })}
                  onClick={() => {
                    setProfileMenuOpen(false)
                    navigate("/messages")
                  }}
                  badge={counts.unreadMessages > 0 ? counts.unreadMessages : undefined}
                />
                <QuickActionButton
                  icon={<Settings className="h-5 w-5" />}
                  label={t("common.settings", { defaultValue: "Settings" })}
                  onClick={() => {
                    setProfileMenuOpen(false)
                    navigate("/settings")
                  }}
                />
              </div>
            </div>

            {/* Menu Items */}
            <div className="px-4 py-2">
              <p className="px-2 py-2 text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                {t("common.account", { defaultValue: "Account" })}
              </p>
              <div className="space-y-1">
                {checkEditorAccess(profile) && (
                  <MenuButton
                    icon={<Shield className="h-5 w-5" />}
                    label={t("common.admin", { defaultValue: "Admin Panel" })}
                    onClick={() => {
                      setProfileMenuOpen(false)
                      navigate("/admin")
                    }}
                  />
                )}
                {checkBugCatcherAccess(profile) && (
                  <MenuButton
                    icon={<Bug className="h-5 w-5" />}
                    label={t("common.bugCatcher", { defaultValue: "Bug Catching" })}
                    onClick={() => {
                      setProfileMenuOpen(false)
                      navigate("/bug-catcher")
                    }}
                    bugCatcher
                  />
                )}
                <MenuButton
                  icon={<Crown className="h-5 w-5" />}
                  label={t("common.membership", { defaultValue: "Membership" })}
                  onClick={() => {
                    setProfileMenuOpen(false)
                    navigate("/pricing")
                  }}
                  highlight
                />
                <MenuButton
                  icon={<LogOut className="h-5 w-5" />}
                  label={t("common.logout", { defaultValue: "Log out" })}
                  onClick={() => {
                    setProfileMenuOpen(false)
                    if (onLogout) onLogout()
                  }}
                  destructive
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Guest menu for non-logged-in users */}
      <Sheet open={guestMenuOpen} onOpenChange={setGuestMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{t("common.welcome", { defaultValue: "Welcome" })}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            <button
              onClick={() => {
                setGuestMenuOpen(false)
                if (onLogin) onLogin()
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <LogIn className="h-5 w-5" />
              <span>{t("common.login")}</span>
            </button>
            <button
              onClick={() => {
                setGuestMenuOpen(false)
                if (onSignup) onSignup()
              }}
              className="w-full text-left px-4 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] flex items-center gap-3 text-emerald-600 dark:text-emerald-400 active:scale-[0.98] transition-transform"
            >
              <UserPlus className="h-5 w-5" />
              <span>{t("common.signup")}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Notification Sheet */}
      <MobileNotificationSheet
        isOpen={notificationSheetOpen}
        onClose={() => setNotificationSheetOpen(false)}
        friendRequests={friendRequests}
        gardenInvites={gardenInvites}
        onRefresh={refreshNotifications}
      />
    </>
  )

  // No portal needed - position:fixed is relative to viewport regardless of DOM position
  return navMarkup
}

/** NavItem - Link-based navigation item with label */
function NavItem({ 
  to, 
  icon, 
  label, 
  isActive, 
  showDot,
  badge
}: { 
  to: string
  icon: React.ReactNode
  label: string
  isActive: boolean
  showDot?: boolean
  badge?: number
}) {
  return (
    <Link
      to={to}
      className={`
        flex flex-col items-center justify-center gap-0.5 px-2 py-2 min-w-[56px] rounded-xl no-underline
        transition-colors duration-150 active:scale-95
        ${isActive 
          ? 'text-emerald-600 dark:text-emerald-400' 
          : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="relative">
        {icon}
        {showDot && !badge && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1a1a1c]"
            aria-hidden="true"
          />
        )}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#1a1a1c]"
            aria-hidden="true"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {label}
      </span>
    </Link>
  )
}

/** NavItemButton - Button-based navigation item with label */
function NavItemButton({ 
  icon, 
  label, 
  isActive, 
  onClick,
  badge,
  highlight
}: { 
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  badge?: number
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-0.5 px-2 py-2 min-w-[56px] rounded-xl
        transition-colors duration-150 active:scale-95
        ${highlight
          ? 'text-emerald-600 dark:text-emerald-400'
          : isActive 
            ? 'text-emerald-600 dark:text-emerald-400' 
            : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
        }
      `}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#1a1a1c]"
            aria-hidden="true"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-medium ${highlight ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {label}
      </span>
    </button>
  )
}

/** QuickActionButton - Grid-based quick action button */
function QuickActionButton({
  icon,
  label,
  onClick,
  badge,
  highlight
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  badge?: number
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl active:scale-95 transition-all ${
        highlight 
          ? 'bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30' 
          : 'bg-stone-50 dark:bg-[#2a2a2d] hover:bg-stone-100 dark:hover:bg-[#333336]'
      }`}
    >
      <div className={`relative ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-300'}`}>
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[11px] font-medium ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-300'}`}>{label}</span>
    </button>
  )
}

/** MenuButton - Standard menu item button */
function MenuButton({
  icon,
  label,
  onClick,
  highlight,
  destructive,
  bugCatcher
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  highlight?: boolean
  destructive?: boolean
  bugCatcher?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl
        transition-all duration-150 active:scale-[0.98]
        ${destructive 
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
          : bugCatcher
            ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
            : highlight 
              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2a2a2d]'
        }
      `}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  )
}

export const MobileNavBar = React.memo(MobileNavBarComponent)

export default MobileNavBar
