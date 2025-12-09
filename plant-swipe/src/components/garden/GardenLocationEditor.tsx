import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { MapPin, Loader2, Check, CloudSun, Search, X } from "lucide-react";
import type { Garden } from "@/types/garden";

interface LocationSuggestion {
  id: number;
  name: string;
  country: string;
  admin1?: string; // State/Province
  latitude: number;
  longitude: number;
  timezone?: string;
}

interface GardenLocationEditorProps {
  garden: Garden | null;
  onSaved: () => void;
  canEdit: boolean;
}

export const GardenLocationEditor: React.FC<GardenLocationEditorProps> = ({
  garden,
  onSaved,
  canEdit,
}) => {
  const { t } = useTranslation("common");
  const gardenId = garden?.id;
  const gardenCity = garden?.locationCity || "";
  const gardenCountry = garden?.locationCountry || "";
  const gardenLat = garden?.locationLat || null;
  const gardenLon = garden?.locationLon || null;
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLocation, setSelectedLocation] = React.useState<LocationSuggestion | null>(null);
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [detectingLocation, setDetectingLocation] = React.useState(false);
  
  const inputRef = React.useRef<HTMLInputElement>(null);
  const suggestionsRef = React.useRef<HTMLDivElement>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Track previous values to detect changes
  const prevValuesRef = React.useRef<{ gardenId?: string; city?: string; country?: string }>({});

  // Initialize from garden data - runs when garden data changes
  React.useEffect(() => {
    console.log("[LocationEditor] useEffect triggered:", { 
      gardenId, 
      gardenCity, 
      gardenCountry, 
      gardenLat, 
      gardenLon,
      prev: prevValuesRef.current
    });
    
    const prevGardenId = prevValuesRef.current.gardenId;
    const prevCity = prevValuesRef.current.city;
    const prevCountry = prevValuesRef.current.country;
    
    // Check if anything actually changed
    const gardenChanged = gardenId !== prevGardenId;
    const locationChanged = gardenCity !== prevCity || gardenCountry !== prevCountry;
    
    console.log("[LocationEditor] Change detection:", { gardenChanged, locationChanged });
    
    if (gardenChanged || locationChanged) {
      prevValuesRef.current = { gardenId, city: gardenCity, country: gardenCountry };
      
      if (gardenCity) {
        console.log("[LocationEditor] Setting location from garden data:", gardenCity, gardenCountry, gardenLat, gardenLon);
        setSearchQuery("");
        setSelectedLocation({
          id: 0,
          name: gardenCity,
          country: gardenCountry,
          latitude: gardenLat || 0,
          longitude: gardenLon || 0,
        });
      } else if (gardenChanged) {
        // Only clear when switching gardens, not when location is empty after save
        console.log("[LocationEditor] Clearing location (garden changed)");
        setSearchQuery("");
        setSelectedLocation(null);
      }
    }
  }, [gardenId, gardenCity, gardenCountry, gardenLat, gardenLon]);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for location suggestions
  const searchLocations = React.useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    try {
      const resp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && Array.isArray(data.results)) {
          interface GeoResult {
            id: number;
            name: string;
            country?: string;
            admin1?: string;
            latitude: number;
            longitude: number;
            timezone?: string;
          }
          setSuggestions(
            data.results.map((r: GeoResult) => ({
              id: r.id,
              name: r.name,
              country: r.country || "",
              admin1: r.admin1 || "",
              latitude: r.latitude,
              longitude: r.longitude,
              timezone: r.timezone,
            }))
          );
        } else {
          setSuggestions([]);
        }
      }
    } catch (err) {
      console.error("[location] Search failed:", err);
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    setSelectedLocation(suggestion);
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Clear selected location
  const handleClearLocation = () => {
    setSelectedLocation(null);
    setSearchQuery("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // Save location
  const handleSave = async () => {
    if (!garden?.id || !canEdit || !selectedLocation) return;
    
    setSaving(true);
    setSaved(false);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const payload = {
        city: selectedLocation.name,
        country: selectedLocation.country,
        lat: selectedLocation.latitude,
        lon: selectedLocation.longitude,
        timezone: selectedLocation.timezone || null,
      };
      
      console.log("[location] Saving location:", payload);

      const resp = await fetch(`/api/garden/${garden.id}/location`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      console.log("[location] Save response:", resp.status, data);

      if (resp.ok && data.ok) {
        setSaved(true);
        // Call onSaved to refresh the garden data
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      } else {
        console.error("[location] Save failed:", data.error || "Unknown error");
        alert(data.error || "Failed to save location");
      }
    } catch (err) {
      console.error("[location] Failed to save:", err);
      alert("Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Detect current location
  const detectLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Use Open-Meteo reverse geocoding (not used, kept for future reference)
          // Fallback to Nominatim for reverse geocoding
          const nomResp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept': 'application/json' } }
          );
          
          if (nomResp.ok) {
            const nomData = await nomResp.json();
            const detectedCity = nomData.address?.city || nomData.address?.town || nomData.address?.village || nomData.address?.municipality || "";
            const detectedCountry = nomData.address?.country || "";
            
            if (detectedCity) {
              setSelectedLocation({
                id: Date.now(),
                name: detectedCity,
                country: detectedCountry,
                latitude,
                longitude,
              });
              setSearchQuery("");
            }
          }
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
          alert("Unable to detect location name. Please search manually.");
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setDetectingLocation(false);
        alert("Unable to detect location. Please search manually.");
      },
      { timeout: 10000 }
    );
  };

  // Check if there are changes
  const hasChanges = selectedLocation
    ? selectedLocation.name !== gardenCity || selectedLocation.country !== gardenCountry
    : false;


  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "gardenDashboard.settingsSection.locationDescription",
          "Set your garden's location to get weather-based advice and forecasts."
        )}
      </p>

      {/* Location Search / Display */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t("gardenDashboard.settingsSection.location", "Location")}
        </label>
        
        {selectedLocation ? (
          /* Selected location display */
          <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20">
            <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-emerald-800 dark:text-emerald-200 truncate">
                {selectedLocation.name}
              </div>
              {selectedLocation.country && (
                <div className="text-sm text-emerald-600 dark:text-emerald-400 truncate">
                  {selectedLocation.admin1 ? `${selectedLocation.admin1}, ` : ""}{selectedLocation.country}
                </div>
              )}
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full p-1 h-auto hover:bg-emerald-200 dark:hover:bg-emerald-800"
                onClick={handleClearLocation}
              >
                <X className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </Button>
            )}
          </div>
        ) : (
          /* Search input with suggestions */
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                placeholder={t("gardenDashboard.settingsSection.searchLocation", "Search for a city...")}
                disabled={!canEdit}
                className="rounded-xl pl-10 pr-10"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1f1f1f] rounded-xl border border-stone-200 dark:border-stone-700 shadow-lg overflow-hidden"
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <MapPin className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800 dark:text-stone-200 truncate">
                        {suggestion.name}
                      </div>
                      <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
                        {suggestion.admin1 ? `${suggestion.admin1}, ` : ""}{suggestion.country}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* No results message */}
            {showSuggestions && searchQuery.length >= 2 && !searching && suggestions.length === 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1f1f1f] rounded-xl border border-stone-200 dark:border-stone-700 shadow-lg p-4 text-center text-sm text-muted-foreground"
              >
                {t("gardenDashboard.settingsSection.noResults", "No locations found. Try a different search.")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-2"
          onClick={detectLocation}
          disabled={!canEdit || detectingLocation}
        >
          {detectingLocation ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("gardenDashboard.settingsSection.detecting", "Detecting...")}
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              {t("gardenDashboard.settingsSection.detectLocation", "Detect Location")}
            </>
          )}
        </Button>

        {canEdit && (
          <Button
            onClick={handleSave}
            disabled={saving || !selectedLocation || !hasChanges}
            className="rounded-xl gap-2"
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.saving", "Saving...")}
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                {t("common.saved", "Saved!")}
              </>
            ) : (
              t("common.save", "Save")
            )}
          </Button>
        )}
      </div>

      {/* Weather info message */}
      {selectedLocation && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 text-sm">
          <CloudSun className="w-4 h-4 flex-shrink-0" />
          <span>
            {t(
              "gardenDashboard.settingsSection.locationSet",
              "Weather-based advice will use this location for forecasts."
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default GardenLocationEditor;
