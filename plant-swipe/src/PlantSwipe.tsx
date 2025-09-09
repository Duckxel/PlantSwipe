import React, { useMemo, useState } from "react";
import { useMotionValue } from "framer-motion";
import { Search } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopBar } from "@/components/layout/TopBar";
import { BottomBar } from "@/components/layout/BottomBar";
import { SwipePage } from "@/pages/SwipePage";
import { GalleryPage } from "@/pages/GalleryPage";
import { SearchPage } from "@/pages/SearchPage";
import type { Plant } from "@/types/plant";
import { PlantDetails } from "@/components/plant/PlantDetails";
import { useAuth } from "@/context/AuthContext";
import { ProfilePage } from "@/pages/ProfilePage";

// --- Main Component ---
export default function PlantSwipe() {
  const { user, signIn, signUp, signOut, profile } = useAuth()
  const [query, setQuery] = useState("")
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [onlySeeds, setOnlySeeds] = useState(false)

  const [index, setIndex] = useState(0)
  const [openInfo, setOpenInfo] = useState<Plant | null>(null)

  const [view, setView] = useState<"swipe" | "gallery" | "search" | "profile">("swipe")
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")
  const [authError, setAuthError] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authPassword2, setAuthPassword2] = useState("")
  const [authDisplayName, setAuthDisplayName] = useState("")
  const [authSubmitting, setAuthSubmitting] = useState(false)

  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  React.useEffect(() => {
    (async () => {
      try {
        const apiBase = (import.meta as any).env?.VITE_API_BASE || ''
        const resp = await fetch(`${apiBase}/api/plants`)
        const data = await resp.json()
        if (!resp.ok) {
          throw new Error(data?.error || `HTTP ${resp.status}`)
        }
        const parsed: Plant[] = (Array.isArray(data) ? data : []).map((p: any) => ({
          id: String(p.id),
          name: String(p.name),
          scientificName: String(p.scientificName || p.scientific_name || ''),
          colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
          seasons: Array.isArray(p.seasons) ? p.seasons.map(String) : [],
          rarity: p.rarity as Plant['rarity'],
          meaning: p.meaning ? String(p.meaning) : '',
          description: p.description ? String(p.description) : '',
          image: p.image || p.image_url || '',
          care: {
            sunlight: (p.care?.sunlight || p.care_sunlight || 'Low') as Plant['care']['sunlight'],
            water: (p.care?.water || p.care_water || 'Low') as Plant['care']['water'],
            soil: String(p.care?.soil || p.care_soil || ''),
            difficulty: (p.care?.difficulty || p.care_difficulty || 'Easy') as Plant['care']['difficulty']
          },
          seedsAvailable: Boolean(p.seedsAvailable ?? p.seeds_available ?? false)
        }))
        setPlants(parsed)
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load plants')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    return plants.filter((p: Plant) => {
      const matchesQ = `${p.name} ${p.scientificName} ${p.meaning} ${p.colors.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesSeason = seasonFilter ? p.seasons.includes(seasonFilter as any) : true
      const matchesColor = colorFilter ? p.colors.map((c: string) => c.toLowerCase()).includes(colorFilter.toLowerCase()) : true
      const matchesSeeds = onlySeeds ? p.seedsAvailable : true
      return matchesQ && matchesSeason && matchesColor && matchesSeeds
    })
  }, [plants, query, seasonFilter, colorFilter, onlySeeds])

  // Swiping-only randomized order with continuous wrap-around
  const [shuffleEpoch, setShuffleEpoch] = useState(0)
  const swipeList = useMemo(() => {
    const arr = filtered.slice()
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }, [filtered, shuffleEpoch])

  const current = swipeList.length > 0 ? swipeList[index % swipeList.length] : undefined

  const handlePass = () => {
    if (swipeList.length === 0) return
    setIndex((i) => {
      const next = i + 1
      // When we complete a full cycle, reshuffle for variety
      if (swipeList.length > 0 && next % swipeList.length === 0) {
        setShuffleEpoch((e) => e + 1)
      }
      return next
    })
  }

  const handleInfo = () => {
    if (current) setOpenInfo(current)
  }

  // Swipe logic
  const x = useMotionValue(0)
  const threshold = 120
  const onDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const dx = info.offset.x + info.velocity.x * 0.2
    if (dx <= -threshold) {
      handlePass()
    } else if (dx >= threshold) {
      handleInfo()
    }
  }

  const openLogin = () => { setAuthMode("login"); setAuthOpen(true) }
  const openSignup = () => { setAuthMode("signup"); setAuthOpen(true) }

  const submitAuth = async () => {
    if (authSubmitting) return
    setAuthError(null)
    setAuthSubmitting(true)
    try {
      if (authMode === 'signup') {
        if (authPassword !== authPassword2) {
          setAuthError('Passwords do not match')
          return
        }
        const { error } = await signUp({ email: authEmail, password: authPassword, displayName: authDisplayName })
        if (error) { setAuthError(error); return }
      } else {
        const { error } = await signIn({ email: authEmail, password: authPassword })
        if (error) { setAuthError(error); return }
      }
      // Optimistically update UI; effect below will also ensure closure when user updates
      setAuthOpen(false)
      setView('swipe')
    } catch (e: any) {
      setAuthError(e?.message || 'Unexpected error')
    } finally {
      setAuthSubmitting(false)
    }
  }

  // Close auth dialog and route to swipe once the user object becomes available
  React.useEffect(() => {
    if (user) {
      setAuthOpen(false)
      setView('swipe')
    }
  }, [user])

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-50 to-stone-100 p-4 md:p-8">
  <TopBar
    view={view}
    setView={setView}
    openLogin={openLogin}
    openSignup={openSignup}
    user={user}
    displayName={profile?.display_name || null}
    onProfile={() => setView('profile')}
    onLogout={async () => { await signOut(); setView('swipe') }}
  />

      {/* Mobile nav */}
      <div className="max-w-5xl mx-auto mt-4 md:hidden grid grid-cols-3 gap-2">
        <button onClick={() => setView('swipe')} className={`px-3 py-2 rounded-xl border text-sm ${view==='swipe' ? 'bg-black text-white' : 'bg-white'}`}>Swipe</button>
        <button onClick={() => setView('gallery')} className={`px-3 py-2 rounded-xl border text-sm ${view==='gallery' ? 'bg-black text-white' : 'bg-white'}`}>Gallery</button>
        <button onClick={() => setView('search')} className={`px-3 py-2 rounded-xl border text-sm ${view==='search' ? 'bg-black text-white' : 'bg-white'}`}>Search</button>
      </div>

      {/* Layout: grid only when search view (to avoid narrow column in other views) */}
      <div className={`max-w-6xl mx-auto mt-6 ${view === 'search' ? 'lg:grid lg:grid-cols-[260px_1fr] lg:gap-10' : ''}`}>
        {/* Sidebar / Filters */}
        {view === 'search' && (
        <aside className="mb-8 lg:mb-0 space-y-6 lg:sticky lg:top-4 self-start" aria-label="Filters">
          {/* Search */}
            <div>
              <Label htmlFor="plant-search" className="sr-only">Search plants</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                <Input
                  id="plant-search"
                  className="pl-9"
                  placeholder="Search name, meaning, color…"
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setQuery(e.target.value)
                    setIndex(0)
                  }}
                />
              </div>
            </div>

            {/* Seasons */}
            <div>
              <div className="text-xs font-medium mb-2 uppercase tracking-wide opacity-60">Season</div>
              <div className="flex flex-wrap gap-2">
                {(["Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeasonFilter((cur) => (cur === s ? null : s))}
                    className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${seasonFilter === s ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`}
                    aria-pressed={seasonFilter === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div>
              <div className="text-xs font-medium mb-2 uppercase tracking-wide opacity-60">Color</div>
              <div className="flex flex-wrap gap-2">
                {["Red", "Pink", "Yellow", "White", "Purple", "Blue", "Orange", "Green"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColorFilter((cur) => (cur === c ? null : c))}
                    className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${colorFilter === c ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`}
                    aria-pressed={colorFilter === c}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2">
              <button
                onClick={() => setOnlySeeds((v) => !v)}
                className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition ${
                  onlySeeds ? "bg-emerald-600 text-white" : "bg-white hover:bg-stone-50"
                }`}
                aria-pressed={onlySeeds}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-current" /> Seeds only
              </button>
            </div>

            {/* Active filters summary */}
            <div className="text-xs space-y-1">
              <div className="font-medium uppercase tracking-wide opacity-60">Active</div>
              <div className="flex flex-wrap gap-2">
                {seasonFilter && (
                  <Badge variant="secondary" className="rounded-xl">{seasonFilter}</Badge>
                )}
                {colorFilter && (
                  <Badge variant="secondary" className="rounded-xl">{colorFilter}</Badge>
                )}
                {onlySeeds && (
                  <Badge variant="secondary" className="rounded-xl">Seeds</Badge>
                )}
                {!seasonFilter && !colorFilter && !onlySeeds && (
                  <span className="opacity-50">None</span>
                )}
              </div>
            </div>
  </aside>
  )}

        {/* Main content area */}
        <main className="min-h-[60vh]" aria-live="polite">
          {loading && <div className="p-8 text-center text-sm opacity-60">Connecting to database…</div>}
          {loadError && <div className="p-8 text-center text-sm text-red-600">Database error: {loadError}</div>}
          {!loading && !loadError && (
            <>
              {plants.length === 0 && !query && !loadError && !loading && (
                <div className="p-8 text-center text-sm opacity-60">
                  No plants found. Insert rows into table "plants" (columns: id, name, scientific_name, colors[], seasons[], rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available) then refresh.
                </div>
              )}
              {view === 'swipe' && plants.length > 0 && (
                <SwipePage
                  current={current}
                  index={index}
                  setIndex={setIndex}
                  x={x}
                  onDragEnd={onDragEnd}
                  handleInfo={handleInfo}
                  handlePass={handlePass}
                />
              )}
              {view === 'gallery' && plants.length > 0 && (
                <GalleryPage plants={plants} onOpen={(p) => setOpenInfo(p)} />
              )}
              {view === 'search' && (
                <SearchPage plants={filtered} openInfo={(p) => setOpenInfo(p)} />
              )}
              {view === 'profile' && user && (
                <ProfilePage />
              )}
            </>
          )}
        </main>
      </div>

      {/* Info Sheet */}
      <Sheet open={!!openInfo} onOpenChange={(o: boolean) => !o && setOpenInfo(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
          {openInfo && <PlantDetails plant={openInfo} onClose={() => setOpenInfo(null)} />}
        </SheetContent>
      </Sheet>

      {/* Auth Dialog (Login / Sign up) */}
      <Dialog open={authOpen && !user} onOpenChange={setAuthOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? 'Log in' : 'Create your account'}</DialogTitle>
            <DialogDescription>
              {authMode === 'login' ? 'Access favorites, notes, and seed wishlists.' : 'Start saving favorites, notes, and seed wishlists.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {authMode === 'signup' && (
              <div className="grid gap-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" type="text" placeholder="Your name" value={authDisplayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthDisplayName(e.target.value)} />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={authEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthEmail(e.target.value)} disabled={authSubmitting} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={authPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthPassword(e.target.value)} disabled={authSubmitting} />
            </div>
            {authMode === 'signup' && (
              <div className="grid gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" placeholder="••••••••" value={authPassword2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthPassword2(e.target.value)} disabled={authSubmitting} />
              </div>
            )}
            {authError && <div className="text-sm text-red-600">{authError}</div>}
            <Button className="w-full rounded-2xl" onClick={submitAuth} disabled={authSubmitting}>
              {authSubmitting ? (authMode === 'login' ? 'Signing in…' : 'Creating account…') : (authMode === 'login' ? 'Continue' : 'Create account')}
            </Button>
            <div className="text-center text-xs opacity-60">Demo only – hook up to your auth later (e.g., Supabase, Clerk, Auth.js)</div>
            <div className="text-center text-sm">
              {authMode === 'login' ? (
                <button className="underline" onClick={() => setAuthMode('signup')}>No account? Sign up</button>
              ) : (
                <button className="underline" onClick={() => setAuthMode('login')}>Have an account? Log in</button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomBar />
    </div>
  )
}

