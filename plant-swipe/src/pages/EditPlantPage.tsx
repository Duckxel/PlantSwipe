import React from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { PlantProfileForm } from "@/components/plant/PlantProfileForm"
import { fetchAiPlantFill } from "@/lib/aiPlantFill"
import plantSchema from "../../PLANT-INFO-SCHEMA.json"
import type { Plant, PlantColor, PlantImage } from "@/types/plant"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { saveLanguagePreference } from "@/lib/i18nRouting"
import { applyAiFieldToPlant, getCategoryForField } from "@/lib/applyAiField"
import { buildCategoryProgress, createEmptyCategoryProgress, plantFormCategoryOrder, type CategoryProgress } from "@/lib/plantFormCategories"

const DISALLOWED_FIELDS = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL'])

function generateUUIDv4(): string {
  try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID() } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function loadPlant(id: string): Promise<Plant | null> {
  const { data, error } = await supabase
    .from('plants')
    .select('id,name,plant_type,utility,comestible_part,fruit_type,identity,plant_care,growth,usage,ecology,danger,miscellaneous,meta,colors,seasons,description,multicolor,bicolor')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { data: colorLinks } = await supabase.from('plant_colors').select('color_id, colors:color_id (id,name,hex_code)').eq('plant_id', id)
  const { data: images } = await supabase.from('plant_images').select('id,link,use').eq('plant_id', id)
  const colors = (colorLinks || []).map((c: any) => ({ id: c.colors?.id, name: c.colors?.name, hexCode: c.colors?.hex_code }))
  const plant: Plant = {
    id: data.id,
    name: data.name,
    plantType: data.plant_type || undefined,
    utility: data.utility || [],
    comestiblePart: data.comestible_part || [],
    fruitType: data.fruit_type || [],
    identity: data.identity || {},
    plantCare: data.plant_care || {},
    growth: data.growth || {},
    usage: data.usage || {},
    ecology: data.ecology || {},
    danger: data.danger || {},
    miscellaneous: data.miscellaneous || {},
    meta: data.meta || {},
    colors: data.colors || [],
    multicolor: data.multicolor || false,
    bicolor: data.bicolor || false,
    seasons: data.seasons || [],
    description: data.description || undefined,
    images: (images as PlantImage[]) || [],
  }
  if (colors.length || data.multicolor || data.bicolor) plant.identity = { ...(plant.identity || {}), colors, multicolor: data.multicolor, bicolor: data.bicolor }
  return plant
}

async function upsertColors(colors: PlantColor[]) {
  if (!colors?.length) return [] as string[]
  const { data, error } = await supabase.from('colors').upsert(colors.map((c) => ({ name: c.name, hex_code: c.hexCode || null }))).select('id')
  if (error) throw new Error(error.message)
  return (data || []).map((row) => row.id as string)
}

async function linkColors(plantId: string, colorIds: string[]) {
  await supabase.from('plant_colors').delete().eq('plant_id', plantId)
  if (!colorIds.length) return
  const inserts = colorIds.map((id) => ({ plant_id: plantId, color_id: id }))
  const { error } = await supabase.from('plant_colors').insert(inserts)
  if (error) throw new Error(error.message)
}

async function upsertImages(plantId: string, images: PlantImage[] | undefined) {
  await supabase.from('plant_images').delete().eq('plant_id', plantId)
  if (!images?.length) return
  const payload = images.filter((img) => img.link).map((img) => ({ plant_id: plantId, link: img.link, use: img.use || 'other' }))
  if (!payload.length) return
  const { error } = await supabase.from('plant_images').insert(payload)
  if (error) throw new Error(error.message)
}

