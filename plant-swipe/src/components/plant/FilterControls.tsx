import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/lib/i18nRouting'
import { FilterSectionHeader } from './FilterSectionHeader'
import type { ColorOption } from '@/types/plant'

export type SearchSortMode = "default" | "newest" | "popular" | "favorites" | "impressions"

interface FilterControlsProps {
  // Sort
  searchSort: SearchSortMode
  setSearchSort: (val: SearchSortMode) => void
  /** When true, shows admin-only sort options like "impressions" */
  isAdmin?: boolean

  // Filter State
  seasonFilter: string | null
  setSeasonFilter: React.Dispatch<React.SetStateAction<string | null>>
  colorFilter: string[]
  setColorFilter: React.Dispatch<React.SetStateAction<string[]>>
  typeFilter: string | null
  setTypeFilter: React.Dispatch<React.SetStateAction<string | null>>
  usageFilters: string[]
  setUsageFilters: React.Dispatch<React.SetStateAction<string[]>>
  habitatFilters: string[]
  setHabitatFilters: React.Dispatch<React.SetStateAction<string[]>>
  maintenanceFilter: string | null
  setMaintenanceFilter: React.Dispatch<React.SetStateAction<string | null>>
  petSafe: boolean
  setPetSafe: React.Dispatch<React.SetStateAction<boolean>>
  humanSafe: boolean
  setHumanSafe: React.Dispatch<React.SetStateAction<boolean>>
  livingSpaceFilters: string[]
  setLivingSpaceFilters: React.Dispatch<React.SetStateAction<string[]>>
  lifeCycleFilters: string[]
  setLifeCycleFilters: React.Dispatch<React.SetStateAction<string[]>>
  plantHabitFilters: string[]
  setPlantHabitFilters: React.Dispatch<React.SetStateAction<string[]>>
  ediblePartFilters: string[]
  setEdiblePartFilters: React.Dispatch<React.SetStateAction<string[]>>
  plantPartFilters: string[]
  setPlantPartFilters: React.Dispatch<React.SetStateAction<string[]>>

  // Data Options
  colorOptions: ColorOption[]
  primaryColors: ColorOption[]
  advancedColors: ColorOption[]
  typeOptions: string[]
  usageOptions: string[]
}

