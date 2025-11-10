export type AccentKey =
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'lime'
  | 'teal'
  | 'cyan'
  | 'orange'
  | 'fuchsia'

export type AccentOption = {
  key: AccentKey
  label: string
  hsl: string
  foreground: string
}

// Preselected vibrant accents aligned with the site's aesthetic (no black/white)
export const ACCENT_OPTIONS: AccentOption[] = [
  { key: 'emerald', label: 'Emerald', hsl: '142 72% 40%', foreground: '0 0% 98%' },
  { key: 'rose', label: 'Rose', hsl: '347 77% 54%', foreground: '0 0% 98%' },
  { key: 'sky', label: 'Sky', hsl: '199 89% 48%', foreground: '0 0% 98%' },
  { key: 'amber', label: 'Amber', hsl: '38 92% 50%', foreground: '0 0% 9%' },
  { key: 'violet', label: 'Violet', hsl: '262 83% 58%', foreground: '0 0% 98%' },
  { key: 'lime', label: 'Lime', hsl: '84 81% 44%', foreground: '0 0% 9%' },
  { key: 'teal', label: 'Teal', hsl: '173 80% 40%', foreground: '0 0% 98%' },
  { key: 'cyan', label: 'Cyan', hsl: '188 94% 42%', foreground: '0 0% 98%' },
  { key: 'orange', label: 'Orange', hsl: '24 95% 53%', foreground: '0 0% 98%' },
  { key: 'fuchsia', label: 'Fuchsia', hsl: '292 84% 61%', foreground: '0 0% 98%' },
]

export function getAccentOption(key: AccentKey): AccentOption | undefined {
  return ACCENT_OPTIONS.find((o) => o.key === key)
}

export function applyAccentByKey(key: AccentKey) {
  const opt = getAccentOption(key)
  if (!opt) return
  try {
    const el = document.documentElement
    el.style.setProperty('--accent', opt.hsl)
    el.style.setProperty('--accent-foreground', opt.foreground)
  } catch {}
}

export function saveAccentKey(key: AccentKey) {
  try {
    localStorage.setItem('aphylia.accent', key)
  } catch {}
}

export function getSavedAccentKey(): AccentKey | null {
  try {
    const v = localStorage.getItem('aphylia.accent') as AccentKey | null
    return v && (ACCENT_OPTIONS.some((o) => o.key === v) ? v : null)
  } catch {
    return null
  }
}

export function initAccentFromStorage() {
  const key = getSavedAccentKey()
  if (key) applyAccentByKey(key)
}

