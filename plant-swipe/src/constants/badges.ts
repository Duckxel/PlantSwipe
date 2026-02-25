import type { PlantSeason } from "@/types/plant"

export const rarityTone: Record<string, string> = {
  Common: 'bg-emerald-200 dark:bg-emerald-700 text-emerald-900 dark:text-emerald-100',
  Uncommon: 'bg-cyan-200 dark:bg-cyan-700 text-cyan-900 dark:text-cyan-100',
  Rare: 'bg-violet-200 dark:bg-violet-700 text-violet-900 dark:text-violet-100',
  Legendary: 'bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100'
}

export const seasonBadge: Record<string, string> = {
  Spring: 'bg-green-200 dark:bg-green-700 text-green-900 dark:text-green-100',
  Summer: 'bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100',
  Autumn: 'bg-orange-200 dark:bg-orange-700 text-orange-900 dark:text-orange-100',
  Winter: 'bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100',
  spring: 'bg-green-200 dark:bg-green-700 text-green-900 dark:text-green-100',
  summer: 'bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100',
  autumn: 'bg-orange-200 dark:bg-orange-700 text-orange-900 dark:text-orange-100',
  winter: 'bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100',
}