import React from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { Leaf, Grid3X3, ScrollText, Search, LogIn, UserPlus, User, LogOut, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopBarProps {
  openLogin: () => void
  openSignup: () => void
  user?: { id: string | null } | null
  displayName?: string | null
  onProfile?: () => void
  onLogout?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ openLogin, openSignup, user, displayName, onProfile, onLogout }) => {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [menuOpen])
  const label = displayName && displayName.trim().length > 0 ? displayName : 'Profile'
  return (
    <header className="max-w-5xl mx-auto flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-green-200 flex items-center justify-center shadow">
        <Leaf className="h-5 w-5" />
      </div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">PLANT SWIPE</h1>
      <nav className="ml-4 hidden md:flex gap-2">
        <NavPill to="/" icon={<ScrollText className="h-4 w-4" />} label="Swipe" />
        <NavPill to="/gallery" icon={<Grid3X3 className="h-4 w-4" />} label="Gallery" />
        <NavPill to="/search" icon={<Search className="h-4 w-4" />} label="Search" />
      </nav>
  <div className="ml-auto flex items-center gap-2">
        {user && (
          <Button className="rounded-2xl" variant="default" onClick={() => navigate('/create')}>
            <Plus className="h-4 w-4 mr-2" /> Add Plant
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
          <div className="relative" ref={menuRef}>
            <Button className="rounded-2xl" variant="secondary" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}>
              <User className="h-4 w-4 mr-2" /> {label}
              <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl border bg-white shadow z-20 p-1">
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); onProfile ? onProfile() : navigate('/profile') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2">
                  <User className="h-4 w-4" /> Profile
                </button>
                <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); onLogout && onLogout() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-red-600 flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function NavPill({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-sm shadow-sm ${isActive ? 'bg-black text-white' : 'bg-white'}`}
      end
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}
