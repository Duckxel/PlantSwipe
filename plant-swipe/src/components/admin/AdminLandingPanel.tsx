import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"
import { translateText } from "@/lib/deepl"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Smartphone,
  BarChart3,
  Layout,
  Star,
  HelpCircle,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Leaf,
  Droplets,
  Sun,
  Bell,
  Camera,
  Users,
  Check,
  Upload,
  Link2,
  Search,
  X,
  ArrowRight,
  Download,
  Shuffle,
  ExternalLink,
  Copy,
  Monitor,
  Settings,
  Megaphone,
  GraduationCap,
  CirclePlay,
  Route,
  Grid3X3,
  Quote,
  AlertCircle,
  Languages,
  User,
  LinkIcon,
} from "lucide-react"

// Types
type HeroCard = {
  id: string
  position: number
  plant_name: string
  plant_scientific_name: string | null
  plant_description: string | null
  image_url: string | null
  water_frequency: string
  light_level: string
  reminder_text: string
  is_active: boolean
}

type LandingStats = {
  id: string
  plants_count: string
  plants_label: string
  users_count: string
  users_label: string
  tasks_count: string
  tasks_label: string
  rating_value: string
  rating_label: string
}

type Testimonial = {
  id: string
  position: number
  author_name: string
  author_role: string | null
  author_avatar_url: string | null
  author_website_url: string | null
  linked_user_id: string | null
  quote: string
  rating: number
  is_active: boolean
}

type FAQ = {
  id: string
  position: number
  question: string
  answer: string
  is_active: boolean
}

type FAQTranslation = {
  id: string
  faq_id: string
  language: string
  question: string
  answer: string
}

type DemoFeature = {
  id: string
  position: number
  icon_name: string
  label: string
  color: string
  is_active: boolean
}

type DemoFeatureTranslation = {
  id: string
  feature_id: string
  language: string
  label: string
}

type UserProfile = {
  id: string
  display_name: string
  avatar_url: string | null
}

type LandingPageSettings = {
  id: string
  // Hero Section
  hero_badge_text: string
  hero_title: string
  hero_title_highlight: string
  hero_title_end: string
  hero_description: string
  hero_cta_primary_text: string
  hero_cta_primary_link: string
  hero_cta_secondary_text: string
  hero_cta_secondary_link: string
  hero_social_proof_text: string
  // Section Visibility
  show_hero_section: boolean
  show_stats_section: boolean
  show_beginner_section: boolean
  show_features_section: boolean
  show_demo_section: boolean
  show_how_it_works_section: boolean
  show_showcase_section: boolean
  show_testimonials_section: boolean
  show_faq_section: boolean
  show_final_cta_section: boolean
  // Social Links
  instagram_url: string
  twitter_url: string
  support_email: string
  // Final CTA
  final_cta_badge: string
  final_cta_title: string
  final_cta_subtitle: string
  final_cta_button_text: string
  final_cta_secondary_text: string
  // Beginner Section
  beginner_badge: string
  beginner_title: string
  beginner_title_highlight: string
  beginner_subtitle: string
  // Meta/SEO
  meta_title: string
  meta_description: string
}

type LandingTab = "settings" | "hero" | "stats" | "testimonials" | "faq" | "demo"

