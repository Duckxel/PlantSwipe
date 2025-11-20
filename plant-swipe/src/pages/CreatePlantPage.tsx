import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { PlantProfileForm } from "@/components/plant/PlantProfileForm"
import { fetchAiPlantFill } from "@/lib/aiPlantFill"
import plantSchema from "../../PLANT-INFO-SCHEMA.json"
import type { Plant, PlantColor, PlantImage } from "@/types/plant"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { saveLanguagePreference } from "@/lib/i18nRouting"
import { applyAiFieldToPlant, getCategoryForField } from "@/lib/applyAiField"
import { translateArray, translateText } from "@/lib/deepl"
import { buildCategoryProgress, createEmptyCategoryProgress, plantFormCategoryOrder, type CategoryProgress } from "@/lib/plantFormCategories"
import { useParams } from "react-router-dom"

const DISALLOWED_FIELDS = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL'])

function generateUUIDv4(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const emptyPlant: Plant = {
  id: generateUUIDv4(),
  name: "",
  utility: [],
  comestiblePart: [],
  fruitType: [],
  images: [],
  identity: { givenNames: [], colors: [], multicolor: false, bicolor: false },
  plantCare: {},
  growth: {},
  usage: {},
  ecology: {},
  danger: {},
  miscellaneous: {},
  meta: {},
  seasons: [],
  colors: [],
}

async function upsertColors(colors: PlantColor[]) {
  if (!colors?.length) return [] as string[]
  const upsertPayload = colors.map((c) => ({ name: c.name, hex_code: c.hexCode || null }))
  const { data, error } = await supabase.from('colors').upsert(upsertPayload).select('id,name')
  if (error) throw new Error(error.message)
  return (data || []).map((row) => row.id as string)
}

async function linkColors(plantId: string, colorIds: string[]) {
  if (!colorIds.length) return
  await supabase.from('plant_colors').delete().eq('plant_id', plantId)
  const inserts = colorIds.map((id) => ({ plant_id: plantId, color_id: id }))
  const { error } = await supabase.from('plant_colors').insert(inserts)
  if (error) throw new Error(error.message)
}

async function upsertImages(plantId: string, images: Plant["images"]) {
  await supabase.from('plant_images').delete().eq('plant_id', plantId)
  if (!images?.length) return
  const inserts = images.filter((img) => img.link).map((img) => ({ plant_id: plantId, link: img.link, use: img.use || 'other' }))
  if (inserts.length === 0) return
  const { error } = await supabase.from('plant_images').insert(inserts)
  if (error) throw new Error(error.message)
}

async function loadPlant(id: string): Promise<Plant | null> {
  const { data, error } = await supabase
    .from('plants')
    .select('id,name,plant_type,utility,comestible_part,fruit_type,given_names,scientific_name,family,overview,promotion_month,life_cycle,season,foliage_persistance,spiked,toxicity_human,toxicity_pets,allergens,scent,symbolism,living_space,composition,maintenance_level,multicolor,bicolor,origin,habitat,temperature_max,temperature_min,temperature_ideal,level_sun,hygrometry,watering_type,division,soil,advice_soil,mulching,advice_mulching,nutrition_need,fertilizer,advice_fertilizer,sowing_month,flowering_month,fruiting_month,height_cm,wingspan_cm,tutoring,advice_tutoring,sow_type,separation_cm,transplanting,advice_sowing,cut,advice_medicinal,nutritional_intake,infusion,advice_infusion,infusion_mix,recipes_ideas,aromatherapy,spice_mixes,melliferous,polenizer,be_fertilizer,ground_effect,conservation_status,pests,diseases,companions,tags,source_name,source_url,status,admin_commentary,created_by,created_time,updated_by,updated_time')
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
    identity: {
      givenNames: data.given_names || [],
      scientificName: data.scientific_name || undefined,
      family: data.family || undefined,
      overview: data.overview || undefined,
      promotionMonth: data.promotion_month || undefined,
      lifeCycle: data.life_cycle || undefined,
      season: (data.season || []).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) as Plant["seasons"],
      foliagePersistance: data.foliage_persistance || undefined,
      spiked: data.spiked || false,
      toxicityHuman: data.toxicity_human || undefined,
      toxicityPets: data.toxicity_pets || undefined,
      allergens: data.allergens || [],
      scent: data.scent || false,
      symbolism: data.symbolism || [],
      livingSpace: data.living_space || undefined,
      composition: data.composition || [],
      maintenanceLevel: data.maintenance_level || undefined,
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      colors,
    },
    plantCare: {
      origin: data.origin || [],
      habitat: data.habitat || [],
      temperatureMax: data.temperature_max || undefined,
      temperatureMin: data.temperature_min || undefined,
      temperatureIdeal: data.temperature_ideal || undefined,
      levelSun: data.level_sun || undefined,
      hygrometry: data.hygrometry || undefined,
      wateringType: data.watering_type || [],
      division: data.division || [],
      soil: data.soil || [],
      adviceSoil: data.advice_soil || undefined,
      mulching: data.mulching || [],
      adviceMulching: data.advice_mulching || undefined,
      nutritionNeed: data.nutrition_need || [],
      fertilizer: data.fertilizer || [],
      adviceFertilizer: data.advice_fertilizer || undefined,
    },
    growth: {
      sowingMonth: data.sowing_month || [],
      floweringMonth: data.flowering_month || [],
      fruitingMonth: data.fruiting_month || [],
      heightCm: data.height_cm || undefined,
      wingspanCm: data.wingspan_cm || undefined,
      tutoring: data.tutoring || false,
      adviceTutoring: data.advice_tutoring || undefined,
      sowType: data.sow_type || [],
      separation: data.separation_cm || undefined,
      transplanting: data.transplanting || undefined,
      adviceSowing: data.advice_sowing || undefined,
      cut: data.cut || undefined,
    },
    usage: {
      adviceMedicinal: data.advice_medicinal || undefined,
      nutritionalIntake: data.nutritional_intake || [],
      infusion: data.infusion || false,
      adviceInfusion: data.advice_infusion || undefined,
      infusionMix: data.infusion_mix || [],
      recipesIdeas: data.recipes_ideas || [],
      aromatherapy: data.aromatherapy || false,
      spiceMixes: data.spice_mixes || [],
    },
    ecology: {
      melliferous: data.melliferous || false,
      polenizer: data.polenizer || [],
      beFertilizer: data.be_fertilizer || false,
      groundEffect: data.ground_effect || undefined,
      conservationStatus: data.conservation_status || undefined,
    },
    danger: { pests: data.pests || [], diseases: data.diseases || [] },
    miscellaneous: { companions: data.companions || [], tags: data.tags || [], source: { name: data.source_name || undefined, url: data.source_url || undefined } },
    meta: {
      status: data.status || undefined,
      adminCommentary: data.admin_commentary || undefined,
      createdBy: data.created_by || undefined,
      createdAt: data.created_time || undefined,
      updatedBy: data.updated_by || undefined,
      updatedAt: data.updated_time || undefined,
    },
    multicolor: data.multicolor || false,
    bicolor: data.bicolor || false,
    seasons: (data.season || []).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) as Plant["seasons"],
    description: data.overview || undefined,
    images: (images as PlantImage[]) || [],
  }
  if (colors.length || data.multicolor || data.bicolor) plant.identity = { ...(plant.identity || {}), colors, multicolor: data.multicolor, bicolor: data.bicolor }
  return plant
}

