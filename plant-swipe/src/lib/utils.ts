import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEnv(name: string, fallback?: string): string {
  const v = (import.meta as any).env?.[name]
  if (typeof v === 'string' && v.length > 0) return v
  if (fallback !== undefined) return fallback
  throw new Error(`Missing environment variable: ${name}`)
}

export function getEnvAny(names: string[], fallback?: string): string {
  for (const n of names) {
    const v = (import.meta as any).env?.[n]
    if (typeof v === 'string' && v.length > 0) return v
  }
  if (fallback !== undefined) return fallback
  throw new Error(`Missing environment variable. Tried: ${names.join(', ')}`)
}
