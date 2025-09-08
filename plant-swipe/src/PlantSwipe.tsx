import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Search, Leaf, Droplets, SunMedium, Info, X, ChevronLeft, ChevronRight, Sparkles, Grid3X3, ScrollText, LogIn, UserPlus, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// --- Types ---
interface Plant {
  id: string
  name: string
  scientificName: string
  colors: string[]
  seasons: ("Spring" | "Summer" | "Autumn" | "Winter")[]
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary"
  meaning: string
  description: string
  image?: string
  care: {
    sunlight: "Low" | "Medium" | "High"
    water: "Low" | "Medium" | "High"
    soil: string
    difficulty: "Easy" | "Moderate" | "Hard"
  }
  seedsAvailable: boolean
}

// --- Sample Data (replace with your DB later) ---
const PLANTS: Plant[] = [
  {
    id: "rose",
    name: "Rose",
    scientificName: "Rosa spp.",
    colors: ["Red", "Pink", "White", "Yellow", "Orange"],
    seasons: ["Spring", "Summer"],
    rarity: "Common",
    meaning: "Love, admiration, remembrance.",
    description:
      "Classic flowering shrub prized for fragrant blooms. Prefers full sun and well‑drained, rich soil.",
    image:
      "https://images.unsplash.com/photo-1509557964280-ead5b1a3f7b9?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "High", water: "Medium", soil: "Loamy, well‑drained", difficulty: "Moderate" },
    seedsAvailable: true,
  },
  {
    id: "lavender",
    name: "Lavender",
    scientificName: "Lavandula angustifolia",
    colors: ["Purple", "Blue"],
    seasons: ["Summer"],
    rarity: "Common",
    meaning: "Calm, devotion, serenity.",
    description:
      "Mediterranean herb with aromatic spikes. Drought tolerant, great for pollinators and sachets.",
    image:
      "https://images.unsplash.com/photo-1501706362039-c06b2d715385?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "High", water: "Low", soil: "Sandy, well‑drained", difficulty: "Easy" },
    seedsAvailable: true,
  },
  {
    id: "sunflower",
    name: "Sunflower",
    scientificName: "Helianthus annuus",
    colors: ["Yellow", "Orange", "Red"],
    seasons: ["Summer", "Autumn"],
    rarity: "Common",
    meaning: "Happiness, loyalty, longevity.",
    description:
      "Tall annual with large, cheerful flower heads that track the sun. Excellent cut flower.",
    image:
      "https://images.unsplash.com/photo-1466690672306-5f92132f7248?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "High", water: "Medium", soil: "Fertile, well‑drained", difficulty: "Easy" },
    seedsAvailable: true,
  },
  {
    id: "hydrangea",
    name: "Hydrangea",
    scientificName: "Hydrangea macrophylla",
    colors: ["Blue", "Pink", "White", "Purple"],
    seasons: ["Summer"],
    rarity: "Uncommon",
    meaning: "Gratitude, heartfelt emotion.",
    description:
      "Showy shrubs with color‑shifting blooms depending on soil pH. Prefer partial shade and moisture.",
    image:
      "https://images.unsplash.com/photo-1562664385-7096c0b7c54e?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "Medium", water: "High", soil: "Moist, rich", difficulty: "Moderate" },
    seedsAvailable: false,
  },
  {
    id: "monstera",
    name: "Monstera",
    scientificName: "Monstera deliciosa",
    colors: ["Green"],
    seasons: ["Spring", "Summer", "Autumn", "Winter"],
    rarity: "Uncommon",
    meaning: "Growth, exuberance.",
    description:
      "Iconic houseplant with split leaves. Thrives in bright, indirect light and regular humidity.",
    image:
      "https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "Medium", water: "Medium", soil: "Chunky, well‑draining mix", difficulty: "Easy" },
    seedsAvailable: false,
  },
  {
    id: "maple",
    name: "Japanese Maple",
    scientificName: "Acer palmatum",
    colors: ["Red", "Green", "Purple"],
    seasons: ["Spring", "Summer", "Autumn"],
    rarity: "Rare",
    meaning: "Elegance, peace, balance.",
    description:
      "Graceful small tree famed for delicate leaves and fiery autumn color. Likes dappled light.",
    image:
      "https://images.unsplash.com/photo-1519680772-4b6f05b6c763?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "Medium", water: "Medium", soil: "Acidic, well‑drained", difficulty: "Moderate" },
    seedsAvailable: false,
  },
  {
    id: "tulip",
    name: "Tulip",
    scientificName: "Tulipa spp.",
    colors: ["Red", "Yellow", "Purple", "White", "Pink"],
    seasons: ["Spring"],
    rarity: "Common",
    meaning: "Perfect love, cheerfulness.",
    description:
      "Bulbous spring favorite with clean silhouettes. Plant in autumn for spring displays.",
    image:
      "https://images.unsplash.com/photo-1491002052546-bf38f186af17?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "High", water: "Medium", soil: "Well‑drained", difficulty: "Easy" },
    seedsAvailable: true,
  },
  {
    id: "orchid",
    name: "Phalaenopsis Orchid",
    scientificName: "Phalaenopsis spp.",
    colors: ["White", "Pink", "Purple", "Yellow"],
    seasons: ["Spring", "Summer", "Autumn", "Winter"],
    rarity: "Uncommon",
    meaning: "Beauty, refinement.",
    description:
      "Long‑lasting indoor blooms. Likes bright, indirect light and careful watering.",
    image:
      "https://images.unsplash.com/photo-1510502774390-4e5ec1a7512a?q=80&w=1400&auto=format&fit=crop",
    care: { sunlight: "Medium", water: "Low", soil: "Orchid bark mix", difficulty: "Moderate" },
    seedsAvailable: false,
  },
]