export const CreatePlantPage: React.FC<{ onCancel: () => void; onSaved?: (id: string) => void; initialName?: string }> = ({ onCancel, onSaved, initialName }) => {
  const { t, i18n } = useTranslation('common')
  const { id } = useParams<{ id?: string }>()
  const { profile } = useAuth()
  const initialLanguage = SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : 'en'
  const [language, setLanguage] = React.useState<SupportedLanguage>(initialLanguage)
  const [translationTarget, setTranslationTarget] = React.useState<SupportedLanguage>(initialLanguage === 'en' ? 'fr' : 'en')
  const [plant, setPlant] = React.useState<Plant>(() => ({ ...emptyPlant, name: initialName || "", id: id || emptyPlant.id }))
  const [loading, setLoading] = React.useState<boolean>(!!id)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [aiWorking, setAiWorking] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)
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

  React.useEffect(() => {
    if (!id) { setLoading(false); return }
    let ignore = false
    const fetchPlant = async () => {
      try {
        const loaded = await loadPlant(id)
        if (!ignore && loaded) setPlant(loaded)
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Failed to load plant')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    fetchPlant()
    return () => { ignore = true }
  }, [id])
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

  const savePlant = async () => {
    if (!plant.name.trim()) { setError(t('plantAdmin.nameRequired', 'Name is required')); return }
    setSaving(true)
    setError(null)
    try {
      const plantId = plant.id || id || generateUUIDv4()
      const payload = {
        id: plantId,
        name: plant.name.trim(),
        plant_type: plant.plantType || null,
        utility: plant.utility || [],
        comestible_part: plant.comestiblePart || [],
        fruit_type: plant.fruitType || [],
        given_names: plant.identity?.givenNames || [],
        scientific_name: plant.identity?.scientificName || null,
        family: plant.identity?.family || null,
        overview: plant.identity?.overview || null,
        promotion_month: plant.identity?.promotionMonth || null,
        life_cycle: plant.identity?.lifeCycle || null,
        season: plant.identity?.season ? plant.identity.season.map((s) => s.toString().toLowerCase()) : [],
        foliage_persistance: plant.identity?.foliagePersistance || null,
        spiked: plant.identity?.spiked ?? false,
        toxicity_human: plant.identity?.toxicityHuman || null,
        toxicity_pets: plant.identity?.toxicityPets || null,
        allergens: plant.identity?.allergens || [],
        scent: plant.identity?.scent ?? false,
        symbolism: plant.identity?.symbolism || [],
        living_space: plant.identity?.livingSpace || null,
        composition: plant.identity?.composition || [],
        maintenance_level: plant.identity?.maintenanceLevel || null,
        multicolor: plant.identity?.multicolor ?? false,
        bicolor: plant.identity?.bicolor ?? false,
        origin: plant.plantCare?.origin || [],
        habitat: plant.plantCare?.habitat || [],
        temperature_max: plant.plantCare?.temperatureMax || null,
        temperature_min: plant.plantCare?.temperatureMin || null,
        temperature_ideal: plant.plantCare?.temperatureIdeal || null,
        level_sun: plant.plantCare?.levelSun || null,
        hygrometry: plant.plantCare?.hygrometry || null,
        watering_type: plant.plantCare?.wateringType || [],
        division: plant.plantCare?.division || [],
        soil: plant.plantCare?.soil || [],
        advice_soil: plant.plantCare?.adviceSoil || null,
        mulching: plant.plantCare?.mulching || [],
        advice_mulching: plant.plantCare?.adviceMulching || null,
        nutrition_need: plant.plantCare?.nutritionNeed || [],
        fertilizer: plant.plantCare?.fertilizer || [],
        advice_fertilizer: plant.plantCare?.adviceFertilizer || null,
        sowing_month: plant.growth?.sowingMonth || [],
        flowering_month: plant.growth?.floweringMonth || [],
        fruiting_month: plant.growth?.fruitingMonth || [],
        height_cm: plant.growth?.heightCm || null,
        wingspan_cm: plant.growth?.wingspanCm || null,
        tutoring: plant.growth?.tutoring ?? false,
        advice_tutoring: plant.growth?.adviceTutoring || null,
        sow_type: plant.growth?.sowType || [],
        separation_cm: plant.growth?.separation || null,
        transplanting: plant.growth?.transplanting ?? null,
        advice_sowing: plant.growth?.adviceSowing || null,
        cut: plant.growth?.cut || null,
        advice_medicinal: plant.usage?.adviceMedicinal || null,
        nutritional_intake: plant.usage?.nutritionalIntake || [],
        infusion: plant.usage?.infusion ?? false,
        advice_infusion: plant.usage?.adviceInfusion || null,
        infusion_mix: plant.usage?.infusionMix || [],
        recipes_ideas: plant.usage?.recipesIdeas || [],
        aromatherapy: plant.usage?.aromatherapy ?? false,
        spice_mixes: plant.usage?.spiceMixes || [],
        melliferous: plant.ecology?.melliferous ?? false,
        polenizer: plant.ecology?.polenizer || [],
        be_fertilizer: plant.ecology?.beFertilizer ?? false,
        ground_effect: plant.ecology?.groundEffect || null,
        conservation_status: plant.ecology?.conservationStatus || null,
        pests: plant.danger?.pests || [],
        diseases: plant.danger?.diseases || [],
        companions: plant.miscellaneous?.companions || [],
        tags: plant.miscellaneous?.tags || [],
        source_name: (plant.miscellaneous?.source as any)?.name || null,
        source_url: (plant.miscellaneous?.source as any)?.url || null,
        status: plant.meta?.status || null,
        admin_commentary: plant.meta?.adminCommentary || null,
        created_by: plant.meta?.createdBy || (profile as any)?.full_name || null,
        created_time: plant.meta?.createdAt || null,
        updated_by: plant.meta?.updatedBy || null,
        updated_time: plant.meta?.updatedAt || null,
      }
      const { data, error: insertError } = await supabase
        .from('plants')
        .upsert(payload)
        .select('id')
        .maybeSingle()
      if (insertError) throw new Error(insertError.message)
      const savedId = data?.id || plantId
      const colorIds = await upsertColors(plant.identity?.colors || [])
      await linkColors(savedId, colorIds)
      await upsertImages(savedId, plant.images || [])
      setPlant({ ...plant, id: savedId })
      onSaved?.(savedId)
    } catch (e: any) {
      setError(e?.message || 'Failed to save plant')
    } finally {
      setSaving(false)
    }
  }

  const runAiFill = async () => {
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
          setPlant((prev) => applyAiFieldToPlant(prev, field, data))
          markFieldComplete(field)
        },
      })
      if (aiData && typeof aiData === 'object') {
        setPlant((prev) => {
          let updated = { ...prev }
          for (const [fieldKey, data] of Object.entries(aiData as Record<string, unknown>)) {
            updated = applyAiFieldToPlant(updated, fieldKey, data)
            markFieldComplete(fieldKey)
          }
          return { ...updated, id: updated.id || generateUUIDv4() }
        })
      }
    } catch (e: any) {
      setError(e?.message || 'AI fill failed')
    } finally {
      setAiWorking(false)
    }
  }

  const descriptionPreview = plant.identity?.overview || plant.description

  const translatePlant = async () => {
    if (translationTarget === language) {
      setError(t('plantAdmin.translationLanguageMismatch', 'Choose a different target language for translation.'))
      return
    }
    setTranslating(true)
    setError(null)
    try {
      const sourceLang = language
      const translatedName = await translateText(plant.name || '', translationTarget, sourceLang)
      const translatedGivenNames = await translateArray(plant.identity?.givenNames || [], translationTarget, sourceLang)
      const translateArraySafe = (arr?: string[]) => translateArray(arr || [], translationTarget, sourceLang)
      const translatedInfusionMix = plant.usage?.infusionMix
        ? Object.fromEntries(
            await Promise.all(
              Object.entries(plant.usage.infusionMix).map(async ([mixName, benefit]) => [
                await translateText(mixName, translationTarget, sourceLang),
                await translateText(benefit, translationTarget, sourceLang),
              ])
            )
          )
        : undefined
      const translatedSourceName = plant.miscellaneous?.source?.name
        ? await translateText(plant.miscellaneous.source.name, translationTarget, sourceLang)
        : undefined
      const translatedSource: Record<string, string> = {}
      if (translatedSourceName) translatedSource.name = translatedSourceName
      if (plant.miscellaneous?.source?.url) translatedSource.url = plant.miscellaneous.source.url

      const translated: Plant = {
        ...plant,
        name: translatedName,
        identity: {
          ...plant.identity,
          givenNames: translatedGivenNames,
          scientificName: plant.identity?.scientificName,
          family: plant.identity?.family
            ? await translateText(plant.identity.family, translationTarget, sourceLang)
            : plant.identity?.family,
          overview: plant.identity?.overview
            ? await translateText(plant.identity.overview, translationTarget, sourceLang)
            : plant.identity?.overview,
          allergens: await translateArraySafe(plant.identity?.allergens),
          symbolism: await translateArraySafe(plant.identity?.symbolism),
        },
        plantCare: {
          ...plant.plantCare,
          origin: await translateArraySafe(plant.plantCare?.origin),
          adviceSoil: plant.plantCare?.adviceSoil
            ? await translateText(plant.plantCare.adviceSoil, translationTarget, sourceLang)
            : plant.plantCare?.adviceSoil,
          adviceMulching: plant.plantCare?.adviceMulching
            ? await translateText(plant.plantCare.adviceMulching, translationTarget, sourceLang)
            : plant.plantCare?.adviceMulching,
          adviceFertilizer: plant.plantCare?.adviceFertilizer
            ? await translateText(plant.plantCare.adviceFertilizer, translationTarget, sourceLang)
            : plant.plantCare?.adviceFertilizer,
        },
        growth: {
          ...plant.growth,
          adviceTutoring: plant.growth?.adviceTutoring
            ? await translateText(plant.growth.adviceTutoring, translationTarget, sourceLang)
            : plant.growth?.adviceTutoring,
          adviceSowing: plant.growth?.adviceSowing
            ? await translateText(plant.growth.adviceSowing, translationTarget, sourceLang)
            : plant.growth?.adviceSowing,
          cut: plant.growth?.cut
            ? await translateText(plant.growth.cut, translationTarget, sourceLang)
            : plant.growth?.cut,
        },
        usage: {
          ...plant.usage,
          adviceMedicinal: plant.usage?.adviceMedicinal
            ? await translateText(plant.usage.adviceMedicinal, translationTarget, sourceLang)
            : plant.usage?.adviceMedicinal,
          adviceInfusion: plant.usage?.adviceInfusion
            ? await translateText(plant.usage.adviceInfusion, translationTarget, sourceLang)
            : plant.usage?.adviceInfusion,
          infusionMix: translatedInfusionMix,
          recipesIdeas: await translateArraySafe(plant.usage?.recipesIdeas),
          spiceMixes: await translateArraySafe(plant.usage?.spiceMixes),
        },
        ecology: {
          ...plant.ecology,
          groundEffect: plant.ecology?.groundEffect
            ? await translateText(plant.ecology.groundEffect, translationTarget, sourceLang)
            : plant.ecology?.groundEffect,
        },
        danger: {
          pests: await translateArraySafe(plant.danger?.pests),
          diseases: await translateArraySafe(plant.danger?.diseases),
        },
        miscellaneous: {
          ...plant.miscellaneous,
          companions: plant.miscellaneous?.companions || [],
          tags: await translateArraySafe(plant.miscellaneous?.tags),
          source: translatedSource,
        },
        meta: {
          ...plant.meta,
          adminCommentary: plant.meta?.adminCommentary
            ? await translateText(plant.meta.adminCommentary, translationTarget, sourceLang)
            : plant.meta?.adminCommentary,
        },
      }
      setPlant(translated)
      setLanguage(translationTarget)
    } catch (e: any) {
      setError(e?.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {id ? t('plantAdmin.editTitle', 'Edit Plant') : t('plantAdmin.createTitle', 'Create Plant')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('plantAdmin.createSubtitle', 'Fill every field with the supplied descriptions or let AI help.')}
          </p>
          {(plant.name || descriptionPreview) && (
            <p className="text-sm font-medium text-foreground/90">
              {plant.name ? `${plant.name}${descriptionPreview ? ':' : ''}` : t('plantAdmin.nameRequired', 'Name is required')} {descriptionPreview || ''}
            </p>
          )}
        </div>
        <div className="flex gap-4 items-start flex-col sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor="create-language">{t('plantAdmin.languageLabel', 'Language')}</label>
            <select
              id="create-language"
              className="border rounded px-2 py-1 text-sm bg-background"
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm font-medium" htmlFor="translate-target">{t('plantAdmin.translationTarget', 'Translate to')}</label>
            <select
              id="translate-target"
              className="border rounded px-2 py-1 text-sm bg-background"
              value={translationTarget}
              onChange={(e) => setTranslationTarget(e.target.value as SupportedLanguage)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
            <Button type="button" onClick={translatePlant} disabled={translating}>
              {translating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('plantAdmin.deeplTranslate', 'DeepL translate')}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={savePlant} disabled={saving || aiWorking}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Plant
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
      {loading ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('plantAdmin.loadingPlant', 'Loading plant...')}
          </CardContent>
        </Card>
      ) : (
        <PlantProfileForm value={plant} onChange={setPlant} />
      )}
    </div>
  )
}

export default CreatePlantPage
