import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabaseClient'
import {
  Palette,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Star,
  Link as LinkIcon,
  Languages,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  MoreVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'
import { translateText } from '@/lib/deepl'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@/lib/i18n'

// Types
type ColorTranslation = {
  language: SupportedLanguage
  name: string
}

type ColorData = {
  id: string
  name: string
  hexCode: string | null
  isPrimary: boolean
  parentIds: string[]
  translations: ColorTranslation[]
  createdAt: string
  updatedAt: string
}

type ColorFormData = {
  name: string
  hexCode: string
  isPrimary: boolean
  parentIds: string[]
  translations: ColorTranslation[]
}

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    // Try 3-digit hex
    const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex)
    if (shortResult) {
      return {
        r: parseInt(shortResult[1] + shortResult[1], 16),
        g: parseInt(shortResult[2] + shortResult[2], 16),
        b: parseInt(shortResult[3] + shortResult[3], 16),
      }
    }
    return null
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

// Calculate color distance (simple Euclidean distance in RGB space)
function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  if (!rgb1 || !rgb2) return Infinity
  const dr = rgb1.r - rgb2.r
  const dg = rgb1.g - rgb2.g
  const db = rgb1.b - rgb2.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// Normalize hex code
function normalizeHex(hex: string): string {
  if (!hex) return ''
  const trimmed = hex.trim()
  if (!trimmed.startsWith('#')) return '#' + trimmed
  return trimmed
}

// Validate hex code
function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)
}

// Get contrast color for text on background
function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000000'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// Convert RGB to HSL and return hue (0-360)
function getHue(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  
  let hue = 0
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6
    } else if (max === g) {
      hue = (b - r) / delta + 2
    } else {
      hue = (r - g) / delta + 4
    }
    hue = Math.round(hue * 60)
    if (hue < 0) hue += 360
  }
  
  return hue
}

