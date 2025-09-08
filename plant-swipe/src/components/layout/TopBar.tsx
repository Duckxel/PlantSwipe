import React from "react"
import { Leaf, Grid3X3, ScrollText, Search, LogIn, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopBarProps {
  view: string
  setView: (v: any) => void
  openLogin: () => void
  openSignup: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ view, setView, openLogin, openSignup }) => {
  return (
    <header className="max-w-5xl mx-auto flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-green-200 flex items-center justify-center shadow">
        <Leaf className="h-5 w-5" />
      </div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">PlantSwipe</h1>
      <nav className="ml-4 hidden md:flex gap-2">
        <NavPill active={view === 'swipe'} onClick={() => setView('swipe')} icon={<ScrollText className="h-4 w-4" />} label="Swipe" />
        <NavPill active={view === 'gallery'} onClick={() => setView('gallery')} icon={<Grid3X3 className="h-4 w-4" />} label="Gallery" />
        <NavPill active={view === 'search'} onClick={() => setView('search')} icon={<Search className="h-4 w-4" />} label="Search" />
      </nav>
  <div className="ml-auto flex items-center gap-2">
        <Button className="rounded-2xl" variant="secondary" onClick={openSignup}>
          <UserPlus className="h-4 w-4 mr-2" /> Sign up
        </Button>
        <Button className="rounded-2xl" variant="default" onClick={openLogin}>
          <LogIn className="h-4 w-4 mr-2" /> Login
        </Button>
      </div>
    </header>
  )
}

function NavPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-sm shadow-sm ${active ? 'bg-black text-white' : 'bg-white'}`}>
      {icon}
      <span>{label}</span>
    </button>
  )
}
