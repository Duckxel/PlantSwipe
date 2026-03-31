/**
 * Demo data for the onboarding tutorial.
 *
 * Gardens and scans are faked because a brand-new user has none.
 * Discovery and categories use REAL data already loaded from the DB —
 * no fakes needed for those pages.
 */

import type { Garden } from '@/types/garden'
import type { PlantScan } from '@/types/scan'

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
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-scan-2',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Lavender',
    topMatchScientificName: 'Lavandula angustifolia',
    topMatchProbability: 0.89,
    suggestions: [],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'demo-scan-3',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Basil',
    topMatchScientificName: 'Ocimum basilicum',
    topMatchProbability: 0.93,
    suggestions: [],
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'demo-scan-4',
    userId: 'demo-user',
    imageUrl: '',
    apiStatus: 'completed',
    topMatchName: 'Orchid',
    topMatchScientificName: 'Phalaenopsis',
    topMatchProbability: 0.91,
    suggestions: [],
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date(Date.now() - 345600000).toISOString(),
  },
]
