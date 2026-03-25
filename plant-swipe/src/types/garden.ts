export type GardenRole = "owner" | "member"

export type WaterFreqUnit = 'day' | 'week' | 'month' | 'year'

export type GardenPrivacy = 'public' | 'friends_only' | 'private'

export type GardenType = 'default' | 'beginners' | 'seedling'

export type GardenLivingSpace = 'indoor' | 'outdoor' | 'terrarium' | 'greenhouse'

export type GardenClimate =
  | 'polar' | 'montane' | 'oceanic' | 'degraded_oceanic'
  | 'temperate_continental' | 'mediterranean' | 'tropical_dry'
  | 'tropical_humid' | 'tropical_volcanic' | 'tropical_cyclonic'
  | 'humid_insular' | 'subtropical_humid' | 'equatorial'
  | 'windswept_coastal'

export type GardenUsage =
  | 'decorative' | 'edible' | 'medicinal' | 'aromatic'
  | 'pollinator_friendly' | 'air_purifying'

export interface Garden {
  id: string
  name: string
  coverImageUrl: string | null
  createdBy: string
  createdAt: string
  streak?: number
  privacy: GardenPrivacy
  locationCity?: string | null
  locationCountry?: string | null
  locationTimezone?: string | null
  locationLat?: number | null
  locationLon?: number | null
  preferredLanguage?: string | null
  /** If true, hide the AI chat bubble for this garden */
  hideAiChat?: boolean
  gardenType?: GardenType
  livingSpace?: GardenLivingSpace[]
  climate?: GardenClimate[]
  usage?: GardenUsage[]
  /** Seedling tray dimensions (only when gardenType === 'seedling') */
  trayRows?: number | null
  trayCols?: number | null
}

export interface GardenMember {
  gardenId: string
  userId: string
  role: GardenRole
  joinedAt: string
  displayName?: string | null
  email?: string | null
  accentKey?: string | null
  avatarUrl?: string | null
}

// ===== Seedling Tray =====

export type SeedlingStage = 'empty' | 'sown' | 'germinating' | 'sprouted' | 'ready'

export interface SeedlingTrayCell {
  id: string
  gardenId: string
  position: number
  plantId: string | null
  stage: SeedlingStage
  sowDate: string | null
  lastWatered: string | null
  notes: string
}

export type PlantHealthStatus = 'thriving' | 'healthy' | 'okay' | 'struggling' | 'critical'

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
  healthStatus?: PlantHealthStatus | null
  notes?: string | null
  lastHealthUpdate?: string | null
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
  // Optional emoji/icon to display for this task (used mainly for 'custom')
  emoji?: string | null
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

