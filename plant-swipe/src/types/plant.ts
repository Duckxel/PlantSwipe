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
  // Optional frequency hints from plants table
  waterFreqUnit?: 'day' | 'week' | 'month' | 'year'
  waterFreqValue?: number | null
  waterFreqPeriod?: 'week' | 'month' | 'year'
  waterFreqAmount?: number | null
  // New comprehensive plant fields
  wikipediaLink?: string
  plantFamily?: string
  plantType?: string[]
  plantationType?: string[]
  origins?: string
  whereFound?: string
  size?: string
  floweringPeriod?: string
  plantMonth?: number[]
  lightAmount?: string
  climate?: string
  idealTemperature?: string
  regionOfWorld?: string
  soilType?: string
  meaningAndSignifications?: string
  ecology?: string
  pharmaceutical?: string
  alimentaire?: string
  caringTips?: string
  authorNotes?: string
  propagation?: string
  division?: string
  commonDiseases?: string
}
