import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEnv(name: string, fallback?: string): string {
  // Prefer build-time Vite env; fallback to runtime window.__ENV__ injected by server
  const v = (import.meta as any).env?.[name] ?? (globalThis as any)?.__ENV__?.[name]
  if (typeof v === 'string' && v.length > 0) return v
  if (fallback !== undefined) return fallback
  throw new Error(`Missing environment variable: ${name}`)
}

export function getEnvAny(names: string[], fallback?: string): string {
  for (const n of names) {
    const v = (import.meta as any).env?.[n] ?? (globalThis as any)?.__ENV__?.[n]
    if (typeof v === 'string' && v.length > 0) return v
  }
  if (fallback !== undefined) return fallback
  throw new Error(`Missing environment variable. Tried: ${names.join(', ')}`)
}

export function deriveWaterLevelFromFrequency(
  period?: 'day' | 'week' | 'month' | 'year',
  amountRaw?: number | null
): 'Low' | 'Medium' | 'High' | null {
  if (!period) return null
  const amount = Number(amountRaw || 0)
  if (period === 'day') return 'High'
  if (period === 'week') {
    if (amount >= 3) return 'High'
    if (amount === 2) return 'Medium'
    if (amount <= 1) return 'Low'
  }
  if (period === 'month' || period === 'year') return 'Low'
  return null
}
