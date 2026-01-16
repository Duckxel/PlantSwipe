/**
 * Aphylia Chat Types
 * 
 * Types for the in-app AI gardening assistant "Chat with Aphylia".
 * Messages are ephemeral (session-only) and not persisted to database.
 */

// ===== Message Types =====

export type ChatMessageRole = 'user' | 'assistant' | 'system'

export interface ChatAttachment {
  id: string
  type: 'image'
  url: string
  thumbnailUrl?: string
  filename?: string
  /** Local preview URL (blob URL) before upload completes */
  localPreviewUrl?: string
  /** Upload status */
  status: 'uploading' | 'uploaded' | 'error'
  /** Error message if upload failed */
  error?: string
}

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  /** Attached images/files */
  attachments?: ChatAttachment[]
  /** ISO timestamp when created */
  createdAt: string
  /** For assistant messages: whether still streaming */
  isStreaming?: boolean
  /** For assistant messages: any tool calls made */
  toolCalls?: ChatToolCall[]
  /** For assistant messages: whether an error occurred */
  error?: string
}

// ===== Context Types =====

export type ContextChipType = 'garden' | 'plant' | 'task' | 'note'

export interface ContextChip {
  type: ContextChipType
  id: string
  label: string
  /** Additional data specific to the context type */
  data?: Record<string, unknown>
}

export interface GardenMemberContext {
  userId: string
  displayName?: string | null
  role: 'owner' | 'member'
  joinedAt?: string
}

export interface GardenPlantSummary {
  gardenPlantId: string
  plantId: string
  plantName: string
  nickname?: string | null
  healthStatus?: string | null
  plantsOnHand?: number
  seedsPlanted?: number
  taskCount?: number
}

export interface GardenTaskStats {
  totalTasksToday: number
  completedTasksToday: number
  pendingTasksToday: number
  totalTasksThisWeek: number
  completedTasksThisWeek: number
  tasksByType: Record<string, number>
}

export interface GardenTaskSummary {
  taskId?: string
  taskType?: string
  plantName: string
  dueAt: string
  requiredCount?: number
  completedCount?: number
  isCompleted: boolean
}

export interface GardenContext {
  gardenId: string
  gardenName: string
  locationCity?: string | null
  locationCountry?: string | null
  locationTimezone?: string | null
  locationLat?: number | null
  locationLon?: number | null
  plantCount?: number
  memberCount?: number
  /** Total plants currently on hand */
  totalPlantsOnHand?: number
  /** Total seeds planted */
  totalSeedsPlanted?: number
  /** Garden members with basic info */
  members?: GardenMemberContext[]
  /** Summary of plants in the garden */
  plants?: GardenPlantSummary[]
  /** Current task streak */
  streak?: number
  /** Garden privacy setting */
  privacy?: 'public' | 'friends_only' | 'private'
  /** When the garden was created */
  createdAt?: string
  /** Preferred language for advice */
  adviceLanguage?: string | null
  /** Task statistics for today and this week */
  taskStats?: GardenTaskStats
  /** Today's tasks with details */
  todayTasks?: GardenTaskSummary[]
  /** This week's tasks (limited) */
  weekTasks?: GardenTaskSummary[]
}

export interface PlantContext {
  gardenPlantId: string
  plantId: string
  plantName: string
  nickname?: string | null
  healthStatus?: string | null
  notes?: string | null
  scientificName?: string | null
}

export interface TaskContext {
  taskId: string
  taskType: string
  customName?: string | null
  plantName?: string
  dueAt?: string
  completedAt?: string | null
}

export interface UserContext {
  userId: string
  displayName?: string
  language: string
  timezone?: string
  experienceYears?: number
}

export interface ChatContext {
  user: UserContext
  garden?: GardenContext | null
  plants?: PlantContext[]
  tasks?: TaskContext[]
  /** Selected context chips from the UI */
  selectedChips?: ContextChip[]
}

// ===== Quick Actions =====

export type QuickActionId = 
  | 'diagnose'
  | 'watering-schedule'
  | 'weekly-plan'
  | 'summarize-journal'
  | 'plant-care'
  | 'pest-help'
  | 'seasonal-tips'
  | 'companion-plants'

