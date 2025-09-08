import type { Plant } from "@/types/plant"

// Initial seed data used to populate the client-side database on first run
export const PLANT_SEED: Plant[] = [
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

export const rarityTone: Record<Plant["rarity"], string> = {
  Common: "bg-emerald-100 text-emerald-800",
  Uncommon: "bg-cyan-100 text-cyan-800",
  Rare: "bg-violet-100 text-violet-800",
  Legendary: "bg-amber-100 text-amber-900",
}

export const seasonBadge: Record<string, string> = {
  Spring: "bg-green-100 text-green-800",
  Summer: "bg-yellow-100 text-yellow-800",
  Autumn: "bg-orange-100 text-orange-800",
  Winter: "bg-blue-100 text-blue-800",
}
