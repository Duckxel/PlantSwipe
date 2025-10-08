import React from "react"
import { createPortal } from "react-dom"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { Leaf, Sprout, Sparkles, Search, LogIn, UserPlus, User, LogOut, ChevronDown, Plus, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

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

export const TopBar: React.FC<TopBarProps> = ({ openLogin, openSignup, user, displayName, onProfile, onLogout }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [menuPosition, setMenuPosition] = React.useState<{ top: number; right: number } | null>(null)
  const [hasUnfinished, setHasUnfinished] = React.useState(false)

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

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        if (!user?.id) { if (!cancelled) setHasUnfinished(false); return }
        const has = await userHasUnfinishedTasksToday(user.id)
        if (!cancelled) setHasUnfinished(has)
      } catch {
        if (!cancelled) setHasUnfinished(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [user?.id])
  const label = displayName && displayName.trim().length > 0 ? displayName : 'Profile'
  return (
    <header className="max-w-5xl mx-auto w-full flex items-center gap-3 px-2 overflow-x-hidden">
      <div className="h-10 w-10 rounded-2xl bg-green-200 flex items-center justify-center shadow">
        <Leaf className="h-5 w-5" />
      </div>
      <Link
        to="/"
        className="text-2xl md:text-3xl font-semibold tracking-tight no-underline text-black hover:text-black visited:text-black active:text-black focus:text-black focus-visible:outline-none outline-none hover:opacity-90"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        PLANT SWIPE
      </Link>
      <nav className="ml-4 hidden md:flex gap-2">
        <NavPill to="/" isActive={location.pathname === '/'} icon={<Sparkles className="h-4 w-4" />} label="Discovery" />
        <NavPill to="/gardens" isActive={location.pathname.startsWith('/gardens') || location.pathname.startsWith('/garden/')} icon={<Sprout className="h-4 w-4" />} label="Garden" showDot={hasUnfinished} />
        <NavPill to="/search" isActive={location.pathname.startsWith('/search')} icon={<Search className="h-4 w-4" />} label="Search" />
      </nav>
  <div className="ml-auto flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0 justify-end">
        {user && (
          <Button className="rounded-2xl" variant="default" onClick={() => navigate('/create')}>
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Add Plant</span>
          </Button>
        )}
        {!user ? (
          <>
            <Button className="rounded-2xl" variant="secondary" onClick={openSignup}>
              <UserPlus className="h-4 w-4 mr-2" /> Sign up
            </Button>
            <Button className="rounded-2xl" variant="default" onClick={openLogin}>
              <LogIn className="h-4 w-4 mr-2" /> Login
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
                    <Shield className="h-4 w-4" /> Admin
                  </button>
                )}
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); (onProfile ? onProfile : () => navigate('/profile'))() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2" role="menuitem">
                  <User className="h-4 w-4" /> Profile
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); if (onLogout) { onLogout() } }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-red-600 flex items-center gap-2" role="menuitem">
                  <LogOut className="h-4 w-4" /> Logout
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
    <Button
      asChild
      variant={'secondary'}
      className={isActive ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}
    >
      <Link to={to} className="no-underline">
        <span className="relative inline-flex items-center gap-2">
          {icon}
          <span>{label}</span>
          {showDot && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
          )}
        </span>
      </Link>
    </Button>
  )
}
