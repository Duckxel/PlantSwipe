import React, { useMemo, useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useLanguageNavigate, usePathWithoutLanguage } from "@/lib/i18nRouting";
import { Navigate } from "@/components/i18n/Navigate";
import { Link } from "@/components/i18n/Link";
import { useMotionValue, animate } from "framer-motion";
import { Search, ChevronDown, ChevronUp, ListFilter, MessageSquarePlus, Plus, Leaf } from "lucide-react";
// Sheet is used for plant info overlay
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopBar } from "@/components/layout/TopBar";
import { Footer } from "@/components/layout/Footer";
import BroadcastToast from "@/components/layout/BroadcastToast";
import MobileNavBar from "@/components/layout/MobileNavBar";
import { RequestPlantDialog } from "@/components/plant/RequestPlantDialog";
// GardenListPage and GardenDashboardPage are lazy loaded below
import { SearchPage } from "@/pages/SearchPage";
import { SwipePage } from "@/pages/SwipePage";
import { CreatePlantPage } from "@/pages/CreatePlantPage";
import { EditPlantPage } from "@/pages/EditPlantPage";
import type { Plant } from "@/types/plant";
// PlantDetails imported in PlantInfoPage route component
import PlantInfoPage from "@/pages/PlantInfoPage";
import { useAuth } from "@/context/AuthContext";
import { AuthActionsProvider } from "@/context/AuthActionsContext";
import PublicProfilePage from "@/pages/PublicProfilePage";
import RequireAdmin from "@/pages/RequireAdmin";
import { FriendsPage } from "@/pages/FriendsPage";
import SettingsPage from "@/pages/SettingsPage";
import ContactUsPage from "@/pages/ContactUsPage";
import AboutPage from "@/pages/AboutPage";
import DownloadPage from "@/pages/DownloadPage";
import TermsPage from "@/pages/TermsPage";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/lib/i18nRouting";
import { loadPlantsWithTranslations } from "@/lib/plantTranslationLoader";
import { isPlantOfTheMonth } from "@/lib/plantHighlights";
import { useTranslation } from "react-i18next";

// Lazy load heavy pages for code splitting
const AdminPage = lazy(() => import("@/pages/AdminPage").then(module => ({ default: module.AdminPage })));
const GardenDashboardPage = lazy(() => import("@/pages/GardenDashboardPage").then(module => ({ default: module.GardenDashboardPage })));
const GardenListPage = lazy(() => import("@/pages/GardenListPage").then(module => ({ default: module.GardenListPage })));

type SearchSortMode = "default" | "newest" | "popular"