// ========================
// IMPORT FROM PLANTS MODAL
// ========================
const ImportPlantModal: React.FC<{
  open: boolean
  onClose: () => void
  onImport: (plant: {
    name: string
    scientific_name: string | null
    image_url: string | null
  }) => void
}> = ({ open, onClose, onImport }) => {
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [plants, setPlants] = React.useState<Array<{
    id: string
    name: string
    scientific_name: string | null
    image_url: string | null
  }>>([])

  const searchPlants = React.useCallback(async (term: string) => {
    setLoading(true)
    try {
      let query = supabase
        .from("plants")
        .select("id, name, scientific_name, plant_images(link, use)")
        .order("name")
        .limit(20)

      if (term.trim()) {
        query = query.or(`name.ilike.%${term}%,scientific_name.ilike.%${term}%`)
      }

      const { data } = await query

      const mappedPlants = (data || []).map((plant: any) => ({
        id: plant.id,
        name: plant.name,
        scientific_name: plant.scientific_name,
        image_url: plant.plant_images?.find((img: any) => img.use === "main")?.link ||
                   plant.plant_images?.[0]?.link || null,
      }))

      setPlants(mappedPlants)
    } catch (e) {
      console.error("Failed to search plants:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      searchPlants(search)
    }
  }, [open, searchPlants])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchPlants(search)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-500" />
            Import from Plant Database
          </DialogTitle>
          <DialogDescription>
            Search for an existing plant to import its details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plants by name..."
            className="pl-10 pr-20 rounded-xl"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {loading && plants.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : plants.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              {search ? "No plants found matching your search" : "Search for a plant to import"}
            </div>
          ) : (
            plants.map((plant) => (
              <button
                key={plant.id}
                type="button"
                onClick={() => {
                  onImport({
                    name: plant.name,
                    scientific_name: plant.scientific_name,
                    image_url: plant.image_url,
                  })
                  onClose()
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left"
              >
                <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-emerald-400/20 to-teal-400/20 flex-shrink-0 overflow-hidden">
                  {plant.image_url ? (
                    <img
                      src={plant.image_url}
                      alt={plant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Leaf className="h-6 w-6 text-emerald-500/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 dark:text-white truncate">
                    {plant.name}
                  </p>
                  {plant.scientific_name && (
                    <p className="text-sm text-stone-500 italic truncate">
                      {plant.scientific_name}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-stone-400 flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-stone-200 dark:border-stone-700">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ========================
// IMAGE PICKER MODAL
// ========================
const ImagePickerModal: React.FC<{
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  currentImage?: string | null
}> = ({ open, onClose, onSelect, currentImage }) => {
  const [tab, setTab] = React.useState<"url" | "library">("url")
  const [urlInput, setUrlInput] = React.useState(currentImage || "")
  const [libraryImages, setLibraryImages] = React.useState<Array<{ url: string; name: string }>>([])
  const [loadingLibrary, setLoadingLibrary] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (open && tab === "library") {
      loadLibraryImages()
    }
  }, [open, tab])

  React.useEffect(() => {
    if (open) {
      setUrlInput(currentImage || "")
    }
  }, [open, currentImage])

  const loadLibraryImages = async () => {
    setLoadingLibrary(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) {
        setLibraryImages([])
        return
      }
      const resp = await fetch("/api/admin/media?limit=100&source=admin", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
      })
      const data = await resp.json()
      if (data?.media) {
        setLibraryImages(
          data.media
            .filter((m: { url?: string }) => m.url)
            .map((m: { url: string; metadata?: { storageName?: string }; path: string }) => ({
              url: m.url,
              name: m.metadata?.storageName || m.path.split("/").pop() || "Image",
            }))
        )
      }
    } catch (e) {
      console.error("Failed to load library images:", e)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const filteredImages = libraryImages.filter(
    (img) => img.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectUrl = () => {
    if (urlInput.trim()) {
      onSelect(urlInput.trim())
      onClose()
    }
  }

  const handleCopyUrl = async () => {
    if (urlInput) {
      await navigator.clipboard.writeText(urlInput)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-emerald-500" />
            Select Image
          </DialogTitle>
          <DialogDescription>
            Enter an image URL or select from your uploaded images
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-stone-200 dark:border-stone-700 pb-4">
          <button
            onClick={() => setTab("url")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              tab === "url"
                ? "bg-emerald-500 text-white"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
            )}
          >
            <Link2 className="h-4 w-4 inline mr-2" />
            Enter URL
          </button>
          <button
            onClick={() => setTab("library")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              tab === "library"
                ? "bg-emerald-500 text-white"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
            )}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Image Library
          </button>
        </div>

        {tab === "url" && (
          <div className="space-y-4">
            {/* Current image preview */}
            {urlInput && (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                <img
                  src={urlInput}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm">Preview</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 rounded-xl"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                  className="rounded-xl"
                  disabled={!urlInput}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleSelectUrl} disabled={!urlInput.trim()} className="rounded-xl">
                <Check className="h-4 w-4 mr-2" />
                Use This Image
              </Button>
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search images..."
                className="pl-10 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-stone-400 hover:text-stone-600" />
                </button>
              )}
            </div>

            {loadingLibrary ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="text-center py-12 text-stone-500">
                {searchQuery ? "No images match your search" : "No images in library yet"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
                {filteredImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onSelect(img.url)
                      onClose()
                    }}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105",
                      currentImage === img.url
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-transparent hover:border-stone-300"
                    )}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    {currentImage === img.url && (
                      <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose} className="rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ========================
// HERO CARD PREVIEW
// ========================
const HeroCardPreview: React.FC<{ card: HeroCard }> = ({ card }) => {
  return (
    <div className="relative w-full max-w-[260px] mx-auto">
      {/* Phone Frame */}
      <div className="bg-stone-900 dark:bg-stone-950 rounded-[2rem] p-2 shadow-xl">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-[#0f1a14] dark:to-[#0a1510] rounded-[1.5rem] overflow-hidden">
          {/* Dynamic Island */}
          <div className="h-8 flex items-center justify-center pt-1">
            <div className="w-16 h-5 bg-stone-900 dark:bg-black rounded-full" />
          </div>

          {/* Content */}
          <div className="px-3 pb-4 space-y-2">
            {/* Plant Image */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400/20 to-teal-400/20">
              {card.image_url ? (
                <img
                  src={card.image_url}
                  alt={card.plant_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Leaf className="h-12 w-12 text-emerald-500/50" />
                </div>
              )}
              {/* Info Overlay */}
              <div className="absolute bottom-2 left-2 right-2">
                <div className="rounded-xl bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm p-2 border border-white/30">
                  <p className="font-semibold text-xs text-stone-900 dark:text-white truncate">
                    {card.plant_name || "Plant Name"}
                  </p>
                  <p className="text-[10px] text-stone-600 dark:text-stone-400 italic truncate">
                    {card.plant_scientific_name || "Scientific name"}
                  </p>
                </div>
              </div>
            </div>

            {/* Care Pills */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200/50 dark:border-white/10">
                <div className="h-5 w-5 rounded bg-blue-500/10 flex items-center justify-center">
                  <Droplets className="h-3 w-3 text-blue-500" />
                </div>
                <span className="text-[9px] text-stone-600 dark:text-stone-300 truncate">
                  {card.water_frequency || "2x/week"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200/50 dark:border-white/10">
                <div className="h-5 w-5 rounded bg-amber-500/10 flex items-center justify-center">
                  <Sun className="h-3 w-3 text-amber-500" />
                </div>
                <span className="text-[9px] text-stone-600 dark:text-stone-300 truncate">
                  {card.light_level || "Bright"}
                </span>
              </div>
            </div>

            {/* Reminder */}
            <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Bell className="h-3 w-3 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] text-emerald-600/80 uppercase">Reminder</p>
                <p className="text-[10px] font-semibold text-stone-900 dark:text-white truncate">
                  {card.reminder_text || "Water in 2 days"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className={cn(
        "absolute -top-2 -right-2 px-2 py-1 rounded-full text-[10px] font-medium",
        card.is_active
          ? "bg-emerald-500 text-white"
          : "bg-stone-400 text-white"
      )}>
        {card.is_active ? "Active" : "Hidden"}
      </div>
    </div>
  )
}

// ========================
// STATS PREVIEW
// ========================
const StatsPreview: React.FC<{ stats: LandingStats | null }> = ({ stats }) => {
  if (!stats) return null

  const statItems = [
    { value: stats.plants_count, label: stats.plants_label, icon: Leaf, color: "emerald" },
    { value: stats.users_count, label: stats.users_label, icon: Users, color: "blue" },
    { value: stats.tasks_count, label: stats.tasks_label, icon: Check, color: "purple" },
    { value: stats.rating_value, label: stats.rating_label, icon: Star, color: "amber" },
  ]

  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 p-[1px]">
      <div className="rounded-2xl bg-white dark:bg-stone-950 px-4 py-5">
        <div className="grid grid-cols-4 gap-4">
          {statItems.map((stat, i) => (
            <div key={i} className="text-center">
              <div className={cn(
                "inline-flex items-center justify-center h-8 w-8 rounded-lg mb-2",
                `bg-${stat.color}-500/10`
              )}>
                <stat.icon className={cn("h-4 w-4", `text-${stat.color}-500`)} />
              </div>
              <div className="text-lg font-bold text-stone-900 dark:text-white">
                {stat.value || "-"}
              </div>
              <div className="text-[10px] text-stone-500 truncate">{stat.label || "-"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ========================
// MAIN COMPONENT
// ========================
export const AdminLandingPanel: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<LandingTab>("settings")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(true)

  // Data states
  const [settings, setSettings] = React.useState<LandingPageSettings | null>(null)
  const [settingsError, setSettingsError] = React.useState<string | null>(null)
  const [heroCards, setHeroCards] = React.useState<HeroCard[]>([])
  const [stats, setStats] = React.useState<LandingStats | null>(null)
  const [testimonials, setTestimonials] = React.useState<Testimonial[]>([])
  const [faqItems, setFaqItems] = React.useState<FAQ[]>([])
  const [demoFeatures, setDemoFeatures] = React.useState<DemoFeature[]>([])

  // Load all data
  const loadData = React.useCallback(async () => {
    setLoading(true)
    setSettingsError(null)
    try {
      const [settingsRes, heroRes, statsRes, testimonialsRes, faqRes, demoRes] = await Promise.all([
        supabase.from("landing_page_settings").select("*").limit(1).maybeSingle(),
        supabase.from("landing_hero_cards").select("*").order("position"),
        supabase.from("landing_stats").select("*").limit(1).maybeSingle(),
        supabase.from("landing_testimonials").select("*").order("position"),
        supabase.from("landing_faq").select("*").order("position"),
        supabase.from("landing_demo_features").select("*").order("position"),
      ])

      // Handle settings - check for table not found error (404)
      if (settingsRes.error) {
        // Table doesn't exist or other error - show error state instead of infinite spinner
        console.error("Settings table error:", settingsRes.error)
        setSettingsError(`Settings table not available: ${settingsRes.error.message}. Please run the landing_page_settings migration.`)
        setSettings(null)
      } else if (!settingsRes.data) {
        // Table exists but no row - try to auto-initialize
        const { data: newSettings, error: insertError } = await supabase
          .from("landing_page_settings")
          .insert({})
          .select()
          .single()
        if (insertError) {
          setSettingsError(`Failed to initialize settings: ${insertError.message}`)
        } else if (newSettings) {
          setSettings(newSettings)
        }
      } else {
        setSettings(settingsRes.data)
      }

      // Handle stats - check for table not found error
      if (statsRes.error) {
        console.error("Stats table error:", statsRes.error)
        // Don't block on stats error, just leave as null
      } else if (!statsRes.data) {
        // Table exists but no row - try to auto-initialize
        const { data: newStats } = await supabase
          .from("landing_stats")
          .insert({})
          .select()
          .single()
        if (newStats) setStats(newStats)
      } else {
        setStats(statsRes.data)
      }

      if (heroRes.data) setHeroCards(heroRes.data)
      if (testimonialsRes.data) setTestimonials(testimonialsRes.data)
      if (faqRes.data) setFaqItems(faqRes.data)
      if (demoRes.data) setDemoFeatures(demoRes.data)
    } catch (e) {
      console.error("Failed to load landing data:", e)
      setSettingsError("Failed to load landing data. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const tabs = [
    { id: "settings" as const, label: "Global Settings", icon: Settings },
    { id: "hero" as const, label: "Hero Cards", icon: Smartphone, count: heroCards.length },
    { id: "stats" as const, label: "Stats", icon: BarChart3 },
    { id: "demo" as const, label: "Wheel Features", icon: CirclePlay, count: demoFeatures.length },
    { id: "testimonials" as const, label: "Reviews", icon: Star, count: testimonials.length },
    { id: "faq" as const, label: "FAQ", icon: HelpCircle, count: faqItems.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Layout className="h-5 w-5 text-emerald-500" />
            Landing Page Editor
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Customize your public landing page content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className={cn("rounded-xl", showPreview && "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20")}
          >
            <Monitor className="h-4 w-4 mr-2" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="rounded-xl"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/", "_blank")}
            className="rounded-xl"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Live
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-xs",
                activeTab === tab.id
                  ? "bg-white/20"
                  : "bg-stone-200 dark:bg-stone-700"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          {activeTab === "settings" && (
            <GlobalSettingsTab
              settings={settings}
              setSettings={setSettings}
              saving={saving}
              setSaving={setSaving}
              settingsError={settingsError}
            />
          )}
          {activeTab === "hero" && (
            <HeroCardsTab
              cards={heroCards}
              setCards={setHeroCards}
              setSaving={setSaving}
              showPreview={showPreview}
              sectionVisible={settings?.show_hero_section ?? true}
            />
          )}
          {activeTab === "stats" && (
            <StatsTab
              stats={stats}
              setStats={setStats}
              saving={saving}
              setSaving={setSaving}
              showPreview={showPreview}
              sectionVisible={settings?.show_stats_section ?? true}
            />
          )}
          {activeTab === "testimonials" && (
            <TestimonialsTab
              testimonials={testimonials}
              setTestimonials={setTestimonials}
              setSaving={setSaving}
              sectionVisible={settings?.show_testimonials_section ?? true}
            />
          )}
          {activeTab === "demo" && (
            <DemoFeaturesTab
              features={demoFeatures}
              setFeatures={setDemoFeatures}
              setSaving={setSaving}
              sectionVisible={settings?.show_demo_section ?? true}
            />
          )}
          {activeTab === "faq" && (
            <FAQTab
              items={faqItems}
              setItems={setFaqItems}
              setSaving={setSaving}
              sectionVisible={settings?.show_faq_section ?? true}
            />
          )}
        </>
      )}

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white shadow-lg z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}

// ========================
// GLOBAL SETTINGS TAB
// ========================
const GlobalSettingsTab: React.FC<{
  settings: LandingPageSettings | null
  setSettings: React.Dispatch<React.SetStateAction<LandingPageSettings | null>>
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  settingsError?: string | null
}> = ({ settings, setSettings, saving, setSaving, settingsError }) => {
  const [localSettings, setLocalSettings] = React.useState<LandingPageSettings | null>(settings)

  React.useEffect(() => {
    setLocalSettings(settings)
  }, [settings])


  const saveSettings = async () => {
    if (!localSettings) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from("landing_page_settings")
        .update({
          ...localSettings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localSettings.id)

      if (!error) {
        setSettings(localSettings)
      }
    } catch (e) {
      console.error("Failed to save settings:", e)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof LandingPageSettings>(key: K, value: LandingPageSettings[K]) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const visibilityItems = [
    { key: "show_hero_section" as const, label: "Hero Section", description: "Main hero area with headline and phone mockup", icon: Smartphone },
    { key: "show_stats_section" as const, label: "Stats Banner", description: "Statistics banner showing key metrics", icon: BarChart3 },
    { key: "show_beginner_section" as const, label: "Beginner Section", description: "Section encouraging new users", icon: GraduationCap },
    { key: "show_features_section" as const, label: "Features Grid", description: "Feature cards showcasing capabilities", icon: Grid3X3 },
    { key: "show_demo_section" as const, label: "Interactive Demo", description: "Animated demo with rotating features", icon: CirclePlay },
    { key: "show_how_it_works_section" as const, label: "How It Works", description: "Step-by-step guide section", icon: Route },
    { key: "show_testimonials_section" as const, label: "Testimonials", description: "Customer reviews and ratings", icon: Quote },
    { key: "show_faq_section" as const, label: "FAQ Section", description: "Frequently asked questions", icon: HelpCircle },
    { key: "show_final_cta_section" as const, label: "Final CTA", description: "Final call-to-action before footer", icon: Megaphone },
  ]

  const setAllVisibility = (visible: boolean) => {
    setLocalSettings(prev => {
      if (!prev) return prev
      const updates: Partial<LandingPageSettings> = {}
      visibilityItems.forEach(item => {
        updates[item.key] = visible
      })
      return { ...prev, ...updates }
    })
  }

  // Show error state if settings table is not available
  if (settingsError) {
    return (
      <Card className="rounded-xl border-rose-200 dark:border-rose-800">
        <CardContent className="py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-rose-500" />
          <h3 className="font-semibold text-stone-900 dark:text-white mb-2">Settings Unavailable</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto mb-4">{settingsError}</p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            The landing page will use default values from translation files until the database table is created.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!localSettings) {
    return (
      <Card className="rounded-xl">
        <CardContent className="py-16 text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 text-stone-300 animate-spin" />
          <h3 className="font-semibold text-stone-900 dark:text-white mb-2">Loading settings...</h3>
          <p className="text-sm text-stone-500">Settings will be auto-initialized if needed</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-500" />
            Section Visibility
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            Toggle sections on or off to customize your landing page. Text content is managed via translation files.
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>

      {/* Section Visibility Content */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-700">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Visible
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-stone-300" />
                  Hidden
                </span>
              </div>
              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAllVisibility(true)}
                  className="rounded-xl"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Show All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAllVisibility(false)}
                  className="rounded-xl"
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide All
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {visibilityItems.map((item) => {
                const isVisible = localSettings[item.key]
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all",
                      isVisible
                        ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                        : "bg-stone-50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-700 opacity-75"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        isVisible ? "bg-emerald-500/10" : "bg-stone-200 dark:bg-stone-800"
                      )}>
                        <item.icon className={cn(
                          "h-5 w-5",
                          isVisible ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"
                        )} />
                      </div>
                      <div>
                        <p className={cn(
                          "font-medium",
                          isVisible ? "text-stone-900 dark:text-white" : "text-stone-500"
                        )}>
                          {item.label}
                        </p>
                        <p className="text-xs text-stone-500">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={(checked) => updateSetting(item.key, checked)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unsaved Changes Warning */}
      {settings && localSettings && JSON.stringify(settings) !== JSON.stringify(localSettings) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500 text-white shadow-lg z-50">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">You have unsaved changes</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-white/20 hover:bg-white/30 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Now"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ========================
// SECTION VISIBILITY BANNER
// ========================
const SectionHiddenBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (visible) return null
  
  return (
    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
      <EyeOff className="h-5 w-5 text-amber-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">This section is currently hidden</p>
        <p className="text-xs text-amber-600 dark:text-amber-500">Go to Global Settings → Section Visibility to enable it</p>
      </div>
    </div>
  )
}

// ========================
// HERO CARDS TAB
// ========================
const HeroCardsTab: React.FC<{
  cards: HeroCard[]
  setCards: React.Dispatch<React.SetStateAction<HeroCard[]>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  showPreview: boolean
  sectionVisible: boolean
}> = ({ cards, setCards, setSaving, showPreview, sectionVisible }) => {
  const [localCards, setLocalCards] = React.useState<HeroCard[]>(cards)
  const [imagePickerOpen, setImagePickerOpen] = React.useState(false)
  const [importPlantOpen, setImportPlantOpen] = React.useState(false)
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null)
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null)

  // Sync local cards when parent cards change (e.g., after add/delete)
  React.useEffect(() => {
    setLocalCards(cards)
  }, [cards])

  // Check if there are unsaved changes
  const hasUnsavedChanges = JSON.stringify(localCards) !== JSON.stringify(cards)

  const addCard = async () => {
    const newCard: Partial<HeroCard> = {
      position: localCards.length,
      plant_name: "New Plant",
      plant_scientific_name: "Scientific name",
      water_frequency: "2x/week",
      light_level: "Bright indirect",
      reminder_text: "Water in 2 days",
      is_active: true,
    }

    const { data, error } = await supabase
      .from("landing_hero_cards")
      .insert(newCard)
      .select()
      .single()

    if (data && !error) {
      setCards([...cards, data])
      setLocalCards([...localCards, data])
      setExpandedCardId(data.id)
    }
  }

  const importFromPlant = async (plant: {
    name: string
    scientific_name: string | null
    image_url: string | null
  }) => {
    const newCard: Partial<HeroCard> = {
      position: localCards.length,
      plant_name: plant.name,
      plant_scientific_name: plant.scientific_name,
      image_url: plant.image_url,
      water_frequency: "2x/week",
      light_level: "Bright indirect",
      reminder_text: "Water in 2 days",
      is_active: true,
    }

    const { data, error } = await supabase
      .from("landing_hero_cards")
      .insert(newCard)
      .select()
      .single()

    if (data && !error) {
      setCards([...cards, data])
      setLocalCards([...localCards, data])
      setExpandedCardId(data.id)
    }
  }

  // Update local state only (no database write)
  const updateLocalCard = (id: string, updates: Partial<HeroCard>) => {
    setLocalCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  // Save all changes to database
  const saveAllCards = async () => {
    setSaving(true)
    try {
      for (const card of localCards) {
        const originalCard = cards.find(c => c.id === card.id)
        if (originalCard && JSON.stringify(originalCard) !== JSON.stringify(card)) {
          await supabase
            .from("landing_hero_cards")
            .update({ ...card, updated_at: new Date().toISOString() })
            .eq("id", card.id)
        }
      }
      setCards(localCards)
    } finally {
      setSaving(false)
    }
  }

  const deleteCard = async (id: string) => {
    if (!confirm("Delete this hero card?")) return
    const { error } = await supabase
      .from("landing_hero_cards")
      .delete()
      .eq("id", id)

    if (!error) {
      setCards(cards.filter(c => c.id !== id))
      setLocalCards(localCards.filter(c => c.id !== id))
    }
  }

  const moveCard = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === localCards.length - 1)) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    const newCards = [...localCards]
    ;[newCards[index], newCards[newIndex]] = [newCards[newIndex], newCards[index]]

    const updates = newCards.map((card, i) => ({ ...card, position: i }))
    setLocalCards(updates)

    // Save position changes immediately since they affect display order
    for (const card of updates) {
      await supabase
        .from("landing_hero_cards")
        .update({ position: card.position })
        .eq("id", card.id)
    }
    setCards(updates)
  }

  const editingCard = localCards.find(c => c.id === editingCardId)

  return (
    <div className="space-y-6">
      {/* Section Hidden Warning */}
      <SectionHiddenBanner visible={sectionVisible} />

      {/* Info Banner */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-green-500/10 border border-emerald-500/20 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Shuffle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-white">Hero Card Display</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
              Active cards will automatically cycle on the landing page. The first active card is shown by default, then they rotate every 5 seconds. Drag to reorder.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Hero Cards</h3>
          <p className="text-sm text-stone-500">
            {localCards.filter(c => c.is_active).length} active of {localCards.length} total
          </p>
        </div>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <Button onClick={saveAllCards} className="rounded-xl bg-amber-500 hover:bg-amber-600">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
          <Button onClick={() => setImportPlantOpen(true)} variant="outline" className="rounded-xl">
            <Download className="h-4 w-4 mr-2" />
            Import from Plants
          </Button>
          <Button onClick={addCard} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Hero Card
          </Button>
        </div>
      </div>

      {localCards.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-16 text-center">
            <Smartphone className="h-12 w-12 mx-auto mb-4 text-stone-300" />
            <h3 className="font-semibold text-stone-900 dark:text-white mb-2">No hero cards yet</h3>
            <p className="text-sm text-stone-500 mb-4">Add your first hero card to showcase on the landing page</p>
            <Button onClick={addCard} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Add First Card
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          "grid gap-6",
          showPreview ? "lg:grid-cols-[1fr,300px]" : "grid-cols-1"
        )}>
          {/* Cards List */}
          <div className="space-y-4">
            {localCards.map((card, index) => (
              <Card
                key={card.id}
                className={cn(
                  "rounded-xl transition-all",
                  expandedCardId === card.id && "ring-2 ring-emerald-500"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Reorder Controls */}
                    <div className="flex flex-col gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveCard(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center justify-center h-6 w-6">
                        <GripVertical className="h-4 w-4 text-stone-400" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveCard(index, "down")}
                        disabled={index === localCards.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Image Thumbnail */}
                    <button
                      onClick={() => {
                        setEditingCardId(card.id)
                        setImagePickerOpen(true)
                      }}
                      className="relative h-20 w-20 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-400/20 to-teal-400/20 flex-shrink-0 group"
                    >
                      {card.image_url ? (
                        <img
                          src={card.image_url}
                          alt={card.plant_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Leaf className="h-8 w-8 text-emerald-500/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </button>

                    {/* Card Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          value={card.plant_name}
                          onChange={(e) => updateLocalCard(card.id, { plant_name: e.target.value })}
                          className="rounded-xl font-semibold text-lg h-9"
                          placeholder="Plant name"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
                          className="rounded-xl flex-shrink-0"
                        >
                          <ChevronDown className={cn(
                            "h-4 w-4 transition-transform",
                            expandedCardId === card.id && "rotate-180"
                          )} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-stone-500">
                        <Input
                          value={card.plant_scientific_name || ""}
                          onChange={(e) => updateLocalCard(card.id, { plant_scientific_name: e.target.value })}
                          className="rounded-xl h-8 italic text-sm flex-1"
                          placeholder="Scientific name"
                        />
                      </div>

                      {/* Expanded Content */}
                      {expandedCardId === card.id && (
                        <div className="mt-4 space-y-4 border-t border-stone-200 dark:border-stone-700 pt-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Water Frequency</Label>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                  <Droplets className="h-4 w-4 text-blue-500" />
                                </div>
                                <Input
                                  value={card.water_frequency}
                                  onChange={(e) => updateLocalCard(card.id, { water_frequency: e.target.value })}
                                  className="rounded-xl h-8"
                                  placeholder="e.g., 2x/week"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Light Level</Label>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                  <Sun className="h-4 w-4 text-amber-500" />
                                </div>
                                <Input
                                  value={card.light_level}
                                  onChange={(e) => updateLocalCard(card.id, { light_level: e.target.value })}
                                  className="rounded-xl h-8"
                                  placeholder="e.g., Bright indirect"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Reminder Text</Label>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                <Bell className="h-4 w-4 text-emerald-500" />
                              </div>
                              <Input
                                value={card.reminder_text}
                                onChange={(e) => updateLocalCard(card.id, { reminder_text: e.target.value })}
                                className="rounded-xl h-8"
                                placeholder="e.g., Water in 2 days"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Description (optional)</Label>
                            <Textarea
                              value={card.plant_description || ""}
                              onChange={(e) => updateLocalCard(card.id, { plant_description: e.target.value })}
                              className="rounded-xl"
                              rows={2}
                              placeholder="A brief description of this plant..."
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateLocalCard(card.id, { is_active: !card.is_active })}
                        className={cn(
                          "rounded-xl",
                          card.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-stone-400"
                        )}
                      >
                        {card.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCard(card.id)}
                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="space-y-4">
              <div className="sticky top-4">
                <div className="rounded-xl bg-stone-100 dark:bg-stone-900 p-4">
                  <h4 className="text-sm font-medium text-stone-600 dark:text-stone-400 mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Live Preview
                  </h4>
                  {localCards.filter(c => c.is_active).length > 0 ? (
                    <HeroCardPreview card={localCards.filter(c => c.is_active)[0]} />
                  ) : (
                    <div className="text-center py-8 text-stone-500 text-sm">
                      No active cards to preview
                    </div>
                  )}
                </div>

                {localCards.filter(c => c.is_active).length > 1 && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <Shuffle className="h-3 w-3 inline mr-1" />
                      {localCards.filter(c => c.is_active).length} cards will rotate on the live page
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Picker Modal */}
      <ImagePickerModal
        open={imagePickerOpen}
        onClose={() => {
          setImagePickerOpen(false)
          setEditingCardId(null)
        }}
        onSelect={(url) => {
          if (editingCardId) {
            updateLocalCard(editingCardId, { image_url: url })
          }
        }}
        currentImage={editingCard?.image_url}
      />

      {/* Import Plant Modal */}
      <ImportPlantModal
        open={importPlantOpen}
        onClose={() => setImportPlantOpen(false)}
        onImport={importFromPlant}
      />
    </div>
  )
}

// ========================
// STATS TAB
// ========================
const StatsTab: React.FC<{
  stats: LandingStats | null
  setStats: React.Dispatch<React.SetStateAction<LandingStats | null>>
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  showPreview: boolean
  sectionVisible: boolean
}> = ({ stats, setStats, saving, setSaving, showPreview, sectionVisible }) => {
  const [localStats, setLocalStats] = React.useState<LandingStats | null>(stats)

  React.useEffect(() => {
    setLocalStats(stats)
  }, [stats])

  // Check if there are unsaved changes
  const hasUnsavedChanges = stats && localStats && JSON.stringify(stats) !== JSON.stringify(localStats)

  const saveStats = async () => {
    if (!localStats) return
    setSaving(true)

    const { error } = await supabase
      .from("landing_stats")
      .update({
        ...localStats,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localStats.id)

    if (!error) {
      setStats(localStats)
    }
    setSaving(false)
  }

  if (!localStats) {
    return (
      <Card className="rounded-xl">
        <CardContent className="py-16 text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 text-stone-300 animate-spin" />
          <h3 className="font-semibold text-stone-900 dark:text-white mb-2">Loading stats...</h3>
          <p className="text-sm text-stone-500">Stats will be auto-initialized if needed</p>
        </CardContent>
      </Card>
    )
  }

  const statCards = [
    {
      key: "plants" as const,
      icon: Leaf,
      color: "emerald",
      countKey: "plants_count" as const,
      labelKey: "plants_label" as const,
    },
    {
      key: "users" as const,
      icon: Users,
      color: "blue",
      countKey: "users_count" as const,
      labelKey: "users_label" as const,
    },
    {
      key: "tasks" as const,
      icon: Check,
      color: "purple",
      countKey: "tasks_count" as const,
      labelKey: "tasks_label" as const,
    },
    {
      key: "rating" as const,
      icon: Star,
      color: "amber",
      countKey: "rating_value" as const,
      labelKey: "rating_label" as const,
    },
  ]

  return (
    <div className="space-y-6">
      <SectionHiddenBanner visible={sectionVisible} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Statistics Banner</h3>
          <p className="text-sm text-stone-500">Displayed in the stats section and used for hero social proof (rating)</p>
        </div>
        {hasUnsavedChanges && (
          <Button onClick={saveStats} disabled={saving} className="rounded-xl bg-amber-500 hover:bg-amber-600">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        )}
      </div>

      <div className={cn(
        "grid gap-6",
        showPreview ? "lg:grid-cols-[1fr,400px]" : "grid-cols-1"
      )}>
        {/* Editor */}
        <div className="grid sm:grid-cols-2 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.key} className="rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center",
                    `bg-${stat.color}-500/10`
                  )}>
                    <stat.icon className={cn("h-5 w-5", `text-${stat.color}-500`)} />
                  </div>
                  <span className="font-medium text-stone-900 dark:text-white capitalize">
                    {stat.key} Stat
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-500">Value</Label>
                    <Input
                      value={localStats[stat.countKey]}
                      onChange={(e) => setLocalStats({ ...localStats, [stat.countKey]: e.target.value })}
                      className="rounded-xl"
                      placeholder="10K+"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-500">Label</Label>
                    <Input
                      value={localStats[stat.labelKey]}
                      onChange={(e) => setLocalStats({ ...localStats, [stat.labelKey]: e.target.value })}
                      className="rounded-xl"
                      placeholder="Description"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="space-y-4">
            <div className="sticky top-4">
              <div className="rounded-xl bg-stone-100 dark:bg-stone-900 p-4">
                <h4 className="text-sm font-medium text-stone-600 dark:text-stone-400 mb-4 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Live Preview
                </h4>
                <StatsPreview stats={localStats} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ========================
// TESTIMONIALS TAB
// ========================
const TestimonialsTab: React.FC<{
  testimonials: Testimonial[]
  setTestimonials: React.Dispatch<React.SetStateAction<Testimonial[]>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  sectionVisible: boolean
}> = ({ testimonials, setTestimonials, setSaving, sectionVisible }) => {
  const [localTestimonials, setLocalTestimonials] = React.useState<Testimonial[]>(testimonials)
  const [imagePickerOpen, setImagePickerOpen] = React.useState(false)
  const [userPickerOpen, setUserPickerOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [availableUsers, setAvailableUsers] = React.useState<UserProfile[]>([])
  const [userSearchQuery, setUserSearchQuery] = React.useState("")
  const [loadingUsers, setLoadingUsers] = React.useState(false)

  // Sync local testimonials when parent changes
  React.useEffect(() => {
    setLocalTestimonials(testimonials)
  }, [testimonials])

  // Check if there are unsaved changes
  const hasUnsavedChanges = JSON.stringify(localTestimonials) !== JSON.stringify(testimonials)

  // Load available users for linking
  const loadUsers = React.useCallback(async (search?: string) => {
    setLoadingUsers(true)
    try {
      let query = supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .limit(20)
      
      if (search) {
        query = query.ilike("display_name", `%${search}%`)
      }
      
      const { data, error } = await query
      if (data && !error) {
        setAvailableUsers(data)
      }
    } catch (e) {
      console.error("Failed to load users:", e)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  // Load users when user picker opens
  React.useEffect(() => {
    if (userPickerOpen) {
      loadUsers(userSearchQuery)
    }
  }, [userPickerOpen, userSearchQuery, loadUsers])

  const addTestimonial = async () => {
    const newTestimonial: Partial<Testimonial> = {
      position: localTestimonials.length,
      author_name: "New Reviewer",
      author_role: "Plant Enthusiast",
      quote: "This app is amazing!",
      rating: 5,
      is_active: true,
    }

    const { data, error } = await supabase
      .from("landing_testimonials")
      .insert(newTestimonial)
      .select()
      .single()

    if (data && !error) {
      setTestimonials([...testimonials, data])
      setLocalTestimonials([...localTestimonials, data])
    }
  }

  // Update local state only
  const updateLocalTestimonial = (id: string, updates: Partial<Testimonial>) => {
    setLocalTestimonials(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  // Save all changes to database
  const saveAllTestimonials = async () => {
    setSaving(true)
    try {
      for (const testimonial of localTestimonials) {
        const originalTestimonial = testimonials.find(t => t.id === testimonial.id)
        if (originalTestimonial && JSON.stringify(originalTestimonial) !== JSON.stringify(testimonial)) {
          await supabase
            .from("landing_testimonials")
            .update({ ...testimonial, updated_at: new Date().toISOString() })
            .eq("id", testimonial.id)
        }
      }
      setTestimonials(localTestimonials)
    } finally {
      setSaving(false)
    }
  }

  const deleteTestimonial = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return
    const { error } = await supabase
      .from("landing_testimonials")
      .delete()
      .eq("id", id)

    if (!error) {
      setTestimonials(testimonials.filter(t => t.id !== id))
      setLocalTestimonials(localTestimonials.filter(t => t.id !== id))
    }
  }

  // Link a user profile to a testimonial
  const linkUserToTestimonial = (testimonialId: string, user: UserProfile) => {
    updateLocalTestimonial(testimonialId, {
      linked_user_id: user.id,
      author_name: user.display_name,
      author_avatar_url: user.avatar_url,
    })
    setUserPickerOpen(false)
    setEditingId(null)
  }

  // Unlink a user from a testimonial
  const unlinkUser = (testimonialId: string) => {
    updateLocalTestimonial(testimonialId, { linked_user_id: null })
  }

  const editingTestimonial = localTestimonials.find(t => t.id === editingId)

  return (
    <div className="space-y-4">
      <SectionHiddenBanner visible={sectionVisible} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Customer Reviews</h3>
          <p className="text-sm text-stone-500">Testimonials shown in the reviews section</p>
        </div>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <Button onClick={saveAllTestimonials} className="rounded-xl bg-amber-500 hover:bg-amber-600">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
          <Button onClick={addTestimonial} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Review
          </Button>
        </div>
      </div>

      {localTestimonials.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center text-stone-500">
            No testimonials yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localTestimonials.map((testimonial) => (
            <Card key={testimonial.id} className="rounded-xl">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setEditingId(testimonial.id)
                        setImagePickerOpen(true)
                      }}
                      className="relative h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden group"
                    >
                      {testimonial.author_avatar_url ? (
                        <img
                          src={testimonial.author_avatar_url}
                          alt={testimonial.author_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        testimonial.author_name.charAt(0)
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="h-4 w-4 text-white" />
                      </div>
                    </button>
                    <div className="space-y-1">
                      <Input
                        value={testimonial.author_name}
                        onChange={(e) => updateLocalTestimonial(testimonial.id, { author_name: e.target.value })}
                        className="rounded-xl h-8 font-medium"
                        placeholder="Name"
                      />
                      <Input
                        value={testimonial.author_role || ""}
                        onChange={(e) => updateLocalTestimonial(testimonial.id, { author_role: e.target.value })}
                        className="rounded-xl h-7 text-xs"
                        placeholder="Role"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateLocalTestimonial(testimonial.id, { is_active: !testimonial.is_active })}
                      className={cn(
                        "rounded-xl h-8 w-8",
                        testimonial.is_active ? "text-emerald-600 bg-emerald-50" : "text-stone-400"
                      )}
                    >
                      {testimonial.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTestimonial(testimonial.id)}
                      className="rounded-xl h-8 w-8 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => updateLocalTestimonial(testimonial.id, { rating: star })}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-5 w-5 transition-colors",
                          star <= testimonial.rating ? "fill-amber-400 text-amber-400" : "text-stone-300"
                        )}
                      />
                    </button>
                  ))}
                </div>

                <Textarea
                  value={testimonial.quote}
                  onChange={(e) => updateLocalTestimonial(testimonial.id, { quote: e.target.value })}
                  className="rounded-xl"
                  rows={3}
                  placeholder="Review text..."
                />

                {/* Website/Review Link */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500 flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    Website or Review Link
                  </Label>
                  <Input
                    value={testimonial.author_website_url || ""}
                    onChange={(e) => updateLocalTestimonial(testimonial.id, { author_website_url: e.target.value })}
                    className="rounded-xl h-8 text-sm"
                    placeholder="https://example.com or review URL"
                  />
                </div>

                {/* Link to User Profile */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Link to App User
                  </Label>
                  {testimonial.linked_user_id ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">
                        <User className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-emerald-700 dark:text-emerald-300 flex-1">
                        Linked to user profile
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlinkUser(testimonial.id)}
                        className="h-6 px-2 text-xs text-red-500 hover:text-red-600"
                      >
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(testimonial.id)
                        setUserPickerOpen(true)
                      }}
                      className="rounded-xl w-full justify-start text-stone-500"
                    >
                      <User className="h-3.5 w-3.5 mr-2" />
                      Link to existing user...
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImagePickerModal
        open={imagePickerOpen}
        onClose={() => {
          setImagePickerOpen(false)
          setEditingId(null)
        }}
        onSelect={(url) => {
          if (editingId) {
            updateLocalTestimonial(editingId, { author_avatar_url: url })
          }
        }}
        currentImage={editingTestimonial?.author_avatar_url}
      />

      {/* User Picker Modal */}
      {userPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md rounded-xl">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-stone-900 dark:text-white">Link to User Profile</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setUserPickerOpen(false)
                    setEditingId(null)
                    setUserSearchQuery("")
                  }}
                  className="rounded-xl h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="rounded-xl pl-9"
                  placeholder="Search users..."
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {loadingUsers ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-stone-400" />
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="py-8 text-center text-stone-500 text-sm">
                    No users found
                  </div>
                ) : (
                  availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => editingId && linkUserToTestimonial(editingId, user)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                        ) : (
                          user.display_name.charAt(0)
                        )}
                      </div>
                      <span className="font-medium text-stone-900 dark:text-white">{user.display_name}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ========================
// DEMO FEATURES TAB WITH TRANSLATION SUPPORT
// ========================
const DEMO_LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  fr: "Français",
}

const AVAILABLE_ICONS = [
  "Leaf", "Clock", "TrendingUp", "Shield", "Camera", "NotebookPen", 
  "Users", "Sparkles", "Bell", "Heart", "Star", "Zap", "Globe", "Search",
  "BookMarked", "Flower2", "TreeDeciduous", "Sprout", "Sun", "Droplets"
]

const AVAILABLE_COLORS = [
  { name: "emerald", class: "bg-emerald-500" },
  { name: "blue", class: "bg-blue-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "rose", class: "bg-rose-500" },
  { name: "pink", class: "bg-pink-500" },
  { name: "amber", class: "bg-amber-500" },
  { name: "teal", class: "bg-teal-500" },
  { name: "indigo", class: "bg-indigo-500" },
  { name: "red", class: "bg-red-500" },
  { name: "green", class: "bg-green-500" },
]

const DemoFeaturesTab: React.FC<{
  features: DemoFeature[]
  setFeatures: React.Dispatch<React.SetStateAction<DemoFeature[]>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  sectionVisible: boolean
}> = ({ features, setFeatures, setSaving, sectionVisible }) => {
  const [localFeatures, setLocalFeatures] = React.useState<DemoFeature[]>(features)
  const [selectedLang, setSelectedLang] = React.useState<SupportedLanguage>("en")
  const [translations, setTranslations] = React.useState<Record<string, DemoFeatureTranslation>>({})
  const [localTranslations, setLocalTranslations] = React.useState<Record<string, Partial<DemoFeatureTranslation>>>({})
  const [translating, setTranslating] = React.useState(false)
  const [loadingTranslations, setLoadingTranslations] = React.useState(false)

  // Sync local features when parent changes
  React.useEffect(() => {
    setLocalFeatures(features)
  }, [features])

  // Check if there are unsaved changes
  const hasUnsavedChanges = selectedLang === "en" 
    ? JSON.stringify(localFeatures) !== JSON.stringify(features)
    : Object.keys(localTranslations).length > 0

  // Load translations for the selected language
  const loadTranslations = React.useCallback(async (lang: SupportedLanguage) => {
    if (lang === "en") {
      setTranslations({})
      setLocalTranslations({})
      return
    }
    
    setLoadingTranslations(true)
    try {
      const { data, error } = await supabase
        .from("landing_demo_feature_translations")
        .select("*")
        .eq("language", lang)
      
      if (data && !error) {
        const translationMap: Record<string, DemoFeatureTranslation> = {}
        data.forEach((t: DemoFeatureTranslation) => {
          translationMap[t.feature_id] = t
        })
        setTranslations(translationMap)
        setLocalTranslations({})
      }
    } catch (e) {
      console.error("Failed to load translations:", e)
    } finally {
      setLoadingTranslations(false)
    }
  }, [])

  // Load translations when language changes
  React.useEffect(() => {
    loadTranslations(selectedLang)
  }, [selectedLang, loadTranslations])

  // Get the display label for a feature based on selected language
  const getDisplayLabel = (feature: DemoFeature) => {
    if (selectedLang === "en") {
      const localFeature = localFeatures.find(f => f.id === feature.id)
      return localFeature?.label || feature.label
    }
    const localTrans = localTranslations[feature.id]
    const savedTrans = translations[feature.id]
    return localTrans?.label ?? savedTrans?.label ?? feature.label
  }

  const addFeature = async () => {
    const newFeature: Partial<DemoFeature> = {
      position: localFeatures.length,
      icon_name: "Leaf",
      label: "New Feature",
      color: "emerald",
      is_active: true,
    }

    const { data, error } = await supabase
      .from("landing_demo_features")
      .insert(newFeature)
      .select()
      .single()

    if (data && !error) {
      setFeatures([...features, data])
      setLocalFeatures([...localFeatures, data])
    }
  }

  // Update local state only
  const updateLocalFeature = (id: string, updates: Partial<DemoFeature>) => {
    if (selectedLang === "en") {
      setLocalFeatures(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
    } else {
      // Update local translations
      setLocalTranslations(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          label: updates.label ?? prev[id]?.label,
          feature_id: id,
          language: selectedLang,
        }
      }))
    }
  }

  // Save all changes to database
  const saveAllFeatures = async () => {
    setSaving(true)
    try {
      if (selectedLang === "en") {
        // Save English base content
        for (const feature of localFeatures) {
          const originalFeature = features.find(f => f.id === feature.id)
          if (originalFeature && JSON.stringify(originalFeature) !== JSON.stringify(feature)) {
            await supabase
              .from("landing_demo_features")
              .update({ ...feature, updated_at: new Date().toISOString() })
              .eq("id", feature.id)
          }
        }
        setFeatures(localFeatures)
      } else {
        // Save translations
        for (const [featureId, localTrans] of Object.entries(localTranslations)) {
          const existingTranslation = translations[featureId]
          const translationData = {
            feature_id: featureId,
            language: selectedLang,
            label: localTrans.label ?? existingTranslation?.label ?? "",
            updated_at: new Date().toISOString(),
          }
          
          if (existingTranslation) {
            await supabase
              .from("landing_demo_feature_translations")
              .update(translationData)
              .eq("id", existingTranslation.id)
            
            setTranslations(prev => ({
              ...prev,
              [featureId]: { ...existingTranslation, ...translationData }
            }))
          } else {
            const { data, error } = await supabase
              .from("landing_demo_feature_translations")
              .insert(translationData)
              .select()
              .single()
            
            if (data && !error) {
              setTranslations(prev => ({ ...prev, [featureId]: data }))
            }
          }
        }
        setLocalTranslations({})
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteFeature = async (id: string) => {
    if (!confirm("Delete this feature?")) return
    const { error } = await supabase
      .from("landing_demo_features")
      .delete()
      .eq("id", id)

    if (!error) {
      setFeatures(features.filter(f => f.id !== id))
      setLocalFeatures(localFeatures.filter(f => f.id !== id))
    }
  }

  const moveFeature = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === localFeatures.length - 1)) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    const newFeatures = [...localFeatures]
    ;[newFeatures[index], newFeatures[newIndex]] = [newFeatures[newIndex], newFeatures[index]]

    const updates = newFeatures.map((feature, i) => ({ ...feature, position: i }))
    setLocalFeatures(updates)

    // Save position changes immediately
    for (const feature of updates) {
      await supabase
        .from("landing_demo_features")
        .update({ position: feature.position })
        .eq("id", feature.id)
    }
    setFeatures(updates)
  }

  // Translate all features to the selected language using DeepL
  const translateAllFeatures = async () => {
    if (selectedLang === "en") return
    
    setTranslating(true)
    setSaving(true)
    
    try {
      for (const feature of localFeatures) {
        const translatedLabel = await translateText(feature.label, selectedLang, "en")
        
        const existingTranslation = translations[feature.id]
        const translationData = {
          feature_id: feature.id,
          language: selectedLang,
          label: translatedLabel,
          updated_at: new Date().toISOString(),
        }
        
        if (existingTranslation) {
          const { error } = await supabase
            .from("landing_demo_feature_translations")
            .update(translationData)
            .eq("id", existingTranslation.id)
          
          if (error) {
            console.error("Failed to update translation:", error)
            throw error
          }
        } else {
          const { data, error } = await supabase
            .from("landing_demo_feature_translations")
            .insert(translationData)
            .select()
            .single()
          
          if (error) {
            console.error("Failed to insert translation:", error)
            throw error
          }
          
          if (data) {
            setTranslations(prev => ({ ...prev, [feature.id]: data }))
          }
        }
      }
      
      // Reload translations after bulk update
      await loadTranslations(selectedLang)
    } catch (e: unknown) {
      console.error("Translation failed:", e)
      const errorMessage = e instanceof Error ? e.message : "Translation failed. Please try again."
      alert(errorMessage)
    } finally {
      setTranslating(false)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHiddenBanner visible={sectionVisible} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Demo Wheel Features</h3>
          <p className="text-sm text-stone-500">Features shown in the interactive demo wheel</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Save Button */}
          {hasUnsavedChanges && (
            <Button onClick={saveAllFeatures} className="rounded-xl bg-amber-500 hover:bg-amber-600">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}

          {/* Language Selector */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  selectedLang === lang
                    ? "bg-white dark:bg-stone-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                )}
              >
                {DEMO_LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
          
          {/* DeepL Translate Button (only shown for non-English) */}
          {selectedLang !== "en" && (
            <Button
              variant="outline"
              size="sm"
              onClick={translateAllFeatures}
              disabled={translating || localFeatures.length === 0}
              className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
            >
              {translating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Languages className="h-4 w-4 mr-2" />
              )}
              {translating ? "Translating..." : "DeepL Translate All"}
            </Button>
          )}
          
          <Button onClick={addFeature} className="rounded-xl" disabled={selectedLang !== "en"}>
            <Plus className="h-4 w-4 mr-2" />
            Add Feature
          </Button>
        </div>
      </div>

      {/* Language Info Banner */}
      {selectedLang !== "en" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Languages className="h-4 w-4 text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Editing {DEMO_LANGUAGE_LABELS[selectedLang]} translations. Base content is managed in English.
          </span>
        </div>
      )}

      {loadingTranslations ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-2 text-stone-400 animate-spin" />
            <p className="text-stone-500">Loading translations...</p>
          </CardContent>
        </Card>
      ) : localFeatures.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center text-stone-500">
            No features yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {localFeatures.map((feature, index) => {
            const displayLabel = getDisplayLabel(feature)
            const hasTranslation = selectedLang !== "en" && (!!translations[feature.id] || !!localTranslations[feature.id])
            
            return (
              <Card key={feature.id} className="rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Position Controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveFeature(index, "up")}
                        disabled={index === 0 || selectedLang !== "en"}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center justify-center h-6 w-6 text-xs font-medium text-stone-400">
                        {index + 1}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveFeature(index, "down")}
                        disabled={index === localFeatures.length - 1 || selectedLang !== "en"}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Icon Preview */}
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      `bg-${feature.color}-500`
                    )}>
                      <span className="text-white text-lg">
                        {feature.icon_name.charAt(0)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-stone-500 flex items-center gap-1">
                            Label
                            {selectedLang !== "en" && !hasTranslation && (
                              <span className="text-amber-600 dark:text-amber-400">(not translated)</span>
                            )}
                          </Label>
                          <Input
                            value={displayLabel}
                            onChange={(e) => updateLocalFeature(feature.id, { label: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                      
                      {/* Icon and Color selectors (only in English mode) */}
                      {selectedLang === "en" && (
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label className="text-xs text-stone-500">Icon</Label>
                            <select
                              value={feature.icon_name}
                              onChange={(e) => updateLocalFeature(feature.id, { icon_name: e.target.value })}
                              className="w-full h-9 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
                            >
                              {AVAILABLE_ICONS.map(icon => (
                                <option key={icon} value={icon}>{icon}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-stone-500">Color</Label>
                            <div className="flex gap-1 flex-wrap">
                              {AVAILABLE_COLORS.map(color => (
                                <button
                                  key={color.name}
                                  onClick={() => updateLocalFeature(feature.id, { color: color.name })}
                                  className={cn(
                                    "h-6 w-6 rounded-lg transition-all",
                                    color.class,
                                    feature.color === color.name && "ring-2 ring-offset-2 ring-stone-900 dark:ring-white"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateLocalFeature(feature.id, { is_active: !feature.is_active })}
                        disabled={selectedLang !== "en"}
                        className={cn(
                          "rounded-xl",
                          feature.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-stone-400"
                        )}
                      >
                        {feature.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFeature(feature.id)}
                        disabled={selectedLang !== "en"}
                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ========================
// FAQ TAB WITH TRANSLATION SUPPORT
// ========================
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  fr: "Français",
}

const FAQTab: React.FC<{
  items: FAQ[]
  setItems: React.Dispatch<React.SetStateAction<FAQ[]>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  sectionVisible: boolean
}> = ({ items, setItems, setSaving, sectionVisible }) => {
  const [localItems, setLocalItems] = React.useState<FAQ[]>(items)
  const [selectedLang, setSelectedLang] = React.useState<SupportedLanguage>("en")
  const [translations, setTranslations] = React.useState<Record<string, FAQTranslation>>({})
  const [localTranslations, setLocalTranslations] = React.useState<Record<string, Partial<FAQTranslation>>>({})
  const [translating, setTranslating] = React.useState(false)
  const [loadingTranslations, setLoadingTranslations] = React.useState(false)

  // Sync local items when parent changes
  React.useEffect(() => {
    setLocalItems(items)
  }, [items])

  // Check if there are unsaved changes
  const hasUnsavedChanges = selectedLang === "en" 
    ? JSON.stringify(localItems) !== JSON.stringify(items)
    : Object.keys(localTranslations).length > 0

  // Load translations for the selected language
  const loadTranslations = React.useCallback(async (lang: SupportedLanguage) => {
    if (lang === "en") {
      setTranslations({})
      setLocalTranslations({})
      return
    }
    
    setLoadingTranslations(true)
    try {
      const { data, error } = await supabase
        .from("landing_faq_translations")
        .select("*")
        .eq("language", lang)
      
      if (data && !error) {
        const translationMap: Record<string, FAQTranslation> = {}
        data.forEach((t: FAQTranslation) => {
          translationMap[t.faq_id] = t
        })
        setTranslations(translationMap)
        setLocalTranslations({})
      }
    } catch (e) {
      console.error("Failed to load translations:", e)
    } finally {
      setLoadingTranslations(false)
    }
  }, [])

  // Load translations when language changes
  React.useEffect(() => {
    loadTranslations(selectedLang)
  }, [selectedLang, loadTranslations])

  // Get the display content for an FAQ item based on selected language
  const getDisplayContent = (item: FAQ) => {
    if (selectedLang === "en") {
      const localItem = localItems.find(i => i.id === item.id)
      return { question: localItem?.question || item.question, answer: localItem?.answer || item.answer }
    }
    // Check local translations first, then fall back to saved translations
    const localTrans = localTranslations[item.id]
    const savedTrans = translations[item.id]
    return {
      question: localTrans?.question ?? savedTrans?.question ?? item.question,
      answer: localTrans?.answer ?? savedTrans?.answer ?? item.answer,
    }
  }

  const addFAQ = async () => {
    const newFAQ: Partial<FAQ> = {
      position: localItems.length,
      question: "New Question?",
      answer: "Answer goes here...",
      is_active: true,
    }

    const { data, error } = await supabase
      .from("landing_faq")
      .insert(newFAQ)
      .select()
      .single()

    if (data && !error) {
      setItems([...items, data])
      setLocalItems([...localItems, data])
    }
  }

  // Update local state only
  const updateLocalFAQ = (id: string, updates: Partial<FAQ>) => {
    if (selectedLang === "en") {
      setLocalItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    } else {
      // Update local translations
      setLocalTranslations(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          ...updates,
          faq_id: id,
          language: selectedLang,
        }
      }))
    }
  }

  // Save all changes to database
  const saveAllFAQs = async () => {
    setSaving(true)
    try {
      if (selectedLang === "en") {
        // Save English base content
        for (const item of localItems) {
          const originalItem = items.find(i => i.id === item.id)
          if (originalItem && JSON.stringify(originalItem) !== JSON.stringify(item)) {
            await supabase
              .from("landing_faq")
              .update({ ...item, updated_at: new Date().toISOString() })
              .eq("id", item.id)
          }
        }
        setItems(localItems)
      } else {
        // Save translations
        for (const [faqId, localTrans] of Object.entries(localTranslations)) {
          const existingTranslation = translations[faqId]
          const translationData = {
            faq_id: faqId,
            language: selectedLang,
            question: localTrans.question ?? existingTranslation?.question ?? "",
            answer: localTrans.answer ?? existingTranslation?.answer ?? "",
            updated_at: new Date().toISOString(),
          }
          
          if (existingTranslation) {
            await supabase
              .from("landing_faq_translations")
              .update(translationData)
              .eq("id", existingTranslation.id)
            
            setTranslations(prev => ({
              ...prev,
              [faqId]: { ...existingTranslation, ...translationData }
            }))
          } else {
            const { data, error } = await supabase
              .from("landing_faq_translations")
              .insert(translationData)
              .select()
              .single()
            
            if (data && !error) {
              setTranslations(prev => ({ ...prev, [faqId]: data }))
            }
          }
        }
        setLocalTranslations({})
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteFAQ = async (id: string) => {
    if (!confirm("Delete this FAQ? This will also delete all translations.")) return
    const { error } = await supabase
      .from("landing_faq")
      .delete()
      .eq("id", id)

    if (!error) {
      setItems(items.filter(i => i.id !== id))
      setLocalItems(localItems.filter(i => i.id !== id))
      // Remove from translations state
      setTranslations(prev => {
        const newTranslations = { ...prev }
        delete newTranslations[id]
        return newTranslations
      })
      setLocalTranslations(prev => {
        const newTranslations = { ...prev }
        delete newTranslations[id]
        return newTranslations
      })
    }
  }

  const moveFAQ = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === localItems.length - 1)) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    const newItems = [...localItems]
    ;[newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]]

    const updates = newItems.map((item, i) => ({ ...item, position: i }))
    setLocalItems(updates)

    // Save position changes immediately
    for (const item of updates) {
      await supabase
        .from("landing_faq")
        .update({ position: item.position })
        .eq("id", item.id)
    }
    setItems(updates)
  }

  // Translate all FAQs to the selected language using DeepL
  const translateAllFAQs = async () => {
    if (selectedLang === "en") return
    
    setTranslating(true)
    setSaving(true)
    
    try {
      for (const item of localItems) {
        // Translate question and answer from English
        const [translatedQuestion, translatedAnswer] = await Promise.all([
          translateText(item.question, selectedLang, "en"),
          translateText(item.answer, selectedLang, "en"),
        ])
        
        const existingTranslation = translations[item.id]
        const translationData = {
          faq_id: item.id,
          language: selectedLang,
          question: translatedQuestion,
          answer: translatedAnswer,
          updated_at: new Date().toISOString(),
        }
        
        if (existingTranslation) {
          const { error } = await supabase
            .from("landing_faq_translations")
            .update(translationData)
            .eq("id", existingTranslation.id)
          
          if (error) {
            console.error("Failed to update translation:", error)
            if (error.code === "42P01" || error.message?.includes("does not exist")) {
              throw new Error("Translation table not found. Please run the database sync to create landing_faq_translations table.")
            }
            throw error
          }
        } else {
          const { data, error } = await supabase
            .from("landing_faq_translations")
            .insert(translationData)
            .select()
            .single()
          
          if (error) {
            console.error("Failed to insert translation:", error)
            if (error.code === "42P01" || error.message?.includes("does not exist")) {
              throw new Error("Translation table not found. Please run the database sync to create landing_faq_translations table.")
            }
            throw error
          }
          
          if (data) {
            setTranslations(prev => ({ ...prev, [item.id]: data }))
          }
        }
      }
      
      // Reload translations after bulk update
      await loadTranslations(selectedLang)
    } catch (e: unknown) {
      console.error("Translation failed:", e)
      const errorMessage = e instanceof Error ? e.message : "Translation failed. Please try again."
      alert(errorMessage)
    } finally {
      setTranslating(false)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHiddenBanner visible={sectionVisible} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">FAQ Items</h3>
          <p className="text-sm text-stone-500">Questions and answers shown in the FAQ section</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Save Button */}
          {hasUnsavedChanges && (
            <Button onClick={saveAllFAQs} className="rounded-xl bg-amber-500 hover:bg-amber-600">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}

          {/* Language Selector */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  selectedLang === lang
                    ? "bg-white dark:bg-stone-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                )}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
          
          {/* DeepL Translate Button (only shown for non-English) */}
          {selectedLang !== "en" && (
            <Button
              variant="outline"
              size="sm"
              onClick={translateAllFAQs}
              disabled={translating || localItems.length === 0}
              className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
            >
              {translating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Languages className="h-4 w-4 mr-2" />
              )}
              {translating ? "Translating..." : "DeepL Translate All"}
            </Button>
          )}
          
          <Button onClick={addFAQ} className="rounded-xl" disabled={selectedLang !== "en"}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Language Info Banner */}
      {selectedLang !== "en" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Languages className="h-4 w-4 text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Editing {LANGUAGE_LABELS[selectedLang]} translations. Base content is managed in English.
          </span>
        </div>
      )}

      {loadingTranslations ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-2 text-stone-400 animate-spin" />
            <p className="text-stone-500">Loading translations...</p>
          </CardContent>
        </Card>
      ) : localItems.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center text-stone-500">
            No FAQ items yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {localItems.map((item, index) => {
            const displayContent = getDisplayContent(item)
            const hasTranslation = selectedLang !== "en" && (!!translations[item.id] || !!localTranslations[item.id])
            
            return (
              <Card key={item.id} className="rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Position Controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveFAQ(index, "up")}
                        disabled={index === 0 || selectedLang !== "en"}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center justify-center h-6 w-6 text-xs font-medium text-stone-400">
                        {index + 1}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveFAQ(index, "down")}
                        disabled={index === localItems.length - 1 || selectedLang !== "en"}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-stone-500">Question</Label>
                          {selectedLang !== "en" && !hasTranslation && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">(not translated)</span>
                          )}
                        </div>
                        <Input
                          value={displayContent.question}
                          onChange={(e) => updateLocalFAQ(item.id, { question: e.target.value })}
                          className="rounded-xl font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Answer</Label>
                        <Textarea
                          value={displayContent.answer}
                          onChange={(e) => updateLocalFAQ(item.id, { answer: e.target.value })}
                          className="rounded-xl"
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateLocalFAQ(item.id, { is_active: !item.is_active })}
                        disabled={selectedLang !== "en"}
                        className={cn(
                          "rounded-xl",
                          item.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-stone-400"
                        )}
                      >
                        {item.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFAQ(item.id)}
                        disabled={selectedLang !== "en"}
                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