export interface QuickAction {
  id: QuickActionId
  icon: string // emoji
  labelKey: string // i18n key
  /** Whether this action requires a plant to be selected */
  requiresPlant?: boolean
  /** Whether this action requires a garden to be selected */
  requiresGarden?: boolean
  /** Slash command alias */
  slashCommand?: string
}

// ===== Tool Calls (Backend Tools) =====

export type ChatToolType = 
  | 'create_task'
  | 'update_plant_health'
  | 'generate_watering_plan'
  | 'add_journal_entry'
  | 'search_plants'

export interface ChatToolCall {
  id: string
  type: ChatToolType
  status: 'pending' | 'running' | 'completed' | 'error'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
}

// ===== API Types =====

export interface ChatRequestMessage {
  role: ChatMessageRole
  content: string
  /** Image URLs if any */
  imageUrls?: string[]
}

export interface ChatRequest {
  messages: ChatRequestMessage[]
  context: ChatContext
  /** Quick action being invoked */
  quickAction?: QuickActionId
  /** Whether to enable tool calling */
  enableTools?: boolean
  /** Stream the response */
  stream?: boolean
}

export interface ChatResponse {
  message: ChatMessage
  /** Token usage for this response */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ===== Streaming Types =====

export type StreamEventType = 
  | 'start'
  | 'token'
  | 'tool_start'
  | 'tool_end'
  | 'done'
  | 'error'

export interface StreamEvent {
  type: StreamEventType
  /** For 'token' events: the token text */
  token?: string
  /** For 'tool_start'/'tool_end' events: the tool call */
  toolCall?: ChatToolCall
  /** For 'done' events: the complete message */
  message?: ChatMessage
  /** For 'error' events: error details */
  error?: string
  /** For 'done' events: usage info */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ===== Chat State =====

export interface AphyliaChatState {
  /** Whether the chat panel is open */
  isOpen: boolean
  /** Chat messages (ephemeral, session-only) */
  messages: ChatMessage[]
  /** Current input value */
  input: string
  /** Files pending upload */
  pendingAttachments: ChatAttachment[]
  /** Selected context chips */
  selectedChips: ContextChip[]
  /** Whether a message is currently being sent */
  isSending: boolean
  /** Current garden context (if on a garden page) */
  currentGarden?: GardenContext | null
  /** Current plant context (if viewing a plant) */
  currentPlant?: PlantContext | null
  /** Available context chips based on current page */
  availableChips: ContextChip[]
  /** Whether the chat is minimized */
  isMinimized: boolean
}

// ===== Constants =====

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'diagnose',
    icon: '🔍',
    labelKey: 'aphylia.quickActions.diagnose',
    requiresPlant: true,
    slashCommand: '/diagnose'
  },
  {
    id: 'watering-schedule',
    icon: '💧',
    labelKey: 'aphylia.quickActions.wateringSchedule',
    requiresGarden: true,
    slashCommand: '/watering-plan'
  },
  {
    id: 'weekly-plan',
    icon: '📅',
    labelKey: 'aphylia.quickActions.weeklyPlan',
    requiresGarden: true,
    slashCommand: '/weekly-plan'
  },
  {
    id: 'summarize-journal',
    icon: '📝',
    labelKey: 'aphylia.quickActions.summarizeJournal',
    requiresGarden: true,
    slashCommand: '/summarize-journal'
  },
  {
    id: 'plant-care',
    icon: '🌱',
    labelKey: 'aphylia.quickActions.plantCare',
    requiresPlant: true,
    slashCommand: '/care'
  },
  {
    id: 'pest-help',
    icon: '🐛',
    labelKey: 'aphylia.quickActions.pestHelp',
    slashCommand: '/pest-help'
  },
  {
    id: 'seasonal-tips',
    icon: '🍂',
    labelKey: 'aphylia.quickActions.seasonalTips',
    requiresGarden: true,
    slashCommand: '/seasonal'
  },
  {
    id: 'companion-plants',
    icon: '🤝',
    labelKey: 'aphylia.quickActions.companionPlants',
    requiresPlant: true,
    slashCommand: '/companions'
  }
]

export const SLASH_COMMANDS = QUICK_ACTIONS.reduce((acc, action) => {
  if (action.slashCommand) {
    acc[action.slashCommand] = action.id
  }
  return acc
}, {} as Record<string, QuickActionId>)
