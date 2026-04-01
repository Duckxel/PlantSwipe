/**
 * Demo data for the onboarding tutorial.
 *
 * Gardens and scans are faked because a brand-new user has none.
 * Discovery and categories use REAL data already loaded from the DB.
 *
 * Canonical plant IDs used across the tutorial:
 *   Monstera  — 43cd0d55-e799-4f2b-99fd-8dd7c7940530
 *   Basil     — 688b2126-ed89-4369-91b6-df898683f105
 *   Lily      — fc3c2bc4-39ba-4ec1-bdab-0d3a490460e6
 *   Aphyllante — 58510c83-2ef0-4247-8e3d-e564f72f8c34
 */

import type { Garden } from '@/types/garden'
import type { PlantScan } from '@/types/scan'

// ─── Canonical plant IDs ────────────────────────────────────────────

export const DEMO_PLANT_IDS = {
  monstera: '43cd0d55-e799-4f2b-99fd-8dd7c7940530',
  basil: '688b2126-ed89-4369-91b6-df898683f105',
  lily: 'fc3c2bc4-39ba-4ec1-bdab-0d3a490460e6',
  aphyllante: '58510c83-2ef0-4247-8e3d-e564f72f8c34',
} as const

// ─── Gardens (new users have zero) ──────────────────────────────────

const now = new Date().toISOString()

export const DEMO_GARDENS: Garden[] = [
  {
    id: 'demo-garden-1',
    name: 'My Balcony Garden',
    coverImageUrl: null,
    createdBy: 'demo-user',
    createdAt: now,
    streak: 7,
    privacy: 'public',
    gardenType: 'default',
    livingSpace: ['outdoor'],
  },
  {
    id: 'demo-garden-2',
    name: 'Indoor Plants',
    coverImageUrl: null,
    createdBy: 'demo-user',
    createdAt: now,
    streak: 3,
    privacy: 'public',
    gardenType: 'beginners',
    livingSpace: ['indoor'],
  },
  {
    id: 'demo-garden-3',
    name: 'Herb Garden',
    coverImageUrl: null,
    createdBy: 'demo-user',
    createdAt: now,
    streak: 12,
    privacy: 'public',
    gardenType: 'default',
    livingSpace: ['outdoor'],
  },
]

export const DEMO_GARDEN_PROGRESS: Record<string, { due: number; completed: number }> = {
  'demo-garden-1': { due: 5, completed: 3 },
  'demo-garden-2': { due: 3, completed: 2 },
  'demo-garden-3': { due: 4, completed: 4 },
}

export const DEMO_GARDEN_MEMBER_COUNTS: Record<string, number> = {
  'demo-garden-1': 2,
  'demo-garden-2': 1,
  'demo-garden-3': 1,
}

// ─── Scans (new users have zero) ────────────────────────────────────
// imageUrl left empty — ScanPage enriches them with real images from DB

export const DEMO_SCANS: PlantScan[] = [
  {
    id: 'demo-scan-1',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Monstera',
    topMatchScientificName: 'Monstera deliciosa',
    topMatchProbability: 0.96,
    suggestions: [],
    matchedPlantId: DEMO_PLANT_IDS.monstera,
    matchedPlant: { id: DEMO_PLANT_IDS.monstera, name: 'Monstera', scientificName: 'Monstera deliciosa' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-scan-2',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Basil',
    topMatchScientificName: 'Ocimum basilicum',
    topMatchProbability: 0.93,
    suggestions: [],
    matchedPlantId: DEMO_PLANT_IDS.basil,
    matchedPlant: { id: DEMO_PLANT_IDS.basil, name: 'Basil', scientificName: 'Ocimum basilicum' },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'demo-scan-3',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Lily',
    topMatchScientificName: 'Lilium',
    topMatchProbability: 0.89,
    suggestions: [],
    matchedPlantId: DEMO_PLANT_IDS.lily,
    matchedPlant: { id: DEMO_PLANT_IDS.lily, name: 'Lily', scientificName: 'Lilium' },
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'demo-scan-4',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Aphyllante',
    topMatchScientificName: 'Aphyllanthes monspeliensis',
    topMatchProbability: 0.91,
    suggestions: [],
    matchedPlantId: DEMO_PLANT_IDS.aphyllante,
    matchedPlant: { id: DEMO_PLANT_IDS.aphyllante, name: 'Aphyllante', scientificName: 'Aphyllanthes monspeliensis' },
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date(Date.now() - 345600000).toISOString(),
  },
]
