import * as React from "react"
import { MapPin, Loader2, X, Clock } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { useDebounce } from "@/hooks/useDebounce"
import { useTranslation } from "react-i18next"
import { useLanguage } from "@/lib/i18nRouting"
import { cn } from "@/lib/utils"

/** Represents a geocoded location result */
export interface LocationSuggestion {
  id: number
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

/** The selected location data passed to callbacks */
export interface SelectedLocation {
  city: string
  country: string
  timezone?: string
  latitude?: number
  longitude?: number
  admin1?: string
}

export interface CityCountrySelectorProps {
  /** Currently selected city (controlled) */
  city: string
  /** Currently selected country (controlled) */
  country: string
  /** Optional timezone to display alongside the selected location */
  timezone?: string
  /** Called when a location is selected (from search or detection) */
  onSelect: (location: SelectedLocation) => void
  /** Called when the selected location is cleared */
  onClear: () => void
  /** Disables all interactions */
  disabled?: boolean
  /** Show the "Detect my location" button (browser GPS). Default: true */
  showDetectButton?: boolean
  /** Show the timezone in the selected location display. Default: false */
  showTimezone?: boolean
  /** Size variant for the search input. Default: "default" */
  variant?: "sm" | "default" | "lg"
  /** Additional class on the root wrapper */
  className?: string
  /** Label text above the search input. Default: translated "Search for your city" */
  label?: string
  /** Placeholder for the search input. Default: translated "Type a city name..." */
  placeholder?: string
  /** Text for the no-results message. Default: translated "No cities found. Try a different search." */
  noResultsText?: string
}

/**
 * A shared City/Country selector component with geocoding search and GPS-based
 * location detection. Uses the Open-Meteo geocoding API for search and
 * Nominatim for reverse geocoding.
 *
 * Standardised across Garden Settings, User Settings, Setup page, and Edit Profile.
 */
export const CityCountrySelector: React.FC<CityCountrySelectorProps> = ({
  city,
  country,
  timezone,
  onSelect,
  onClear,
  disabled = false,
  showDetectButton = true,
  showTimezone = false,
  variant = "default",
  className,
  label,
  placeholder,
  noResultsText,
}) => {
  const { t } = useTranslation("common")
  const currentLang = useLanguage()

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebounce(searchQuery, 350)
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)

  // Detection state (unified)
  const [detecting, setDetecting] = React.useState(false)

  const suggestionsRef = React.useRef<HTMLDivElement>(null)

