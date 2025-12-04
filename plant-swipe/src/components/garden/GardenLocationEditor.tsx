// @ts-nocheck
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { MapPin, Loader2, Check, CloudSun } from "lucide-react";
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
  const [city, setCity] = React.useState((garden as any)?.locationCity || "");
  const [country, setCountry] = React.useState((garden as any)?.locationCountry || "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [detectingLocation, setDetectingLocation] = React.useState(false);

  React.useEffect(() => {
    setCity((garden as any)?.locationCity || "");
    setCountry((garden as any)?.locationCountry || "");
  }, [garden]);

  const handleSave = async () => {
    if (!garden?.id || !canEdit) return;
    setSaving(true);
    setSaved(false);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const resp = await fetch(`/api/garden/${garden.id}/location`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({ city: city.trim(), country: country.trim() }),
      });

      if (resp.ok) {
        setSaved(true);
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("[location] Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use reverse geocoding to get city name
          const { latitude, longitude } = position.coords;
          const resp = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}`
          );
          
          if (resp.ok) {
            const data = await resp.json();
            if (data?.results?.[0]) {
              setCity(data.results[0].name || "");
              setCountry(data.results[0].country || "");
            }
          } else {
            // Fallback: just use coordinates
            setCity(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          }
        } catch {
          // Fallback method using a free geocoding API
          try {
            const { latitude, longitude } = position.coords;
            const nomResp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            if (nomResp.ok) {
              const nomData = await nomResp.json();
              setCity(nomData.address?.city || nomData.address?.town || nomData.address?.village || "");
              setCountry(nomData.address?.country || "");
            }
          } catch {}
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setDetectingLocation(false);
        alert("Unable to detect location. Please enter it manually.");
      },
      { timeout: 10000 }
    );
  };

  const hasChanges =
    city !== ((garden as any)?.locationCity || "") ||
    country !== ((garden as any)?.locationCountry || "");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "gardenDashboard.settingsSection.locationDescription",
          "Set your garden's location to get weather-based advice and forecasts."
        )}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">
            {t("gardenDashboard.settingsSection.city", "City")}
          </label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("gardenDashboard.settingsSection.cityPlaceholder", "e.g., Paris")}
            disabled={!canEdit}
            className="rounded-xl"
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">
            {t("gardenDashboard.settingsSection.country", "Country")}
          </label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t("gardenDashboard.settingsSection.countryPlaceholder", "e.g., France")}
            disabled={!canEdit}
            className="rounded-xl"
          />
        </div>
      </div>

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
            disabled={saving || !hasChanges}
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

      {city && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm">
          <CloudSun className="w-4 h-4" />
          {t(
            "gardenDashboard.settingsSection.locationSet",
            "Weather-based advice will use this location for forecasts."
          )}
        </div>
      )}
    </div>
  );
};

export default GardenLocationEditor;
