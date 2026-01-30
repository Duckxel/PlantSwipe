export type AccentKey =
  | 'emerald'
  | 'crimson'
  | 'royal'
  | 'purple'
  | 'gold'
  | 'coral'
  | 'neon'
  | 'turquoise'

export type AccentOption = {
  key: AccentKey
  label: string
  hsl: string
  hex: string
  foreground: string
}

// Balanced & distinct accent palette
// Each color is visually distinct and serves a different personality
export const ACCENT_OPTIONS: AccentOption[] = [
  { key: 'emerald', label: 'Emerald', hsl: '142 71% 45%', hex: '#22C55E', foreground: '0 0% 98%' },
  { key: 'crimson', label: 'Crimson', hsl: '343 81% 50%', hex: '#E11D48', foreground: '0 0% 98%' },
  { key: 'royal', label: 'Royal Blue', hsl: '217 83% 53%', hex: '#2563EB', foreground: '0 0% 98%' },
  { key: 'purple', label: 'Purple', hsl: '258 83% 58%', hex: '#7C3AED', foreground: '0 0% 98%' },
  { key: 'gold', label: 'Gold', hsl: '38 92% 50%', hex: '#F59E0B', foreground: '0 0% 9%' },
  { key: 'coral', label: 'Coral', hsl: '351 95% 72%', hex: '#FB7185', foreground: '0 0% 9%' },
  { key: 'neon', label: 'Neon Green', hsl: '84 81% 44%', hex: '#84CC16', foreground: '0 0% 9%' },
  { key: 'turquoise', label: 'Turquoise', hsl: '173 80% 40%', hex: '#14B8A6', foreground: '0 0% 98%' },
]

export function getAccentOption(key: AccentKey): AccentOption | undefined {
  return ACCENT_OPTIONS.find((o) => o.key === key)
}

export function getAccentHex(key: AccentKey): string {
  const opt = getAccentOption(key)
  return opt?.hex || '#22C55E' // Default to emerald
}

export function applyAccentByKey(key: AccentKey) {
  const opt = getAccentOption(key)
  if (!opt) return
  try {
    const el = document.documentElement
    el.style.setProperty('--accent', opt.hsl)
    el.style.setProperty('--accent-foreground', opt.foreground)
    el.style.setProperty('--accent-hex', opt.hex)
  } catch {}
}

export function saveAccentKey(key: AccentKey) {
  try {
    localStorage.setItem('plantswipe.accent', key)
  } catch {}
}

export function getSavedAccentKey(): AccentKey | null {
  try {
    const v = localStorage.getItem('plantswipe.accent') as AccentKey | null
    return v && (ACCENT_OPTIONS.some((o) => o.key === v) ? v : null)
  } catch {
    return null
  }
}

export function initAccentFromStorage() {
  const key = getSavedAccentKey()
  if (key) applyAccentByKey(key)
}