const FilterControlsComponent: React.FC<FilterControlsProps> = ({
  searchSort,
  setSearchSort,
  isAdmin = false,
  seasonFilter,
  setSeasonFilter,
  colorFilter,
  setColorFilter,
  typeFilter,
  setTypeFilter,
  usageFilters,
  setUsageFilters,
  habitatFilters,
  setHabitatFilters,
  maintenanceFilter,
  setMaintenanceFilter,
  petSafe,
  setPetSafe,
  humanSafe,
  setHumanSafe,
  livingSpaceFilters,
  setLivingSpaceFilters,
  lifeCycleFilters,
  setLifeCycleFilters,
  plantHabitFilters,
  setPlantHabitFilters,
  ediblePartFilters,
  setEdiblePartFilters,
  plantPartFilters,
  setPlantPartFilters,
  colorOptions,
  primaryColors,
  advancedColors,
  typeOptions,
  usageOptions,
}) => {
  const { t } = useTranslation(['common', 'plantInfo'])
  const currentLang = useLanguage()

  // Local UI State
  const [seasonSectionOpen, setSeasonSectionOpen] = useState(false)
  const [colorSectionOpen, setColorSectionOpen] = useState(false)
  const [advancedColorsOpen, setAdvancedColorsOpen] = useState(false)
  const [typeSectionOpen, setTypeSectionOpen] = useState(false)
  const [usageSectionOpen, setUsageSectionOpen] = useState(false)
  const [habitatSectionOpen, setHabitatSectionOpen] = useState(false)
  const [maintenanceSectionOpen, setMaintenanceSectionOpen] = useState(false)
  const [lifeCycleSectionOpen, setLifeCycleSectionOpen] = useState(false)
  const [plantHabitSectionOpen, setPlantHabitSectionOpen] = useState(false)
  const [ediblePartSectionOpen, setEdiblePartSectionOpen] = useState(false)
  const [plantPartSectionOpen, setPlantPartSectionOpen] = useState(false)

  // Auto-expand filter sections that have active filters (e.g. from URL params)
  useEffect(() => {
    if (typeFilter) setTypeSectionOpen(true)
    if (usageFilters.length > 0) setUsageSectionOpen(true)
    if (plantPartFilters.length > 0) setPlantPartSectionOpen(true)
    if (habitatFilters.length > 0) setHabitatSectionOpen(true)
    if (lifeCycleFilters.length > 0) setLifeCycleSectionOpen(true)
    if (plantHabitFilters.length > 0) setPlantHabitSectionOpen(true)
    if (ediblePartFilters.length > 0) setEdiblePartSectionOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasEdibleUsage = usageFilters.some(u => u.toLowerCase() === 'comestible')

  // Clear edible part filters when "Comestible" usage is deselected
  useEffect(() => {
    if (!hasEdibleUsage && ediblePartFilters.length > 0) {
      setEdiblePartFilters([])
    }
  }, [hasEdibleUsage, ediblePartFilters.length, setEdiblePartFilters])

  // Auto-expand advanced colors if selected
  useEffect(() => {
    if (colorFilter.length === 0) return

    const hasAdvancedColor = colorFilter.some((colorName) => {
      const normalizedName = colorName.toLowerCase()
      // Check if it matches any advanced color (name or translation)
      return advancedColors.some(ac =>
         ac.name.toLowerCase() === normalizedName ||
         Object.values(ac.translations).some(trans => trans?.toLowerCase().trim() === normalizedName)
      )
    })

    if (hasAdvancedColor) {
      setAdvancedColorsOpen(true)
    }
  }, [colorFilter, advancedColors])

  const hasActiveFilters = seasonFilter !== null ||
    colorFilter.length > 0 ||
    typeFilter !== null ||
    usageFilters.length > 0 ||
    habitatFilters.length > 0 ||
    maintenanceFilter !== null ||
    petSafe ||
    humanSafe ||
    livingSpaceFilters.length > 0 ||
    lifeCycleFilters.length > 0 ||
    plantHabitFilters.length > 0 ||
    ediblePartFilters.length > 0 ||
    plantPartFilters.length > 0

  const clearAllFilters = () => {
    setSeasonFilter(null)
    setColorFilter([])
    setTypeFilter(null)
    setUsageFilters([])
    setHabitatFilters([])
    setMaintenanceFilter(null)
    setPetSafe(false)
    setHumanSafe(false)
    setLivingSpaceFilters([])
    setLifeCycleFilters([])
    setPlantHabitFilters([])
    setEdiblePartFilters([])
    setPlantPartFilters([])
  }

  const habitatOptions = [
    "polar", "montane", "oceanic", "degraded_oceanic",
    "temperate_continental", "mediterranean", "tropical_dry",
    "tropical_humid", "subtropical_humid", "equatorial",
    "windswept_coastal"
  ] as const

  const maintenanceOptions = ["easy", "moderate", "complex"] as const
  const livingSpaceOptions = ["indoor", "outdoor"] as const

  const renderColorOption = (color: ColorOption) => {
    const isActive = colorFilter.includes(color.name)
    // Use translated name if available for the current language, fallback to default name
    const translatedName = color.translations[currentLang] || color.name
    const label = translatedName || t("plant.unknownColor", { defaultValue: "Unnamed color" })

    return (
      <button
        key={color.id}
        type="button"
        onClick={() => setColorFilter((cur) =>
          isActive
            ? cur.filter((c) => c !== color.name)
            : [...cur, color.name]
        )}
        className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          isActive
            ? "bg-black dark:bg-white text-white dark:text-black"
            : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
        }`}
        aria-pressed={isActive}
        style={!isActive && color.hexCode ? { borderColor: color.hexCode } : undefined}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 border border-black/5 dark:border-white/10"
          style={{ backgroundColor: color.hexCode || "transparent" }}
          aria-hidden="true"
        />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Clear all filters button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="w-full rounded-2xl text-sm border-dashed hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
        >
          <X className="h-4 w-4 mr-2" />
          {t("plant.clearAllFilters", { defaultValue: "Clear all filters" })}
        </Button>
      )}

      {/* Sort */}
      <div>
        <div className="text-xs font-medium mb-2 uppercase tracking-wide opacity-60">{t("plant.sortLabel")}</div>
        <select
          value={searchSort}
          onChange={(e) => setSearchSort(e.target.value as SearchSortMode)}
          className="w-full rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-white"
        >
          <option value="default">{t("plant.sortDefault")}</option>
          <option value="newest">{t("plant.sortNewest")}</option>
          <option value="popular">{t("plant.sortPopular")}</option>
          <option value="favorites">{t("plant.sortFavorites")}</option>
          {isAdmin && (
            <option value="impressions">{t("plant.sortImpressions", { defaultValue: "Most viewed" })}</option>
          )}
        </select>
      </div>

      {/* Type */}
      <div>
        <FilterSectionHeader
          label={t("plantInfo.classification.type", { defaultValue: "Type" })}
          isOpen={typeSectionOpen}
          onToggle={() => setTypeSectionOpen((prev) => !prev)}
        />
        {typeSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {typeOptions.length > 0 ? (
              typeOptions.map((option) => {
                const isSelected = typeFilter?.toLowerCase() === option.toLowerCase()
                return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTypeFilter((current) => (current?.toLowerCase() === option.toLowerCase() ? null : option))}
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {t(`plant.classificationType.${option.toLowerCase()}`, { defaultValue: option })}
                </button>
                )
              })
            ) : (
              <p className="text-xs opacity-60">
                {t("plantInfo.values.notAvailable", { defaultValue: "N/A" })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Usage */}
      <div>
        <FilterSectionHeader
          label={t("plantInfo.sections.usage", { defaultValue: "Usage" })}
          isOpen={usageSectionOpen}
          onToggle={() => setUsageSectionOpen((prev) => !prev)}
        />
        {usageSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {usageOptions.length > 0 ? (
              usageOptions.map((option) => {
                const isSelected = usageFilters.some(u => u.toLowerCase() === option.toLowerCase())
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setUsageFilters((current) =>
                        isSelected ? current.filter((value) => value.toLowerCase() !== option.toLowerCase()) : [...current, option]
                      )
                    }
                    className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      isSelected
                        ? "bg-emerald-600 dark:bg-emerald-500 text-white"
                        : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {t(`plant.utility.${option.toLowerCase()}`, { defaultValue: option })}
                  </button>
                )
              })
            ) : (
              <p className="text-xs opacity-60">
                {t("plantInfo.values.notAvailable", { defaultValue: "N/A" })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Seasons */}
      <div>
        <FilterSectionHeader
          label={t("plant.season")}
          isOpen={seasonSectionOpen}
          onToggle={() => setSeasonSectionOpen((prev) => !prev)}
        />
        {seasonSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["spring", "summer", "autumn", "winter"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeasonFilter((cur) => (cur === s ? null : s))}
                className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  seasonFilter === s ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                }`}
                aria-pressed={seasonFilter === s}
              >
                {t(`plant.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Colors */}
      <div>
        <FilterSectionHeader
          label={t("plant.color")}
          isOpen={colorSectionOpen}
          onToggle={() => setColorSectionOpen((prev) => !prev)}
        />
        {colorSectionOpen && (
          <div className="mt-3 space-y-3">
            {colorOptions.length === 0 ? (
              <div className="text-sm text-stone-500 dark:text-stone-400">{t("common.loading")}</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {primaryColors.length > 0 ? (
                    primaryColors.map(renderColorOption)
                  ) : (
                    <p className="text-xs opacity-60">
                      {t("plant.noPrimaryColors", { defaultValue: "No primary colors available." })}
                    </p>
                  )}
                </div>
                {advancedColors.length > 0 && (
                  <div className="rounded-2xl border border-dashed border-stone-200 dark:border-[#3e3e42] p-3 bg-white/70 dark:bg-[#2d2d30]/50">
                    <button
                      type="button"
                      onClick={() => setAdvancedColorsOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-expanded={advancedColorsOpen}
                    >
                      <span>{t("plant.advancedColors", { defaultValue: "Advanced colors" })}</span>
                      {advancedColorsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {advancedColorsOpen && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {advancedColors.map(renderColorOption)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Habitat */}
      <div>
        <FilterSectionHeader
          label={t("plantInfo:labels.habitat", { defaultValue: "Habitat" })}
          isOpen={habitatSectionOpen}
          onToggle={() => setHabitatSectionOpen((prev) => !prev)}
        />
        {habitatSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {habitatOptions.map((habitat) => {
              const isSelected = habitatFilters.includes(habitat)
              const habitatKey = habitat.toLowerCase().replace(/[\s-]/g, '')
              return (
                <button
                  key={habitat}
                  type="button"
                  onClick={() =>
                    setHabitatFilters((current) =>
                      isSelected ? current.filter((h) => h !== habitat) : [...current, habitat]
                    )
                  }
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "bg-teal-600 dark:bg-teal-500 text-white"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {t(`plantInfo:enums.climate.${habitatKey}`, { defaultValue: habitat })}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Maintenance Level */}
      <div>
        <FilterSectionHeader
          label={t("plantInfo:labels.maintenance", { defaultValue: "Maintenance" })}
          isOpen={maintenanceSectionOpen}
          onToggle={() => setMaintenanceSectionOpen((prev) => !prev)}
        />
        {maintenanceSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {maintenanceOptions.map((level) => {
              const isSelected = maintenanceFilter === level
              const levelKey = level.toLowerCase()
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setMaintenanceFilter((current) => (current === level ? null : level))}
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "bg-violet-600 dark:bg-violet-500 text-white"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {t(`plantInfo:enums.careLevel.${levelKey}`, { defaultValue: level })}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Safety Toggles - Pet-Safe & Human-Safe */}
      <div>
        <div className="text-xs font-medium mb-3 uppercase tracking-wide text-stone-500 dark:text-stone-300">
          {t("plant.safetyFilters", { defaultValue: "Safety" })}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPetSafe((v) => !v)}
            className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              petSafe ? "bg-cyan-600 dark:bg-cyan-500 text-white" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
            }`}
            aria-pressed={petSafe}
          >
            <span>🐾</span> {t("plant.petSafe", { defaultValue: "Pet-Safe" })}
          </button>
          <button
            type="button"
            onClick={() => setHumanSafe((v) => !v)}
            className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              humanSafe ? "bg-cyan-600 dark:bg-cyan-500 text-white" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
            }`}
            aria-pressed={humanSafe}
          >
            <span>👤</span> {t("plant.humanSafe", { defaultValue: "Human-Safe" })}
          </button>
        </div>
      </div>

      {/* Indoor / Outdoor - Not collapsible */}
      <div>
        <div className="text-xs font-medium mb-3 uppercase tracking-wide text-stone-500 dark:text-stone-300">
          {t("plantInfo:labels.livingSpace", { defaultValue: "Living Space" })}
        </div>
        <div className="flex gap-2">
          {livingSpaceOptions.map((space) => {
            const isSelected = livingSpaceFilters.includes(space)
            const spaceKey = space.toLowerCase()
            return (
              <button
                key={space}
                type="button"
                onClick={() =>
                  setLivingSpaceFilters((current) =>
                    isSelected ? current.filter((s) => s !== space) : [...current, space]
                  )
                }
                className={`flex-1 px-4 py-2 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isSelected
                    ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                    : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                }`}
                aria-pressed={isSelected}
              >
                {t(`plantInfo:enums.livingSpace.${spaceKey}`, { defaultValue: space })}
              </button>
            )
          })}
        </div>
        {livingSpaceFilters.length === 2 && (
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            {t("plant.livingSpaceBothHint", { defaultValue: "Showing plants suitable for indoor OR outdoor" })}
          </p>
        )}
      </div>

      {/* Life Cycle */}
      <div>
        <FilterSectionHeader
          label={t("plant.lifeCycleLabel", { defaultValue: "Life Cycle" })}
          isOpen={lifeCycleSectionOpen}
          onToggle={() => setLifeCycleSectionOpen((prev) => !prev)}
        />
        {lifeCycleSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["annual", "biennial", "perennial", "succulent_perennial", "monocarpic", "ephemeral"] as const).map((option) => {
              const isSelected = lifeCycleFilters.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setLifeCycleFilters((current) =>
                      isSelected ? current.filter((v) => v !== option) : [...current, option]
                    )
                  }
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "bg-lime-600 dark:bg-lime-500 text-white"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {t(`plantInfo:enums.lifeCycle.${option}`, { defaultValue: option })}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Plant Habit */}
      <div>
        <FilterSectionHeader
          label={t("plant.plantHabitLabel", { defaultValue: "Plant Habit" })}
          isOpen={plantHabitSectionOpen}
          onToggle={() => setPlantHabitSectionOpen((prev) => !prev)}
        />
        {plantHabitSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["upright", "spreading", "clumping", "shrubby", "erect", "bushy", "climbing", "creeping", "trailing", "rosette", "arborescent", "carpeting", "ground_cover", "rhizomatous", "liana", "succulent", "suckering", "ball_shaped"] as const).map((option) => {
              const isSelected = plantHabitFilters.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setPlantHabitFilters((current) =>
                      isSelected ? current.filter((v) => v !== option) : [...current, option]
                    )
                  }
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "bg-amber-600 dark:bg-amber-500 text-white"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {t(`plant.plantHabit.${option}`, { defaultValue: option })}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Plant Parts */}
      <div>
        <FilterSectionHeader
          label={t("plant.plantPartLabel", { defaultValue: "Plant Parts" })}
          isOpen={plantPartSectionOpen}
          onToggle={() => setPlantPartSectionOpen((prev) => !prev)}
        />
        {plantPartSectionOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["roots", "bulbs", "stems", "leaves", "flowers", "fruits", "spores"] as const).map((option) => {
              const isSelected = plantPartFilters.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setPlantPartFilters((current) =>
                      isSelected ? current.filter((v) => v !== option) : [...current, option]
                    )
                  }
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "bg-green-600 dark:bg-green-500 text-white"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {t(`plantInfo:enums.plantPart.${option}`, { defaultValue: option })}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Edible Part — only visible when Usage: Edible (Comestible) is active */}
      {hasEdibleUsage && (
        <div>
          <FilterSectionHeader
            label={t("plant.ediblePartLabel", { defaultValue: "Edible Part" })}
            isOpen={ediblePartSectionOpen}
            onToggle={() => setEdiblePartSectionOpen((prev) => !prev)}
          />
          {ediblePartSectionOpen && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["fruit", "flower", "leaf", "stem", "seed", "rhizome", "bulb", "bark"] as const).map((option) => {
                const isSelected = ediblePartFilters.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setEdiblePartFilters((current) =>
                        isSelected ? current.filter((v) => v !== option) : [...current, option]
                      )
                    }
                    className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      isSelected
                        ? "bg-orange-600 dark:bg-orange-500 text-white"
                        : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {t(`plantInfo:enums.ediblePart.${option}`, { defaultValue: option })}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Active filters summary */}
      <div className="text-xs space-y-1">
        <div className="font-medium uppercase tracking-wide opacity-60">{t("plant.active")}</div>
        <div className="flex flex-wrap gap-2">
          {seasonFilter && <Badge variant="secondary" className="rounded-xl">{t(`plant.${seasonFilter.toLowerCase()}`)}</Badge>}
          {colorFilter.map((color) => (
            <Badge key={color} variant="secondary" className="rounded-xl">{t(`plant.${color.toLowerCase()}`, { defaultValue: color })}</Badge>
          ))}
          {typeFilter && <Badge variant="secondary" className="rounded-xl">{t(`plant.classificationType.${typeFilter.toLowerCase()}`, { defaultValue: typeFilter })}</Badge>}
          {usageFilters.map((usage) => (
            <Badge key={usage} variant="secondary" className="rounded-xl">{t(`plant.utility.${usage.toLowerCase()}`, { defaultValue: usage })}</Badge>
          ))}
          {habitatFilters.map((habitat) => (
            <Badge key={habitat} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.climate.${habitat.toLowerCase().replace(/[\s-]/g, '')}`, { defaultValue: habitat })}</Badge>
          ))}
          {maintenanceFilter && <Badge variant="secondary" className="rounded-xl">{t(`plantInfo:enums.careLevel.${maintenanceFilter.toLowerCase()}`, { defaultValue: maintenanceFilter })}</Badge>}
          {petSafe && <Badge variant="secondary" className="rounded-xl">🐾 {t("plant.petSafe", { defaultValue: "Pet-Safe" })}</Badge>}
          {humanSafe && <Badge variant="secondary" className="rounded-xl">👤 {t("plant.humanSafe", { defaultValue: "Human-Safe" })}</Badge>}
          {livingSpaceFilters.map((space) => (
            <Badge key={space} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.livingSpace.${space.toLowerCase()}`, { defaultValue: space })}</Badge>
          ))}
          {lifeCycleFilters.map((lc) => (
            <Badge key={lc} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.lifeCycle.${lc}`, { defaultValue: lc })}</Badge>
          ))}
          {plantHabitFilters.map((ph) => (
            <Badge key={ph} variant="secondary" className="rounded-xl">{t(`plant.plantHabit.${ph}`, { defaultValue: ph })}</Badge>
          ))}
          {ediblePartFilters.map((ep) => (
            <Badge key={ep} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.ediblePart.${ep}`, { defaultValue: ep })}</Badge>
          ))}
          {plantPartFilters.map((pp) => (
            <Badge key={pp} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.plantPart.${pp}`, { defaultValue: pp })}</Badge>
          ))}
          {!seasonFilter && colorFilter.length === 0 && !typeFilter && usageFilters.length === 0 && habitatFilters.length === 0 && !maintenanceFilter && !petSafe && !humanSafe && livingSpaceFilters.length === 0 && lifeCycleFilters.length === 0 && plantHabitFilters.length === 0 && ediblePartFilters.length === 0 && plantPartFilters.length === 0 && (
            <span className="opacity-50">{t("plant.none")}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ⚡ Bolt: Memoize FilterControls to prevent re-renders on every swipe.
// The parent PlantSwipe re-renders frequently (index changes), but filter props
// (options, handlers) remain stable.
export const FilterControls = React.memo(FilterControlsComponent)
