import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"
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
  Image,
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
} from "lucide-react"

// Icon mapping for dynamic rendering
const iconMap: Record<string, React.ElementType> = {
  Leaf, Droplets, Sun, Bell, BookMarked, Camera, NotebookPen, Wifi, Users, Check,
  Clock, TrendingUp, Shield, Heart, Globe, Zap, MessageCircle, Flower2,
  TreeDeciduous, Sprout, Star, Sparkles, Image, Eye, EyeOff,
}

const availableIcons = Object.keys(iconMap)

const colorOptions = [
  { value: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  { value: "blue", label: "Blue", bg: "bg-blue-500" },
  { value: "purple", label: "Purple", bg: "bg-purple-500" },
  { value: "pink", label: "Pink", bg: "bg-pink-500" },
  { value: "amber", label: "Amber", bg: "bg-amber-500" },
  { value: "teal", label: "Teal", bg: "bg-teal-500" },
  { value: "rose", label: "Rose", bg: "bg-rose-500" },
  { value: "indigo", label: "Indigo", bg: "bg-indigo-500" },
  { value: "orange", label: "Orange", bg: "bg-orange-500" },
  { value: "cyan", label: "Cyan", bg: "bg-cyan-500" },
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
  color: string
  is_active: boolean
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

// Sub-tab type
type LandingTab = "hero" | "stats" | "features" | "showcase" | "testimonials" | "faq"

export const AdminLandingPanel: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<LandingTab>("hero")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Data states
  const [heroCards, setHeroCards] = React.useState<HeroCard[]>([])
  const [stats, setStats] = React.useState<LandingStats | null>(null)
  const [features, setFeatures] = React.useState<LandingFeature[]>([])
  const [showcaseCards, setShowcaseCards] = React.useState<ShowcaseCard[]>([])
  const [testimonials, setTestimonials] = React.useState<Testimonial[]>([])
  const [faqItems, setFaqItems] = React.useState<FAQ[]>([])

  // Load all data
  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [heroRes, statsRes, featuresRes, showcaseRes, testimonialsRes, faqRes] = await Promise.all([
        supabase.from("landing_hero_cards").select("*").order("position"),
        supabase.from("landing_stats").select("*").limit(1).single(),
        supabase.from("landing_features").select("*").order("position"),
        supabase.from("landing_showcase_cards").select("*").order("position"),
        supabase.from("landing_testimonials").select("*").order("position"),
        supabase.from("landing_faq").select("*").order("position"),
      ])

      if (heroRes.data) setHeroCards(heroRes.data)
      if (statsRes.data) setStats(statsRes.data)
      if (featuresRes.data) setFeatures(featuresRes.data)
      if (showcaseRes.data) setShowcaseCards(showcaseRes.data)
      if (testimonialsRes.data) setTestimonials(testimonialsRes.data)
      if (faqRes.data) setFaqItems(faqRes.data)
    } catch (e) {
      console.error("Failed to load landing data:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const tabs = [
    { id: "hero" as const, label: "Hero Cards", icon: Smartphone },
    { id: "stats" as const, label: "Stats", icon: BarChart3 },
    { id: "features" as const, label: "Features", icon: Sparkles },
    { id: "showcase" as const, label: "Showcase", icon: Layout },
    { id: "testimonials" as const, label: "Reviews", icon: Star },
    { id: "faq" as const, label: "FAQ", icon: HelpCircle },
  ]

  return (
    <div className="space-y-6">
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
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="ml-auto rounded-xl"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          {activeTab === "hero" && (
            <HeroCardsTab
              cards={heroCards}
              setCards={setHeroCards}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === "stats" && (
            <StatsTab
              stats={stats}
              setStats={setStats}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === "features" && (
            <FeaturesTab
              features={features}
              setFeatures={setFeatures}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === "showcase" && (
            <ShowcaseTab
              cards={showcaseCards}
              setCards={setShowcaseCards}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === "testimonials" && (
            <TestimonialsTab
              testimonials={testimonials}
              setTestimonials={setTestimonials}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === "faq" && (
            <FAQTab
              items={faqItems}
              setItems={setFaqItems}
              saving={saving}
              setSaving={setSaving}
            />
          )}
        </>
      )}
    </div>
  )
}

// ========================
// HERO CARDS TAB
// ========================
const HeroCardsTab: React.FC<{
  cards: HeroCard[]
  setCards: React.Dispatch<React.SetStateAction<HeroCard[]>>
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ cards, setCards, saving, setSaving }) => {
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
    
    // Update positions
    const updates = newCards.map((card, i) => ({ ...card, position: i }))
    setCards(updates)
    
    // Save to DB
    for (const card of updates) {
      await supabase
        .from("landing_hero_cards")
        .update({ position: card.position })
        .eq("id", card.id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Hero Section Cards</h3>
          <p className="text-sm text-stone-500">Manage the plant cards shown in the hero section</p>
        </div>
        <Button onClick={addCard} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center text-stone-500">
            No hero cards yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((card, index) => (
            <Card key={card.id} className="rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Position Controls */}
                  <div className="flex flex-col gap-1">
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

                  {/* Card Content */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Plant Name</Label>
                      <Input
                        value={card.plant_name}
                        onChange={(e) => updateCard(card.id, { plant_name: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scientific Name</Label>
                      <Input
                        value={card.plant_scientific_name || ""}
                        onChange={(e) => updateCard(card.id, { plant_scientific_name: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input
                        value={card.image_url || ""}
                        onChange={(e) => updateCard(card.id, { image_url: e.target.value })}
                        placeholder="https://..."
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Water Frequency</Label>
                      <Input
                        value={card.water_frequency}
                        onChange={(e) => updateCard(card.id, { water_frequency: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Light Level</Label>
                      <Input
                        value={card.light_level}
                        onChange={(e) => updateCard(card.id, { light_level: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reminder Text</Label>
                      <Input
                        value={card.reminder_text}
                        onChange={(e) => updateCard(card.id, { reminder_text: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={card.plant_description || ""}
                        onChange={(e) => updateCard(card.id, { plant_description: e.target.value })}
                        className="rounded-xl"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateCard(card.id, { is_active: !card.is_active })}
                      className={cn("rounded-xl", card.is_active ? "text-emerald-600" : "text-stone-400")}
                    >
                      {card.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCard(card.id)}
                      className="rounded-xl text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
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
}> = ({ stats, setStats, saving, setSaving }) => {
  const [localStats, setLocalStats] = React.useState<LandingStats | null>(stats)

  React.useEffect(() => {
    setLocalStats(stats)
  }, [stats])

  const createStats = async () => {
    const newStats: Partial<LandingStats> = {
      plants_count: "10K+",
      plants_label: "Plant Species",
      users_count: "50K+",
      users_label: "Happy Gardeners",
      tasks_count: "100K+",
      tasks_label: "Care Tasks Done",
      rating_value: "4.9",
      rating_label: "App Store Rating",
    }
    
    const { data, error } = await supabase
      .from("landing_stats")
      .insert(newStats)
      .select()
      .single()
    
    if (data && !error) {
      setStats(data)
      setLocalStats(data)
    }
  }

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
        <CardContent className="py-12 text-center">
          <p className="text-stone-500 mb-4">No stats configured yet.</p>
          <Button onClick={createStats} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Initialize Stats
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Landing Page Stats</h3>
          <p className="text-sm text-stone-500">Edit the statistics shown in the stats banner</p>
        </div>
        <Button onClick={saveStats} disabled={saving} className="rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plants Stat */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Leaf className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="font-medium">Plants Stat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={localStats.plants_count}
                  onChange={(e) => setLocalStats({ ...localStats, plants_count: e.target.value })}
                  className="rounded-xl"
                  placeholder="10K+"
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={localStats.plants_label}
                  onChange={(e) => setLocalStats({ ...localStats, plants_label: e.target.value })}
                  className="rounded-xl"
                  placeholder="Plant Species"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Stat */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <span className="font-medium">Users Stat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={localStats.users_count}
                  onChange={(e) => setLocalStats({ ...localStats, users_count: e.target.value })}
                  className="rounded-xl"
                  placeholder="50K+"
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={localStats.users_label}
                  onChange={(e) => setLocalStats({ ...localStats, users_label: e.target.value })}
                  className="rounded-xl"
                  placeholder="Happy Gardeners"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Stat */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-purple-500" />
              </div>
              <span className="font-medium">Tasks Stat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={localStats.tasks_count}
                  onChange={(e) => setLocalStats({ ...localStats, tasks_count: e.target.value })}
                  className="rounded-xl"
                  placeholder="100K+"
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={localStats.tasks_label}
                  onChange={(e) => setLocalStats({ ...localStats, tasks_label: e.target.value })}
                  className="rounded-xl"
                  placeholder="Care Tasks Done"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Stat */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
              <span className="font-medium">Rating Stat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={localStats.rating_value}
                  onChange={(e) => setLocalStats({ ...localStats, rating_value: e.target.value })}
                  className="rounded-xl"
                  placeholder="4.9"
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={localStats.rating_label}
                  onChange={(e) => setLocalStats({ ...localStats, rating_label: e.target.value })}
                  className="rounded-xl"
                  placeholder="App Store Rating"
                />
              </div>
            </div>
          </CardContent>
        </Card>
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
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ features, setFeatures, saving, setSaving }) => {
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
    const { error } = await supabase
      .from("landing_features")
      .delete()
      .eq("id", id)
    
    if (!error) {
      setFeatures(features.filter(f => f.id !== id))
    }
  }

  const renderFeatureCard = (feature: LandingFeature) => {
    const IconComponent = iconMap[feature.icon_name] || Leaf

    return (
      <Card key={feature.id} className="rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", `bg-${feature.color}-500`)}>
              <IconComponent className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={feature.title}
                    onChange={(e) => updateFeature(feature.id, { title: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <select
                    value={feature.icon_name}
                    onChange={(e) => updateFeature(feature.id, { icon_name: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                  >
                    {availableIcons.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <select
                    value={feature.color}
                    onChange={(e) => updateFeature(feature.id, { color: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                  >
                    {colorOptions.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={feature.description || ""}
                    onChange={(e) => updateFeature(feature.id, { description: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateFeature(feature.id, { is_active: !feature.is_active })}
                className={cn("rounded-xl", feature.is_active ? "text-emerald-600" : "text-stone-400")}
              >
                {feature.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteFeature(feature.id)}
                className="rounded-xl text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* Circle Features */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Interactive Demo Features</h3>
            <p className="text-sm text-stone-500">Features shown in the spinning circle (max 6 recommended)</p>
          </div>
          <Button onClick={() => addFeature(true)} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Circle Feature
          </Button>
        </div>
        {circleFeatures.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="py-8 text-center text-stone-500">
              No circle features yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {circleFeatures.map(renderFeatureCard)}
          </div>
        )}
      </div>

      {/* Grid Features */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Feature Grid Cards</h3>
            <p className="text-sm text-stone-500">Features shown in the bento grid section</p>
          </div>
          <Button onClick={() => addFeature(false)} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Grid Feature
          </Button>
        </div>
        {gridFeatures.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="py-8 text-center text-stone-500">
              No grid features yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {gridFeatures.map(renderFeatureCard)}
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}

// ========================
// SHOWCASE TAB
// ========================
const ShowcaseTab: React.FC<{
  cards: ShowcaseCard[]
  setCards: React.Dispatch<React.SetStateAction<ShowcaseCard[]>>
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ cards, setCards, saving, setSaving }) => {
  const addCard = async () => {
    const newCard: Partial<ShowcaseCard> = {
      position: cards.length,
      card_type: "small",
      icon_name: "Leaf",
      title: "New Card",
      description: "Card description",
      color: "emerald",
      is_active: true,
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
    const { error } = await supabase
      .from("landing_showcase_cards")
      .delete()
      .eq("id", id)
    
    if (!error) {
      setCards(cards.filter(c => c.id !== id))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Showcase Cards</h3>
          <p className="text-sm text-stone-500">Cards in the "Designed for your jungle" section</p>
        </div>
        <Button onClick={addCard} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center text-stone-500">
            No showcase cards yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => {
            const IconComponent = card.icon_name ? (iconMap[card.icon_name] || Leaf) : Leaf

            return (
              <Card key={card.id} className="rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0", `bg-${card.color}-500`)}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={card.title}
                          onChange={(e) => updateCard(card.id, { title: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Card Type</Label>
                        <select
                          value={card.card_type}
                          onChange={(e) => updateCard(card.id, { card_type: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                        >
                          <option value="small">Small</option>
                          <option value="large">Large (2-column)</option>
                          <option value="main">Main (Dashboard)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <select
                          value={card.icon_name || "Leaf"}
                          onChange={(e) => updateCard(card.id, { icon_name: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                        >
                          {availableIcons.map(icon => (
                            <option key={icon} value={icon}>{icon}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Color</Label>
                        <select
                          value={card.color}
                          onChange={(e) => updateCard(card.id, { color: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                        >
                          {colorOptions.map(color => (
                            <option key={color.value} value={color.value}>{color.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Badge Text</Label>
                        <Input
                          value={card.badge_text || ""}
                          onChange={(e) => updateCard(card.id, { badge_text: e.target.value })}
                          className="rounded-xl"
                          placeholder="Optional badge"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Image URL</Label>
                        <Input
                          value={card.image_url || ""}
                          onChange={(e) => updateCard(card.id, { image_url: e.target.value })}
                          className="rounded-xl"
                          placeholder="https://..."
                        />
                      </div>
                      <div className="md:col-span-2 lg:col-span-3 space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={card.description || ""}
                          onChange={(e) => updateCard(card.id, { description: e.target.value })}
                          className="rounded-xl"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateCard(card.id, { is_active: !card.is_active })}
                        className={cn("rounded-xl", card.is_active ? "text-emerald-600" : "text-stone-400")}
                      >
                        {card.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCard(card.id)}
                        className="rounded-xl text-red-500"
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

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}

// ========================
// TESTIMONIALS TAB
// ========================
const TestimonialsTab: React.FC<{
  testimonials: Testimonial[]
  setTestimonials: React.Dispatch<React.SetStateAction<Testimonial[]>>
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ testimonials, setTestimonials, saving, setSaving }) => {
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
    const { error } = await supabase
      .from("landing_testimonials")
      .delete()
      .eq("id", id)
    
    if (!error) {
      setTestimonials(testimonials.filter(t => t.id !== id))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Customer Reviews</h3>
          <p className="text-sm text-stone-500">Testimonials shown in the reviews section</p>
        </div>
        <Button onClick={addTestimonial} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add Review
        </Button>
      </div>

      {testimonials.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center text-stone-500">
            No testimonials yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="rounded-xl">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold">
                      {testimonial.author_name.charAt(0)}
                    </div>
                    <div>
                      <Input
                        value={testimonial.author_name}
                        onChange={(e) => updateTestimonial(testimonial.id, { author_name: e.target.value })}
                        className="rounded-xl h-8 font-medium"
                        placeholder="Name"
                      />
                      <Input
                        value={testimonial.author_role || ""}
                        onChange={(e) => updateTestimonial(testimonial.id, { author_role: e.target.value })}
                        className="rounded-xl h-7 text-xs mt-1"
                        placeholder="Role"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateTestimonial(testimonial.id, { is_active: !testimonial.is_active })}
                      className={cn("rounded-xl h-8 w-8", testimonial.is_active ? "text-emerald-600" : "text-stone-400")}
                    >
                      {testimonial.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTestimonial(testimonial.id)}
                      className="rounded-xl h-8 w-8 text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => updateTestimonial(testimonial.id, { rating: star })}
                      className="focus:outline-none"
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

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}

// ========================
// FAQ TAB
// ========================
const FAQTab: React.FC<{
  items: FAQ[]
  setItems: React.Dispatch<React.SetStateAction<FAQ[]>>
  saving: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ items, setItems, saving, setSaving }) => {
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
    const { error } = await supabase
      .from("landing_faq")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
    
    if (!error) {
      setItems(items.map(i => i.id === id ? { ...i, ...updates } : i))
    }
    setSaving(false)
  }

  const deleteFAQ = async (id: string) => {
    const { error } = await supabase
      .from("landing_faq")
      .delete()
      .eq("id", id)
    
    if (!error) {
      setItems(items.filter(i => i.id !== id))
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">FAQ Items</h3>
          <p className="text-sm text-stone-500">Questions and answers shown in the FAQ section</p>
        </div>
        <Button onClick={addFAQ} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center text-stone-500">
            No FAQ items yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
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
                      disabled={index === 0}
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
                      disabled={index === items.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input
                        value={item.question}
                        onChange={(e) => updateFAQ(item.id, { question: e.target.value })}
                        className="rounded-xl font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea
                        value={item.answer}
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
                      className={cn("rounded-xl", item.is_active ? "text-emerald-600" : "text-stone-400")}
                    >
                      {item.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFAQ(item.id)}
                      className="rounded-xl text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}
