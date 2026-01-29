import React, { useMemo, useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation, useSearchParams } from "react-router-dom";
import { useLanguageNavigate, usePathWithoutLanguage, addLanguagePrefix } from "@/lib/i18nRouting";
import { Navigate } from "@/components/i18n/Navigate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { executeRecaptcha } from "@/lib/recaptcha";
import { useMotionValue, animate } from "framer-motion";
import { ChevronDown, ChevronUp, ListFilter, MessageSquarePlus, Plus, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchInput } from "@/components/ui/search-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { Footer } from "@/components/layout/Footer";
import BroadcastToast from "@/components/layout/BroadcastToast";
import MobileNavBar from "@/components/layout/MobileNavBar";
import { RequestPlantDialog } from "@/components/plant/RequestPlantDialog";
import { MessageNotificationToast } from "@/components/messaging/MessageNotificationToast";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { CookieConsent } from "@/components/CookieConsent";
import { LegalUpdateModal, useNeedsLegalUpdate } from "@/components/LegalUpdateModal";
// GardenListPage and GardenDashboardPage are lazy loaded below
import type { Plant } from "@/types/plant";
import { useAuth } from "@/context/AuthContext";
import { AuthActionsProvider } from "@/context/AuthActionsContext";
import { RequireEditor } from "@/pages/RequireAdmin";
import { supabase } from "@/lib/supabaseClient";
import { checkEditorAccess } from "@/constants/userRoles";
import { useLanguage } from "@/lib/i18nRouting";
import { loadPlantPreviews } from "@/lib/plantTranslationLoader";
import { getDiscoveryPageImageUrl } from "@/lib/photos";
import { isPlantOfTheMonth } from "@/lib/plantHighlights";
import { formatClassificationLabel } from "@/constants/classification";
import { useTranslation } from "react-i18next";

import { SwipePage } from "@/pages/SwipePage"
import { FilterControls } from "@/components/plant/FilterControls"
import { SwipeCardSkeleton } from "@/components/plant/SwipeCardSkeleton"
import type { ColorOption } from "@/types/plant"

// Lazy load heavy pages for code splitting
const AdminPage = lazy(() => import("@/pages/AdminPage").then(module => ({ default: module.AdminPage })))
const AdminEmailTemplatePageLazy = lazy(() => import("@/pages/AdminEmailTemplatePage").then(module => ({ default: module.AdminEmailTemplatePage })))
const GardenDashboardPage = lazy(() => import("@/pages/GardenDashboardPage").then(module => ({ default: module.GardenDashboardPage })))
const GardenListPage = lazy(() => import("@/pages/GardenListPage").then(module => ({ default: module.GardenListPage })))
// SwipePage is main view, loaded eagerly inside PlantSwipe chunk
// const SwipePageLazy = lazy(() => import("@/pages/SwipePage").then(module => ({ default: module.SwipePage })))
const SearchPageLazy = lazy(() => import("@/pages/SearchPage").then(module => ({ default: module.SearchPage })))
const CreatePlantPageLazy = lazy(() => import("@/pages/CreatePlantPage").then(module => ({ default: module.CreatePlantPage })))
const PlantInfoPageLazy = lazy(() => import("@/pages/PlantInfoPage"))
const PublicProfilePageLazy = lazy(() => import("@/pages/PublicProfilePage"))
const FriendsPageLazy = lazy(() => import("@/pages/FriendsPage").then(module => ({ default: module.FriendsPage })))
const MessagesPageLazy = lazy(() => import("@/pages/MessagesPage").then(module => ({ default: module.MessagesPage })))
const ScanPageLazy = lazy(() => import("@/pages/ScanPage").then(module => ({ default: module.ScanPage })))
const SettingsPageLazy = lazy(() => import("@/pages/SettingsPage"))
const BugCatcherPageLazy = lazy(() => import("@/pages/BugCatcherPage").then(module => ({ default: module.BugCatcherPage })))
const ContactUsPageLazy = lazy(() => import("@/pages/ContactUsPage"))
const AboutPageLazy = lazy(() => import("@/pages/AboutPage"))
const DownloadPageLazy = lazy(() => import("@/pages/DownloadPage"))
const PricingPageLazy = lazy(() => import("@/pages/PricingPage"))
const TermsPageLazy = lazy(() => import("@/pages/TermsPage"))
const PrivacyPageLazy = lazy(() => import("@/pages/PrivacyPage"))
const ErrorPageLazy = lazy(() => import("@/pages/ErrorPage").then(module => ({ default: module.ErrorPage })))
const BlogPageLazy = lazy(() => import("@/pages/BlogPage"))
const BlogPostPageLazy = lazy(() => import("@/pages/BlogPostPage"))
const BlogComposerPageLazy = lazy(() => import("@/pages/BlogComposerPage"))
const BookmarkPageLazy = lazy(() => import("@/pages/BookmarkPage").then(module => ({ default: module.BookmarkPage })))
const LandingPageLazy = lazy(() => import("@/pages/LandingPage"))

type SearchSortMode = "default" | "newest" | "popular" | "favorites"

type PreparedPlant = Plant & {
  _searchString: string
  _normalizedColors: string[]
  _colorTokens: Set<string>        // Pre-tokenized colors for compound matching
  _typeLabel: string | null
  _usageLabels: string[]
  _usageSet: Set<string>           // O(1) usage lookups
  _habitats: string[]
  _habitatSet: Set<string>         // O(1) habitat lookups
  _maintenance: string
  _petSafe: boolean
  _humanSafe: boolean
  _livingSpace: string
  _seasonsSet: Set<string>         // O(1) season lookups
  _createdAtTs: number             // Pre-parsed timestamp for sorting
  _popularityLikes: number         // Pre-extracted popularity for sorting
  _hasImage: boolean               // Pre-computed image availability
}

type ExtendedWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  cancelIdleCallback?: (handle: number) => void
}

const RE_SPLIT_COLOR = /[-_/]+/g
const RE_WHITESPACE = /\s+/