// --- Helpers ---
const rarityTone: Record<Plant["rarity"], string> = {
  Common: "bg-emerald-100 text-emerald-800",
  Uncommon: "bg-cyan-100 text-cyan-800",
  Rare: "bg-violet-100 text-violet-800",
  Legendary: "bg-amber-100 text-amber-900",
}

const seasonBadge: Record<string, string> = {
  Spring: "bg-green-100 text-green-800",
  Summer: "bg-yellow-100 text-yellow-800",
  Autumn: "bg-orange-100 text-orange-800",
  Winter: "bg-blue-100 text-blue-800",
}

// --- Main Component ---
export default function PlantSwipe() {
  const [query, setQuery] = useState("")
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [onlySeeds, setOnlySeeds] = useState(false)

  const [index, setIndex] = useState(0)
  const [openInfo, setOpenInfo] = useState<Plant | null>(null)

  const [view, setView] = useState<"swipe" | "gallery" | "search">("swipe")
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")

  const filtered = useMemo(() => {
    return PLANTS.filter((p) => {
      const matchesQ = `${p.name} ${p.scientificName} ${p.meaning} ${p.colors.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesSeason = seasonFilter ? p.seasons.includes(seasonFilter as any) : true
      const matchesColor = colorFilter ? p.colors.map((c) => c.toLowerCase()).includes(colorFilter.toLowerCase()) : true
      const matchesSeeds = onlySeeds ? p.seedsAvailable : true
      return matchesQ && matchesSeason && matchesColor && matchesSeeds
    })
  }, [query, seasonFilter, colorFilter, onlySeeds])

  const current = filtered[index]

  const handlePass = () => {
    if (index < filtered.length - 1) setIndex((i) => i + 1)
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-50 to-stone-100 p-4 md:p-8">
      {/* Header */}
      <header className="max-w-5xl mx-auto flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-green-200 flex items-center justify-center shadow">
          <Leaf className="h-5 w-5" />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">PlantSwipe</h1>

        {/* Nav */}
        <nav className="ml-4 hidden md:flex gap-2">
          <NavPill active={view === 'swipe'} onClick={() => setView('swipe')} icon={<ScrollText className="h-4 w-4" />} label="Swipe" />
          <NavPill active={view === 'gallery'} onClick={() => setView('gallery')} icon={<Grid3X3 className="h-4 w-4" />} label="Gallery" />
          <NavPill active={view === 'search'} onClick={() => setView('search')} icon={<Search className="h-4 w-4" />} label="Search" />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">Prototype</Badge>
          <Button className="rounded-2xl" variant="secondary" onClick={openSignup}>
            <UserPlus className="h-4 w-4 mr-2" /> Sign up
          </Button>
          <Button className="rounded-2xl" variant="default" onClick={openLogin}>
            <LogIn className="h-4 w-4 mr-2" /> Login
          </Button>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="max-w-5xl mx-auto mt-4 md:hidden grid grid-cols-3 gap-2">
        <button onClick={() => setView('swipe')} className={`px-3 py-2 rounded-xl border text-sm ${view==='swipe' ? 'bg-black text-white' : 'bg-white'}`}>Swipe</button>
        <button onClick={() => setView('gallery')} className={`px-3 py-2 rounded-xl border text-sm ${view==='gallery' ? 'bg-black text-white' : 'bg-white'}`}>Gallery</button>
        <button onClick={() => setView('search')} className={`px-3 py-2 rounded-xl border text-sm ${view==='search' ? 'bg-black text-white' : 'bg-white'}`}>Search</button>
      </div>

      {/* Controls (shared filters) */}
      <div className="max-w-5xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <Input
              className="pl-9"
              placeholder="Search name, meaning, color…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIndex(0)
              }}
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto items-center">
          {(["Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeasonFilter((cur) => (cur === s ? null : s))}
              className={`px-3 py-1 rounded-2xl text-sm shadow-sm border ${
                seasonFilter === s ? "bg-black text-white" : "bg-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto items-center">
          {["Red", "Pink", "Yellow", "White", "Purple", "Blue", "Orange", "Green"].map((c) => (
            <button
              key={c}
              onClick={() => setColorFilter((cur) => (cur === c ? null : c))}
              className={`px-3 py-1 rounded-2xl text-sm shadow-sm border ${
                colorFilter === c ? "bg-black text-white" : "bg-white"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setOnlySeeds((v) => !v)}
            className={`px-3 py-1 rounded-2xl text-sm shadow-sm border whitespace-nowrap ${
              onlySeeds ? "bg-emerald-600 text-white" : "bg-white"
            }`}
          >
            Seeds only
          </button>
        </div>
      </div>

      {/* Views */}
      {view === 'swipe' && (
        <SwipeDeck
          current={current}
          index={index}
          setIndex={setIndex}
          filtered={filtered}
          x={x}
          onDragEnd={onDragEnd}
          handleInfo={handleInfo}
          handlePass={handlePass}
        />
      )}

      {view === 'gallery' && (
        <GalleryGrid plants={filtered} onOpen={(p) => setOpenInfo(p)} />
      )}

      {view === 'search' && (
        <SearchPage plants={filtered} openInfo={(p) => setOpenInfo(p)} />
      )}

      {/* Info Sheet */}
      <Sheet open={!!openInfo} onOpenChange={(o) => !o && setOpenInfo(null)}>
        <SheetContent side="bottom" className="max-h-[86vh] overflow-y-auto rounded-t-3xl">
          {openInfo && <PlantDetails plant={openInfo} onClose={() => setOpenInfo(null)} />}
        </SheetContent>
      </Sheet>

      {/* Auth Dialog (Login / Sign up) */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
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
                <Input id="name" type="text" placeholder="Your name" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            {authMode === 'signup' && (
              <div className="grid gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" placeholder="••••••••" />
              </div>
            )}
            <Button className="w-full rounded-2xl">{authMode === 'login' ? 'Continue' : 'Create account'}</Button>
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

      {/* Footer */}
      <footer className="max-w-5xl mx-auto mt-10 text-center text-xs opacity-60">
        Built with React, Tailwind, shadcn/ui & framer‑motion. Swipe, browse the gallery, or search.
      </footer>
    </div>
  )
}

// --- Subcomponents ---
function NavPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-sm shadow-sm ${active ? 'bg-black text-white' : 'bg-white'}`}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function SwipeDeck({ current, index, setIndex, filtered, x, onDragEnd, handleInfo, handlePass }: any) {
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="relative h-[520px]">
        <AnimatePresence initial={false}>
          {current ? (
            <motion.div
              key={current.id + index}
              drag="x"
              style={{ x }}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={onDragEnd}
              initial={{ scale: 0.98, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-0"
            >
              <Card className="h-full rounded-3xl overflow-hidden shadow-xl">
                <div className="h-2/3 relative">
                  {/* Image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${current.image})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${rarityTone[current.rarity]} backdrop-blur bg-opacity-80`}>{current.rarity}</Badge>
                      {current.seasons.map((s: string) => (
                        <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                      ))}
                    </div>
                    <h2 className="text-2xl font-semibold drop-shadow-sm">{current.name}</h2>
                    <p className="opacity-90 text-sm italic">{current.scientificName}</p>
                  </div>
                </div>

                <CardContent className="h-1/3 p-4 flex flex-col gap-3">
                  <p className="text-sm line-clamp-3">{current.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {current.colors.slice(0, 6).map((c: string) => (
                      <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <Button variant="secondary" className="rounded-2xl" onClick={handlePass}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Pass
                    </Button>
                    <div className="text-xs opacity-60 select-none">Swipe: left = pass, right = info</div>
                    <Button className="rounded-2xl" onClick={handleInfo}>
                      More info <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <EmptyState onReset={() => setIndex(0)} />
          )}
        </AnimatePresence>
      </div>

      {/* Action Hints */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ActionHint label="Pass" icon={<X className="h-5 w-5" />} />
        <ActionHint label="More info" icon={<Info className="h-5 w-5" />} />
      </div>
    </div>
  )
}

function GalleryGrid({ plants, onOpen }: { plants: Plant[]; onOpen: (p: Plant) => void }) {
  return (
    <div className="max-w-5xl mx-auto mt-8">
      <div className="text-sm opacity-60 mb-3">{plants.length} result{plants.length !== 1 ? 's' : ''}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {plants.map((p) => (
          <button key={p.id} onClick={() => onOpen(p)} className="text-left">
            <Card className="rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${p.image})` }} />
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${rarityTone[p.rarity]} rounded-xl`}>{p.rarity}</Badge>
                  {p.seasons.slice(0, 1).map((s) => (
                    <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                  ))}
                </div>
                <div className="font-medium text-sm leading-tight">{p.name}</div>
                <div className="text-xs opacity-60 italic leading-tight">{p.scientificName}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
      {plants.length === 0 && (
        <EmptyState onReset={() => {}} />
      )}
    </div>
  )
}

function SearchPage({ plants, openInfo }: { plants: Plant[]; openInfo: (p: Plant) => void }) {
  return (
    <div className="max-w-5xl mx-auto mt-8">
      <div className="flex items-center gap-2 text-sm mb-3">
        <ListFilter className="h-4 w-4" />
        <span className="opacity-60">Refine with filters above. Click a card for full details.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((p) => (
          <Card key={p.id} className="rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 gap-0">
              <button onClick={() => openInfo(p)} className="col-span-1 h-36 bg-cover bg-center" style={{ backgroundImage: `url(${p.image})` }} />
              <div className="col-span-2 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${rarityTone[p.rarity]} rounded-xl`}>{p.rarity}</Badge>
                  {p.seasons.map((s) => (
                    <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                  ))}
                </div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs italic opacity-60">{p.scientificName}</div>
                <p className="text-sm mt-1 line-clamp-2">{p.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.colors.map((c) => (
                    <Badge key={c} variant="secondary" className="rounded-xl text-[11px]">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {plants.length === 0 && <EmptyState onReset={() => {}} />}
    </div>
  )
}

function ActionHint({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow border">
      <div className="h-8 w-8 rounded-xl bg-stone-100 flex items-center justify-center">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <Card className="rounded-3xl p-8 text-center">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5" /> No results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm opacity-70 max-w-md mx-auto">
          Try another search or adjust your filters.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" className="rounded-2xl" onClick={onReset}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PlantDetails({ plant, onClose }: { plant: Plant; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle className="text-xl">{plant.name}</SheetTitle>
        <SheetDescription className="italic">{plant.scientificName}</SheetDescription>
      </SheetHeader>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden shadow">
        <div
          className="h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${plant.image})` }}
        />
      </div>

      {/* Quick facts */}
      <div className="grid md:grid-cols-3 gap-3">
        <Fact icon={<SunMedium className="h-4 w-4" />} label="Sunlight" value={plant.care.sunlight} />
        <Fact icon={<Droplets className="h-4 w-4" />} label="Water" value={plant.care.water} />
        <Fact icon={<Leaf className="h-4 w-4" />} label="Difficulty" value={plant.care.difficulty} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{plant.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge className={`${rarityTone[plant.rarity]} rounded-xl`}>{plant.rarity}</Badge>
            {plant.seasons.map((s) => (
              <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
            ))}
            {plant.colors.map((c) => (
              <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Meaning</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{plant.meaning}</CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Care Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="font-medium">Sunlight:</span> {plant.care.sunlight}</div>
          <div><span className="font-medium">Water:</span> {plant.care.water}</div>
          <div><span className="font-medium">Soil:</span> {plant.care.soil}</div>
          <div><span className="font-medium">Difficulty:</span> {plant.care.difficulty}</div>
          <div><span className="font-medium">Seeds available:</span> {plant.seedsAvailable ? "Yes" : "No"}</div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="rounded-2xl" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
      <div className="h-9 w-9 rounded-xl bg-stone-100 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-xs opacity-60">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}