export const AdminColorsPanel: React.FC = () => {
  const [colors, setColors] = React.useState<ColorData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [filterPrimary, setFilterPrimary] = React.useState<'all' | 'primary' | 'advanced'>('all')
  
  // Sheet state for editing
  const [editSheetOpen, setEditSheetOpen] = React.useState(false)
  const [editingColor, setEditingColor] = React.useState<ColorData | null>(null)
  const [formData, setFormData] = React.useState<ColorFormData>({
    name: '',
    hexCode: '#',
    isPrimary: false,
    parentIds: [],
    translations: [],
  })
  const [saving, setSaving] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [similarColors, setSimilarColors] = React.useState<ColorData[]>([])
  const [showTranslations, setShowTranslations] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  // Load colors from database
  const loadColors = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Load colors
      const { data: colorData, error: colorError } = await supabase
        .from('colors')
        .select('id, name, hex_code, is_primary, parent_ids, created_at, updated_at')
        .order('name', { ascending: true })

      if (colorError) throw colorError

      // Load translations
      const { data: translationData, error: translationError } = await supabase
        .from('color_translations')
        .select('color_id, language, name')

      if (translationError) {
        console.warn('Color translations table may not exist yet:', translationError)
      }

      const translationMap = new Map<string, ColorTranslation[]>()
      if (translationData) {
        translationData.forEach((t: { color_id: string; language: string; name: string }) => {
          if (!translationMap.has(t.color_id)) {
            translationMap.set(t.color_id, [])
          }
          translationMap.get(t.color_id)!.push({
            language: t.language as SupportedLanguage,
            name: t.name,
          })
        })
      }

      const mappedColors: ColorData[] = (colorData || []).map((c: any) => ({
        id: c.id,
        name: c.name || '',
        hexCode: c.hex_code || null,
        isPrimary: c.is_primary || false,
        parentIds: c.parent_ids || [],
        translations: translationMap.get(c.id) || [],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }))

      setColors(mappedColors)
    } catch (e: any) {
      console.error('Error loading colors:', e)
      setError(e?.message || 'Failed to load colors')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadColors()
  }, [loadColors])

  // Filter colors based on search and filter, sorted by hue
  const filteredColors = React.useMemo(() => {
    let result = colors

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((c) => 
        c.name.toLowerCase().includes(query) ||
        c.hexCode?.toLowerCase().includes(query) ||
        c.translations.some((t) => t.name.toLowerCase().includes(query))
      )
    }

    // Filter by primary/advanced
    if (filterPrimary === 'primary') {
      result = result.filter((c) => c.isPrimary)
    } else if (filterPrimary === 'advanced') {
      result = result.filter((c) => !c.isPrimary)
    }

    // Sort by hue value (gradient order)
    result = [...result].sort((a, b) => {
      const hueA = a.hexCode ? getHue(a.hexCode) : 999
      const hueB = b.hexCode ? getHue(b.hexCode) : 999
      return hueA - hueB
    })

    return result
  }, [colors, searchQuery, filterPrimary])

  // Get primary colors for parent selection
  const primaryColors = React.useMemo(() => {
    return colors.filter((c) => c.isPrimary)
  }, [colors])

  // Find similar colors based on hex value
  const findSimilarColors = React.useCallback((hex: string) => {
    if (!isValidHex(hex)) {
      setSimilarColors([])
      return
    }
    const similar = colors
      .filter((c) => c.hexCode && isValidHex(c.hexCode))
      .map((c) => ({
        color: c,
        distance: colorDistance(hex, c.hexCode!),
      }))
      .filter((item) => item.distance < 100 && item.distance > 0) // Exclude exact match
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
      .map((item) => item.color)

    setSimilarColors(similar)
  }, [colors])

  // Update similar colors when hex changes
  React.useEffect(() => {
    if (showAddForm && formData.hexCode) {
      findSimilarColors(normalizeHex(formData.hexCode))
    }
  }, [formData.hexCode, showAddForm, findSimilarColors])

  // Open edit sheet
  const openEditSheet = (color: ColorData) => {
    setEditingColor(color)
    setFormData({
      name: color.name,
      hexCode: color.hexCode || '#',
      isPrimary: color.isPrimary,
      parentIds: color.parentIds,
      translations: [...color.translations],
    })
    setShowTranslations(color.translations.length > 0)
    setEditSheetOpen(true)
  }

  // Close edit sheet
  const closeEditSheet = () => {
    setEditSheetOpen(false)
    setEditingColor(null)
    setFormData({
      name: '',
      hexCode: '#',
      isPrimary: false,
      parentIds: [],
      translations: [],
    })
    setShowTranslations(false)
  }

  // Reset add form
  const resetAddForm = () => {
    setFormData({
      name: '',
      hexCode: '#',
      isPrimary: false,
      parentIds: [],
      translations: [],
    })
    setShowAddForm(false)
    setSimilarColors([])
    setShowTranslations(false)
  }

  // Translate color name using DeepL
  const handleTranslate = async () => {
    if (!formData.name.trim()) return

    setTranslating(true)
    try {
      const newTranslations: ColorTranslation[] = []
      const sourceLang = DEFAULT_LANGUAGE

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === sourceLang) continue
        try {
          const translatedName = await translateText(formData.name, lang, sourceLang)
          newTranslations.push({
            language: lang,
            name: translatedName,
          })
        } catch (e) {
          console.error(`Failed to translate to ${lang}:`, e)
        }
      }

      setFormData((prev) => ({
        ...prev,
        translations: newTranslations,
      }))
      setShowTranslations(true)
      setSuccessMessage('Translations generated successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (e: any) {
      setError(e?.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  // Auto-translate color name to missing languages
  const autoTranslateColorName = async (colorName: string, existingTranslations: ColorTranslation[]): Promise<ColorTranslation[]> => {
    const missingLanguages = SUPPORTED_LANGUAGES.filter(
      lang => lang !== DEFAULT_LANGUAGE && !existingTranslations.some(t => t.language === lang && t.name.trim())
    )
    
    if (missingLanguages.length === 0) return existingTranslations
    
    const newTranslations: ColorTranslation[] = [...existingTranslations]
    
    for (const lang of missingLanguages) {
      try {
        const translated = await translateText(colorName, lang as SupportedLanguage, DEFAULT_LANGUAGE)
        if (translated && translated !== colorName) {
          const existing = newTranslations.find(t => t.language === lang)
          if (existing) {
            existing.name = translated
          } else {
            newTranslations.push({ language: lang, name: translated })
          }
        }
      } catch (e) {
        console.error(`Failed to auto-translate to ${lang}:`, e)
      }
    }
    
    return newTranslations
  }

  // Save color (create or update)
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Color name is required')
      return
    }

    // Validate: non-primary colors must have at least one parent
    if (!formData.isPrimary && formData.parentIds.length === 0) {
      setError('Non-primary colors must have at least one parent color')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const hexValue = normalizeHex(formData.hexCode)
      const colorPayload = {
        name: formData.name.trim(),
        hex_code: isValidHex(hexValue) ? hexValue : null,
        is_primary: formData.isPrimary,
        parent_ids: formData.isPrimary ? [] : formData.parentIds,
      }

      let colorId: string

      if (editingColor) {
        // Update existing color
        const { error: updateError } = await supabase
          .from('colors')
          .update(colorPayload)
          .eq('id', editingColor.id)

        if (updateError) throw updateError
        colorId = editingColor.id

        // Delete existing translations
        await supabase
          .from('color_translations')
          .delete()
          .eq('color_id', colorId)
      } else {
        // Create new color
        const { data: newColor, error: createError } = await supabase
          .from('colors')
          .insert(colorPayload)
          .select('id')
          .single()

        if (createError) throw createError
        colorId = newColor.id
      }

      // Auto-translate if translations are missing
      let translationsToSave = formData.translations
      const hasAllTranslations = SUPPORTED_LANGUAGES
        .filter(lang => lang !== DEFAULT_LANGUAGE)
        .every(lang => translationsToSave.some(t => t.language === lang && t.name.trim()))
      
      if (!hasAllTranslations) {
        // Auto-translate missing languages
        translationsToSave = await autoTranslateColorName(formData.name.trim(), translationsToSave)
      }

      // Save translations
      const validTranslations = translationsToSave.filter(t => t.name.trim())
      if (validTranslations.length > 0) {
        const translationInserts = validTranslations.map((t) => ({
          color_id: colorId,
          language: t.language,
          name: t.name.trim(),
        }))

        const { error: translationError } = await supabase
          .from('color_translations')
          .insert(translationInserts)

        if (translationError) {
          console.warn('Failed to save translations:', translationError)
        }
      }

      setSuccessMessage(editingColor ? 'Color updated successfully!' : 'Color created successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)

      await loadColors()
      closeEditSheet()
      resetAddForm()
    } catch (e: any) {
      console.error('Error saving color:', e)
      setError(e?.message || 'Failed to save color')
    } finally {
      setSaving(false)
    }
  }

  // Delete color
  const handleDelete = async (colorId: string) => {
    setDeleting(true)
    try {
      // Delete translations first
      await supabase
        .from('color_translations')
        .delete()
        .eq('color_id', colorId)

      // Delete color
      const { error } = await supabase
        .from('colors')
        .delete()
        .eq('id', colorId)

      if (error) throw error

      setSuccessMessage('Color deleted successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      setDeleteConfirm(null)
      await loadColors()
    } catch (e: any) {
      console.error('Error deleting color:', e)
      setError(e?.message || 'Failed to delete color')
    } finally {
      setDeleting(false)
    }
  }

  // Toggle parent selection
  const toggleParent = (parentId: string) => {
    setFormData((prev) => ({
      ...prev,
      parentIds: prev.parentIds.includes(parentId)
        ? prev.parentIds.filter((id) => id !== parentId)
        : [...prev.parentIds, parentId],
    }))
  }

  // Update translation
  const updateTranslation = (lang: SupportedLanguage, name: string) => {
    setFormData((prev) => {
      const existing = prev.translations.find((t) => t.language === lang)
      if (existing) {
        return {
          ...prev,
          translations: prev.translations.map((t) =>
            t.language === lang ? { ...t, name } : t
          ),
        }
      } else {
        return {
          ...prev,
          translations: [...prev.translations, { language: lang, name }],
        }
      }
    })
  }

  // Get parent names for display
  const getParentNames = (parentIds: string[]): string => {
    return parentIds
      .map((id) => colors.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  }

  // Copy hex to clipboard
  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      setSuccessMessage('Hex code copied!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = hex
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setSuccessMessage('Hex code copied!')
      setTimeout(() => setSuccessMessage(null), 2000)
    }
  }

  // Color card component
  const ColorCard: React.FC<{ color: ColorData }> = ({ color }) => {
    return (
      <div className="group relative rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1f1f1f] overflow-hidden hover:shadow-lg transition-all">
        {/* Color preview */}
        <div
          className="h-20 w-full relative"
          style={{ backgroundColor: color.hexCode || '#e5e7eb' }}
        >
          {color.isPrimary && (
            <div className="absolute top-2 left-2">
              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-400/90 text-amber-950 flex items-center gap-1">
                <Star className="h-3 w-3" />
                Primary
              </span>
            </div>
          )}
          {/* Action buttons on color preview */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {color.hexCode && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copyHex(color.hexCode!)
                }}
                className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 transition-colors"
                style={{ color: getContrastColor(color.hexCode) }}
                title="Copy hex code"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 transition-colors"
                  style={{ color: color.hexCode ? getContrastColor(color.hexCode) : '#000' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => openEditSheet(color)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteConfirm(color.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Color info */}
        <div className="p-3 space-y-1.5">
          {/* Name - full width */}
          <h3 className="font-semibold text-sm truncate" title={color.name}>{color.name}</h3>
          
          {/* Bottom row: hex code and status icons */}
          <div className="flex items-center justify-between gap-2">
            {/* Hex code */}
            {color.hexCode && (
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                {color.hexCode}
              </span>
            )}
            {!color.hexCode && <span />}
            
            {/* Status icons */}
            <div className="flex items-center gap-1.5">
              {/* Translated in all languages */}
              {color.translations.length >= SUPPORTED_LANGUAGES.length - 1 && (
                <div 
                  className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30"
                  title="Translated in all languages"
                >
                  <Languages className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              {/* Has parent */}
              {color.parentIds.length > 0 && (
                <div 
                  className="p-1 rounded-md bg-blue-100 dark:bg-blue-900/30"
                  title={`Parent: ${getParentNames(color.parentIds)}`}
                >
                  <LinkIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirmation overlay */}
        {deleteConfirm === color.id && (
          <div className="absolute inset-0 bg-white/95 dark:bg-[#1f1f1f]/95 flex flex-col items-center justify-center p-4 gap-3 z-10">
            <p className="text-sm text-center font-medium">Delete "{color.name}"?</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirm(null)
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(color.id)
                }}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Color form content - rendered inline to avoid focus issues
  const renderColorForm = () => (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="color-name">Color Name *</Label>
        <Input
          id="color-name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Emerald Green"
          className="rounded-xl"
          autoComplete="off"
        />
      </div>

      {/* Hex Code */}
      <div className="space-y-2">
        <Label htmlFor="color-hex">Hex Code</Label>
        <div className="flex items-center gap-2">
          <Input
            id="color-hex"
            value={formData.hexCode}
            onChange={(e) => setFormData((prev) => ({ ...prev, hexCode: e.target.value }))}
            placeholder="#00ff00"
            className="rounded-xl font-mono"
            autoComplete="off"
          />
          {formData.hexCode && isValidHex(normalizeHex(formData.hexCode)) && (
            <div
              className="h-10 w-10 rounded-xl border border-stone-200 dark:border-[#3e3e42] flex-shrink-0"
              style={{ backgroundColor: normalizeHex(formData.hexCode) }}
            />
          )}
        </div>
      </div>

      {/* Primary Toggle - using checkbox for better accessibility */}
      <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30] cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            checked={formData.isPrimary}
            onChange={(e) => setFormData((prev) => ({ 
              ...prev, 
              isPrimary: e.target.checked, 
              parentIds: e.target.checked ? [] : prev.parentIds 
            }))}
            className="sr-only peer"
          />
          <div className={cn(
            "w-11 h-6 rounded-full transition-colors",
            formData.isPrimary ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
          )} />
          <div className={cn(
            "absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
            formData.isPrimary && "translate-x-5"
          )} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Star className={cn("h-4 w-4", formData.isPrimary ? "text-amber-500" : "text-stone-400")} />
            Primary Color
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Primary colors are basic colors like Red, Blue, Green
          </p>
        </div>
      </label>

      {/* Parent Selection (only for non-primary) */}
      {!formData.isPrimary && (
        <div className="space-y-2">
          <Label>
            Parent Colors * 
            <span className="text-xs text-stone-500 ml-1">(at least one required)</span>
          </Label>
          <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30]">
            {primaryColors.length === 0 ? (
              <p className="text-sm text-stone-500">No primary colors available. Create primary colors first.</p>
            ) : (
              primaryColors.map((parent) => (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => toggleParent(parent.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all",
                    formData.parentIds.includes(parent.id)
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                      : "bg-white dark:bg-[#1f1f1f] hover:bg-stone-100 dark:hover:bg-[#3e3e42]"
                  )}
                >
                  {parent.hexCode && (
                    <span
                      className="h-4 w-4 rounded-full border border-stone-200 dark:border-stone-600"
                      style={{ backgroundColor: parent.hexCode }}
                    />
                  )}
                  {parent.name}
                  {formData.parentIds.includes(parent.id) && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Translations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Languages className="h-4 w-4" />
            Translations
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => handleTranslate()}
            disabled={translating || !formData.name.trim()}
          >
            {translating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            DeepL Translate
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowTranslations(!showTranslations)}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
        >
          {showTranslations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showTranslations ? 'Hide' : 'Show'} translations
        </button>
        {showTranslations && (
          <div className="space-y-2 p-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30]">
            {SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE).map((lang) => {
              const translation = formData.translations.find((t) => t.language === lang)
              return (
                <div key={lang} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-medium uppercase text-stone-500">{lang}</span>
                  <Input
                    value={translation?.name || ''}
                    onChange={(e) => updateTranslation(lang, e.target.value)}
                    placeholder={`Translation in ${lang.toUpperCase()}`}
                    className="rounded-xl flex-1"
                    autoComplete="off"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Palette className="h-6 w-6 text-emerald-600" />
            Color Management
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Manage plant colors with translations and parent-child relationships
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-stone-900 dark:text-white">{colors.length}</div>
              <div className="text-xs text-stone-500">Total Colors</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{primaryColors.length}</div>
              <div className="text-xs text-stone-500">Primary</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{colors.length - primaryColors.length}</div>
              <div className="text-xs text-stone-500">Advanced</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add Color Section */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          {!showAddForm ? (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full rounded-xl h-12"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Color
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Color
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAddForm}
                  className="rounded-xl"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {renderColorForm()}

              {/* Similar Colors */}
              {similarColors.length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Similar colors found:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {similarColors.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1f1f1f] text-sm"
                      >
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: c.hexCode || '#e5e7eb' }}
                        />
                        {c.name}
                        <span className="text-xs text-stone-400">{c.hexCode}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim() || (!formData.isPrimary && formData.parentIds.length === 0)}
                  className="rounded-xl flex-1"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Color
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search colors..."
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterPrimary('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              filterPrimary === 'all'
                ? "bg-emerald-600 text-white"
                : "bg-stone-100 dark:bg-[#2d2d30] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3e3e42]"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilterPrimary('primary')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5",
              filterPrimary === 'primary'
                ? "bg-amber-500 text-white"
                : "bg-stone-100 dark:bg-[#2d2d30] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3e3e42]"
            )}
          >
            <Star className="h-3.5 w-3.5" />
            Primary
          </button>
          <button
            onClick={() => setFilterPrimary('advanced')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              filterPrimary === 'advanced'
                ? "bg-emerald-600 text-white"
                : "bg-stone-100 dark:bg-[#2d2d30] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3e3e42]"
            )}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Color Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      ) : filteredColors.length === 0 ? (
        <div className="text-center py-12 text-stone-500 dark:text-stone-400">
          {searchQuery || filterPrimary !== 'all' ? (
            <p>No colors match your filters</p>
          ) : (
            <div className="space-y-2">
              <Palette className="h-12 w-12 mx-auto text-stone-300 dark:text-stone-600" />
              <p>No colors yet. Add your first color above.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredColors.map((color) => (
            <ColorCard key={color.id} color={color} />
          ))}
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Color
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {renderColorForm()}

            {/* Similar Colors in Edit Mode */}
            {similarColors.length > 0 && formData.hexCode && (
              <div className="space-y-2 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30]">
                <div className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  Similar colors:
                </div>
                <div className="flex flex-wrap gap-2">
                  {similarColors.filter((c) => c.id !== editingColor?.id).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white dark:bg-[#1f1f1f] text-xs"
                    >
                      <span
                        className="h-3 w-3 rounded-full border"
                        style={{ backgroundColor: c.hexCode || '#e5e7eb' }}
                      />
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={closeEditSheet}
                className="rounded-xl flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || (!formData.isPrimary && formData.parentIds.length === 0)}
                className="rounded-xl flex-1"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
