import React, { useMemo, useState } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useMotionValue } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopBar } from "@/components/layout/TopBar";
import { BottomBar } from "@/components/layout/BottomBar";
import { SwipePage } from "@/pages/SwipePage";
import { GardenListPage } from "@/pages/GardenListPage";
import { GardenDashboardPage } from "@/pages/GardenDashboardPage";
import { SearchPage } from "@/pages/SearchPage";
import { CreatePlantPage } from "@/pages/CreatePlantPage";
import { EditPlantPage } from "@/pages/EditPlantPage";
import type { Plant } from "@/types/plant";
import { PlantDetails } from "@/components/plant/PlantDetails";
import { useAuth } from "@/context/AuthContext";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminPage } from "@/pages/AdminPage";
import { supabase } from "@/lib/supabaseClient";

// --- Main Component ---
export default function PlantSwipe() {
  const { user, signIn, signUp, signOut, profile, refreshProfile } = useAuth()
  const [query, setQuery] = useState("")
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [onlySeeds, setOnlySeeds] = useState(false)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [favoritesFirst, setFavoritesFirst] = useState(false)

  const [index, setIndex] = useState(0)
  const [openInfo, setOpenInfo] = useState<Plant | null>(null)
  const [likedIds, setLikedIds] = useState<string[]>([])

  const location = useLocation()
  const navigate = useNavigate()
  const currentView: "discovery" | "gardens" | "search" | "profile" | "create" =
    location.pathname === "/" ? "discovery" :
    location.pathname.startsWith("/gardens") || location.pathname.startsWith('/garden/') ? "gardens" :
    location.pathname.startsWith("/search") ? "search" :
    location.pathname.startsWith("/profile") ? "profile" :
    location.pathname.startsWith("/create") ? "create" : "discovery"
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

  // Hydrate liked ids from profile when available
  React.useEffect(() => {
    const arr = Array.isArray(profile?.liked_plant_ids) ? profile!.liked_plant_ids!.map(String) : []
    setLikedIds(arr)
  }, [profile?.liked_plant_ids])

  const loadPlants = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
        .order('name', { ascending: true })
      if (error) throw error
      type PlantRow = {
        id: string | number
        name: string
        scientific_name?: string | null
        colors?: unknown
        seasons?: unknown
        rarity: Plant['rarity']
        meaning?: string | null
        description?: string | null
        image_url?: string | null
        care_sunlight?: Plant['care']['sunlight'] | null
        care_water?: Plant['care']['water'] | null
        care_soil?: string | null
        care_difficulty?: Plant['care']['difficulty'] | null
        seeds_available?: boolean | null
        water_freq_unit?: Plant['waterFreqUnit'] | null
        water_freq_value?: number | null
        water_freq_period?: Plant['waterFreqPeriod'] | null
        water_freq_amount?: number | null
      }
      const parsed: Plant[] = (Array.isArray(data) ? data : []).map((p: PlantRow) => ({
        id: String(p.id),
        name: String(p.name),
        scientificName: String(p.scientific_name || ''),
        colors: Array.isArray(p.colors as string[] | unknown[]) ? (p.colors as unknown[]).map((c) => String(c)) : [],
        seasons: Array.isArray(p.seasons as string[] | unknown[]) ? (p.seasons as unknown[]).map((s) => String(s)) as Plant['seasons'] : [],
        rarity: p.rarity as Plant['rarity'],
        meaning: p.meaning ? String(p.meaning) : '',
        description: p.description ? String(p.description) : '',
        image: p.image_url || '',
        care: {
          sunlight: (p.care_sunlight || 'Low') as Plant['care']['sunlight'],
          water: (p.care_water || 'Low') as Plant['care']['water'],
          soil: String(p.care_soil || ''),
          difficulty: (p.care_difficulty || 'Easy') as Plant['care']['difficulty']
        },
        seedsAvailable: Boolean(p.seeds_available ?? false),
        waterFreqUnit: p.water_freq_unit || undefined,
        waterFreqValue: p.water_freq_value ?? null,
        waterFreqPeriod: p.water_freq_period || undefined,
        waterFreqAmount: p.water_freq_amount ?? null
      }))
      setPlants(parsed)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
      setLoadError(msg || 'Failed to load plants')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadPlants()
  }, [loadPlants])

  // Global presence tracking so Admin can see "currently online" users
  const presenceRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null)
  React.useEffect(() => {
    // Track SPA route changes to server for visit analytics
    const sendVisit = async (path: string) => {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const authHeader = token ? { Authorization: `Bearer ${token}` } : {}
        const ref = document.referrer || ''
        const extra = {
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
          screen: { w: window.screen?.width || null, h: window.screen?.height || null, colorDepth: (window.screen as any)?.colorDepth || null },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          platform: navigator.platform || null,
          vendor: navigator.vendor || null,
          hardwareConcurrency: (navigator as any).hardwareConcurrency || null,
          memoryGB: (navigator as any).deviceMemory || null,
          webgl: (() => { try { const c = document.createElement('canvas'); const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null; const debug = gl && gl.getExtension('WEBGL_debug_renderer_info'); return debug && gl ? { vendor: gl.getParameter((debug as any).UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter((debug as any).UNMASKED_RENDERER_WEBGL) } : null } catch { return null } })(),
        }
        await fetch('/api/track-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            pagePath: path,
            referrer: ref,
            userId: user?.id || null,
            pageTitle: document.title || null,
            language: navigator.language || (navigator as any).languages?.[0] || null,
            utm: null,
            extra,
          }),
          keepalive: true,
        })
      } catch {}
    }

    // Initial on mount and on subsequent route changes
    sendVisit(location.pathname + location.search).catch(() => {})
    const unlisten = () => {
      // react-router v6 provides useLocation, so listen via effect dependency
    }
    return () => { unlisten() }
  }, [location.pathname, location.search, user?.id])

  React.useEffect(() => {
    // Stable anonymous id for non-authenticated visitors
    let anonId: string | null = null
    try {
      anonId = localStorage.getItem('plantswipe.anon_id')
      if (!anonId) {
        anonId = `anon_${Math.random().toString(36).slice(2, 10)}`
        localStorage.setItem('plantswipe.anon_id', anonId)
      }
    } catch {}

    const key = user?.id || anonId || `anon_${Math.random().toString(36).slice(2, 10)}`
    const channel = supabase.channel('global-presence', { config: { presence: { key } } })

    channel.subscribe((status: unknown) => {
      if (status === 'SUBSCRIBED') {
        channel.track({
          user_id: user?.id || null,
          display_name: profile?.display_name || null,
          online_at: new Date().toISOString(),
        })
      }
    })

    presenceRef.current = channel
    return () => {
      try { channel.untrack() } catch {}
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.display_name])

  const filtered = useMemo(() => {
    const likedSet = new Set(likedIds)
    const base = plants.filter((p: Plant) => {
      const matchesQ = `${p.name} ${p.scientificName} ${p.meaning} ${p.colors.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesSeason = seasonFilter ? p.seasons.includes(seasonFilter as Plant['seasons'][number]) : true
      const matchesColor = colorFilter ? p.colors.map((c: string) => c.toLowerCase()).includes(colorFilter.toLowerCase()) : true
      const matchesSeeds = onlySeeds ? p.seedsAvailable : true
      const matchesFav = onlyFavorites ? likedSet.has(p.id) : true
      return matchesQ && matchesSeason && matchesColor && matchesSeeds && matchesFav
    })
    if (favoritesFirst) {
      return base.slice().sort((a, b) => {
        const la = likedSet.has(a.id) ? 1 : 0
        const lb = likedSet.has(b.id) ? 1 : 0
        if (la !== lb) return lb - la
        // fallback: by name asc to keep deterministic
        return a.name.localeCompare(b.name)
      })
    }
    return base
  }, [plants, query, seasonFilter, colorFilter, onlySeeds, onlyFavorites, favoritesFirst, likedIds])

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
  const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const dx = info.offset.x + info.velocity.x * 0.2
    if (dx <= -threshold) {
      handlePass()
    } else if (dx >= threshold) {
      handleInfo()
    }
  }

  // Favorites handling
  const ensureLoggedIn = () => {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return false
    }
    return true
  }

  const toggleLiked = async (plantId: string) => {
    if (!ensureLoggedIn()) return
    setLikedIds((prev) => {
      const has = prev.includes(plantId)
      const next = has ? prev.filter((id) => id !== plantId) : [...prev, plantId]
      // fire-and-forget sync to Supabase
      ;(async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ liked_plant_ids: next })
            .eq('id', user!.id)
          if (error) {
            // revert on error
            setLikedIds(prev)
          } else {
            // keep server in sync in context eventually
            refreshProfile().catch(() => {})
          }
        } catch {
          setLikedIds(prev)
        }
      })()
      return next
    })
  }

  const openLogin = () => { setAuthMode("login"); setAuthOpen(true) }
  const openSignup = () => { setAuthMode("signup"); setAuthOpen(true) }

  const submitAuth = async () => {
    if (authSubmitting) return
    setAuthError(null)
    setAuthSubmitting(true)
    try {
      console.log('[auth] submit start', { mode: authMode })
      if (authMode === 'signup') {
        if (authPassword !== authPassword2) {
          console.warn('[auth] password mismatch')
          setAuthError('Passwords do not match')
          setAuthSubmitting(false)
          return
        }
        const { error } = await signUp({ email: authEmail, password: authPassword, displayName: authDisplayName })
        if (error) {
          console.error('[auth] signup error', error)
          setAuthError(error)
          setAuthSubmitting(false)
          return
        }
        console.log('[auth] signup ok')
      } else {
        const { error } = await signIn({ email: authEmail, password: authPassword })
        if (error) {
          console.error('[auth] login error', error)
          setAuthError(error)
          setAuthSubmitting(false)
          return
        }
        console.log('[auth] login ok')
      }
      setAuthOpen(false)
    } catch (e: unknown) {
      console.error('[auth] unexpected error', e)
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
      setAuthError(msg || 'Unexpected error')
      setAuthSubmitting(false)
    }
  }

  // Close auth dialog once the user object becomes available
  React.useEffect(() => {
    if (user) {
      setAuthOpen(false)
    }
  }, [user])

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-50 to-stone-100 p-4 md:p-8">
  <TopBar
    openLogin={openLogin}
    openSignup={openSignup}
    user={user}
    displayName={profile?.display_name || null}
    onProfile={() => navigate('/profile')}
    onLogout={async () => { await signOut(); navigate('/') }}
  />

      {/* Mobile nav */}
      <div className="max-w-5xl mx-auto mt-4 md:hidden grid grid-cols-3 gap-2">
        <Button asChild variant={'secondary'} className={currentView === 'discovery' ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}>
          <NavLink to="/" end className="no-underline flex items-center gap-2"><Sparkles className="h-4 w-4" /> Discovery</NavLink>
        </Button>
        <Button asChild variant={'secondary'} className={currentView === 'gardens' ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}>
          <NavLink to="/gardens" className="no-underline">Garden</NavLink>
        </Button>
        <Button asChild variant={'secondary'} className={currentView === 'search' ? "rounded-2xl bg-black text-white hover:bg-black/90 hover:text-white" : "rounded-2xl bg-white text-black hover:bg-stone-100 hover:text-black"}>
          <NavLink to="/search" className="no-underline">Search</NavLink>
        </Button>
      </div>

      {/* Layout: grid only when search view (to avoid narrow column in other views) */}
      <div className={`max-w-6xl mx-auto mt-6 ${currentView === 'search' ? 'lg:grid lg:grid-cols-[260px_1fr] lg:gap-10' : ''}`}>
        {/* Sidebar / Filters */}
        {currentView === 'search' && (
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
              <div className="h-2" />
              <button
                onClick={() => setOnlyFavorites((v) => !v)}
                className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition ${
                  onlyFavorites ? "bg-rose-600 text-white" : "bg-white hover:bg-stone-50"
                }`}
                aria-pressed={onlyFavorites}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-current" /> Favorites only
              </button>
              <div className="h-2" />
              <button
                onClick={() => setFavoritesFirst((v) => !v)}
                className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition ${
                  favoritesFirst ? "bg-rose-100 text-rose-900 border-rose-300" : "bg-white hover:bg-stone-50"
                }`}
                aria-pressed={favoritesFirst}
              >
                Favorites first
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
                {onlyFavorites && (
                  <Badge variant="secondary" className="rounded-xl">Favorites</Badge>
                )}
                {favoritesFirst && (
                  <Badge variant="secondary" className="rounded-xl">Favs first</Badge>
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
          {loading && <div className="p-8 text-center text-sm opacity-60">Loading from Supabase…</div>}
          {loadError && <div className="p-8 text-center text-sm text-red-600">Supabase error: {loadError}</div>}
          {!loading && !loadError && (
            <>
              {plants.length === 0 && !query && !loadError && !loading && (
                <div className="p-8 text-center text-sm opacity-60">
                  No plants found. Insert rows into table "plants" (columns: id, name, scientific_name, colors[], seasons[], rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available) then refresh.
                </div>
              )}
              <Routes>
                <Route
                  path="/"
                  element={plants.length > 0 ? (
                    <SwipePage
                      current={current}
                      index={index}
                      setIndex={setIndex}
                      x={x}
                      onDragEnd={onDragEnd}
                      handleInfo={handleInfo}
                      handlePass={handlePass}
                      liked={current ? likedIds.includes(current.id) : false}
                      onToggleLike={() => { if (current) toggleLiked(current.id) }}
                    />
                  ) : (
                    <></>
                  )}
                />
                <Route path="/gardens" element={<GardenListPage />} />
                <Route path="/garden/:id/*" element={<GardenDashboardPage />} />
                <Route
                  path="/search"
                  element={
                    <SearchPage
                      plants={filtered}
                      openInfo={(p) => setOpenInfo(p)}
                      likedIds={likedIds}
                    />
                  }
                />
                <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
                <Route path="/admin" element={profile?.is_admin ? <AdminPage /> : <Navigate to="/" replace />} />
                <Route path="/create" element={user ? (
                  <CreatePlantPage
                    onCancel={() => navigate('/')}
                    onSaved={async () => { await loadPlants(); navigate('/search') }}
                  />
                ) : (
                  <Navigate to="/" replace />
                )} />
                <Route path="/plants/:id/edit" element={user ? (
                  <EditPlantPage
                    onCancel={() => navigate('/search')}
                    onSaved={async () => { await loadPlants(); navigate('/search') }}
                  />
                ) : (
                  <Navigate to="/" replace />
                )} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </>
          )}
        </main>
      </div>

      {/* Info Sheet */}
      <Sheet open={!!openInfo} onOpenChange={(o: boolean) => !o && setOpenInfo(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
          {openInfo && (
            <PlantDetails
              plant={openInfo}
              onClose={() => setOpenInfo(null)}
              liked={likedIds.includes(openInfo.id)}
              onToggleLike={() => toggleLiked(openInfo.id)}
            />
          )}
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
            <Button className="w-full rounded-2xl" onClick={submitAuth}>
              {authMode === 'login' ? 'Continue' : 'Create account'}
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

