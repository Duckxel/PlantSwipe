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
  Sparkles,
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
  BookMarked,
  Camera,
  NotebookPen,
  Wifi,
  Users,
  Check,
  Clock,
  TrendingUp,
  Shield,
  Heart,
  Globe,
  Zap,
  MessageCircle,
  Flower2,
  TreeDeciduous,
  Sprout,
  Upload,
  Link2,
  Search,
  X,
  ArrowRight,
  Palette,
  Share2,
  Calendar,
  Target,
  Award,
  Lightbulb,
  Download,
  Shuffle,
  ExternalLink,
  Copy,
  Monitor,
  Settings,
  Instagram,
  Twitter,
  Mail,
  Layers,
  GraduationCap,
  CirclePlay,
  Route,
  Grid3X3,
  Quote,
  AlertCircle,
  Languages,
} from "lucide-react"

// Icon mapping for dynamic rendering
const iconMap: Record<string, React.ElementType> = {
  Leaf, Droplets, Sun, Bell, BookMarked, Camera, NotebookPen, Wifi, Users, Check,
  Clock, TrendingUp, Shield, Heart, Globe, Zap, MessageCircle, Flower2,
  TreeDeciduous, Sprout, Star, Sparkles, ImageIcon, Eye, EyeOff, Palette, Share2,
  Calendar, Target, Award, Lightbulb,
}

const availableIcons = Object.keys(iconMap)

const colorOptions = [
  { value: "emerald", label: "Emerald", bg: "bg-emerald-500", text: "text-emerald-500", ring: "ring-emerald-500" },
  { value: "blue", label: "Blue", bg: "bg-blue-500", text: "text-blue-500", ring: "ring-blue-500" },
  { value: "purple", label: "Purple", bg: "bg-purple-500", text: "text-purple-500", ring: "ring-purple-500" },
  { value: "pink", label: "Pink", bg: "bg-pink-500", text: "text-pink-500", ring: "ring-pink-500" },
  { value: "amber", label: "Amber", bg: "bg-amber-500", text: "text-amber-500", ring: "ring-amber-500" },
  { value: "teal", label: "Teal", bg: "bg-teal-500", text: "text-teal-500", ring: "ring-teal-500" },
  { value: "rose", label: "Rose", bg: "bg-rose-500", text: "text-rose-500", ring: "ring-rose-500" },
  { value: "indigo", label: "Indigo", bg: "bg-indigo-500", text: "text-indigo-500", ring: "ring-indigo-500" },
  { value: "orange", label: "Orange", bg: "bg-orange-500", text: "text-orange-500", ring: "ring-orange-500" },
  { value: "cyan", label: "Cyan", bg: "bg-cyan-500", text: "text-cyan-500", ring: "ring-cyan-500" },
]

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

type LandingFeature = {
  id: string
  position: number
  icon_name: string
  title: string
  description: string | null
  color: string
  is_in_circle: boolean
  is_active: boolean
}

type ShowcaseCard = {
  id: string
  position: number
  card_type: string
  icon_name: string | null
  title: string
  description: string | null
  badge_text: string | null
  image_url: string | null
  cover_image_url: string | null
  plant_images: Array<{ url: string; name: string }> | null
  garden_name: string | null
  plants_count: number | null
  species_count: number | null
  streak_count: number | null
  progress_percent: number | null
  link_url: string | null
  color: string
  is_active: boolean
  selected_garden_ids: string[] | null
}

type PublicGardenOption = {
  id: string
  name: string
  coverImageUrl: string | null
  plantCount: number
  streak: number
  ownerDisplayName: string | null
}

type Testimonial = {
  id: string
  position: number
  author_name: string
  author_role: string | null
  author_avatar_url: string | null
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

type LandingTab = "settings" | "hero" | "stats" | "features" | "showcase" | "testimonials" | "faq"

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
// ICON PICKER
// ========================
const IconPicker: React.FC<{
  value: string
  onChange: (value: string) => void
  color?: string
}> = ({ value, onChange, color = "emerald" }) => {
  const [open, setOpen] = React.useState(false)
  const IconComponent = iconMap[value] || Leaf

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "h-12 w-12 rounded-xl flex items-center justify-center transition-all hover:scale-105",
          `bg-${color}-500`
        )}
      >
        <IconComponent className="h-6 w-6 text-white" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 top-full mt-2 left-0 p-3 rounded-xl bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-700">
            <div className="grid grid-cols-5 gap-2 w-[220px]">
              {availableIcons.map((iconName) => {
                const Icon = iconMap[iconName]
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onChange(iconName)
                      setOpen(false)
                    }}
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center transition-all hover:scale-110",
                      value === iconName
                        ? `bg-${color}-500 text-white`
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                    )}
                    title={iconName}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ========================
