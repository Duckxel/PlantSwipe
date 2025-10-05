export type GardenRole = "owner" | "member"

export type WaterFreqUnit = 'day' | 'week' | 'month' | 'year'

export interface Garden {
  id: string
  name: string
  coverImageUrl: string | null
  createdBy: string
  createdAt: string
  streak?: number
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
  overrideWaterFreqUnit?: WaterFreqUnit | null
  overrideWaterFreqValue?: number | null
  plantsOnHand?: number | null
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

export interface GardenWateringScheduleRow {
  id: string
  gardenPlantId: string
  dueDate: string
  completedAt: string | null
}

export interface GardenTaskRow {
  id: string
  gardenId: string
  day: string
  taskType: 'watering'
  gardenPlantIds: string[]
  success: boolean
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

// ===== Tasks v2 (generic per-plant tasks) =====

export type TaskType = 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'
export type TaskScheduleKind = 'one_time_date' | 'one_time_duration' | 'repeat_duration' | 'repeat_pattern'
export type TaskUnit = 'hour' | 'day' | 'week' | 'month' | 'year'

export interface GardenPlantTask {
  id: string
  gardenId: string
  gardenPlantId: string
  type: TaskType
  customName?: string | null
  scheduleKind: TaskScheduleKind
  // When scheduleKind === 'one_time_date'
  dueAt?: string | null
  // When scheduleKind in one_time_duration | repeat_duration
  intervalAmount?: number | null
  intervalUnit?: TaskUnit | null
  // How many times must the task be done per occurrence/period
  requiredCount: number
  // When scheduleKind === 'repeat_pattern'
  period?: 'week' | 'month' | 'year' | null
  amount?: number | null
  weeklyDays?: number[] | null
  monthlyDays?: number[] | null
  yearlyDays?: string[] | null
  monthlyNthWeekdays?: string[] | null
  createdAt: string
}

export interface GardenPlantTaskOccurrence {
  id: string
  taskId: string
  gardenPlantId: string
  dueAt: string
  requiredCount: number
  completedCount: number
  completedAt?: string | null
}

