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
  onlySeeds: boolean
  setOnlySeeds: React.Dispatch<React.SetStateAction<boolean>>
  onlyFavorites: boolean
  setOnlyFavorites: React.Dispatch<React.SetStateAction<boolean>>

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
  onlySeeds,
  setOnlySeeds,
  onlyFavorites,
  setOnlyFavorites,
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
    onlySeeds ||
    onlyFavorites

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
    setOnlySeeds(false)
    setOnlyFavorites(false)
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
              typeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTypeFilter((current) => (current === option ? null : option))}
                  className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    typeFilter === option
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
                  }`}
                  aria-pressed={typeFilter === option}
                >
                  {t(`plant.classificationType.${option.toLowerCase()}`, { defaultValue: option })}
                </button>
              ))
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
                const isSelected = usageFilters.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setUsageFilters((current) =>
                        isSelected ? current.filter((value) => value !== option) : [...current, option]
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
                  {t(`plantInfo:enums.habitat.${habitatKey}`, { defaultValue: habitat })}
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
                  {t(`plantDetails.maintenanceLevels.${levelKey}`, { defaultValue: level })}
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
            {t("plant.livingSpaceBothHint", { defaultValue: "Showing plants suitable for both indoor AND outdoor" })}
          </p>
        )}
      </div>

      {/* Toggles */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={() => setOnlySeeds((v) => !v)}
          className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            onlySeeds ? "bg-emerald-600 dark:bg-emerald-500 text-white" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
          }`}
          aria-pressed={onlySeeds}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current" /> {t("plant.seedsOnly")}
        </button>
        <button
          type="button"
          onClick={() => setOnlyFavorites((v) => !v)}
          className={`w-full justify-center px-3 py-2 rounded-2xl text-sm shadow-sm border flex items-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            onlyFavorites ? "bg-rose-600 dark:bg-rose-500 text-white" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
          }`}
          aria-pressed={onlyFavorites}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current" /> {t("plant.favoritesOnly")}
        </button>
      </div>

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
            <Badge key={habitat} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.habitat.${habitat.toLowerCase().replace(/[\s-]/g, '')}`, { defaultValue: habitat })}</Badge>
          ))}
          {maintenanceFilter && <Badge variant="secondary" className="rounded-xl">{t(`plantDetails.maintenanceLevels.${maintenanceFilter.toLowerCase()}`, { defaultValue: maintenanceFilter })}</Badge>}
          {petSafe && <Badge variant="secondary" className="rounded-xl">🐾 {t("plant.petSafe", { defaultValue: "Pet-Safe" })}</Badge>}
          {humanSafe && <Badge variant="secondary" className="rounded-xl">👤 {t("plant.humanSafe", { defaultValue: "Human-Safe" })}</Badge>}
          {livingSpaceFilters.map((space) => (
            <Badge key={space} variant="secondary" className="rounded-xl">{t(`plantInfo:enums.livingSpace.${space.toLowerCase()}`, { defaultValue: space })}</Badge>
          ))}
          {onlySeeds && <Badge variant="secondary" className="rounded-xl">{t("plant.seedsOnly")}</Badge>}
          {onlyFavorites && <Badge variant="secondary" className="rounded-xl">{t("plant.favoritesOnly")}</Badge>}
          {!seasonFilter && colorFilter.length === 0 && !typeFilter && usageFilters.length === 0 && habitatFilters.length === 0 && !maintenanceFilter && !petSafe && !humanSafe && livingSpaceFilters.length === 0 && !onlySeeds && !onlyFavorites && (
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