// COLOR PICKER
// ========================
const ColorPicker: React.FC<{
  value: string
  onChange: (value: string) => void
}> = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false)
  const selectedColor = colorOptions.find(c => c.value === value) || colorOptions[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "h-10 px-3 rounded-xl flex items-center gap-2 transition-all border border-stone-200 dark:border-stone-700 hover:border-emerald-500",
          "bg-white dark:bg-stone-900"
        )}
      >
        <div className={cn("h-5 w-5 rounded-md", selectedColor.bg)} />
        <span className="text-sm text-stone-600 dark:text-stone-400">{selectedColor.label}</span>
        <ChevronDown className="h-4 w-4 text-stone-400 ml-auto" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 top-full mt-2 left-0 p-3 rounded-xl bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-700">
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => {
                    onChange(color.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all hover:scale-110",
                    color.bg,
                    value === color.value && "ring-2 ring-offset-2 ring-stone-900 dark:ring-white"
                  )}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
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
// FEATURE PREVIEW
// ========================
const FeaturePreview: React.FC<{ feature: LandingFeature }> = ({ feature }) => {
  const IconComponent = iconMap[feature.icon_name] || Leaf
  const color = colorOptions.find(c => c.value === feature.color) || colorOptions[0]

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-800 border border-stone-200 dark:border-stone-700">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", color.bg)}>
        <IconComponent className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-stone-900 dark:text-white truncate">
          {feature.title || "Feature Title"}
        </p>
        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
          {feature.description || "Feature description goes here"}
        </p>
      </div>
      {!feature.is_active && (
        <EyeOff className="h-4 w-4 text-stone-400 flex-shrink-0" />
      )}
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
  const [features, setFeatures] = React.useState<LandingFeature[]>([])
  const [showcaseCards, setShowcaseCards] = React.useState<ShowcaseCard[]>([])
  const [testimonials, setTestimonials] = React.useState<Testimonial[]>([])
  const [faqItems, setFaqItems] = React.useState<FAQ[]>([])

  // Load all data
  const loadData = React.useCallback(async () => {
    setLoading(true)
    setSettingsError(null)
    try {
      const [settingsRes, heroRes, statsRes, featuresRes, showcaseRes, testimonialsRes, faqRes] = await Promise.all([
        supabase.from("landing_page_settings").select("*").limit(1).maybeSingle(),
        supabase.from("landing_hero_cards").select("*").order("position"),
        supabase.from("landing_stats").select("*").limit(1).maybeSingle(),
        supabase.from("landing_features").select("*").order("position"),
        supabase.from("landing_showcase_cards").select("*").order("position"),
        supabase.from("landing_testimonials").select("*").order("position"),
        supabase.from("landing_faq").select("*").order("position"),
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
      if (featuresRes.data) setFeatures(featuresRes.data)
      if (showcaseRes.data) setShowcaseCards(showcaseRes.data)
      if (testimonialsRes.data) setTestimonials(testimonialsRes.data)
      if (faqRes.data) setFaqItems(faqRes.data)
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
    { id: "features" as const, label: "Features", icon: Sparkles, count: features.length },
    { id: "showcase" as const, label: "Showcase", icon: Layout, count: showcaseCards.length },
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
          {activeTab === "features" && (
            <FeaturesTab
              features={features}
              setFeatures={setFeatures}
              setSaving={setSaving}
              showPreview={showPreview}
              sectionVisible={settings?.show_features_section ?? true}
            />
          )}
          {activeTab === "showcase" && (
            <ShowcaseTab
              cards={showcaseCards}
              setCards={setShowcaseCards}
              setSaving={setSaving}
              sectionVisible={settings?.show_showcase_section ?? true}
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
  const [activeSection, setActiveSection] = React.useState<"visibility" | "social">("visibility")

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
    if (!localSettings) return
    setLocalSettings({ ...localSettings, [key]: value })
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

  const sectionTabs = [
    { id: "visibility" as const, label: "Section Visibility", icon: Layers, description: "Control which sections appear on the landing page" },
    { id: "social" as const, label: "Social & Contact", icon: Share2, description: "Social media links and contact info" },
  ]

  const visibilityItems = [
    { key: "show_hero_section" as const, label: "Hero Section", description: "Main hero area with headline and phone mockup", icon: Smartphone },
    { key: "show_stats_section" as const, label: "Stats Banner", description: "Statistics banner showing key metrics", icon: BarChart3 },
    { key: "show_beginner_section" as const, label: "Beginner Section", description: "Section encouraging new users", icon: GraduationCap },
    { key: "show_features_section" as const, label: "Features Grid", description: "Feature cards showcasing capabilities", icon: Grid3X3 },
    { key: "show_demo_section" as const, label: "Interactive Demo", description: "Animated demo with rotating features", icon: CirclePlay },
    { key: "show_how_it_works_section" as const, label: "How It Works", description: "Step-by-step guide section", icon: Route },
    { key: "show_showcase_section" as const, label: "Showcase", description: "App showcase bento grid", icon: Layout },
    { key: "show_testimonials_section" as const, label: "Testimonials", description: "Customer reviews and ratings", icon: Quote },
    { key: "show_faq_section" as const, label: "FAQ Section", description: "Frequently asked questions", icon: HelpCircle },
    { key: "show_final_cta_section" as const, label: "Final CTA", description: "Final call-to-action before footer", icon: Megaphone },
  ]

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-500" />
            Global Landing Page Settings
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            Control section visibility and social links. Text content is managed via translation files.
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>

      {/* Section Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all",
              activeSection === tab.id
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Section Content */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          {/* Section Visibility */}
          {activeSection === "visibility" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-700">
                <div>
                  <h4 className="font-semibold text-stone-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-500" />
                    Section Visibility
                  </h4>
                  <p className="text-sm text-stone-500 mt-1">Toggle sections on or off to customize your landing page</p>
                </div>
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

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t border-stone-200 dark:border-stone-700">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    visibilityItems.forEach(item => updateSetting(item.key, true))
                  }}
                  className="rounded-xl"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Show All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    visibilityItems.forEach(item => updateSetting(item.key, false))
                  }}
                  className="rounded-xl"
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide All
                </Button>
              </div>
            </div>
          )}

          {/* Social & Contact Settings */}
          {activeSection === "social" && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-stone-200 dark:border-stone-700">
                <h4 className="font-semibold text-stone-900 dark:text-white flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-emerald-500" />
                  Social Media & Contact
                </h4>
                <p className="text-sm text-stone-500 mt-1">Links displayed in the footer and contact sections</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                    <Instagram className="h-5 w-5 text-pink-500" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Instagram URL</Label>
                    <Input
                      value={localSettings.instagram_url}
                      onChange={(e) => updateSetting("instagram_url", e.target.value)}
                      placeholder="https://instagram.com/your_handle"
                      className="rounded-xl mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                    <Twitter className="h-5 w-5 text-sky-500" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Twitter/X URL</Label>
                    <Input
                      value={localSettings.twitter_url}
                      onChange={(e) => updateSetting("twitter_url", e.target.value)}
                      placeholder="https://twitter.com/your_handle"
                      className="rounded-xl mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Support Email</Label>
                    <Input
                      value={localSettings.support_email}
                      onChange={(e) => updateSetting("support_email", e.target.value)}
                      placeholder="hello@example.com"
                      className="rounded-xl mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
  const [imagePickerOpen, setImagePickerOpen] = React.useState(false)
  const [importPlantOpen, setImportPlantOpen] = React.useState(false)
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null)
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null)

  const addCard = async () => {
    const newCard: Partial<HeroCard> = {
      position: cards.length,
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
      setExpandedCardId(data.id)
    }
  }

  const importFromPlant = async (plant: {
    name: string
    scientific_name: string | null
    image_url: string | null
  }) => {
    const newCard: Partial<HeroCard> = {
      position: cards.length,
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
      setExpandedCardId(data.id)
    }
  }

  const updateCard = async (id: string, updates: Partial<HeroCard>) => {
    setSaving(true)
    const { error } = await supabase
      .from("landing_hero_cards")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (!error) {
      setCards(cards.map(c => c.id === id ? { ...c, ...updates } : c))
    }
    setSaving(false)
  }

  const deleteCard = async (id: string) => {
    if (!confirm("Delete this hero card?")) return
    const { error } = await supabase
      .from("landing_hero_cards")
      .delete()
      .eq("id", id)

    if (!error) {
      setCards(cards.filter(c => c.id !== id))
    }
  }

  const moveCard = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === cards.length - 1)) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    const newCards = [...cards]
    ;[newCards[index], newCards[newIndex]] = [newCards[newIndex], newCards[index]]

    const updates = newCards.map((card, i) => ({ ...card, position: i }))
    setCards(updates)

    for (const card of updates) {
      await supabase
        .from("landing_hero_cards")
        .update({ position: card.position })
        .eq("id", card.id)
    }
  }

  const editingCard = cards.find(c => c.id === editingCardId)

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
            {cards.filter(c => c.is_active).length} active of {cards.length} total
          </p>
        </div>
        <div className="flex gap-2">
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

      {cards.length === 0 ? (
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
            {cards.map((card, index) => (
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
                        disabled={index === cards.length - 1}
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
                          onChange={(e) => updateCard(card.id, { plant_name: e.target.value })}
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
                          onChange={(e) => updateCard(card.id, { plant_scientific_name: e.target.value })}
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
                                  onChange={(e) => updateCard(card.id, { water_frequency: e.target.value })}
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
                                  onChange={(e) => updateCard(card.id, { light_level: e.target.value })}
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
                                onChange={(e) => updateCard(card.id, { reminder_text: e.target.value })}
                                className="rounded-xl h-8"
                                placeholder="e.g., Water in 2 days"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Description (optional)</Label>
                            <Textarea
                              value={card.plant_description || ""}
                              onChange={(e) => updateCard(card.id, { plant_description: e.target.value })}
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
                        onClick={() => updateCard(card.id, { is_active: !card.is_active })}
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
                  {cards.filter(c => c.is_active).length > 0 ? (
                    <HeroCardPreview card={cards.filter(c => c.is_active)[0]} />
                  ) : (
                    <div className="text-center py-8 text-stone-500 text-sm">
                      No active cards to preview
                    </div>
                  )}
                </div>

                {cards.filter(c => c.is_active).length > 1 && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <Shuffle className="h-3 w-3 inline mr-1" />
                      {cards.filter(c => c.is_active).length} cards will rotate on the live page
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
            updateCard(editingCardId, { image_url: url })
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
          <p className="text-sm text-stone-500">Displayed in the stats section below the hero</p>
        </div>
        <Button onClick={saveStats} disabled={saving} className="rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
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
// FEATURES TAB
// ========================
const FeaturesTab: React.FC<{
  features: LandingFeature[]
  setFeatures: React.Dispatch<React.SetStateAction<LandingFeature[]>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  showPreview: boolean
  sectionVisible: boolean
}> = ({ features, setFeatures, setSaving, showPreview, sectionVisible }) => {
  const circleFeatures = features.filter(f => f.is_in_circle)
  const gridFeatures = features.filter(f => !f.is_in_circle)

  const addFeature = async (isCircle: boolean) => {
    const relevantFeatures = isCircle ? circleFeatures : gridFeatures
    const newFeature: Partial<LandingFeature> = {
      position: relevantFeatures.length,
      icon_name: "Leaf",
      title: "New Feature",
      description: "Feature description",
      color: "emerald",
      is_in_circle: isCircle,
      is_active: true,
    }

    const { data, error } = await supabase
      .from("landing_features")
      .insert(newFeature)
      .select()
      .single()

    if (data && !error) {
      setFeatures([...features, data])
    }
  }

  const updateFeature = async (id: string, updates: Partial<LandingFeature>) => {
    setSaving(true)
    const { error } = await supabase
      .from("landing_features")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (!error) {
      setFeatures(features.map(f => f.id === id ? { ...f, ...updates } : f))
    }
    setSaving(false)
  }

  const deleteFeature = async (id: string) => {
    if (!confirm("Delete this feature?")) return
    const { error } = await supabase
      .from("landing_features")
      .delete()
      .eq("id", id)

    if (!error) {
      setFeatures(features.filter(f => f.id !== id))
    }
  }

  const renderFeatureCard = (feature: LandingFeature) => (
    <Card key={feature.id} className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon Picker */}
          <IconPicker
            value={feature.icon_name}
            onChange={(iconName) => updateFeature(feature.id, { icon_name: iconName })}
            color={feature.color}
          />

          {/* Fields */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500">Title</Label>
                <Input
                  value={feature.title}
                  onChange={(e) => updateFeature(feature.id, { title: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500">Color</Label>
                <ColorPicker
                  value={feature.color}
                  onChange={(color) => updateFeature(feature.id, { color })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Description</Label>
              <Input
                value={feature.description || ""}
                onChange={(e) => updateFeature(feature.id, { description: e.target.value })}
                className="rounded-xl"
                placeholder="Brief description..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateFeature(feature.id, { is_active: !feature.is_active })}
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
              className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <SectionHiddenBanner visible={sectionVisible} />

      {/* Circle Features */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Interactive Demo Features</h3>
            <p className="text-sm text-stone-500">Shown in the spinning circle (8 recommended)</p>
          </div>
          <Button onClick={() => addFeature(true)} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Feature
          </Button>
        </div>

        {circleFeatures.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-8 text-center text-stone-500">
              No circle features yet. Add one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className={cn(
            "grid gap-4",
            showPreview ? "lg:grid-cols-[1fr,280px]" : "grid-cols-1"
          )}>
            <div className="space-y-3">
              {circleFeatures.map(renderFeatureCard)}
            </div>
            {showPreview && circleFeatures.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-stone-600 dark:text-stone-400">Preview</h4>
                {circleFeatures.slice(0, 3).map((f) => (
                  <FeaturePreview key={f.id} feature={f} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid Features */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Feature Grid Cards</h3>
            <p className="text-sm text-stone-500">Shown in the bento grid section</p>
          </div>
          <Button onClick={() => addFeature(false)} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Feature
          </Button>
        </div>

        {gridFeatures.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-8 text-center text-stone-500">
              No grid features yet. Add one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {gridFeatures.map(renderFeatureCard)}
          </div>
        )}
      </div>
    </div>
  )
}

// ========================
// SHOWCASE TAB
// ========================
const ShowcaseTab: React.FC<{
  cards: ShowcaseCard[]
  setCards: React.Dispatch<React.SetStateAction<ShowcaseCard[]>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  sectionVisible: boolean
}> = ({ cards, setCards, setSaving, sectionVisible }) => {
  const [imagePickerOpen, setImagePickerOpen] = React.useState(false)
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null)
  const [imagePickerTarget, setImagePickerTarget] = React.useState<"image" | "cover" | "plant">("image")
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null)
  const [publicGardens, setPublicGardens] = React.useState<PublicGardenOption[]>([])
  const [loadingGardens, setLoadingGardens] = React.useState(false)
  const [gardenSelectorOpen, setGardenSelectorOpen] = React.useState<string | null>(null)

  // Fetch public gardens when component mounts
  React.useEffect(() => {
    const fetchPublicGardens = async () => {
      setLoadingGardens(true)
      try {
        const { data, error } = await supabase
          .from('gardens')
          .select('id, name, cover_image_url, streak, created_by')
          .eq('privacy', 'public')
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (!error && data) {
          // Fetch plant counts
          const gardenIds = data.map((g: any) => g.id)
          const { data: plantCounts } = await supabase
            .from('garden_plants')
            .select('garden_id')
            .in('garden_id', gardenIds)
          
          const countByGarden: Record<string, number> = {}
          for (const p of plantCounts || []) {
            countByGarden[p.garden_id] = (countByGarden[p.garden_id] || 0) + 1
          }
          
          // Fetch owner names
          const ownerIds = [...new Set(data.map((g: any) => g.created_by))]
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', ownerIds)
          
          const ownerNames: Record<string, string> = {}
          for (const p of profiles || []) {
            ownerNames[p.id] = p.display_name || ''
          }
          
          setPublicGardens(data.map((g: any) => ({
            id: g.id,
            name: g.name,
            coverImageUrl: g.cover_image_url,
            plantCount: countByGarden[g.id] || 0,
            streak: g.streak || 0,
            ownerDisplayName: ownerNames[g.created_by] || null
          })))
        }
      } catch (e) {
        console.error('Failed to fetch public gardens:', e)
      }
      setLoadingGardens(false)
    }
    fetchPublicGardens()
  }, [])

  const addCard = async () => {
    const newCard: Partial<ShowcaseCard> = {
      position: cards.length,
      card_type: "small",
      icon_name: "Leaf",
      title: "New Card",
      description: "Card description",
      color: "emerald",
      is_active: true,
      plants_count: 12,
      species_count: 8,
      streak_count: 7,
      progress_percent: 85,
      plant_images: [],
      selected_garden_ids: [],
    }

    const { data, error } = await supabase
      .from("landing_showcase_cards")
      .insert(newCard)
      .select()
      .single()

    if (data && !error) {
      setCards([...cards, data])
    }
  }

  const updateCard = async (id: string, updates: Partial<ShowcaseCard>) => {
    setSaving(true)
    const { error } = await supabase
      .from("landing_showcase_cards")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (!error) {
      setCards(cards.map(c => c.id === id ? { ...c, ...updates } : c))
    }
    setSaving(false)
  }

  const deleteCard = async (id: string) => {
    if (!confirm("Delete this showcase card?")) return
    const { error } = await supabase
      .from("landing_showcase_cards")
      .delete()
      .eq("id", id)

    if (!error) {
      setCards(cards.filter(c => c.id !== id))
    }
  }

  const addPlantImage = (cardId: string, url: string) => {
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    const currentImages = card.plant_images || []
    const newImages = [...currentImages, { url, name: `Plant ${currentImages.length + 1}` }]
    updateCard(cardId, { plant_images: newImages })
  }

  const removePlantImage = (cardId: string, index: number) => {
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    const currentImages = card.plant_images || []
    const newImages = currentImages.filter((_, i) => i !== index)
    updateCard(cardId, { plant_images: newImages })
  }

  const toggleGardenSelection = (cardId: string, gardenId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    const currentIds = card.selected_garden_ids || []
    const newIds = currentIds.includes(gardenId)
      ? currentIds.filter(id => id !== gardenId)
      : [...currentIds, gardenId]
    updateCard(cardId, { selected_garden_ids: newIds })
  }

  const getSelectedGardensInfo = (selectedIds: string[] | null) => {
    if (!selectedIds || selectedIds.length === 0) return []
    return publicGardens.filter(g => selectedIds.includes(g.id))
  }

  const editingCard = cards.find(c => c.id === editingCardId)

  return (
    <div className="space-y-4">
      <SectionHiddenBanner visible={sectionVisible} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Showcase Cards</h3>
          <p className="text-sm text-stone-500">Cards in the "Designed for your jungle" section</p>
        </div>
        <Button onClick={addCard} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center text-stone-500">
            No showcase cards yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => {
            const isExpanded = expandedCardId === card.id
            
            return (
            <Card key={card.id} className="rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon Picker */}
                  <IconPicker
                    value={card.icon_name || "Leaf"}
                    onChange={(iconName) => updateCard(card.id, { icon_name: iconName })}
                    color={card.color}
                  />

                  {/* Fields */}
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Title</Label>
                        <Input
                          value={card.title}
                          onChange={(e) => updateCard(card.id, { title: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Type</Label>
                        <select
                          value={card.card_type}
                          onChange={(e) => updateCard(card.id, { card_type: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
                        >
                          <option value="small">Small</option>
                          <option value="large">Large (2-column)</option>
                          <option value="main">Main (Garden Dashboard)</option>
                          <option value="analytics">Analytics</option>
                          <option value="tasks">Tasks List</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Color</Label>
                        <ColorPicker
                          value={card.color}
                          onChange={(color) => updateCard(card.id, { color })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Badge Text</Label>
                        <Input
                          value={card.badge_text || ""}
                          onChange={(e) => updateCard(card.id, { badge_text: e.target.value })}
                          className="rounded-xl"
                          placeholder="Optional badge"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Icon Image</Label>
                        <Button
                          variant="outline"
                          className="w-full rounded-xl justify-start"
                          onClick={() => {
                            setEditingCardId(card.id)
                            setImagePickerTarget("image")
                            setImagePickerOpen(true)
                          }}
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          {card.image_url ? "Change" : "Add"}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-stone-500">Description</Label>
                      <Textarea
                        value={card.description || ""}
                        onChange={(e) => updateCard(card.id, { description: e.target.value })}
                        className="rounded-xl"
                        rows={2}
                      />
                    </div>

                    {/* Expand button for garden/main type */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                      className="rounded-xl text-xs"
                    >
                      {isExpanded ? "Hide Advanced Options" : "Show Advanced Options (Images, Stats)"}
                    </Button>

                    {/* Expanded options for garden-type cards */}
                    {isExpanded && (
                      <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-700">
                        {/* Select Public Gardens */}
                        {card.card_type === "main" && (
                          <div className="space-y-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                  Select Public Gardens to Showcase
                                </Label>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  Choose real gardens to display on the landing page
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-emerald-300"
                                onClick={() => setGardenSelectorOpen(gardenSelectorOpen === card.id ? null : card.id)}
                              >
                                {gardenSelectorOpen === card.id ? "Close" : "Select Gardens"}
                              </Button>
                            </div>

                            {/* Selected Gardens Preview */}
                            {(card.selected_garden_ids && card.selected_garden_ids.length > 0) && (
                              <div className="flex flex-wrap gap-2">
                                {getSelectedGardensInfo(card.selected_garden_ids).map(g => (
                                  <div 
                                    key={g.id} 
                                    className="flex items-center gap-2 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700"
                                  >
                                    {g.coverImageUrl ? (
                                      <img src={g.coverImageUrl} alt={g.name} className="w-6 h-6 rounded object-cover" />
                                    ) : (
                                      <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                                        <Leaf className="h-3 w-3 text-emerald-600" />
                                      </div>
                                    )}
                                    <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{g.name}</span>
                                    <span className="text-xs text-stone-500">{g.plantCount} plants</span>
                                    <button
                                      onClick={() => toggleGardenSelection(card.id, g.id)}
                                      className="text-red-500 hover:text-red-600 ml-1"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Garden Selector Dropdown */}
                            {gardenSelectorOpen === card.id && (
                              <div className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 max-h-64 overflow-y-auto">
                                {loadingGardens ? (
                                  <div className="p-4 text-center text-stone-500">Loading gardens...</div>
                                ) : publicGardens.length === 0 ? (
                                  <div className="p-4 text-center text-stone-500">No public gardens found</div>
                                ) : (
                                  publicGardens.map(garden => {
                                    const isSelected = card.selected_garden_ids?.includes(garden.id)
                                    return (
                                      <button
                                        key={garden.id}
                                        onClick={() => toggleGardenSelection(card.id, garden.id)}
                                        className={`w-full flex items-center gap-3 p-3 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors border-b border-stone-100 dark:border-stone-700 last:border-0 ${
                                          isSelected ? "bg-emerald-50 dark:bg-emerald-900/30" : ""
                                        }`}
                                      >
                                        {garden.coverImageUrl ? (
                                          <img src={garden.coverImageUrl} alt={garden.name} className="w-12 h-12 rounded-lg object-cover" />
                                        ) : (
                                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-800 dark:to-emerald-900 flex items-center justify-center">
                                            <Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                          </div>
                                        )}
                                        <div className="flex-1 text-left">
                                          <div className="font-medium text-stone-800 dark:text-stone-200">{garden.name}</div>
                                          <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
                                            <span>{garden.plantCount} plants</span>
                                            {garden.streak > 0 && <span>🔥 {garden.streak} streak</span>}
                                            {garden.ownerDisplayName && <span>by {garden.ownerDisplayName}</span>}
                                          </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                          isSelected 
                                            ? "bg-emerald-500 border-emerald-500 text-white" 
                                            : "border-stone-300 dark:border-stone-600"
                                        }`}>
                                          {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Manual Override Section */}
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {card.card_type === "main" 
                            ? "If no gardens selected above, these manual settings will be used:"
                            : "Manual settings for this card:"
                          }
                        </div>

                        {/* Cover Image */}
                        <div className="space-y-2">
                          <Label className="text-xs text-stone-500 font-medium">Cover Image (Background)</Label>
                          <div className="flex items-center gap-3">
                            {card.cover_image_url && (
                              <div className="relative w-24 h-16 rounded-lg overflow-hidden">
                                <img src={card.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => updateCard(card.id, { cover_image_url: null })}
                                  className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setEditingCardId(card.id)
                                setImagePickerTarget("cover")
                                setImagePickerOpen(true)
                              }}
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              {card.cover_image_url ? "Change Cover" : "Add Cover Image"}
                            </Button>
                          </div>
                        </div>

                        {/* Garden Name */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-stone-500">Garden Name (for preview)</Label>
                          <Input
                            value={card.garden_name || ""}
                            onChange={(e) => updateCard(card.id, { garden_name: e.target.value })}
                            className="rounded-xl"
                            placeholder="My Indoor Jungle"
                          />
                        </div>

                        {/* Garden Stats */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-500">Plants</Label>
                            <Input
                              type="number"
                              value={card.plants_count || 12}
                              onChange={(e) => updateCard(card.id, { plants_count: parseInt(e.target.value) || 0 })}
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-500">Species</Label>
                            <Input
                              type="number"
                              value={card.species_count || 8}
                              onChange={(e) => updateCard(card.id, { species_count: parseInt(e.target.value) || 0 })}
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-500">Streak</Label>
                            <Input
                              type="number"
                              value={card.streak_count || 7}
                              onChange={(e) => updateCard(card.id, { streak_count: parseInt(e.target.value) || 0 })}
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-500">Progress %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={card.progress_percent || 85}
                              onChange={(e) => updateCard(card.id, { progress_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                              className="rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Plant Images Gallery */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-stone-500 font-medium">Plant Images Gallery</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setEditingCardId(card.id)
                                setImagePickerTarget("plant")
                                setImagePickerOpen(true)
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Plant
                            </Button>
                          </div>
                          {(card.plant_images && card.plant_images.length > 0) ? (
                            <div className="flex flex-wrap gap-2">
                              {card.plant_images.map((img, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden group">
                                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => removePlantImage(card.id, idx)}
                                    className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400">No plant images yet. Add some to show in the garden preview.</p>
                          )}
                        </div>

                        {/* Link URL */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-stone-500">Link URL (optional)</Label>
                          <Input
                            value={card.link_url || ""}
                            onChange={(e) => updateCard(card.id, { link_url: e.target.value })}
                            className="rounded-xl"
                            placeholder="/garden/example"
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
                      onClick={() => updateCard(card.id, { is_active: !card.is_active })}
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
                      className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
      )}

      <ImagePickerModal
        open={imagePickerOpen}
        onClose={() => {
          setImagePickerOpen(false)
          setEditingCardId(null)
        }}
        onSelect={(url) => {
          if (editingCardId) {
            if (imagePickerTarget === "cover") {
              updateCard(editingCardId, { cover_image_url: url })
            } else if (imagePickerTarget === "plant") {
              addPlantImage(editingCardId, url)
            } else {
              updateCard(editingCardId, { image_url: url })
            }
          }
        }}
        currentImage={
          imagePickerTarget === "cover" 
            ? editingCard?.cover_image_url 
            : imagePickerTarget === "plant" 
              ? null 
              : editingCard?.image_url
        }
      />
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
  const [imagePickerOpen, setImagePickerOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const addTestimonial = async () => {
    const newTestimonial: Partial<Testimonial> = {
      position: testimonials.length,
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
    }
  }

  const updateTestimonial = async (id: string, updates: Partial<Testimonial>) => {
    setSaving(true)
    const { error } = await supabase
      .from("landing_testimonials")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (!error) {
      setTestimonials(testimonials.map(t => t.id === id ? { ...t, ...updates } : t))
    }
    setSaving(false)
  }

  const deleteTestimonial = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return
    const { error } = await supabase
      .from("landing_testimonials")
      .delete()
      .eq("id", id)

    if (!error) {
      setTestimonials(testimonials.filter(t => t.id !== id))
    }
  }

  const editingTestimonial = testimonials.find(t => t.id === editingId)

  return (
    <div className="space-y-4">
      <SectionHiddenBanner visible={sectionVisible} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Customer Reviews</h3>
          <p className="text-sm text-stone-500">Testimonials shown in the reviews section</p>
        </div>
        <Button onClick={addTestimonial} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add Review
        </Button>
      </div>

      {testimonials.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center text-stone-500">
            No testimonials yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((testimonial) => (
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
                        onChange={(e) => updateTestimonial(testimonial.id, { author_name: e.target.value })}
                        className="rounded-xl h-8 font-medium"
                        placeholder="Name"
                      />
                      <Input
                        value={testimonial.author_role || ""}
                        onChange={(e) => updateTestimonial(testimonial.id, { author_role: e.target.value })}
                        className="rounded-xl h-7 text-xs"
                        placeholder="Role"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateTestimonial(testimonial.id, { is_active: !testimonial.is_active })}
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
                      onClick={() => updateTestimonial(testimonial.id, { rating: star })}
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
                  onChange={(e) => updateTestimonial(testimonial.id, { quote: e.target.value })}
                  className="rounded-xl"
                  rows={3}
                  placeholder="Review text..."
                />
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
            updateTestimonial(editingId, { author_avatar_url: url })
          }
        }}
        currentImage={editingTestimonial?.author_avatar_url}
      />
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
  const [selectedLang, setSelectedLang] = React.useState<SupportedLanguage>("en")
  const [translations, setTranslations] = React.useState<Record<string, FAQTranslation>>({})
  const [translating, setTranslating] = React.useState(false)
  const [loadingTranslations, setLoadingTranslations] = React.useState(false)

  // Load translations for the selected language
  const loadTranslations = React.useCallback(async (lang: SupportedLanguage) => {
    if (lang === "en") {
      setTranslations({})
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
      return { question: item.question, answer: item.answer }
    }
    const translation = translations[item.id]
    return {
      question: translation?.question || item.question,
      answer: translation?.answer || item.answer,
    }
  }

  const addFAQ = async () => {
    const newFAQ: Partial<FAQ> = {
      position: items.length,
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
    }
  }

  const updateFAQ = async (id: string, updates: Partial<FAQ>) => {
    setSaving(true)
    
    if (selectedLang === "en") {
      // Update base FAQ
      const { error } = await supabase
        .from("landing_faq")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (!error) {
        setItems(items.map(i => i.id === id ? { ...i, ...updates } : i))
      }
    } else {
      // Update or create translation
      const existingTranslation = translations[id]
      const translationData = {
        faq_id: id,
        language: selectedLang,
        question: updates.question ?? existingTranslation?.question ?? "",
        answer: updates.answer ?? existingTranslation?.answer ?? "",
        updated_at: new Date().toISOString(),
      }
      
      if (existingTranslation) {
        // Update existing translation
        const { error } = await supabase
          .from("landing_faq_translations")
          .update(translationData)
          .eq("id", existingTranslation.id)
        
        if (!error) {
          setTranslations(prev => ({
            ...prev,
            [id]: { ...existingTranslation, ...translationData }
          }))
        }
      } else {
        // Insert new translation
        const { data, error } = await supabase
          .from("landing_faq_translations")
          .insert(translationData)
          .select()
          .single()
        
        if (data && !error) {
          setTranslations(prev => ({ ...prev, [id]: data }))
        }
      }
    }
    
    setSaving(false)
  }

  const deleteFAQ = async (id: string) => {
    if (!confirm("Delete this FAQ? This will also delete all translations.")) return
    const { error } = await supabase
      .from("landing_faq")
      .delete()
      .eq("id", id)

    if (!error) {
      setItems(items.filter(i => i.id !== id))
      // Remove from translations state
      setTranslations(prev => {
        const newTranslations = { ...prev }
        delete newTranslations[id]
        return newTranslations
      })
    }
  }

  const moveFAQ = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === items.length - 1)) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    const newItems = [...items]
    ;[newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]]

    const updates = newItems.map((item, i) => ({ ...item, position: i }))
    setItems(updates)

    for (const item of updates) {
      await supabase
        .from("landing_faq")
        .update({ position: item.position })
        .eq("id", item.id)
    }
  }

  // Translate all FAQs to the selected language using DeepL
  const translateAllFAQs = async () => {
    if (selectedLang === "en") return
    
    setTranslating(true)
    setSaving(true)
    
    try {
      for (const item of items) {
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
          await supabase
            .from("landing_faq_translations")
            .update(translationData)
            .eq("id", existingTranslation.id)
        } else {
          const { data } = await supabase
            .from("landing_faq_translations")
            .insert(translationData)
            .select()
            .single()
          
          if (data) {
            setTranslations(prev => ({ ...prev, [item.id]: data }))
          }
        }
      }
      
      // Reload translations after bulk update
      await loadTranslations(selectedLang)
    } catch (e) {
      console.error("Translation failed:", e)
      alert("Translation failed. Please try again.")
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
              disabled={translating || items.length === 0}
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
      ) : items.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center text-stone-500">
            No FAQ items yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const displayContent = getDisplayContent(item)
            const hasTranslation = selectedLang !== "en" && !!translations[item.id]
            
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
                        disabled={index === items.length - 1 || selectedLang !== "en"}
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
                          onChange={(e) => updateFAQ(item.id, { question: e.target.value })}
                          className="rounded-xl font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-stone-500">Answer</Label>
                        <Textarea
                          value={displayContent.answer}
                          onChange={(e) => updateFAQ(item.id, { answer: e.target.value })}
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
                        onClick={() => updateFAQ(item.id, { is_active: !item.is_active })}
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