export const EditPlantPage: React.FC<{ onCancel: () => void; onSaved?: (id: string) => void }> = ({ onCancel, onSaved }) => {
  const { t, i18n } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const initialLanguage = SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : 'en'
  const [language, setLanguage] = React.useState<SupportedLanguage>(initialLanguage)
  const [plant, setPlant] = React.useState<Plant | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [aiWorking, setAiWorking] = React.useState(false)
  const [aiProgress, setAiProgress] = React.useState<CategoryProgress>(() => createEmptyCategoryProgress())
  const targetFields = React.useMemo(() => Object.keys(plantSchema as Record<string, unknown>).filter((key) => !DISALLOWED_FIELDS.has(key) && !DISALLOWED_FIELDS.has(key.toLowerCase())), [])
  const categoryLabels = React.useMemo(() => ({
    basics: t('plantAdmin.categories.basics', 'Basics'),
    identity: t('plantAdmin.categories.identity', 'Identity'),
    plantCare: t('plantAdmin.categories.plantCare', 'Plant Care'),
    growth: t('plantAdmin.categories.growth', 'Growth'),
    usage: t('plantAdmin.categories.usage', 'Usage'),
    ecology: t('plantAdmin.categories.ecology', 'Ecology'),
    danger: t('plantAdmin.categories.danger', 'Danger'),
    miscellaneous: t('plantAdmin.categories.miscellaneous', 'Miscellaneous'),
    meta: t('plantAdmin.categories.meta', 'Meta'),
  }), [t])
  React.useEffect(() => {
    i18n.changeLanguage(language)
    saveLanguagePreference(language)
  }, [language, i18n])
  const initializeCategoryProgress = () => {
    const progress = buildCategoryProgress(targetFields)
    setAiProgress(progress)
    return progress
  }
  const markFieldComplete = (fieldKey: string) => {
    const category = getCategoryForField(fieldKey)
    setAiProgress((prev) => {
      const current = prev[category] || { total: 0, completed: 0, status: 'idle' }
      const total = current.total || 1
      const completed = Math.min((current.completed || 0) + 1, total)
      return {
        ...prev,
        [category]: {
          total,
          completed,
          status: completed >= total ? 'done' : 'filling',
        },
      }
    })
  }

  React.useEffect(() => {
    let ignore = false
    const fetchData = async () => {
      if (!id) { setError('Missing plant id'); setLoading(false); return }
      try {
        const loaded = await loadPlant(id)
        if (!ignore) setPlant(loaded)
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Failed to load plant')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    fetchData()
    return () => { ignore = true }
  }, [id])

  const savePlant = async () => {
    if (!plant) return
    if (!plant.name.trim()) { setError(t('plantAdmin.nameRequired', 'Name is required')); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        id: plant.id || id || generateUUIDv4(),
        name: plant.name.trim(),
        plant_type: plant.plantType || null,
        utility: plant.utility || [],
        comestible_part: plant.comestiblePart || [],
        fruit_type: plant.fruitType || [],
        identity: plant.identity || {},
        plant_care: plant.plantCare || {},
        growth: plant.growth || {},
        usage: plant.usage || {},
        ecology: plant.ecology || {},
        danger: plant.danger || {},
        miscellaneous: plant.miscellaneous || {},
        meta: plant.meta || {},
        multicolor: plant.identity?.multicolor ?? false,
        bicolor: plant.identity?.bicolor ?? false,
        description: plant.identity?.overview || plant.description || null,
        colors: (plant.identity?.colors || []).map((c) => c.name),
        seasons: plant.identity?.season || plant.seasons || [],
      }
      const { error: updateError } = await supabase.from('plants').upsert(payload)
      if (updateError) throw new Error(updateError.message)
      const colorIds = await upsertColors(plant.identity?.colors || [])
      await linkColors(payload.id, colorIds)
      await upsertImages(payload.id, plant.images || [])
      onSaved?.(payload.id)
    } catch (e: any) {
      setError(e?.message || 'Failed to save plant')
    } finally {
      setSaving(false)
    }
  }

  const runAiFill = async () => {
    if (!plant) return
    if (!plant.name.trim()) { setError(t('plantAdmin.aiNameRequired', 'Please enter a name before using AI fill.')); return }
    initializeCategoryProgress()
    setAiWorking(true)
    setError(null)
    try {
      const aiData = await fetchAiPlantFill({
        plantName: plant.name || 'Unknown plant',
        schema: plantSchema,
        existingData: plant,
        language,
        onFieldComplete: ({ field, data }) => {
          if (field === 'complete') return
          setPlant((prev) => prev ? applyAiFieldToPlant(prev, field, data) : prev)
          markFieldComplete(field)
        },
      })
      if (aiData && typeof aiData === 'object') {
        setPlant((prev) => {
          if (!prev) return prev
          let updated = { ...prev }
          for (const [fieldKey, data] of Object.entries(aiData as Record<string, unknown>)) {
            updated = applyAiFieldToPlant(updated, fieldKey, data)
            markFieldComplete(fieldKey)
          }
          return updated
        })
      }
    } catch (e: any) {
      setError(e?.message || 'AI fill failed')
    } finally {
      setAiWorking(false)
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4">Loading...</div>
  if (!plant) return <div className="max-w-4xl mx-auto px-4">Plant not found</div>

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('plantAdmin.editTitle', 'Edit Plant')}</h1>
          <p className="text-sm text-muted-foreground">{t('plantAdmin.editSubtitle', 'Update the record to match the new database structure.')}</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor="edit-language">{t('plantAdmin.languageLabel', 'Language')}</label>
            <select
              id="edit-language"
              className="border rounded px-2 py-1 text-sm bg-background"
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={savePlant} disabled={saving || aiWorking}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
      {error && (
        <Card className="border-red-500">
          <CardContent className="flex gap-2 items-center text-red-700 py-3">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" onClick={runAiFill} disabled={aiWorking || !plant.name.trim()}>
              {aiWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {t('plantAdmin.aiFill', 'AI fill all fields')}
            </Button>
            {!plant.name.trim() && (
              <span className="text-xs text-muted-foreground self-center">{t('plantAdmin.aiNameRequired', 'Please enter a name before using AI fill.')}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground self-center sm:self-start">{t('plantAdmin.aiFillHelper', 'AI will try to populate almost every field based on the provided schema and selected language.')} ({language.toUpperCase()})</p>
        </div>
        {Object.values(aiProgress).some((p) => p.total > 0) && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="font-medium text-sm">{t('plantAdmin.categoryProgressTitle', 'Category fill progress')}</div>
              <div className="grid gap-2">
                {plantFormCategoryOrder.map((cat) => {
                  const info = aiProgress[cat]
                  if (!info?.total) return null
                  const percent = info.total ? Math.round((info.completed / info.total) * 100) : 0
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{categoryLabels[cat]}</span>
                        <span className="text-muted-foreground">{info.completed}/{info.total}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-muted overflow-hidden">
                        <div
                          className={`h-2 transition-all ${info.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, Math.max(percent, info.status === 'done' ? 100 : percent))}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <PlantProfileForm value={plant} onChange={(p) => setPlant(p)} />
    </div>
  )
}

export default EditPlantPage
