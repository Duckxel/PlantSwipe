/**
 * Fake data injected into real page components during the onboarding tutorial.
 * When the tutorial is active, pages use this data instead of fetching from the API.
 * This keeps the tutorial visuals perfectly in sync with real page layouts.
 */

import type { Plant } from '@/types/plant'
import type { Garden } from '@/types/garden'
import type { PlantScan } from '@/types/scan'

// ─── Discovery ───────────────────────────────────────────────────────

export const DEMO_PLANT: Plant = {
  id: 'demo-monstera',
  name: 'Monstera',
  scientificNameSpecies: 'Monstera deliciosa',
  variety: 'Variegata',
  rarity: 'Uncommon',
  season: ['spring', 'summer'],
  plantType: 'climber',
  careLevel: ['easy'],
  sunlight: ['partial_shade'],
  wateringFrequencyWarm: 7,
  wateringFrequencyCold: 14,
  toxicityPets: 'slightly_toxic',
  toxicityHuman: 'slightly_toxic',
  livingSpace: ['indoor'],
  heightCm: 200,
  image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&h=1000&fit=crop',
  images: [{
    url: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&h=1000&fit=crop',
    category: 'discovery',
  }],
  popularity: { likes: 2453 },
}

// ─── Gardens ─────────────────────────────────────────────────────────

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

// ─── Scan ────────────────────────────────────────────────────────────

export const DEMO_SCANS: PlantScan[] = [
  {
    id: 'demo-scan-1',
    userId: 'demo-user',
    imageUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400&h=400&fit=crop',
    apiStatus: 'completed',
    topMatchName: 'Monstera',
    topMatchScientificName: 'Monstera deliciosa',
    topMatchProbability: 0.96,
    suggestions: [],
    matchedPlantId: 'demo-monstera',
    matchedPlant: { id: 'demo-monstera', name: 'Monstera', scientificName: 'Monstera deliciosa' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-scan-2',
    userId: 'demo-user',
    imageUrl: 'https://images.unsplash.com/photo-1611485988300-b7530defb8e2?w=400&h=400&fit=crop',
    apiStatus: 'completed',
    topMatchName: 'Lavender',
    topMatchScientificName: 'Lavandula angustifolia',
    topMatchProbability: 0.89,
    suggestions: [],
    matchedPlantId: 'demo-lavender',
    matchedPlant: { id: 'demo-lavender', name: 'Lavender', scientificName: 'Lavandula angustifolia' },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'demo-scan-3',
    userId: 'demo-user',
    imageUrl: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=400&h=400&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1567748157439-651aca2ff064?w=400&h=400&fit=crop',
    apiStatus: 'completed',
    topMatchName: 'Orchid',
    topMatchScientificName: 'Phalaenopsis',
    topMatchProbability: 0.91,
    suggestions: [],
    matchedPlantId: 'demo-orchid',
    matchedPlant: { id: 'demo-orchid', name: 'Orchid', scientificName: 'Phalaenopsis' },
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date(Date.now() - 345600000).toISOString(),
  },
]

// ─── Categories ──────────────────────────────────────────────────────

export const DEMO_CATEGORY_PREVIEWS: Record<string, Array<{ id: string; name: string; imageUrl: string }>> = {
  cactusSucculent: [
    { id: 'd-1', name: 'Aloe Vera', imageUrl: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=200&h=200&fit=crop' },
    { id: 'd-2', name: 'Echeveria', imageUrl: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=200&h=200&fit=crop' },
  ],
  flowering: [
    { id: 'd-3', name: 'Rose', imageUrl: 'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=200&h=200&fit=crop' },
    { id: 'd-4', name: 'Orchid', imageUrl: 'https://images.unsplash.com/photo-1567748157439-651aca2ff064?w=200&h=200&fit=crop' },
  ],
  vegetable: [
    { id: 'd-5', name: 'Tomato', imageUrl: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=200&h=200&fit=crop' },
  ],
  petSafe: [
    { id: 'd-6', name: 'Spider Plant', imageUrl: 'https://images.unsplash.com/photo-1572688484438-313a56e6dc34?w=200&h=200&fit=crop' },
  ],
  indoor: [
    { id: 'd-7', name: 'Monstera', imageUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=200&h=200&fit=crop' },
  ],
  easyGrowing: [
    { id: 'd-8', name: 'Snake Plant', imageUrl: 'https://images.unsplash.com/photo-1593482892580-e32e47e8bf36?w=200&h=200&fit=crop' },
  ],
}