const scheduleIdleTask = (task: () => void, timeout = 1500): (() => void) => {
  if (typeof window === "undefined") {
    return () => {}
  }
  const extendedWindow = window as ExtendedWindow
  let cancelled = false
  let timeoutId: number | null = null
  let idleHandle: number | null = null

  const run = () => {
    if (cancelled) return
    task()
  }

  if (typeof extendedWindow.requestIdleCallback === "function") {
    idleHandle = extendedWindow.requestIdleCallback(() => run(), { timeout })
  } else {
    timeoutId = window.setTimeout(run, timeout)
  }

  return () => {
    cancelled = true
    if (idleHandle !== null && typeof extendedWindow.cancelIdleCallback === "function") {
      extendedWindow.cancelIdleCallback(idleHandle)
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}

// --- Main Component ---
export default function PlantSwipe() {
  const { user, signIn, signUp, signOut, profile, refreshProfile } = useAuth()
  const currentLang = useLanguage()
  const { t } = useTranslation('common')
  const routeLoadingFallback = (
    <div className="p-8 text-center text-sm opacity-60">{t('common.loading')}</div>
  )
  const routeErrorFallback = (
    <div className="p-8 text-center">
      <p className="text-stone-600 dark:text-stone-400 mb-4">{t('common.loadError', 'Failed to load this page. Please check your internet connection.')}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
      >
        {t('common.reload', 'Reload Page')}
      </button>
    </div>
  )
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 100)
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<string[]>([])
  const [onlySeeds, setOnlySeeds] = useState(false)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [usageFilters, setUsageFilters] = useState<string[]>([])
  const [habitatFilters, setHabitatFilters] = useState<string[]>([])
  const [maintenanceFilter, setMaintenanceFilter] = useState<string | null>(null)
  const [petSafe, setPetSafe] = useState(false)
  const [humanSafe, setHumanSafe] = useState(false)
  const [livingSpaceFilters, setLivingSpaceFilters] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window === "undefined") return true
    return window.innerWidth >= 1024
  })
  const [requestPlantDialogOpen, setRequestPlantDialogOpen] = useState(false)
  const [searchSort, setSearchSort] = useState<SearchSortMode>("default")
  const [searchBarVisible, setSearchBarVisible] = useState(true)
  const lastScrollY = React.useRef(0)

  const [index, setIndex] = useState(0)
  const [likedIds, setLikedIds] = useState<string[]>([])
  const initialCardBoostRef = React.useRef(true)

  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()
  const currentView: "landing" | "discovery" | "gardens" | "search" | "profile" | "create" =
    pathWithoutLang === "/" ? "landing" :
    pathWithoutLang === "/discovery" || pathWithoutLang.startsWith("/discovery/") ? "discovery" :
    pathWithoutLang.startsWith("/gardens") || pathWithoutLang.startsWith('/garden/') ? "gardens" :
    pathWithoutLang.startsWith("/search") ? "search" :
    pathWithoutLang.startsWith("/profile") ? "profile" :
    pathWithoutLang.startsWith("/create") ? "create" : "discovery"
  
  // Message notifications - determine if user is on messages page
  const isOnMessagesPage = pathWithoutLang.startsWith('/messages')
  const { 
    notification: messageNotification, 
    dismiss: dismissMessageNotification
  } = useMessageNotifications({
    userId: user?.id ?? null,
    enabled: Boolean(user),
    // Don't show notifications when already on messages page
    currentConversationId: isOnMessagesPage ? 'all' : null
  })
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")
  const [authError, setAuthError] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authPassword2, setAuthPassword2] = useState("")
  const [authDisplayName, setAuthDisplayName] = useState("")
  const [authAcceptedTerms, setAuthAcceptedTerms] = useState(false)
  const [authMarketingConsent, setAuthMarketingConsent] = useState(true) // Default to checked
  
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const termsPath = React.useMemo(() => addLanguagePrefix('/terms', currentLang), [currentLang])
  
  // Legal update modal - show when user's accepted versions are outdated
  const [legalUpdateDismissed, setLegalUpdateDismissed] = useState(false)
  const { needsUpdate: needsLegalUpdate } = useNeedsLegalUpdate(
    profile?.terms_version_accepted,
    profile?.privacy_version_accepted
  )
  const showLegalUpdateModal = Boolean(user && profile && needsLegalUpdate && !legalUpdateDismissed)

  const [plants, setPlants] = useState<Plant[]>(() => {
    if (typeof localStorage === 'undefined') return []
    try {
      const cached = localStorage.getItem(`plantswipe.plants.${currentLang}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return []
  })
  const [loading, setLoading] = useState(() => {
    if (typeof localStorage === 'undefined') return true
    try {
      const cached = localStorage.getItem(`plantswipe.plants.${currentLang}`)
      return !cached
    } catch {
      // Ignore localStorage errors
      return true
    }
  })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([])

  // Separate colors into primary and advanced based on is_primary field
  const { primaryColors, advancedColors } = React.useMemo(() => {
    const primary: ColorOption[] = []
    const advanced: ColorOption[] = []

    colorOptions.forEach((color) => {
      const normalized = (color.name || "").trim()
      const preparedColor = color.name === normalized ? color : { ...color, name: normalized }

      if (color.isPrimary) {
        primary.push(preparedColor)
      } else {
        advanced.push(preparedColor)
      }
    })

    return { primaryColors: primary, advancedColors: advanced }
  }, [colorOptions])
  
  const typeOptions = useMemo(() => {
    const labels = new Set<string>()
    plants.forEach((plant) => {
      const label = getPlantTypeLabel(plant.classification)
      if (label) labels.add(label)
    })
    return Array.from(labels).sort((a, b) => a.localeCompare(b))
  }, [plants])
  const usageOptions = useMemo(() => {
    const labels = new Set<string>()
    plants.forEach((plant) => {
      getPlantUsageLabels(plant).forEach((label) => labels.add(label))
    })
    return Array.from(labels).sort((a, b) => a.localeCompare(b))
  }, [plants])
  const likedSet = React.useMemo(() => new Set(likedIds), [likedIds])

  // Hydrate liked ids from profile when available
  React.useEffect(() => {
    const arr = Array.isArray(profile?.liked_plant_ids) ? profile.liked_plant_ids.map(String) : []
    setLikedIds(arr)
  }, [profile])

  // Read search query from URL parameters when on search page
  React.useEffect(() => {
    if (pathWithoutLang.startsWith("/search")) {
      const urlQuery = searchParams.get("q")
      if (urlQuery && urlQuery !== query) {
        setQuery(urlQuery)
        // Clear the URL parameter after setting the query to keep URL clean
        setSearchParams({}, { replace: true })
      }
    }
  }, [pathWithoutLang, searchParams, setSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hide search bar on scroll down, show on scroll up (mobile only)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (currentView !== "search") return
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDelta = currentScrollY - lastScrollY.current
      
      // Only trigger if scrolled more than 10px to avoid jitter
      if (Math.abs(scrollDelta) < 10) return
      
      // Show search bar when scrolling up or at top
      if (scrollDelta < 0 || currentScrollY < 50) {
        setSearchBarVisible(true)
      } else {
        // Hide when scrolling down (only on mobile)
        if (window.innerWidth < 768) {
          setSearchBarVisible(false)
        }
      }
      
      lastScrollY.current = currentScrollY
    }
    
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [currentView])

  const plantsRef = React.useRef(plants)
  plantsRef.current = plants

  const loadPlants = React.useCallback(async () => {
    // Only show loading if we don't have plants
    if (plantsRef.current.length === 0) {
      setLoading(true)
    }
    setLoadError(null)
    let ok = false
    try {
      // Always use Supabase with translations to ensure plants created in one language
      // display correctly when viewed in another language
      // This ensures translations are properly loaded for all languages, including English
      // Using optimized preview loader for faster initial render
      const plantsWithTranslations = await loadPlantPreviews(currentLang)
      setPlants(plantsWithTranslations)
      
      // Cache results
      try {
        if (plantsWithTranslations.length > 0) {
          localStorage.setItem(`plantswipe.plants.${currentLang}`, JSON.stringify(plantsWithTranslations))
        }
      } catch {
        // Ignore localStorage errors
      }
      
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

  // Load colors from database with translations
  React.useEffect(() => {
    const loadColors = async () => {
      try {
        const { data, error } = await supabase
          .from('colors')
          .select('id, name, hex_code, is_primary, parent_ids')
          .order('name', { ascending: true })

        if (error) {
          console.error('Error loading colors:', error)
          return
        }

        // Load translations
        const { data: translationsData } = await supabase
          .from('color_translations')
          .select('color_id, language, name')

        // Build translations map
        const translationsMap = new Map<string, Record<string, string>>()
        if (translationsData) {
          translationsData.forEach((t: { color_id: string; language: string; name: string }) => {
            if (!translationsMap.has(t.color_id)) {
              translationsMap.set(t.color_id, {})
            }
            translationsMap.get(t.color_id)![t.language] = t.name
          })
        }

        if (data) {
          setColorOptions(data.map((c) => ({
            id: c.id,
            name: (c.name ?? "").trim(),
            hexCode: c.hex_code ?? "",
            isPrimary: c.is_primary ?? false,
            parentIds: c.parent_ids ?? [],
            translations: translationsMap.get(c.id) || {}
          })))
        }
      } catch (e) {
        console.error('Error loading colors:', e)
      }
    }

    loadColors()
  }, [])

  // Create O(1) lookups for color matching to avoid O(N) iteration in filter logic
  // Enhanced with ID-based lookup and translation-aware matching
  const colorLookups = useMemo(() => {
    const nameMap = new Map<string, ColorOption>()
    const idMap = new Map<string, ColorOption>()
    const childrenMap = new Map<string, ColorOption[]>()
    // Translation map: any translated name (lowercase) -> ColorOption
    // This enables users to filter by colors in their language
    const translationMap = new Map<string, ColorOption>()
    // Alias map: any color token -> Set of all aliases (canonical + translations)
    // This allows O(1) expansion of a color token into all its localized forms
    const aliasMap = new Map<string, Set<string>>()

    colorOptions.forEach(c => {
      const normalizedName = c.name.toLowerCase()
      nameMap.set(normalizedName, c)
      idMap.set(c.id, c)
      
      // Collect all aliases for this color
      const aliases = new Set<string>()
      aliases.add(normalizedName)

      // Build children map for primary color expansion
      c.parentIds.forEach(pid => {
        const existing = childrenMap.get(pid)
        if (existing) {
          existing.push(c)
        } else {
          childrenMap.set(pid, [c])
        }
      })
      
      // Index all translations for multi-language matching
      Object.values(c.translations).forEach(translatedName => {
        if (translatedName) {
          const tName = translatedName.toLowerCase().trim()
          translationMap.set(tName, c)
          aliases.add(tName)
        }
      })

      // Populate alias map for all aliases of this color
      // All aliases point to the SAME Set instance to save memory
      aliases.forEach(alias => {
        aliasMap.set(alias, aliases)
      })
    })
    return { nameMap, idMap, childrenMap, translationMap, aliasMap }
  }, [colorOptions])

  // Global refresh for plant lists without full reload
  React.useEffect(() => {
    const onRefresh = () => { loadPlants() }
    try { window.addEventListener('plants:refresh', onRefresh as EventListener) } catch {
      // Ignore event listener errors
    }
    return () => { try { window.removeEventListener('plants:refresh', onRefresh as EventListener) } catch {
      // Ignore event listener errors
    } }
  }, [loadPlants])

  // Global presence tracking so Admin can see "currently online" users
  const presenceRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    // Track SPA route changes to server for visit analytics
    const sendVisit = async (path: string) => {
      try {
        const base: string = ''
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        const ref = document.referrer || ''
        const nav = navigator as Navigator & { hardwareConcurrency?: number; deviceMemory?: number }
        const extra = {
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
          screen: { w: window.screen?.width || null, h: window.screen?.height || null, colorDepth: window.screen?.colorDepth || null },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          platform: navigator.platform || null,
          vendor: navigator.vendor || null,
          hardwareConcurrency: nav.hardwareConcurrency || null,
          memoryGB: nav.deviceMemory || null,
          webgl: (() => {
            try {
              const c = document.createElement('canvas')
              const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
              if (!gl) return null
              // Use standard VENDOR and RENDERER parameters (Firefox compatible)
              // WEBGL_debug_renderer_info is deprecated in Firefox
              let vendor: string | null = null
              let renderer: string | null = null
              try {
                // Try standard parameters first (works in Firefox)
                vendor = gl.getParameter(gl.VENDOR) as string | null
                renderer = gl.getParameter(gl.RENDERER) as string | null
              } catch {
                // Fallback silently
              }
              // If standard params returned generic values, try the extension (Chrome/Safari)
              // but only if it's available (not in Firefox)
              if ((!vendor || vendor === 'WebKit' || vendor === 'Mozilla') || (!renderer || renderer === 'WebKit WebGL')) {
                try {
                  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
                  if (debugInfo) {
                    vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string | null
                    renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string | null
                  }
                } catch {
                  // Extension not available, use standard values
                }
              }
              return { vendor: vendor ?? null, renderer: renderer ?? null }
            } catch {
              // WebGL not available
              return null
            }
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
            language: navigator.language || navigator.languages?.[0] || null,
            // utm removed from server; not sent anymore
            extra,
          }),
          keepalive: true,
        })
      } catch {
        // Ignore visit tracking errors
      }
    }

    const cancelIdleVisit = scheduleIdleTask(() => {
      sendVisit(location.pathname + location.search).catch(() => {
        // Ignore errors
      })
    }, 2000)

    return () => { cancelIdleVisit() }
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
            language: navigator.language || navigator.languages?.[0] || null,
            extra: { source: 'heartbeat' },
          }),
          keepalive: true,
        })
      } catch {
        // Ignore heartbeat errors
      }
    }
    timer = setInterval(() => { sendHeartbeat().catch(() => {
      // Ignore errors
    }) }, HEARTBEAT_MS)
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
    } catch {
      // Ignore localStorage errors
    }

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
          } catch {
            // Ignore tracking errors
          }
        }
      })

    presenceRef.current = channel
    return () => {
      try { channel.untrack() } catch {
        // Ignore untrack errors
      }
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.display_name])

  // Pre-calculate normalized values for all plants to optimize filter performance
  // This avoids repeating expensive string operations on every filter change
  // All Set-based lookups enable O(1) membership tests instead of O(n) array scans
  // Enhanced: Now includes color translations for bi-directional language matching
  const preparedPlants = useMemo(() => {
    const { aliasMap } = colorLookups
    
    return plants.map((p) => {
      // Colors - build both array (for iteration) and Sets (for O(1) lookups)
      const legacyColors = Array.isArray(p.colors) ? p.colors.map((c: string) => String(c)) : []
      const identityColors = Array.isArray(p.identity?.colors)
        ? p.identity.colors.map((c) => (typeof c === 'object' && c?.name ? c.name : String(c)))
        : []
      const colors = [...legacyColors, ...identityColors]
      const normalizedColors = colors.map(c => c.toLowerCase().trim())
      
      // Pre-tokenize compound colors (e.g., "red-orange" -> ["red", "orange"])
      // This avoids regex operations during filtering
      // Enhanced: Also add translations for bi-directional matching
      // (e.g., plant with "red" will also match filter "rouge")
      const colorTokens = new Set<string>()
      normalizedColors.forEach(color => {
        colorTokens.add(color)

        // Check aliases for the full color string (e.g. "dark-green" -> "vert fonce")
        const fullColorAliases = aliasMap.get(color)
        if (fullColorAliases) {
          for (const alias of fullColorAliases) {
            colorTokens.add(alias)
          }
        }

        // Split compound colors and add individual tokens
        const tokens = color.replace(RE_SPLIT_COLOR, ' ').split(RE_WHITESPACE).filter(Boolean)
        tokens.forEach(token => {
          colorTokens.add(token)

          // O(1) expansion of tokens to all their aliases (canonical + translations)
          // Uses the pre-calculated aliasMap to avoid object iteration
          const aliases = aliasMap.get(token)
          if (aliases) {
            // Fast add of all aliases
            for (const alias of aliases) {
              colorTokens.add(alias)
            }
          }
        })
      })

      // Search string
      const searchString = `${p.name} ${p.scientificName || ''} ${p.meaning || ''} ${colors.join(" ")}`.toLowerCase()

      // Type
      const typeLabel = getPlantTypeLabel(p.classification)?.toLowerCase() ?? null

      // Usage - both array and Set
      const usageLabels = getPlantUsageLabels(p).map((label) => label.toLowerCase())
      const usageSet = new Set(usageLabels)

      // Habitat - both array and Set for O(1) lookups
      const habitats = (p.plantCare?.habitat || p.care?.habitat || []).map((h) => h.toLowerCase())
      const habitatSet = new Set(habitats)

      // Maintenance
      const maintenance = (p.identity?.maintenanceLevel || p.plantCare?.maintenanceLevel || p.care?.maintenanceLevel || '').toLowerCase()

      // Toxicity
      const petSafe = (p.identity?.toxicityPets || '').toLowerCase().replace(/[\s-]/g, '') === 'nontoxic'
      const humanSafe = (p.identity?.toxicityHuman || '').toLowerCase().replace(/[\s-]/g, '') === 'nontoxic'

      // Living space
      const livingSpace = (p.identity?.livingSpace || '').toLowerCase()

      // Seasons - convert to Set for O(1) lookups
      const seasons = Array.isArray(p.seasons) ? p.seasons : []
      const seasonsSet = new Set(seasons.map(s => String(s)))

      // Pre-parse createdAt for faster sorting (avoid Date.parse on each sort comparison)
      const createdAtValue = p.meta?.createdAt
      const createdAtTs = createdAtValue ? Date.parse(createdAtValue) : 0
      const createdAtTsFinal = Number.isNaN(createdAtTs) ? 0 : createdAtTs

      // Pre-extract popularity for faster sorting
      const popularityLikes = p.popularity?.likes ?? 0

      // Pre-compute image availability for Discovery page filtering
      const hasLegacyImage = Boolean(p.image)
      const hasImagesArray = Array.isArray(p.images) && p.images.some((img) => img?.link)
      const hasImage = hasLegacyImage || hasImagesArray

      return {
        ...p,
        _searchString: searchString,
        _normalizedColors: normalizedColors,
        _colorTokens: colorTokens,
        _typeLabel: typeLabel,
        _usageLabels: usageLabels,
        _usageSet: usageSet,
        _habitats: habitats,
        _habitatSet: habitatSet,
        _maintenance: maintenance,
        _petSafe: petSafe,
        _humanSafe: humanSafe,
        _livingSpace: livingSpace,
        _seasonsSet: seasonsSet,
        _createdAtTs: createdAtTsFinal,
        _popularityLikes: popularityLikes,
        _hasImage: hasImage
      } as PreparedPlant
    })
  }, [plants, colorLookups])

  // Memoize color filter expansion separately to avoid recomputing on every filter change
  // This builds a Set of all color names that should match (including children of primary colors)
  // Enhanced: Also supports matching by translated color names for multi-language filtering
  const expandedColorFilterSet = useMemo(() => {
    const normalizedColorFilters = colorFilter.map((c) => c.toLowerCase().trim()).filter(Boolean)
    if (normalizedColorFilters.length === 0) return null
    
    const expandedSet = new Set<string>()
    const { nameMap, childrenMap, translationMap } = colorLookups
    
    // Pre-allocate a Set for tracking processed color IDs to avoid duplicate expansion
    const processedIds = new Set<string>()
    
    normalizedColorFilters.forEach((filterColorName) => {
      // Add the exact filter name for direct matching
      expandedSet.add(filterColorName)
      
      // Try to resolve the color - first by name, then by translation
      // This allows filtering by colors in any supported language
      const filterColor = nameMap.get(filterColorName) || translationMap.get(filterColorName)
      
      if (filterColor && !processedIds.has(filterColor.id)) {
        processedIds.add(filterColor.id)
        
        // Always add the canonical name for reliable matching
        expandedSet.add(filterColor.name.toLowerCase())
        
        // Add all translations for this color to enable cross-language plant matching
        Object.values(filterColor.translations).forEach(translatedName => {
          if (translatedName) {
            expandedSet.add(translatedName.toLowerCase().trim())
          }
        })
        
        // If primary color, expand to include all child colors
        if (filterColor.isPrimary) {
          const children = childrenMap.get(filterColor.id)
          if (children) {
            for (let i = 0; i < children.length; i++) {
              const child = children[i]
              expandedSet.add(child.name.toLowerCase())
              // Also add child translations for comprehensive matching
              Object.values(child.translations).forEach(translatedName => {
                if (translatedName) {
                  expandedSet.add(translatedName.toLowerCase().trim())
                }
              })
            }
          }
        }
      }
    })
    
    return expandedSet
  }, [colorFilter, colorLookups])

  // Pre-normalize filter values to avoid repeated lowercasing during filtering
  const normalizedFilters = useMemo(() => ({
    query: debouncedQuery.toLowerCase(),
    type: typeFilter?.toLowerCase() ?? null,
    usageSet: new Set(usageFilters.map((u) => u.toLowerCase())),
    habitatSet: new Set(habitatFilters.map((h) => h.toLowerCase())),
    maintenance: maintenanceFilter?.toLowerCase() ?? null,
    livingSpaceSet: new Set(livingSpaceFilters.map(s => s.toLowerCase()))
  }), [debouncedQuery, typeFilter, usageFilters, habitatFilters, maintenanceFilter, livingSpaceFilters])

  // Reset index when search query changes
  React.useEffect(() => {
    setIndex(0)
  }, [debouncedQuery])

  const filtered = useMemo(() => {
    const { query: lowerQuery, type: normalizedType, usageSet, habitatSet, maintenance: normalizedMaintenanceFilter, livingSpaceSet } = normalizedFilters
    
    // Pre-compute living space matching logic
    const livingSpaceCount = livingSpaceSet.size
    const requiresBoth = livingSpaceCount === 2
    const requiresIndoor = livingSpaceSet.has('indoor')
    const requiresOutdoor = livingSpaceSet.has('outdoor')

    return preparedPlants.filter((p) => {
      // Early exit pattern: check cheapest conditions first
      // Boolean checks are O(1) and fastest
      if (petSafe && !p._petSafe) return false
      if (humanSafe && !p._humanSafe) return false
      if (onlySeeds && !p.seedsAvailable) return false
      if (onlyFavorites && !likedSet.has(p.id)) return false
      
      // String equality checks - still O(1)
      if (normalizedType && p._typeLabel !== normalizedType) return false
      if (normalizedMaintenanceFilter && p._maintenance !== normalizedMaintenanceFilter) return false
      
      // Season filter - O(1) Set lookup
      if (seasonFilter && !p._seasonsSet.has(seasonFilter)) return false
      
      // Living space filter - pre-computed logic
      if (livingSpaceCount > 0) {
        if (requiresBoth) {
          if (p._livingSpace !== 'both') return false
        } else if (requiresIndoor) {
          if (p._livingSpace !== 'indoor' && p._livingSpace !== 'both') return false
        } else if (requiresOutdoor) {
          if (p._livingSpace !== 'outdoor' && p._livingSpace !== 'both') return false
        }
      }
      
      // Usage filter - O(k) where k is number of selected usages, using O(1) Set lookups
      if (usageSet.size > 0) {
        for (const usage of usageSet) {
          if (!p._usageSet.has(usage)) return false
        }
      }
      
      // Habitat filter - OR logic: match if plant has ANY selected habitat
      // Using O(1) Set lookups instead of O(n) array includes
      if (habitatSet.size > 0) {
        let hasMatchingHabitat = false
        for (const h of habitatSet) {
          if (p._habitatSet.has(h)) {
            hasMatchingHabitat = true
            break
          }
        }
        if (!hasMatchingHabitat) return false
      }
      
      // Color filter - using pre-computed color tokens for O(1) lookups
      // Optimized: Iterate over plant tokens (smaller set) instead of filter set (larger set)
      // Note: _colorTokens includes both full color strings (e.g. "red-orange") and split tokens (e.g. "red", "orange")
      if (expandedColorFilterSet) {
        let hasMatchingColor = false
        for (const plantToken of p._colorTokens) {
          if (expandedColorFilterSet.has(plantToken)) {
            hasMatchingColor = true
            break
          }
        }
        if (!hasMatchingColor) return false
      }
      
      // Search query - string includes is O(n*m) but unavoidable for substring search
      // Checked last as it's the most expensive operation
      if (lowerQuery && !p._searchString.includes(lowerQuery)) return false
      
      return true
    })
  }, [preparedPlants, normalizedFilters, seasonFilter, expandedColorFilterSet, onlySeeds, onlyFavorites, petSafe, humanSafe, likedSet])

  // Swiping-only randomized order with continuous wrap-around
  const [shuffleEpoch, setShuffleEpoch] = useState(0)
  
  // Store shuffled plant IDs separately - this is the stable order
  const [shuffledPlantIds, setShuffledPlantIds] = useState<string[]>([])
  
  // Get plants with images for swipe view (doesn't depend on likedSet for filtering)
  const swipeablePlants = useMemo(() => {
    return preparedPlants.filter((p) => p._hasImage)
  }, [preparedPlants])
  
  // Track if we've done initial shuffle
  const hasInitialShuffleRef = React.useRef(false)
  
  // Create/update shuffled order only when plants change or explicit reshuffle
  React.useEffect(() => {
    if (swipeablePlants.length === 0) {
      setShuffledPlantIds([])
      hasInitialShuffleRef.current = false
      return
    }
    
    // Only shuffle if we haven't done initial shuffle yet, or explicit epoch triggered
    if (!hasInitialShuffleRef.current || shuffleEpoch > 0) {
      // Fisher-Yates shuffle for unbiased randomization
      const shuffleArray = <T,>(arr: T[]): T[] => {
        const result = arr.slice()
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[result[i], result[j]] = [result[j], result[i]]
        }
        return result
      }
      
      // Discovery Algorithm:
      // 1. Plants with promotion_month matching current month appear FIRST (shuffled among themselves)
      // 2. All other plants follow (shuffled among themselves)
      // This ensures "Plant of the Month" plants get priority visibility in Discovery
      const now = new Date()
      const promoted: string[] = []
      const regular: string[] = []
      
      swipeablePlants.forEach((plant) => {
        if (isPlantOfTheMonth(plant, now)) {
          promoted.push(plant.id)
        } else {
          regular.push(plant.id)
        }
      })
      
      // Promoted plants first, then regular plants (both groups shuffled internally)
      const newOrder = promoted.length === 0
        ? shuffleArray(swipeablePlants.map(p => p.id))
        : [...shuffleArray(promoted), ...shuffleArray(regular)]
      
      setShuffledPlantIds(newOrder)
      hasInitialShuffleRef.current = true
    }
  }, [swipeablePlants, shuffleEpoch])
  
  // Build the actual swipe list from the stable shuffled IDs
  const swipeList = useMemo(() => {
    if (shuffledPlantIds.length === 0) return []
    
    // Create a map for O(1) lookups
    const plantMap = new Map(swipeablePlants.map(p => [p.id, p]))
    
    // Return plants in shuffled order, filtering out any that no longer exist
    return shuffledPlantIds
      .map(id => plantMap.get(id))
      .filter((p): p is PreparedPlant => p !== undefined)
  }, [shuffledPlantIds, swipeablePlants])

  const sortedSearchResults = useMemo(() => {
    // Helper to check if a plant is "in progress"
    const isPlantInProgress = (p: Plant) => {
      const status = p.meta?.status?.toLowerCase()
      return status === 'in progres' || status === 'in progress'
    }

    // For default sort:
    // 1. Promotion Month plants first (featured for current month)
    // 2. Regular plants in the middle
    // 3. In-progress plants last
    if (searchSort === "default") {
      const now = new Date()
      const arr = filtered.slice() as PreparedPlant[]
      arr.sort((a, b) => {
        // Priority: Promotion Month > Regular > In Progress
        const aPromoted = isPlantOfTheMonth(a, now) ? -1 : 0
        const bPromoted = isPlantOfTheMonth(b, now) ? -1 : 0
        if (aPromoted !== bPromoted) return aPromoted - bPromoted
        
        const aInProgress = isPlantInProgress(a) ? 1 : 0
        const bInProgress = isPlantInProgress(b) ? 1 : 0
        if (aInProgress !== bInProgress) return aInProgress - bInProgress
        
        // Maintain alphabetical order within same priority
        return a.name.localeCompare(b.name)
      })
      return arr
    }
    
    // Cast to PreparedPlant[] since filtered comes from preparedPlants
    const arr = filtered.slice() as PreparedPlant[]
    
    if (searchSort === "newest") {
      // Use pre-computed timestamp - no Date.parse on each comparison
      arr.sort((a, b) => {
        const diff = b._createdAtTs - a._createdAtTs
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name)
      })
    } else if (searchSort === "favorites") {
      arr.sort((a, b) => {
        const la = likedSet.has(a.id) ? 1 : 0
        const lb = likedSet.has(b.id) ? 1 : 0
        if (la !== lb) return lb - la
        return a.name.localeCompare(b.name)
      })
    } else if (searchSort === "popular") {
      // Use pre-computed popularity - no property access chain on each comparison
      arr.sort((a, b) => {
        const diff = b._popularityLikes - a._popularityLikes
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name)
      })
    }
    return arr
  }, [filtered, searchSort, likedSet])

  const current = swipeList.length > 0 ? swipeList[index % swipeList.length] : undefined
  const heroImageCandidate = current ? getDiscoveryPageImageUrl(current) : ""
  const boostImagePriority = initialCardBoostRef.current && index === 0 && Boolean(heroImageCandidate)

  React.useEffect(() => {
    if (!initialCardBoostRef.current) return
    if (!heroImageCandidate) return
    if (index !== 0) return
    initialCardBoostRef.current = false
  }, [heroImageCandidate, index])

  // Track which images have been preloaded to avoid re-preloading
  const preloadedImagesRef = React.useRef<Set<string>>(new Set())

  // Preload next card images for instant swipe transitions
  React.useEffect(() => {
    if (currentView !== "discovery") return
    if (typeof window === "undefined") return
    if (swipeList.length === 0) return

    // Debounce preloading to avoid flashing
    const timeoutId = setTimeout(() => {
      // Preload next 2 cards and previous 1 card
      const offsets = [1, 2, -1]
      offsets.forEach((offset) => {
        const targetIndex = (index + offset + swipeList.length) % swipeList.length
        const plant = swipeList[targetIndex]
        if (plant) {
          const imageUrl = getDiscoveryPageImageUrl(plant)
          if (imageUrl && !preloadedImagesRef.current.has(imageUrl)) {
            preloadedImagesRef.current.add(imageUrl)
            const img = new Image()
            img.src = imageUrl
          }
        }
      })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [currentView, index, swipeList])

  React.useEffect(() => {
    if (currentView !== "discovery") return
    if (typeof document === "undefined" || typeof window === "undefined") return
    if (!current || index !== 0) return
    if (!heroImageCandidate) return
    const href = new URL(heroImageCandidate, window.location.origin).toString()
    const existing = document.querySelector<HTMLLinkElement>('link[data-aphylia-preload="hero"]')
    if (existing && existing.href === href) {
      return
    }
    if (existing) {
      existing.remove()
    }
    const link = document.createElement("link")
    link.rel = "preload"
    link.as = "image"
    link.href = href
    try {
      (link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = "high"
    } catch {
      // Ignore fetchPriority assignment errors
    }
    link.setAttribute("fetchpriority", "high")
    link.setAttribute("data-aphylia-preload", "hero")
    document.head.appendChild(link)
    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }
    }
  }, [currentView, heroImageCandidate, index, current])

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
    if (current) navigate(`/plants/${current.id}`)
  }

  // Swipe logic
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // Minimum distance (in pixels) the card must travel to trigger a swipe action
  // This prevents taps/clicks from being interpreted as swipes
  const threshold = 100
  
  // Reset motion values immediately when index changes
  React.useEffect(() => {
    // Animate smoothly back to center
    animate(x, 0, { duration: 0.1 })
    animate(y, 0, { duration: 0.1 })
  }, [index, x, y])
  
  const onDragEnd = (_: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    const dx = info.offset.x
    const dy = info.offset.y
    
    // Get absolute offset values - this is the actual distance the card traveled
    const absOffsetX = Math.abs(dx)
    const absOffsetY = Math.abs(dy)
    
    let actionTaken = false
    
    // ONLY trigger actions based on actual distance traveled (threshold = 100px)
    // Velocity is IGNORED to prevent taps/clicks from being interpreted as swipes
    // The card must physically move at least 100px to trigger any action
    
    // Prioritize vertical swipe over horizontal if vertical movement is greater
    if (absOffsetY > absOffsetX && absOffsetY > threshold) {
      if (dy < -threshold) {
        // Swipe up (bottom to top) = open info
        animate(x, 0, { duration: 0.1 })
        animate(y, 0, { duration: 0.1 })
        handleInfo()
        actionTaken = true
      }
      // Note: swipe down does nothing
    }
    
    // Horizontal swipe detection - only if horizontal movement is greater than vertical
    if (!actionTaken && absOffsetX > absOffsetY && absOffsetX > threshold) {
      if (dx < -threshold) {
        // Swipe left (right to left) = next
        animate(x, 0, { duration: 0.1 })
        animate(y, 0, { duration: 0.1 })
        handlePass()
        actionTaken = true
      } else if (dx > threshold) {
        // Swipe right (left to right) = previous
        animate(x, 0, { duration: 0.1 })
        animate(y, 0, { duration: 0.1 })
        handlePrevious()
        actionTaken = true
      }
    }
    
    // No action taken - snap back to center smoothly
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
  const handleProfileNavigation = React.useCallback(() => { navigate('/profile') }, [navigate])
  const handleLogoutNavigation = React.useCallback(async () => {
    await signOut()
    // Stay on current page unless it requires authentication
    // Protected routes that require user to be logged in:
    const protectedPrefixes = ['/profile', '/friends', '/settings', '/admin', '/create']
    const isOnProtectedPage = protectedPrefixes.some(prefix => 
      pathWithoutLang === prefix || pathWithoutLang.startsWith(prefix + '/')
    ) || pathWithoutLang.match(/^\/plants\/[^/]+\/edit$/)
    
    if (isOnProtectedPage) {
      navigate('/')
    }
  }, [signOut, navigate, pathWithoutLang])

  const submitAuth = async () => {
    if (authSubmitting) return
    setAuthError(null)
    setAuthSubmitting(true)
    try {
      console.log('[auth] submit start', { mode: authMode })
      
      // Execute reCAPTCHA v3 Enterprise (consent-aware, may return null)
      let recaptchaToken: string | undefined
      try {
        const action = authMode === 'signup' ? 'signup' : 'login'
        const token = await executeRecaptcha(action)
        recaptchaToken = token ?? undefined
        if (token) {
          console.log('[auth] reCAPTCHA token obtained')
        } else {
          console.log('[auth] reCAPTCHA skipped (no consent or unavailable)')
        }
      } catch (recaptchaError) {
        console.warn('[auth] reCAPTCHA execution failed', recaptchaError)
        // Continue without token - backend will decide how to handle
      }
      
      if (authMode === 'signup') {
        if (authPassword !== authPassword2) {
          console.warn('[auth] password mismatch')
          setAuthError(t('auth.passwordsDontMatch'))
          setAuthSubmitting(false)
          return
        }
        if (!authAcceptedTerms) {
          console.warn('[auth] terms not accepted')
          setAuthError(t('auth.mustAcceptTerms'))
          setAuthSubmitting(false)
          return
        }
        const { error } = await signUp({ email: authEmail, password: authPassword, displayName: authDisplayName, recaptchaToken, marketingConsent: authMarketingConsent })
        if (error) {
          console.error('[auth] signup error', error)
          setAuthError(error)
          setAuthSubmitting(false)
          return
        }
        console.log('[auth] signup ok')
      } else {
        const { error } = await signIn({ email: authEmail, password: authPassword, recaptchaToken })
        if (error) {
          console.error('[auth] login error', error)
          setAuthError(error)
          setAuthSubmitting(false)
          return
        }
        console.log('[auth] login ok')
      }
      // Reset submitting state before closing dialog
      setAuthSubmitting(false)
      setAuthOpen(false)
    } catch (e: unknown) {
      console.error('[auth] unexpected error', e)
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
      setAuthError(msg || t('auth.unexpectedError'))
      setAuthSubmitting(false)
    }
  }

  // Close auth dialog once the user object becomes available
  React.useEffect(() => {
    if (user) {
      setAuthOpen(false)
    }
  }, [user])

  // Reset form state when dialog closes
  React.useEffect(() => {
    if (!authOpen) {
      setAuthAcceptedTerms(false)
      setAuthMarketingConsent(true) // Reset to default (checked)
      setAuthSubmitting(false)
      setAuthError(null)
      setAuthEmail("")
      setAuthPassword("")
      setAuthPassword2("")
      setAuthDisplayName("")
    }
  }, [authOpen])

  React.useEffect(() => {
    if (authMode !== 'signup') {
      setAuthAcceptedTerms(false)
      setAuthMarketingConsent(true) // Reset to default (checked)
    }
  }, [authMode])


    // Landing page has its own layout, skip the app shell
    // Show landing page for both logged out users AND logged in users visiting "/"
    const isLandingPage = currentView === "landing"

    if (isLandingPage) {
      return (
        <AuthActionsProvider openLogin={openLogin} openSignup={openSignup}>
          <ErrorBoundary fallback={routeErrorFallback}>
          <Routes>
            <Route
              path="/"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <LandingPageLazy />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/discovery" replace />} />
          </Routes>
          </ErrorBoundary>
          {/* Auth Dialog for landing page */}
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
                {authMode === 'signup' && (
                  <>
                    <div className="flex items-start gap-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] p-3">
                      <input
                        id="auth-accept-terms"
                        type="checkbox"
                        checked={authAcceptedTerms}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthAcceptedTerms(e.target.checked)}
                        disabled={authSubmitting}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-600 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-[#555] dark:bg-[#1e1e1e]"
                      />
                      <Label htmlFor="auth-accept-terms" className="text-sm leading-5 text-stone-600 dark:text-stone-200">
                        {t('auth.acceptTermsLabel')}{" "}
                        <a
                          href={termsPath}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                          {t('auth.termsLinkLabel')}
                        </a>.
                      </Label>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] p-3">
                      <input
                        id="auth-marketing-consent"
                        type="checkbox"
                        checked={authMarketingConsent}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthMarketingConsent(e.target.checked)}
                        disabled={authSubmitting}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-600 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-[#555] dark:bg-[#1e1e1e]"
                      />
                      <Label htmlFor="auth-marketing-consent" className="text-sm leading-5 text-stone-600 dark:text-stone-200">
                        {t('auth.marketingConsentLabel', 'Receive occasional emails about new features and updates')}
                      </Label>
                    </div>
                  </>
                )}
                {authError && <div className="text-sm text-red-600">{authError}</div>}
                <Button className="w-full rounded-2xl" onClick={submitAuth} loading={authSubmitting}>
                  {authMode === 'login' ? t('auth.continue') : t('auth.createAccount')}
                </Button>
                <div className="text-center text-sm">
                  {authMode === 'login' ? (
                    <button className="underline" onClick={() => setAuthMode('signup')} disabled={authSubmitting}>{t('auth.noAccount')}</button>
                  ) : (
                    <button className="underline" onClick={() => setAuthMode('login')} disabled={authSubmitting}>{t('auth.haveAccount')}</button>
                  )}
                </div>
                <p className="text-[10px] text-center text-stone-400 dark:text-stone-500 mt-2">
                  This site is protected by reCAPTCHA and the Google{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600 dark:hover:text-stone-400">Privacy Policy</a> and{' '}
                  <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600 dark:hover:text-stone-400">Terms of Service</a> apply.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* GDPR Cookie Consent Banner */}
          <CookieConsent />
          
          {/* Legal Document Update Modal */}
          {showLegalUpdateModal && user && profile && (
            <LegalUpdateModal
              open={showLegalUpdateModal}
              userId={user.id}
              userTermsVersion={profile.terms_version_accepted ?? null}
              userPrivacyVersion={profile.privacy_version_accepted ?? null}
              onAccepted={() => {
                setLegalUpdateDismissed(true)
                refreshProfile().catch(() => {})
              }}
              onDeclined={async () => {
                // User declined - they will be blocked (threat_level = 3)
                // Sign them out and show message
                await signOut()
                alert(t('legal.declinedMessage', 'Your account has been blocked because you declined the updated terms. Contact support if you wish to reactivate your account.'))
              }}
            />
          )}
        </AuthActionsProvider>
      )
    }

    return (
        <AuthActionsProvider openLogin={openLogin} openSignup={openSignup}>
          <div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] px-4 pb-24 pt-2 md:px-8 md:pb-8 md:pt-4 overflow-y-visible">
          <div className="overflow-y-visible">
          <TopBar
            openLogin={openLogin}
            openSignup={openSignup}
            user={user}
            displayName={profile?.display_name || null}
            onProfile={handleProfileNavigation}
            onLogout={handleLogoutNavigation}
          />
          </div>

          {/* Mobile bottom nav (hide Create on phones) */}
          <MobileNavBar
            canCreate={false}
            onProfile={handleProfileNavigation}
            onLogout={handleLogoutNavigation}
            onLogin={openLogin}
            onSignup={openSignup}
          />

          {/* Layout: grid with sidebar on desktop */}
          <div
            className={`max-w-6xl mx-auto mt-6 ${
              currentView === "search" && showFilters
                ? "lg:grid lg:grid-cols-[260px_1fr] lg:gap-10"
                : ""
            }`}
          >
            {/* Sidebar / Filters - desktop only */}
            {currentView === "search" && showFilters && (
              <aside
                className="hidden lg:block lg:sticky lg:top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain"
                aria-label="Filters"
              >
                <div className="space-y-6 pr-2">
                  <FilterControls
                    searchSort={searchSort}
                    setSearchSort={setSearchSort}
                    seasonFilter={seasonFilter}
                    setSeasonFilter={setSeasonFilter}
                    colorFilter={colorFilter}
                    setColorFilter={setColorFilter}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                    usageFilters={usageFilters}
                    setUsageFilters={setUsageFilters}
                    habitatFilters={habitatFilters}
                    setHabitatFilters={setHabitatFilters}
                    maintenanceFilter={maintenanceFilter}
                    setMaintenanceFilter={setMaintenanceFilter}
                    petSafe={petSafe}
                    setPetSafe={setPetSafe}
                    humanSafe={humanSafe}
                    setHumanSafe={setHumanSafe}
                    livingSpaceFilters={livingSpaceFilters}
                    setLivingSpaceFilters={setLivingSpaceFilters}
                    onlySeeds={onlySeeds}
                    setOnlySeeds={setOnlySeeds}
                    onlyFavorites={onlyFavorites}
                    setOnlyFavorites={setOnlyFavorites}
                    colorOptions={colorOptions}
                    primaryColors={primaryColors}
                    advancedColors={advancedColors}
                    typeOptions={typeOptions}
                    usageOptions={usageOptions}
                  />
                </div>
              </aside>
            )}

            {/* Main content area */}
            <main className="min-h-[60vh]" aria-live="polite">
              <ErrorBoundary fallback={routeErrorFallback}>
              {/* Sticky search bar for search view - hides on scroll down on mobile */}
              {currentView === "search" && (
                <div 
                  className={`sticky z-30 -mx-4 px-4 py-3 mb-4 bg-stone-100/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm shadow-sm lg:-mx-0 lg:px-0 lg:rounded-2xl lg:px-4 transition-all duration-300 ${
                    searchBarVisible ? 'top-0 opacity-100' : '-top-32 opacity-0 md:top-0 md:opacity-100'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex-1">
                      <Label htmlFor="plant-search-main" className="sr-only">
                        {t("common.search")}
                      </Label>
                      <SearchInput
                        id="plant-search-main"
                        variant="lg"
                        className="rounded-2xl"
                        placeholder={t("plant.searchPlaceholder")}
                        value={query}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setQuery(e.target.value)
                        }}
                        onClear={() => setQuery("")}
                      />
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
                          {checkEditorAccess(profile) && (
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
                  {/* Mobile filter dropdown */}
                  <div className={`lg:hidden mt-3 ${showFilters ? "max-h-[50vh] overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] p-4 space-y-6" : "hidden"}`}>
                    <FilterControls
                      searchSort={searchSort}
                      setSearchSort={setSearchSort}
                      seasonFilter={seasonFilter}
                      setSeasonFilter={setSeasonFilter}
                      colorFilter={colorFilter}
                      setColorFilter={setColorFilter}
                      typeFilter={typeFilter}
                      setTypeFilter={setTypeFilter}
                      usageFilters={usageFilters}
                      setUsageFilters={setUsageFilters}
                      habitatFilters={habitatFilters}
                      setHabitatFilters={setHabitatFilters}
                      maintenanceFilter={maintenanceFilter}
                      setMaintenanceFilter={setMaintenanceFilter}
                      petSafe={petSafe}
                      setPetSafe={setPetSafe}
                      humanSafe={humanSafe}
                      setHumanSafe={setHumanSafe}
                      livingSpaceFilters={livingSpaceFilters}
                      setLivingSpaceFilters={setLivingSpaceFilters}
                      onlySeeds={onlySeeds}
                      setOnlySeeds={setOnlySeeds}
                      onlyFavorites={onlyFavorites}
                      setOnlyFavorites={setOnlyFavorites}
                      colorOptions={colorOptions}
                      primaryColors={primaryColors}
                      advancedColors={advancedColors}
                      typeOptions={typeOptions}
                      usageOptions={usageOptions}
                    />
                  </div>
                </div>
              )}

          <Routes>
            <Route
              path="/gardens"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <GardenListPage />
                </Suspense>
              }
            />
            <Route
              path="/garden/:id/*"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <GardenDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="/search"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <SearchPageLazy
                    plants={sortedSearchResults}
                    openInfo={(p) => navigate(`/plants/${p.id}`)}
                    likedIds={likedIds}
                  />
                </Suspense>
              }
            />
            <Route
              path="/profile"
              element={user ? (profile?.display_name ? <Navigate to={`/u/${encodeURIComponent(profile.display_name)}`} replace /> : <Navigate to="/u/_me" replace />) : <Navigate to="/" replace />}
            />
            <Route
              path="/u/:username"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <PublicProfilePageLazy />
                </Suspense>
              }
            />
            <Route
              path="/friends"
              element={user ? (
                <Suspense fallback={routeLoadingFallback}>
                  <FriendsPageLazy />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )}
            />
            <Route
              path="/messages"
              element={user ? (
                <Suspense fallback={routeLoadingFallback}>
                  <MessagesPageLazy />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )}
            />
            <Route
              path="/scan"
              element={user ? (
                <Suspense fallback={routeLoadingFallback}>
                  <ScanPageLazy />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )}
            />
            <Route
              path="/settings"
              element={user ? (
                <Suspense fallback={routeLoadingFallback}>
                  <SettingsPageLazy />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )}
            />
            <Route
              path="/bug-catcher"
              element={user ? (
                <Suspense fallback={routeLoadingFallback}>
                  <BugCatcherPageLazy />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )}
            />
            <Route
              path="/contact/business"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <ContactUsPageLazy defaultChannel="business" />
                </Suspense>
              }
            />
            <Route
              path="/contact/bug"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <ContactUsPageLazy defaultChannel="bug" />
                </Suspense>
              }
            />
            <Route
              path="/contact"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <ContactUsPageLazy defaultChannel="support" />
                </Suspense>
              }
            />
            <Route
              path="/about"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <AboutPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/download"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <DownloadPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/pricing"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <PricingPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/terms"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <TermsPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/privacy"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <PrivacyPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/blog"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <BlogPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/blog/create"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <BlogComposerPageLazy />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/blog/:postId/edit"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <BlogComposerPageLazy />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/blog/:slug"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <BlogPostPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/admin/emails/templates/create"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <AdminEmailTemplatePageLazy />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/admin/emails/templates/:id"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <AdminEmailTemplatePageLazy />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/admin/*"
              element={
                <RequireEditor>
                  <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm opacity-60"><Loader2 className="h-4 w-4 animate-spin" /><span>Loading admin panel...</span></div>}>
                    <AdminPage />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/create"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <CreatePlantPageLazy
                      onCancel={() => navigate('/')}
                      onSaved={async (savedId) => {
                        await loadPlants()
                        if (savedId) {
                          navigate(`/create/${savedId}`)
                        }
                      }}
                    />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/create/:id"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <CreatePlantPageLazy
                      onCancel={() => navigate('/')}
                      onSaved={async (savedId) => {
                        await loadPlants()
                        if (savedId) {
                          navigate(`/create/${savedId}`)
                        }
                      }}
                    />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/plants/:id/edit"
              element={
                <RequireEditor>
                  <Suspense fallback={routeLoadingFallback}>
                    <CreatePlantPageLazy
                      onCancel={() => navigate('/search')}
                      onSaved={async (savedId) => {
                        await loadPlants()
                        if (savedId) {
                          navigate(`/create/${savedId}`)
                        }
                      }}
                    />
                  </Suspense>
                </RequireEditor>
              }
            />
            <Route
              path="/bookmarks/:id"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <BookmarkPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/plants/:id"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <PlantInfoPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/discovery"
              element={plants.length > 0 ? (
                <Suspense fallback={<SwipeCardSkeleton />}>
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
                    onToggleLike={() => {
                      if (current) toggleLiked(current.id)
                    }}
                    boostImagePriority={boostImagePriority}
                  />
                </Suspense>
              ) : (
                <>
                  {loading && <SwipeCardSkeleton />}
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
            <Route
              path="/"
              element={
                user ? (
                  <Navigate to="/discovery" replace />
                ) : (
                  <Suspense fallback={routeLoadingFallback}>
                    <LandingPageLazy />
                  </Suspense>
                )
              }
            />
            <Route
              path="/error/:code"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <ErrorPageLazy />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <Suspense fallback={routeLoadingFallback}>
                  <ErrorPageLazy code="404" />
                </Suspense>
              }
            />
          </Routes>
              </ErrorBoundary>
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
            {authMode === 'signup' && (
              <>
                <div className="flex items-start gap-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] p-3">
                  <input
                    id="auth-accept-terms-2"
                    type="checkbox"
                    checked={authAcceptedTerms}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthAcceptedTerms(e.target.checked)}
                    disabled={authSubmitting}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-600 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-[#555] dark:bg-[#1e1e1e]"
                  />
                  <Label htmlFor="auth-accept-terms-2" className="text-sm leading-5 text-stone-600 dark:text-stone-200">
                    {t('auth.acceptTermsLabel')}{" "}
                    <a
                      href={termsPath}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      {t('auth.termsLinkLabel')}
                    </a>.
                  </Label>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] p-3">
                  <input
                    id="auth-marketing-consent-2"
                    type="checkbox"
                    checked={authMarketingConsent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthMarketingConsent(e.target.checked)}
                    disabled={authSubmitting}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-600 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-[#555] dark:bg-[#1e1e1e]"
                  />
                  <Label htmlFor="auth-marketing-consent-2" className="text-sm leading-5 text-stone-600 dark:text-stone-200">
                    {t('auth.marketingConsentLabel', 'Receive occasional emails about new features and updates')}
                  </Label>
                </div>
              </>
            )}
            {authError && <div className="text-sm text-red-600">{authError}</div>}
            <Button className="w-full rounded-2xl" onClick={submitAuth} loading={authSubmitting}>
              {authMode === 'login' ? t('auth.continue') : t('auth.createAccount')}
            </Button>
            <div className="text-center text-sm">
              {authMode === 'login' ? (
                <button className="underline" onClick={() => setAuthMode('signup')} disabled={authSubmitting}>{t('auth.noAccount')}</button>
              ) : (
                <button className="underline" onClick={() => setAuthMode('login')} disabled={authSubmitting}>{t('auth.haveAccount')}</button>
              )}
            </div>
            {/* reCAPTCHA disclosure (required when hiding the badge) */}
            <p className="text-[10px] text-center text-stone-400 dark:text-stone-500 mt-2">
              This site is protected by reCAPTCHA and the Google{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600 dark:hover:text-stone-400">Privacy Policy</a> and{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600 dark:hover:text-stone-400">Terms of Service</a> apply.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
      <BroadcastToast />
      <RequestPlantDialog open={requestPlantDialogOpen} onOpenChange={setRequestPlantDialogOpen} />
      
      {/* Message notification toast - shows when new messages arrive */}
      <MessageNotificationToast
        notification={messageNotification}
        onDismiss={dismissMessageNotification}
        onOpen={(conversationId) => {
          navigate(`/messages?conversation=${conversationId}`)
        }}
      />
      
      {/* GDPR Cookie Consent Banner */}
      <CookieConsent />
      
      {/* Legal Document Update Modal */}
      {showLegalUpdateModal && user && profile && (
        <LegalUpdateModal
          open={showLegalUpdateModal}
          userId={user.id}
          userTermsVersion={profile.terms_version_accepted ?? null}
          userPrivacyVersion={profile.privacy_version_accepted ?? null}
          onAccepted={() => {
            setLegalUpdateDismissed(true)
            refreshProfile().catch(() => {})
          }}
          onDeclined={async () => {
            // User declined - they will be blocked (threat_level = 3)
            // Sign them out and show message
            await signOut()
            alert(t('legal.declinedMessage', 'Your account has been blocked because you declined the updated terms. Contact support if you wish to reactivate your account.'))
          }}
        />
      )}
    </div>
    </AuthActionsProvider>
  )
}

