export interface Plant {
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
