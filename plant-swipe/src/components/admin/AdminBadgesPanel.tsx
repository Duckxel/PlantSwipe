import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabaseClient'
import {
  Trophy,
  Trash2,
  Edit2,
  Loader2,
  Languages,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Egg,
  Star,
  Target,
  Award,
  X,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'
import { translateText } from '@/lib/deepl'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@/lib/i18n'
import type { BadgeTranslation } from '@/types/badge'
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic badge management data */

// Types
type BadgeData = {
  id: string
  slug: string
  name: string
  description: string
  icon_url: string | null
  category: string
  is_active: boolean
  created_at: string
  translations: BadgeTranslation[]
  earned_count: number
}

type BadgeFormData = {
  slug: string
  name: string
  description: string
  icon_url: string
  category: string
  is_active: boolean
  translations: BadgeTranslation[]
}

const BADGE_CATEGORIES = [
  { value: 'event', label: 'Event', icon: Egg, color: 'text-amber-500' },
  { value: 'achievement', label: 'Achievement', icon: Star, color: 'text-emerald-500' },
  { value: 'milestone', label: 'Milestone', icon: Target, color: 'text-blue-500' },
  { value: 'special', label: 'Special', icon: Award, color: 'text-purple-500' },
]

const emptyForm: BadgeFormData = {
  slug: '',
  name: '',
  description: '',
  icon_url: '',
  category: 'event',
  is_active: true,
  translations: [],
}

export const AdminBadgesPanel: React.FC = () => {
  const [badges, setBadges] = React.useState<BadgeData[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [showForm, setShowForm] = React.useState(false)
  const [editingBadge, setEditingBadge] = React.useState<BadgeData | null>(null)
  const [formData, setFormData] = React.useState<BadgeFormData>(emptyForm)
  const [showTranslations, setShowTranslations] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)
  const [expandedBadge, setExpandedBadge] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)

  // Load all badges
  const loadBadges = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch badges
      const { data: badgeData, error: badgeError } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: false })

      if (badgeError) throw badgeError

      // Fetch translations
      const { data: translationData } = await supabase
        .from('badge_translations')
        .select('badge_id, language, name, description')

      // Fetch earned counts
      const { data: countData } = await supabase
        .from('user_badges')
        .select('badge_id')

      const countMap: Record<string, number> = {}
      if (countData) {
        for (const row of countData) {
          countMap[row.badge_id] = (countMap[row.badge_id] || 0) + 1
        }
      }

      const translationMap: Record<string, BadgeTranslation[]> = {}
      if (translationData) {
        for (const t of translationData) {
          if (!translationMap[t.badge_id]) translationMap[t.badge_id] = []
          translationMap[t.badge_id].push({
            language: t.language as SupportedLanguage,
            name: t.name,
            description: t.description,
          })
        }
      }

      const badgesWithTranslations: BadgeData[] = (badgeData || []).map((b: any) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description || '',
        icon_url: b.icon_url,
        category: b.category,
        is_active: b.is_active,
        created_at: b.created_at,
        translations: translationMap[b.id] || [],
        earned_count: countMap[b.id] || 0,
      }))

      setBadges(badgesWithTranslations)
    } catch (err: any) {
      setError(err.message || 'Failed to load badges')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadBadges()
  }, [loadBadges])

  // Auto-clear messages
  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Open form for editing
  const handleEdit = (badge: BadgeData) => {
    setEditingBadge(badge)
    setFormData({
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon_url: badge.icon_url || '',
      category: badge.category,
      is_active: badge.is_active,
      translations: badge.translations,
    })
    setShowForm(true)
    setShowTranslations(false)
  }

  // Close form
  const handleCancel = () => {
    setShowForm(false)
    setEditingBadge(null)
    setFormData({ ...emptyForm })
    setShowTranslations(false)
  }

  // Update translation for a language
  const updateTranslation = (lang: SupportedLanguage, field: 'name' | 'description', value: string) => {
    setFormData((prev) => {
      const existing = prev.translations.find((t) => t.language === lang)
      if (existing) {
        return {
          ...prev,
          translations: prev.translations.map((t) =>
            t.language === lang ? { ...t, [field]: value } : t
          ),
        }
      }
      return {
        ...prev,
        translations: [
          ...prev.translations,
          { language: lang, name: field === 'name' ? value : '', description: field === 'description' ? value : '' },
        ],
      }
    })
  }

  // Translate name & description using DeepL
  const handleTranslate = async () => {
    if (!formData.name.trim()) return
    setTranslating(true)
    try {
      const newTranslations: BadgeTranslation[] = [...formData.translations]

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === DEFAULT_LANGUAGE) continue
        try {
          const translatedName = await translateText(formData.name, lang, DEFAULT_LANGUAGE)
          const translatedDesc = formData.description.trim()
            ? await translateText(formData.description, lang, DEFAULT_LANGUAGE)
            : ''
          const existing = newTranslations.find((t) => t.language === lang)
          if (existing) {
            existing.name = translatedName
            existing.description = translatedDesc
          } else {
            newTranslations.push({ language: lang, name: translatedName, description: translatedDesc })
          }
        } catch {
          // Skip failed language
        }
      }

      setFormData((prev) => ({ ...prev, translations: newTranslations }))
      setShowTranslations(true)
    } catch {
      setError('Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  // Save badge
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      setError('Name and slug are required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (!editingBadge) return
      const badgeId = editingBadge.id

      // Update existing
      const { error: updateError } = await supabase
        .from('badges')
        .update({
          slug: formData.slug.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          icon_url: formData.icon_url.trim() || null,
          category: formData.category,
          is_active: formData.is_active,
        })
        .eq('id', badgeId)

      if (updateError) throw updateError

      // Delete existing translations
      await supabase.from('badge_translations').delete().eq('badge_id', badgeId)

      // Auto-translate if missing translations
      const translationsToSave = [...formData.translations]
      const hasAllTranslations = SUPPORTED_LANGUAGES
        .filter((lang) => lang !== DEFAULT_LANGUAGE)
        .every((lang) => translationsToSave.some((t) => t.language === lang && t.name.trim()))

      if (!hasAllTranslations) {
        for (const lang of SUPPORTED_LANGUAGES) {
          if (lang === DEFAULT_LANGUAGE) continue
          const existing = translationsToSave.find((t) => t.language === lang)
          if (existing?.name.trim()) continue
          try {
            const translatedName = await translateText(formData.name.trim(), lang, DEFAULT_LANGUAGE)
            const translatedDesc = formData.description.trim()
              ? await translateText(formData.description.trim(), lang, DEFAULT_LANGUAGE)
              : ''
            if (existing) {
              existing.name = translatedName
              existing.description = translatedDesc
            } else {
              translationsToSave.push({ language: lang, name: translatedName, description: translatedDesc })
            }
          } catch {
            // Skip on error
          }
        }
      }

      // Save translations
      const validTranslations = translationsToSave.filter((t) => t.name.trim())
      if (validTranslations.length > 0) {
        const inserts = validTranslations.map((t) => ({
          badge_id: badgeId,
          language: t.language,
          name: t.name.trim(),
          description: t.description.trim(),
        }))

        const { error: translationError } = await supabase
          .from('badge_translations')
          .insert(inserts)

        if (translationError) {
          console.warn('Failed to save translations:', translationError)
        }
      }

      setSuccess('Badge updated')
      handleCancel()
      await loadBadges()
    } catch (err: any) {
      setError(err.message || 'Failed to save badge')
    } finally {
      setSaving(false)
    }
  }

  // Delete badge
  const handleDelete = async (badgeId: string) => {
    setDeleting(true)
    try {
      // Delete translations first
      await supabase.from('badge_translations').delete().eq('badge_id', badgeId)
      // Delete badge (cascade handles user_badges)
      const { error } = await supabase.from('badges').delete().eq('id', badgeId)
      if (error) throw error

      setSuccess('Badge deleted')
      setConfirmDelete(null)
      await loadBadges()
    } catch (err: any) {
      setError(err.message || 'Failed to delete badge')
    } finally {
      setDeleting(false)
    }
  }

  // Filter badges
  const filteredBadges = React.useMemo(() => {
    if (!search.trim()) return badges
    const q = search.toLowerCase()
    return badges.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    )
  }, [badges, search])

  // Category icon helper
  const getCategoryInfo = (category: string) =>
    BADGE_CATEGORIES.find((c) => c.value === category) || BADGE_CATEGORIES[0]

  // Badge card
  const renderBadgeCard = (badge: BadgeData) => {
    const cat = getCategoryInfo(badge.category)
    const CatIcon = cat.icon
    const isExpanded = expandedBadge === badge.id

    return (
      <Card
        key={badge.id}
        className={cn(
          'rounded-2xl border transition-all cursor-pointer',
          !badge.is_active && 'opacity-50',
          isExpanded
            ? 'border-emerald-300 dark:border-emerald-700 shadow-md'
            : 'border-stone-200 dark:border-[#3e3e42] hover:border-stone-300 dark:hover:border-[#4e4e52]'
        )}
        onClick={() => setExpandedBadge(isExpanded ? null : badge.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Badge icon */}
            <div className="flex-shrink-0">
              {badge.icon_url ? (
                <div className="h-12 w-12 rounded-xl overflow-hidden border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30]">
                  <img
                    src={badge.icon_url}
                    alt={badge.name}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-xl border border-dashed border-stone-300 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30] flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-stone-400" />
                </div>
              )}
            </div>

            {/* Badge info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                  {badge.name}
                </h3>
                {!badge.is_active && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-500">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">{badge.slug}</span>
                <span className={cn('flex items-center gap-1 text-xs', cat.color)}>
                  <CatIcon className="h-3 w-3" />
                  {cat.label}
                </span>
              </div>
              {badge.description && (
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                  {badge.description}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1.5 text-xs text-stone-400">
                <Users className="h-3 w-3" />
                {badge.earned_count} earned
              </div>
            </div>

            {/* Chevron */}
            <div className="flex-shrink-0 pt-1">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-stone-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-stone-400" />
              )}
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-stone-200 dark:border-[#3e3e42] space-y-3">
              {/* Translations */}
              {badge.translations.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-stone-600 dark:text-stone-300 flex items-center gap-1">
                    <Languages className="h-3.5 w-3.5" />
                    Translations
                  </p>
                  <div className="space-y-1">
                    {badge.translations.map((t) => (
                      <div
                        key={t.language}
                        className="flex items-start gap-2 text-xs bg-stone-50 dark:bg-[#2d2d30] rounded-lg px-2.5 py-1.5"
                      >
                        <span className="font-medium uppercase text-stone-500 w-6 flex-shrink-0 pt-0.5">
                          {t.language}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-stone-700 dark:text-stone-200">{t.name}</p>
                          {t.description && (
                            <p className="text-stone-500 dark:text-stone-400 mt-0.5">{t.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit(badge)
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
                {confirmDelete === badge.id ? (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => handleDelete(badge.id)}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(badge.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Badge form
  const renderForm = () => (
    <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            Edit Badge
          </h3>
          <button
            onClick={handleCancel}
            className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="h-4 w-4 text-stone-500" />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="badge-name">Name *</Label>
          <Input
            id="badge-name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Easter Egg Hunter 2026"
            className="rounded-xl"
            autoComplete="off"
          />
        </div>

        {/* Slug */}
        <div className="space-y-2">
          <Label htmlFor="badge-slug">Slug * <span className="text-xs text-stone-500">(unique identifier)</span></Label>
          <Input
            id="badge-slug"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
            placeholder="e.g., easter-2026"
            className="rounded-xl font-mono"
            autoComplete="off"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="badge-desc">Description</Label>
          <textarea
            id="badge-desc"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="e.g., Found all hidden Easter eggs during the 2026 hunt!"
            className="w-full rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-transparent px-3 py-2 text-sm min-h-[70px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {BADGE_CATEGORIES.map((cat) => {
              const CatIcon = cat.icon
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, category: cat.value }))}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all',
                    formData.category === cat.value
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-stone-100 dark:bg-[#2d2d30] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3e3e42]'
                  )}
                >
                  <CatIcon className={cn('h-3.5 w-3.5', cat.color)} />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Icon URL */}
        <div className="space-y-2">
          <Label htmlFor="badge-icon">Icon URL</Label>
          <Input
            id="badge-icon"
            type="url"
            value={formData.icon_url}
            onChange={(e) => setFormData((prev) => ({ ...prev, icon_url: e.target.value }))}
            placeholder="https://media.aphylia.app/..."
            className="rounded-xl"
          />
          <p className="text-xs text-stone-500">
            Upload images via Admin &rarr; Upload and Media, then paste the URL here
          </p>
          {formData.icon_url && (
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-xl overflow-hidden border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30]">
                <img
                  src={formData.icon_url}
                  alt="Preview"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = ''
                    e.currentTarget.alt = 'Failed to load'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Active toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30] cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="sr-only peer"
            />
            <div className={cn(
              'w-11 h-6 rounded-full transition-colors',
              formData.is_active ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'
            )} />
            <div className={cn(
              'absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
              formData.is_active && 'translate-x-5'
            )} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Active</div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Inactive badges are hidden from users
            </p>
          </div>
        </label>

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
              onClick={handleTranslate}
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
            <div className="space-y-3 p-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30]">
              {SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE).map((lang) => {
                const translation = formData.translations.find((t) => t.language === lang)
                return (
                  <div key={lang} className="space-y-1.5">
                    <span className="text-xs font-medium uppercase text-stone-500">{lang}</span>
                    <Input
                      value={translation?.name || ''}
                      onChange={(e) => updateTranslation(lang, 'name', e.target.value)}
                      placeholder={`Name in ${lang.toUpperCase()}`}
                      className="rounded-xl"
                      autoComplete="off"
                    />
                    <textarea
                      value={translation?.description || ''}
                      onChange={(e) => updateTranslation(lang, 'description', e.target.value)}
                      placeholder={`Description in ${lang.toUpperCase()}`}
                      className="w-full rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-transparent px-3 py-2 text-sm min-h-[50px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            className="rounded-xl flex-1"
            onClick={handleSave}
            disabled={saving || !formData.name.trim() || !formData.slug.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Update Badge
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Badge Management
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Create and manage badges with multilingual support
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Total</p>
            <p className="text-lg font-bold text-stone-900 dark:text-white">{badges.length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Active</p>
            <p className="text-lg font-bold text-emerald-600">{badges.filter((b) => b.is_active).length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Event</p>
            <p className="text-lg font-bold text-amber-500">{badges.filter((b) => b.category === 'event').length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Total Earned</p>
            <p className="text-lg font-bold text-blue-500">{badges.reduce((sum, b) => sum + b.earned_count, 0)}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-sm" aria-label="Dismiss error" title="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search badges..."
          className="flex-1"
        />
      </div>

      {/* Info: badges are created via SQL files */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30] border border-stone-200 dark:border-[#3e3e42] text-xs text-stone-500 dark:text-stone-400">
        <Trophy className="h-4 w-4 flex-shrink-0" />
        To create a new badge, add a SQL file in <code className="font-mono bg-stone-200 dark:bg-stone-700 px-1 rounded">badges/</code> and run it on the database.
      </div>

      {/* Edit form (no creation — badges are managed via SQL files) */}
      {showForm && editingBadge && renderForm()}

      {/* Badge list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : filteredBadges.length === 0 ? (
        <div className="text-center py-12 text-stone-500 dark:text-stone-400">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'No badges match your search' : 'No badges yet'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredBadges.map(renderBadgeCard)}
        </div>
      )}
    </div>
  )
}
