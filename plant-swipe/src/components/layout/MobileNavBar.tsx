import React from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Sparkles, Sprout, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileNavBarProps {
  canCreate?: boolean
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ canCreate }) => {
  const location = useLocation()
  const currentView: "discovery" | "gardens" | "search" | "create" =
    location.pathname === "/" ? "discovery" :
    location.pathname.startsWith("/gardens") || location.pathname.startsWith('/garden/') ? "gardens" :
    location.pathname.startsWith("/search") ? "search" :
    location.pathname.startsWith("/create") ? "create" : "discovery"

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      role="navigation"
      aria-label="Primary"
    >
      <div className="mx-auto max-w-5xl px-3 py-2 grid grid-cols-3 gap-2">
        <Button asChild variant={"secondary"} className={currentView === 'discovery' ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}>
          <NavLink to="/" end className="no-underline flex items-center justify-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" /> <span>Discover</span>
          </NavLink>
        </Button>
        <Button asChild variant={"secondary"} className={currentView === 'gardens' ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}>
          <NavLink to="/gardens" className="no-underline flex items-center justify-center gap-2 text-sm">
            <Sprout className="h-4 w-4" /> <span>Garden</span>
          </NavLink>
        </Button>
        <Button asChild variant={"secondary"} className={currentView === 'search' ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}>
          <NavLink to="/search" className="no-underline flex items-center justify-center gap-2 text-sm">
            <Search className="h-4 w-4" /> <span>Search</span>
          </NavLink>
        </Button>
      </div>
      {canCreate && (
        <div className="mx-auto max-w-5xl px-3 pb-2">
          <Button asChild className="w-full rounded-2xl">
            <NavLink to="/create" className="no-underline flex items-center justify-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> <span>Add Plant</span>
            </NavLink>
          </Button>
        </div>
      )}
    </nav>
  )
}

export default MobileNavBar

