import Dexie, { Table } from 'dexie'
// Local Dexie remains for app data; Supabase handles auth and profiles
import type { Plant } from '@/types/plant'
import { PLANT_SEED } from '@/data/plants'

class PlantDB extends Dexie {
  plants!: Table<Plant, string>
  constructor() {
    super('PlantSwipeDB')
    this.version(1).stores({ plants: 'id,name,scientificName,rarity' })
  }
}

export const db = new PlantDB()

// Seed only if empty
export async function ensureSeed() {
  const count = await db.plants.count()
  if (count === 0) {
    await db.plants.bulkAdd(PLANT_SEED)
  }
}