// --- Main Component ---
export default function PlantSwipe() {
  const { user, signIn, signUp, signOut, profile, refreshProfile } = useAuth()
  const currentLang = useLanguage()
  const { t } = useTranslation('common')
  const [query, setQuery] = useState("")
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [onlySeeds, setOnlySeeds] = useState(false)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [favoritesFirst, setFavoritesFirst] = useState(false)
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window === "undefined") return true
    return window.innerWidth >= 1024
  })
  const [requestPlantDialogOpen, setRequestPlantDialogOpen] = useState(false)
  const [searchSort, setSearchSort] = useState<SearchSortMode>("default")

  const [index, setIndex] = useState(0)
  const [likedIds, setLikedIds] = useState<string[]>([])

  const location = useLocation()
  const state = location.state as { backgroundLocation?: any } | null
  const backgroundLocation = state?.backgroundLocation
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()
  const currentView: "discovery" | "gardens" | "search" | "profile" | "create" =
    pathWithoutLang === "/" ? "discovery" :
    pathWithoutLang.startsWith("/gardens") || pathWithoutLang.startsWith('/garden/') ? "gardens" :
    pathWithoutLang.startsWith("/search") ? "search" :
    pathWithoutLang.startsWith("/profile") ? "profile" :
    pathWithoutLang.startsWith("/create") ? "create" : "discovery"
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
    let ok = false
    try {
      // Always use Supabase with translations to ensure plants created in one language
      // display correctly when viewed in another language
      // This ensures translations are properly loaded for all languages, including English
      const plantsWithTranslations = await loadPlantsWithTranslations(currentLang)
      setPlants(plantsWithTranslations)
      ok = true
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
      setLoadError(msg || 'Failed to load plants')
    } finally {
      setLoading(false)
    }
    return ok
  }, [currentLang])

  React.useEffect(() => {
    loadPlants()
  }, [loadPlants])

  // Global refresh for plant lists without full reload
  React.useEffect(() => {
    const onRefresh = () => { loadPlants() }
    try { window.addEventListener('plants:refresh', onRefresh as EventListener) } catch {}
    return () => { try { window.removeEventListener('plants:refresh', onRefresh as EventListener) } catch {} }
  }, [loadPlants])

  // Global presence tracking so Admin can see "currently online" users
  const presenceRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null)
  React.useEffect(() => {
    // Track SPA route changes to server for visit analytics
    const sendVisit = async (path: string) => {
      try {
        const base: string = ''
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        const ref = document.referrer || ''
        const extra = {
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
          screen: { w: window.screen?.width || null, h: window.screen?.height || null, colorDepth: (window.screen as any)?.colorDepth || null },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          platform: navigator.platform || null,
          vendor: navigator.vendor || null,
          hardwareConcurrency: (navigator as any).hardwareConcurrency || null,
          memoryGB: (navigator as any).deviceMemory || null,
          webgl: (() => {
            try {
              const c = document.createElement('canvas')
              const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
              if (!gl) return null
              const vendor = (gl as any).getParameter?.((gl as any).VENDOR)
              const renderer = (gl as any).getParameter?.((gl as any).RENDERER)
              return { vendor: vendor ?? null, renderer: renderer ?? null }
            } catch { return null }
          })(),
        }
        await fetch(`${base}/api/track-visit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            pagePath: path,
            referrer: ref,
            userId: user?.id || null,
            pageTitle: document.title || null,
            language: navigator.language || (navigator as any).languages?.[0] || null,
            // utm removed from server; not sent anymore
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

  // Heartbeat: periodically record a lightweight visit so Admin "online" stays fresh
  React.useEffect(() => {
    const HEARTBEAT_MS = 60_000
    let timer: ReturnType<typeof setInterval> | null = null
    const sendHeartbeat = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        await fetch('/api/track-visit', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            pagePath: location.pathname + location.search,
            referrer: document.referrer || '',
            userId: user?.id || null,
            pageTitle: document.title || null,
            language: navigator.language || (navigator as any).languages?.[0] || null,
            extra: { source: 'heartbeat' },
          }),
          keepalive: true,
        })
      } catch {}
    }
    timer = setInterval(() => { sendHeartbeat().catch(() => {}) }, HEARTBEAT_MS)
    return () => { if (timer) clearInterval(timer) }
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

    channel
      .on('presence', { event: 'sync' }, () => {
        // no-op: can be used for debugging presence state
      })
      .subscribe((status: unknown) => {
        if (status === 'SUBSCRIBED') {
          try {
            channel.track({
              user_id: user?.id || null,
              display_name: profile?.display_name || null,
              online_at: new Date().toISOString(),
            })
          } catch {}
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
      const lowerQuery = query.toLowerCase()
      const base = plants.filter((p: Plant) => {
        const colors = Array.isArray(p.colors) ? p.colors : []
        const seasons = Array.isArray(p.seasons) ? p.seasons : []
        const matchesQ = `${p.name} ${p.scientificName || ''} ${p.meaning || ''} ${colors.join(" ")}`
          .toLowerCase()
          .includes(lowerQuery)
        const matchesSeason = seasonFilter ? seasons.includes(seasonFilter as Plant['seasons'][number]) : true
        const matchesColor = colorFilter ? colors.map((c: string) => c.toLowerCase()).includes(colorFilter.toLowerCase()) : true
        const matchesSeeds = onlySeeds ? Boolean(p.seedsAvailable) : true
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
    if (filtered.length === 0) return []
    const shuffleList = (list: Plant[]) => {
      const arr = list.slice()
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }
    const now = new Date()
    const promoted: Plant[] = []
    const regular: Plant[] = []
    filtered.forEach((plant) => {
      if (isPlantOfTheMonth(plant, now)) {
        promoted.push(plant)
      } else {
        regular.push(plant)
      }
    })
    if (promoted.length === 0) {
      return shuffleList(filtered)
    }
    return [...shuffleList(promoted), ...shuffleList(regular)]
  }, [filtered, shuffleEpoch])

  const sortedSearchResults = useMemo(() => {
    if (searchSort === "default") return filtered
    const arr = filtered.slice()
    if (searchSort === "newest") {
      const getCreatedAtValue = (plant: Plant) => {
        const value = plant.meta?.createdAt
        if (!value) return 0
        const ts = Date.parse(value)
        return Number.isNaN(ts) ? 0 : ts
      }
      arr.sort((a, b) => {
        const diff = getCreatedAtValue(b) - getCreatedAtValue(a)
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name)
      })
    } else if (searchSort === "popular") {
      arr.sort((a, b) => {
        const diff = (b.popularity?.likes ?? 0) - (a.popularity?.likes ?? 0)
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name)
      })
    }
    return arr
  }, [filtered, searchSort])

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

  const handlePrevious = () => {
    if (swipeList.length === 0) return
    setIndex((i) => {
      const prev = i - 1
      // Wrap around to the end if going back from the start
      return prev < 0 ? swipeList.length - 1 : prev
    })
  }

  const handleInfo = () => {
    if (current) navigate(`/plants/${current.id}`, { state: { backgroundLocation: location } })
  }

  // Swipe logic
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const threshold = 100
  const velocityThreshold = 500
  
  // Reset motion values immediately when index changes
  React.useEffect(() => {
    // Animate smoothly back to center
    animate(x, 0, { duration: 0.1 })
    animate(y, 0, { duration: 0.1 })
  }, [index, x, y])
  
  const onDragEnd = (_: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    const dx = info.offset.x
    const dy = info.offset.y
    const vx = info.velocity.x
    const vy = info.velocity.y
    
    // Calculate effective movement considering both offset and velocity
    const effectiveX = dx + vx * 0.1
    const effectiveY = dy + vy * 0.1
    
    // Check for significant movement or velocity
    const absX = Math.abs(effectiveX)
    const absY = Math.abs(effectiveY)
    const absVx = Math.abs(vx)
    const absVy = Math.abs(vy)
    
    let actionTaken = false
    
    // Prioritize vertical swipe over horizontal if both are significant
    if ((absY > absX && absY > threshold) || (absVy > absVx && absVy > velocityThreshold)) {
      if (effectiveY < -threshold || vy < -velocityThreshold) {
        // Swipe up (bottom to top) = open info
        animate(x, 0, { duration: 0.1 })
        animate(y, 0, { duration: 0.1 })
        handleInfo()
        actionTaken = true
      }
    }
    
    // Horizontal swipe detection
    if (!actionTaken && ((absX > absY && absX > threshold) || (absVx > absVy && absVx > velocityThreshold))) {
      if (effectiveX < -threshold || vx < -velocityThreshold) {
        // Swipe left (right to left) = next
        animate(x, 0, { duration: 0.1 })
        animate(y, 0, { duration: 0.1 })
        handlePass()
        actionTaken = true
      } else if (effectiveX > threshold || vx > velocityThreshold) {
        // Swipe right (left to right) = previous
        animate(x, 0, { duration: 0.1 })
        animate(y, 0, { duration: 0.1 })
        handlePrevious()
        actionTaken = true
      }
    }
    
    // No action, snap back to center smoothly
    if (!actionTaken) {
      animate(x, 0, { duration: 0.2, type: "spring", stiffness: 300, damping: 30 })
      animate(y, 0, { duration: 0.2, type: "spring", stiffness: 300, damping: 30 })
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

  const openLogin = React.useCallback(() => { setAuthMode("login"); setAuthOpen(true) }, [])
  const openSignup = React.useCallback(() => { setAuthMode("signup"); setAuthOpen(true) }, [])

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

  const FilterControls = () => (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <div className="text-xs font-medium mb-2 uppercase tracking-wide opacity-60">{t("plant.sortLabel")}</div>
        <select
          value={searchSort}
          onChange={(e) => setSearchSort(e.target.value as SearchSortMode)}
          className="w-full rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-white"
        >
          <option value="default">{t("plant.sortDefault")}</option>
          <option value="newest">{t("plant.sortNewest")}</option>
          <option value="popular">{t("plant.sortPopular")}</option>
        </select>
      </div>

      {/* Seasons */}
      <div>
        <div className="text-xs font-medium mb-2 uppercase tracking-wide opacity-60">{t("plant.season")}</div>
        <div className="flex flex-wrap gap-2">
          {(["Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeasonFilter((cur) => (cur === s ? null : s))}
              className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${
                seasonFilter === s ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
              }`}
              aria-pressed={seasonFilter === s}
            >
              {t(`plant.${s.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <div className="text-xs font-medium mb-2 uppercase tracking-wide opacity-60">{t("plant.color")}</div>
        <div className="flex flex-wrap gap-2">
          {["Red", "Pink", "Yellow", "White", "Purple", "Blue", "Orange", "Green"].map((c) => (
            <button
              key={c}
              onClick={() => setColorFilter((cur) => (cur === c ? null : c))}
              className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${
                colorFilter === c ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
              }`}
              aria-pressed={colorFilter === c}
            >
              {t(`plant.${c.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="pt-2 space-y-2">
        <button
          onClick={() => setOnlySeeds((v) => !v)}
          className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition ${
            onlySeeds ? "bg-emerald-600 dark:bg-emerald-500 text-white" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
          }`}
          aria-pressed={onlySeeds}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current" /> {t("plant.seedsOnly")}
        </button>
        <button
          onClick={() => setOnlyFavorites((v) => !v)}
          className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition ${
            onlyFavorites ? "bg-rose-600 dark:bg-rose-500 text-white" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
          }`}
          aria-pressed={onlyFavorites}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current" /> {t("plant.favoritesOnly")}
        </button>
        <button
          onClick={() => setFavoritesFirst((v) => !v)}
          className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition ${
            favoritesFirst
              ? "bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 border-rose-400 dark:border-rose-600"
              : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
          }`}
          aria-pressed={favoritesFirst}
        >
          {t("plant.favoritesFirst")}
        </button>
      </div>

      {/* Active filters summary */}
      <div className="text-xs space-y-1">
        <div className="font-medium uppercase tracking-wide opacity-60">{t("plant.active")}</div>
        <div className="flex flex-wrap gap-2">
          {seasonFilter && <Badge variant="secondary" className="rounded-xl">{t(`plant.${seasonFilter.toLowerCase()}`)}</Badge>}
          {colorFilter && <Badge variant="secondary" className="rounded-xl">{t(`plant.${colorFilter.toLowerCase()}`)}</Badge>}
          {onlySeeds && <Badge variant="secondary" className="rounded-xl">{t("plant.seedsOnly")}</Badge>}
          {onlyFavorites && <Badge variant="secondary" className="rounded-xl">{t("plant.favoritesOnly")}</Badge>}
          {favoritesFirst && <Badge variant="secondary" className="rounded-xl">{t("plant.favoritesFirst")}</Badge>}
          {!seasonFilter && !colorFilter && !onlySeeds && !onlyFavorites && !favoritesFirst && (
            <span className="opacity-50">{t("plant.none")}</span>
          )}
        </div>
      </div>
    </div>
  )

    return (
        <AuthActionsProvider openLogin={openLogin} openSignup={openSignup}>
          <div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] p-4 pb-24 md:p-8 md:pb-8">
          <TopBar
            openLogin={openLogin}
            openSignup={openSignup}
            user={user}
            displayName={profile?.display_name || null}
            onProfile={() => navigate('/profile')}
            onLogout={async () => { await signOut(); navigate('/') }}
          />

          {/* Mobile Logo and App Name - Only on Discovery page (exact path match, no other routes) */}
          {pathWithoutLang === "/" && location.pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '') === "/" && (
            <div className="md:hidden flex flex-col items-center justify-center mb-6 mt-4">
              <div className="h-12 w-12 rounded-2xl bg-green-200 dark:bg-green-800 flex items-center justify-center shadow mb-2">
                <Leaf className="h-6 w-6 text-green-800 dark:text-green-200" />
              </div>
              <Link
                to="/"
                className="text-2xl font-semibold tracking-tight no-underline text-black dark:text-white hover:text-black dark:hover:text-white visited:text-black dark:visited:text-white active:text-black dark:active:text-white focus:text-black dark:focus:text-white focus-visible:outline-none outline-none hover:opacity-90"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {t('common.appName')}
              </Link>
            </div>
          )}

          {/* Mobile bottom nav (hide Create on phones) */}
          <MobileNavBar 
            canCreate={false} 
            onProfile={() => navigate('/profile')}
            onLogout={async () => { await signOut(); navigate('/') }}
            onLogin={openLogin}
          />

          {/* Layout: grid only when search view (to avoid narrow column in other views) */}
        <div
          className={`max-w-6xl mx-auto mt-6 ${
            currentView === "search"
              ? showFilters
                ? "lg:grid lg:grid-cols-[260px_1fr] lg:gap-10"
                : "lg:grid lg:grid-cols-1"
              : ""
          }`}
        >
        {/* Sidebar / Filters */}
          {currentView === "search" && showFilters && (
            <>
              <aside
                className="hidden lg:block mb-8 lg:mb-0 space-y-6 lg:sticky lg:top-4 self-start"
                aria-label="Filters"
              >
                <FilterControls />
              </aside>
            </>
          )}

          {/* Main content area */}
          <main className="min-h-[60vh]" aria-live="polite">
            {currentView === "search" && (
              <div className="mb-6 space-y-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="flex-1">
                        <Label htmlFor="plant-search-main" className="sr-only">
                          {t("common.search")}
                        </Label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                          <Input
                            id="plant-search-main"
                            className="w-full pl-10 pr-4 rounded-2xl h-12"
                            placeholder={t("plant.searchPlaceholder")}
                            value={query}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setQuery(e.target.value)
                              setIndex(0)
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-row lg:items-end lg:gap-2 w-full lg:w-auto">
                      <Button
                        variant="outline"
                        className="rounded-2xl w-full lg:w-auto justify-between lg:justify-center"
                        onClick={() => setShowFilters((prev) => !prev)}
                        aria-expanded={showFilters}
                      >
                        <span className="flex items-center gap-2">
                          <ListFilter className="h-4 w-4" />
                          <span>{t(showFilters ? "plant.hideFilters" : "plant.showFilters")}</span>
                        </span>
                        {showFilters ? (
                          <ChevronUp className="h-4 w-4 lg:hidden" />
                        ) : (
                          <ChevronDown className="h-4 w-4 lg:hidden" />
                        )}
                      </Button>
                      {user && (
                        <>
                          <Button
                            variant="secondary"
                            className="rounded-2xl w-full lg:w-auto"
                            onClick={() => setRequestPlantDialogOpen(true)}
                          >
                            <MessageSquarePlus className="h-4 w-4 mr-2" />
                            {t("requestPlant.button") || "Request Plant"}
                          </Button>
                          {profile?.is_admin && (
                            <Button
                              variant="default"
                              className="rounded-2xl w-full lg:w-auto"
                              onClick={() => navigate("/create")}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {t("common.addPlant")}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`lg:hidden ${showFilters ? "space-y-6" : "hidden"}`}>
                    <FilterControls />
                  </div>
              </div>
            )}

          {/* Use background location for primary routes so overlays render on top */}
          <Routes location={(backgroundLocation as any) || location}>
                <Route path="/gardens" element={
                  <Suspense fallback={<div className="p-8 text-center text-sm opacity-60">{t('common.loading')}</div>}>
                    <GardenListPage />
                  </Suspense>
                } />
                <Route path="/garden/:id/*" element={
                  <Suspense fallback={<div className="p-8 text-center text-sm opacity-60">{t('common.loading')}</div>}>
                    <GardenDashboardPage />
                  </Suspense>
                } />
                <Route
                  path="/search"
                    element={
                      <SearchPage
                        plants={sortedSearchResults}
                        openInfo={(p) => navigate(`/plants/${p.id}`, { state: { backgroundLocation: location } })}
                        likedIds={likedIds}
                      />
                      }
                  />
                  <Route
                    path="/profile"
                    element={user ? (profile?.display_name ? <Navigate to={`/u/${encodeURIComponent(profile.display_name)}`} replace /> : <Navigate to="/u/_me" replace />) : <Navigate to="/" replace />}
                  />
                  <Route path="/u/:username" element={<PublicProfilePage />} />
                    <Route path="/friends" element={user ? <FriendsPage /> : <Navigate to="/" replace />} />
                    <Route path="/settings" element={user ? <SettingsPage /> : <Navigate to="/" replace />} />
                    <Route path="/contact/business" element={<ContactUsPage defaultChannel="business" />} />
                    <Route path="/contact" element={<ContactUsPage defaultChannel="support" />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/download" element={<DownloadPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                <Route path="/admin" element={
                  <RequireAdmin>
                    <Suspense fallback={<div className="p-8 text-center text-sm opacity-60">Loading admin panel...</div>}>
                      <AdminPage />
                    </Suspense>
                  </RequireAdmin>
                } />
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
                  <Route path="/plants/:id" element={<PlantInfoPage />} />
                  <Route
                    path="/*"
                    element={plants.length > 0 ? (
                      <SwipePage
                        current={current}
                        index={index}
                        setIndex={setIndex}
                        x={x}
                        y={y}
                        onDragEnd={onDragEnd}
                        handleInfo={handleInfo}
                        handlePass={handlePass}
                        handlePrevious={handlePrevious}
                        liked={current ? likedIds.includes(current.id) : false}
                        onToggleLike={() => { if (current) toggleLiked(current.id) }}
                      />
                    ) : (
                    <>
                      {loading && <div className="p-8 text-center text-sm opacity-60">{t('common.loading')}</div>}
                      {loadError && <div className="p-8 text-center text-sm text-red-600">{t('common.error')}: {loadError}</div>}
                      {!loading && !loadError && (
                        <>
                          {plants.length === 0 && !query && !loadError && !loading && (
                            <div className="p-8 text-center text-sm opacity-60">
                              {t('plant.noResults')}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                />
              </Routes>
              {/* When a background location is set, also render the overlay route on top */}
              {backgroundLocation && (
                <Routes>
                  <Route
                    path="/plants/:id"
                    element={<PlantInfoOverlay />}
                  />
                </Routes>
              )}
        </main>
      </div>


      {/* Auth Dialog (Login / Sign up) */}
      <Dialog open={authOpen && !user} onOpenChange={setAuthOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? t('auth.login') : t('auth.signup')}</DialogTitle>
            <DialogDescription>
              {authMode === 'login' ? t('auth.loginDescription') : t('auth.signupDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {authMode === 'signup' && (
              <div className="grid gap-2">
                <Label htmlFor="name">{t('auth.displayName')}</Label>
                <Input id="name" type="text" placeholder={t('auth.displayNamePlaceholder')} value={authDisplayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthDisplayName(e.target.value)} />
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder={t('auth.emailPlaceholder')} value={authEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthEmail(e.target.value)} disabled={authSubmitting} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" placeholder={t('auth.passwordPlaceholder')} value={authPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthPassword(e.target.value)} disabled={authSubmitting} />
            </div>
            {authMode === 'signup' && (
              <div className="grid gap-2">
                <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
                <Input id="confirm" type="password" placeholder={t('auth.confirmPasswordPlaceholder')} value={authPassword2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthPassword2(e.target.value)} disabled={authSubmitting} />
              </div>
            )}
            {authError && <div className="text-sm text-red-600">{authError}</div>}
            <Button className="w-full rounded-2xl" onClick={submitAuth}>
              {authMode === 'login' ? t('auth.continue') : t('auth.createAccount')}
            </Button>
            <div className="text-center text-sm">
              {authMode === 'login' ? (
                <button className="underline" onClick={() => setAuthMode('signup')}>{t('auth.noAccount')}</button>
              ) : (
                <button className="underline" onClick={() => setAuthMode('login')}>{t('auth.haveAccount')}</button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
      <BroadcastToast />
      <RequestPlantDialog open={requestPlantDialogOpen} onOpenChange={setRequestPlantDialogOpen} />
    </div>
    </AuthActionsProvider>
  )
}

function PlantInfoOverlay() {
  const navigate = useLanguageNavigate()
  return (
    <Sheet open onOpenChange={(o) => { if (!o) navigate(-1) }}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 md:p-6"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Plant Information</SheetTitle>
          <SheetDescription className="sr-only">View detailed information about this plant</SheetDescription>
        </SheetHeader>
        <div className="max-w-4xl mx-auto w-full">
          <PlantInfoPage />
        </div>
      </SheetContent>
    </Sheet>
  )
}

