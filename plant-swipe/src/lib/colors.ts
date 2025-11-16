const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const NAMED_COLOR_MAP: Record<string, string> = {
  red: "#f87171",
  orange: "#fb923c",
  yellow: "#facc15",
  green: "#34d399",
  blue: "#60a5fa",
  purple: "#c084fc",
  pink: "#f472b6",
  white: "#e5e7eb",
  black: "#1f2937",
  brown: "#b45309",
  bronze: "#b45309",
  gold: "#fbbf24",
  silver: "#a1a1aa",
  teal: "#14b8a6",
  indigo: "#6366f1",
  cyan: "#22d3ee",
  magenta: "#d946ef",
}

export const DEFAULT_PLANT_COLOR = "#34d399"

export function resolveColorValue(value?: string | null, fallback = DEFAULT_PLANT_COLOR): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  if (HEX_COLOR_REGEX.test(trimmed)) return trimmed
  const normalized = trimmed.toLowerCase()
  if (NAMED_COLOR_MAP[normalized]) return NAMED_COLOR_MAP[normalized]
  const firstWord = normalized.split(/[\s/-]+/)[0]
  if (NAMED_COLOR_MAP[firstWord]) return NAMED_COLOR_MAP[firstWord]
  return trimmed
}

export { NAMED_COLOR_MAP }
