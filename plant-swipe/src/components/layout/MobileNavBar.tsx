import React from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Sparkles, Sprout, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { userHasUnfinishedTasksToday } from "@/lib/gardens"

interface MobileNavBarProps {
  canCreate?: boolean
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ canCreate }) => {
  const location = useLocation()
  const { user } = useAuth()
  const [hasUnfinished, setHasUnfinished] = React.useState(false)

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

  // Auto-refresh the Garden notification dot when tasks change without page reload
  React.useEffect(() => {
    const handler = async () => {
      try {
        if (!user?.id) { setHasUnfinished(false); return }
        const has = await userHasUnfinishedTasksToday(user.id)
        setHasUnfinished(has)
      } catch {
        setHasUnfinished(false)
      }
    }
    try { window.addEventListener('garden:tasks_changed', handler as EventListener) } catch {}
    return () => { try { window.removeEventListener('garden:tasks_changed', handler as EventListener) } catch {} }
  }, [user?.id])
  const currentView: "discovery" | "gardens" | "search" | "create" =
    location.pathname === "/" ? "discovery" :
    location.pathname.startsWith("/gardens") || location.pathname.startsWith('/garden/') ? "gardens" :
    location.pathname.startsWith("/search") ? "search" :
    location.pathname.startsWith("/create") ? "create" : "discovery"

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pb-[max(env(safe-area-inset-bottom),0px)]"
      role="navigation"
      aria-label="Primary"
    >
      <div className="relative mx-auto max-w-6xl px-6 pt-3 pb-3">
        {/* Center floating create button */}
        {canCreate && (
          <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2">
            <Button asChild variant={"default"} size={"icon"} className="pointer-events-auto h-14 w-14 rounded-2xl bg-black text-white shadow-xl ring-1 ring-black/10">
              <NavLink to="/create" aria-label="Add Plant" className="no-underline flex items-center justify-center">
                <Plus className="h-7 w-7" />
              </NavLink>
            </Button>
          </div>
        )}
        {/* Icon-only nav items */}
        <div className="flex items-center justify-around gap-8">
          <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'discovery' ? "h-12 w-12 rounded-2xl bg-black text-white hover:bg-black/90" : "h-12 w-12 rounded-2xl bg-white text-black hover:bg-stone-100"}>
            <NavLink to="/" end aria-label="Discover" className="no-underline flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </NavLink>
          </Button>
          <div className="relative">
            <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'gardens' ? "h-12 w-12 rounded-2xl bg-black text-white hover:bg-black/90" : "h-12 w-12 rounded-2xl bg-white text-black hover:bg-stone-100"}>
              <NavLink to="/gardens" aria-label="Garden" className="no-underline flex items-center justify-center">
                <Sprout className="h-6 w-6" />
              </NavLink>
            </Button>
            {hasUnfinished && (
              <span
                className="pointer-events-none absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                aria-hidden="true"
              />
            )}
          </div>
          <Button asChild variant={"secondary"} size={"icon"} className={currentView === 'search' ? "h-12 w-12 rounded-2xl bg-black text-white hover:bg-black/90" : "h-12 w-12 rounded-2xl bg-white text-black hover:bg-stone-100"}>
            <NavLink to="/search" aria-label="Search" className="no-underline flex items-center justify-center">
              <Search className="h-6 w-6" />
            </NavLink>
          </Button>
        </div>
      </div>
    </nav>
  )
}

export default MobileNavBar