  // Whether a location is currently selected
  const hasLocation = Boolean(city || country)

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced search for location suggestions
  React.useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSuggestions([])
      setHasSearched(false)
      return
    }

    let cancelled = false

    const searchLocations = async () => {
      setSearching(true)
      try {
        const resp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(debouncedSearch)}&count=8&language=${currentLang}&format=json`
        )
        if (cancelled) return

        if (resp.ok) {
          const data = await resp.json()
          if (cancelled) return

          if (data.results && Array.isArray(data.results)) {
            setSuggestions(
              data.results.map((r: LocationSuggestion) => ({
                id: r.id,
                name: r.name,
                country: r.country || "",
                admin1: r.admin1 || "",
                latitude: r.latitude,
                longitude: r.longitude,
                timezone: r.timezone,
              }))
            )
          } else {
            setSuggestions([])
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[CityCountrySelector] Search failed:", err)
          setSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setSearching(false)
          setHasSearched(true)
        }
      }
    }

    searchLocations()

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, currentLang])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowSuggestions(true)
    if (value !== debouncedSearch) {
      setHasSearched(false)
    }
  }

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    onSelect({
      city: suggestion.name,
      country: suggestion.country,
      timezone: suggestion.timezone,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      admin1: suggestion.admin1,
    })
    setSearchQuery("")
    setSuggestions([])
    setShowSuggestions(false)
    setHasSearched(false)
  }

  const handleClear = () => {
    onClear()
    setSearchQuery("")
    setSuggestions([])
    setShowSuggestions(false)
    setHasSearched(false)
  }

  /**
   * GPS-based detection via browser Geolocation + Nominatim reverse geocoding.
   * Returns a promise that resolves with the detected location or null.
   */
  const detectViaGPS = (): Promise<SelectedLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
              { headers: { Accept: "application/json" } }
            )

            if (resp.ok) {
              const data = await resp.json()
              const detectedCity =
                data.address?.city ||
                data.address?.town ||
                data.address?.village ||
                data.address?.municipality ||
                ""
              const detectedCountry = data.address?.country || ""

              if (detectedCity || detectedCountry) {
                resolve({ city: detectedCity, country: detectedCountry, latitude, longitude })
                return
              }
            }
          } catch (err) {
            console.error("[CityCountrySelector] Reverse geocoding failed:", err)
          }
          resolve(null)
        },
        (err) => {
          console.error("[CityCountrySelector] Geolocation error:", err)
          resolve(null)
        },
        { timeout: 8000 }
      )
    })
  }

  /**
   * Detect location via browser GPS + reverse geocoding.
   */
  const detectLocation = async () => {
    if (!navigator.geolocation) {
      alert(t("setup.location.geoNotSupported", "Geolocation is not supported by your browser"))
      return
    }

    setDetecting(true)
    try {
      const result = await detectViaGPS()
      if (result) {
        onSelect(result)
        setSearchQuery("")
      } else {
        alert(t("setup.location.detectFailed", "Unable to detect location. Please search manually."))
      }
    } finally {
      setDetecting(false)
    }
  }

  const resolvedLabel = label ?? t("setup.location.searchLabel", "Search for your city")
  const resolvedPlaceholder = placeholder ?? t("setup.location.searchPlaceholder", "Type a city name...")
  const resolvedNoResults = noResultsText ?? t("setup.location.noResults", "No cities found. Try a different search.")

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selected location display */}
      {hasLocation && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
          <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-stone-800 dark:text-stone-100 truncate">
              {city || country}
            </div>
            {city && country && (
              <div className="text-sm text-stone-600 dark:text-stone-400 truncate">
                {country}
              </div>
            )}
            {showTimezone && timezone && (
              <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-500 mt-1">
                <Clock className="w-3 h-3" />
                {timezone}
              </div>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              aria-label={t("setup.location.clear", "Clear location")}
            >
              <X className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
            </button>
          )}
        </div>
      )}

      {/* Search input with suggestions */}
      {!hasLocation && (
        <div className="space-y-3">
          {resolvedLabel && (
            <label className="text-sm font-medium text-stone-600 dark:text-stone-300">
              {resolvedLabel}
            </label>
          )}
          <div className="relative" ref={suggestionsRef}>
            <SearchInput
              variant={variant}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
              onClear={
                searchQuery
                  ? () => {
                      setSearchQuery("")
                      setSuggestions([])
                      setShowSuggestions(false)
                    }
                  : undefined
              }
              placeholder={resolvedPlaceholder}
              loading={searching}
              disabled={disabled}
              className="bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl overflow-hidden">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-left"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <MapPin className="w-5 h-5 text-stone-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800 dark:text-stone-100 truncate">
                        {suggestion.name}
                      </div>
                      <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
                        {suggestion.admin1 ? `${suggestion.admin1}, ` : ""}
                        {suggestion.country}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {showSuggestions &&
              hasSearched &&
              !searching &&
              suggestions.length === 0 &&
              debouncedSearch.length >= 2 && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl p-4 text-center text-sm text-stone-500">
                  {resolvedNoResults}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Detect location button */}
      {showDetectButton && !hasLocation && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={detectLocation}
            disabled={disabled || detecting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all disabled:opacity-50"
          >
            {detecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("setup.location.detectingGPS", "Detecting...")}
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                {t("setup.location.detectButton", "Detect my location")}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default CityCountrySelector
