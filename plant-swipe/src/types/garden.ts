export type GardenRole = "owner" | "member"

export interface Garden {
  id: string
  name: string
  coverImageUrl: string | null
  createdBy: string
  createdAt: string
}

export interface GardenMember {
  gardenId: string
  userId: string
  role: GardenRole
  joinedAt: string
  displayName?: string | null
}

export interface GardenPlant {
  id: string
  gardenId: string
  plantId: string
  nickname: string | null
  seedsPlanted: number
  plantedAt: string | null
  expectedBloomDate: string | null
}

export type GardenPlantEventType = "water" | "fertilize" | "prune" | "harvest" | "note"

export interface GardenPlantEvent {
  id: string
  gardenPlantId: string
  eventType: GardenPlantEventType
  occurredAt: string
  notes: string | null
  nextDueAt: string | null
}

export interface GardenInventoryItem {
  id: string
  gardenId: string
  plantId: string
  seedsOnHand: number
  plantsOnHand: number
}

export type GardenTransactionType = "buy_seeds" | "sell_seeds" | "buy_plants" | "sell_plants"

export interface GardenTransaction {
  id: string
  gardenId: string
  plantId: string
  type: GardenTransactionType
  quantity: number
  occurredAt: string
  notes?: string | null
}