function getPlantTypeLabel(classification?: Plant["classification"]): string | null {
  if (!classification?.type) return null
  const label = formatClassificationLabel(classification.type)
  return label || null
}

function getPlantUsageLabels(plant: Plant): string[] {
  const labels: string[] = []
  
  // Get usage labels from utility field
  if (plant.utility && Array.isArray(plant.utility) && plant.utility.length > 0) {
    plant.utility.forEach((util) => {
      if (util) {
        const formatted = formatClassificationLabel(util)
        if (formatted && !labels.includes(formatted)) {
          labels.push(formatted)
        }
      }
    })
  }
  
  // Also check comestiblePart for edible-related labels
  if (plant.comestiblePart && Array.isArray(plant.comestiblePart) && plant.comestiblePart.length > 0) {
    const hasEdible = plant.comestiblePart.some(part => part && part.trim().length > 0)
    if (hasEdible) {
      const edibleLabel = formatClassificationLabel('comestible')
      if (edibleLabel && !labels.includes(edibleLabel)) {
        labels.push(edibleLabel)
      }
    }
  }
  
  // Check usage fields for additional indicators
  if (plant.usage?.aromatherapy) {
    const aromaticLabel = formatClassificationLabel('aromatic')
    if (aromaticLabel && !labels.includes(aromaticLabel)) {
      labels.push(aromaticLabel)
    }
  }
  
  if (plant.usage?.adviceMedicinal) {
    const medicinalLabel = formatClassificationLabel('medicinal')
    if (medicinalLabel && !labels.includes(medicinalLabel)) {
      labels.push(medicinalLabel)
    }
  }
  
  return labels
}

