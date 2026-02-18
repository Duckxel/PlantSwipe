import React from "react";
import { Button } from "@/components/ui/button";
import { CityCountrySelector, type SelectedLocation } from "@/components/ui/city-country-selector";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Check, CloudSun } from "lucide-react";
import type { Garden } from "@/types/garden";

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

  // Local selected location — may differ from saved garden data until user clicks Save
  const [selectedCity, setSelectedCity] = React.useState(gardenCity);
  const [selectedCountry, setSelectedCountry] = React.useState(gardenCountry);
  const [selectedTimezone, setSelectedTimezone] = React.useState<string | undefined>(undefined);
  const [selectedLat, setSelectedLat] = React.useState<number | undefined>(undefined);
  const [selectedLon, setSelectedLon] = React.useState<number | undefined>(undefined);

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Track previous values to detect changes from parent
  const prevValuesRef = React.useRef<{ gardenId?: string; city?: string; country?: string }>({});

  // Sync from garden data when it changes
  React.useEffect(() => {
    const prevGardenId = prevValuesRef.current.gardenId;
    const prevCity = prevValuesRef.current.city;
    const prevCountry = prevValuesRef.current.country;

    const gardenChanged = gardenId !== prevGardenId;
    const locationChanged = gardenCity !== prevCity || gardenCountry !== prevCountry;

    if (gardenChanged || locationChanged) {
      prevValuesRef.current = { gardenId, city: gardenCity, country: gardenCountry };
      setSelectedCity(gardenCity);
      setSelectedCountry(gardenCountry);
      setSelectedTimezone(undefined);
      setSelectedLat(undefined);
      setSelectedLon(undefined);
    }
  }, [gardenId, gardenCity, gardenCountry]);

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedCity(location.city);
    setSelectedCountry(location.country);
    setSelectedTimezone(location.timezone);
    setSelectedLat(location.latitude);
    setSelectedLon(location.longitude);
  };

  const handleLocationClear = () => {
    setSelectedCity("");
    setSelectedCountry("");
    setSelectedTimezone(undefined);
    setSelectedLat(undefined);
    setSelectedLon(undefined);
  };

  // Save location to garden API
  const handleSave = async () => {
    if (!garden?.id || !canEdit || !selectedCity) return;

    setSaving(true);
    setSaved(false);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const payload = {
        city: selectedCity,
        country: selectedCountry,
        lat: selectedLat ?? null,
        lon: selectedLon ?? null,
        timezone: selectedTimezone || null,
      };

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

      if (resp.ok && data.ok) {
        setSaved(true);
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

  const hasLocation = Boolean(selectedCity || selectedCountry);
  const hasChanges = hasLocation
    ? selectedCity !== gardenCity || selectedCountry !== gardenCountry
    : false;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "gardenDashboard.settingsSection.locationDescription",
          "Set your garden's location to get weather-based advice and forecasts."
        )}
      </p>

      <CityCountrySelector
        city={selectedCity}
        country={selectedCountry}
        onSelect={handleLocationSelect}
        onClear={handleLocationClear}
        disabled={!canEdit}
        showDetectButton={true}
        label={t("gardenDashboard.settingsSection.location", "Location")}
        placeholder={t("gardenDashboard.settingsSection.searchLocation", "Search for a city...")}
        noResultsText={t("gardenDashboard.settingsSection.noResults", "No locations found. Try a different search.")}
      />

      {/* Save button */}
      {canEdit && (
        <div className="flex items-center justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || !hasLocation || !hasChanges}
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
        </div>
      )}

      {/* Weather info message */}
      {hasLocation && (
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
