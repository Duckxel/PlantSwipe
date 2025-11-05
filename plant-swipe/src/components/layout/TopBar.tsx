import React from "react"
import { createPortal } from "react-dom"
import { Link } from "@/components/i18n/Link"
import { Leaf, Sprout, Sparkles, Search, LogIn, UserPlus, User, LogOut, ChevronDown, Plus, Shield, HeartHandshake, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

interface TopBarProps {
  openLogin: () => void
  openSignup: () => void
  user?: { id: string | null } | null
  displayName?: string | null
  onProfile?: () => void
  onLogout?: () => void
}

import { useAuth } from "@/context/AuthContext"
import { userHasUnfinishedTasksToday } from "@/lib/gardens"
import { addGardenBroadcastListener } from "@/lib/realtime"
import { supabase } from "@/lib/supabaseClient"
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
  const [hasUnfinished, setHasUnfinished] = React.useState(false)
  
  // Refresh notification state
  const refreshNotification = React.useCallback(async () => {
    try {
      if (!user?.id) { setHasUnfinished(false); return }
      const has = await userHasUnfinishedTasksToday(user.id)
      setHasUnfinished(has)
    } catch {
      setHasUnfinished(false)
    }
  }, [user?.id])

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

  // Initial load
  React.useEffect(() => {
    refreshNotification()
  }, [refreshNotification])

  // Listen to local events (for when user is on garden page)
  React.useEffect(() => {
    const handler = () => { refreshNotification() }
    try { window.addEventListener('garden:tasks_changed', handler as EventListener) } catch {}
    return () => { try { window.removeEventListener('garden:tasks_changed', handler as EventListener) } catch {} }
  }, [refreshNotification])

  // Listen to realtime broadcasts (works from any page)
  React.useEffect(() => {
    if (!user?.id) return
    let active = true
    let teardown: (() => Promise<void>) | null = null

    addGardenBroadcastListener((message) => {
      if (!active) return
      // Refresh notification when tasks change in any garden
      if (message.kind === 'tasks' || message.kind === 'general') {
        refreshNotification()
      }
    })
      .then((unsubscribe) => {
        if (!active) {
          unsubscribe().catch(() => {})
        } else {
          teardown = unsubscribe
        }
      })
      .catch(() => {})

    return () => {
      active = false
      if (teardown) teardown().catch(() => {})
    }
  }, [user?.id, refreshNotification])

  // Also listen to postgres changes for task occurrences (direct fallback)
  React.useEffect(() => {
    if (!user?.id) return
    let active = true
    
    const channel = supabase.channel('rt-navbar-tasks')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'garden_plant_task_occurrences' 
      }, () => {
        if (active) refreshNotification()
      })
    
    const subscription = channel.subscribe()
    if (subscription instanceof Promise) subscription.catch(() => {})

    return () => {
      active = false
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [user?.id, refreshNotification])
  const label = displayName && displayName.trim().length > 0 ? displayName : t('common.profile')
  return (
    <header className="max-w-6xl mx-auto w-full flex items-center gap-3 px-2 overflow-x-hidden">
      <div className="h-10 w-10 rounded-2xl bg-green-200 flex items-center justify-center shadow">
        <Leaf className="h-5 w-5" />
      </div>
      <Link
        to="/"
        className="text-2xl md:text-3xl font-semibold tracking-tight no-underline text-black hover:text-black visited:text-black active:text-black focus:text-black focus-visible:outline-none outline-none hover:opacity-90"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {t('common.appName')}
      </Link>
      <nav className="ml-4 hidden md:flex gap-2">
        <NavPill to="/" isActive={pathWithoutLang === '/'} icon={<Sparkles className="h-4 w-4" />} label={t('common.discovery')} />
        <NavPill to="/gardens" isActive={pathWithoutLang.startsWith('/gardens') || pathWithoutLang.startsWith('/garden/')} icon={<Sprout className="h-4 w-4" />} label={t('common.garden')} showDot={hasUnfinished} />
        <NavPill to="/search" isActive={pathWithoutLang.startsWith('/search')} icon={<Search className="h-4 w-4" />} label={t('common.encyclopedia')} />
      </nav>
  <div className="ml-auto flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0 justify-end">
        {user && (
          <Button className="rounded-2xl" variant="default" onClick={() => navigate('/create')}>
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">{t('common.addPlant')}</span>
          </Button>
        )}
        {!user ? (
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
                className="w-40 rounded-xl border bg-white shadow z-[60] p-1"
                style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }}
                role="menu"
              >
                {profile?.is_admin && (
                  <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/admin') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2" role="menuitem">
                    <Shield className="h-4 w-4" /> {t('common.admin')}
                  </button>
                )}
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); (onProfile ? onProfile : () => navigate('/profile'))() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2" role="menuitem">
                  <User className="h-4 w-4" /> {t('common.profile')}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/friends') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2" role="menuitem">
                  <HeartHandshake className="h-4 w-4" /> {t('common.friends')}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/settings') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2" role="menuitem">
                  <Settings className="h-4 w-4" /> {t('common.settings')}
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); if (onLogout) { onLogout() } }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-red-600 flex items-center gap-2" role="menuitem">
                  <LogOut className="h-4 w-4" /> {t('common.logout')}
                </button>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function NavPill({ to, isActive, icon, label, showDot }: { to: string; isActive: boolean; icon: React.ReactNode; label: string; showDot?: boolean }) {
  return (
    <div className="relative inline-block align-middle overflow-visible">
      <Button
        asChild
        variant={'secondary'}
        className={isActive ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}
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
          className="pointer-events-none absolute -top-[2px] -right-[2px] z-20 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
