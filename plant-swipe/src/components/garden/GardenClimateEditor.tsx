import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import {
  Snowflake, Mountain, CloudRain, Wind,
  Thermometer, Sun, CloudSun, Palmtree,
  Flame, CloudLightning, Waves, Droplets,
  TreePalm, Anchor, Loader2, Check,
} from "lucide-react";
import type { Garden, GardenClimate } from "@/types/garden";

const CLIMATE_OPTIONS: Array<{
  value: GardenClimate;
  icon: React.ReactNode;
  labelKey: string;
  defaultLabel: string;
}> = [
  { value: "polar", icon: <Snowflake className="w-4 h-4" />, labelKey: "garden.climate.polar", defaultLabel: "Polar" },
  { value: "montane", icon: <Mountain className="w-4 h-4" />, labelKey: "garden.climate.montane", defaultLabel: "Montane" },
  { value: "oceanic", icon: <CloudRain className="w-4 h-4" />, labelKey: "garden.climate.oceanic", defaultLabel: "Oceanic" },
  { value: "degraded_oceanic", icon: <Wind className="w-4 h-4" />, labelKey: "garden.climate.degraded_oceanic", defaultLabel: "Degraded Oceanic" },
  { value: "temperate_continental", icon: <Thermometer className="w-4 h-4" />, labelKey: "garden.climate.temperate_continental", defaultLabel: "Temperate Continental" },
  { value: "mediterranean", icon: <Sun className="w-4 h-4" />, labelKey: "garden.climate.mediterranean", defaultLabel: "Mediterranean" },
  { value: "tropical_dry", icon: <Flame className="w-4 h-4" />, labelKey: "garden.climate.tropical_dry", defaultLabel: "Tropical Dry" },
  { value: "tropical_humid", icon: <Palmtree className="w-4 h-4" />, labelKey: "garden.climate.tropical_humid", defaultLabel: "Tropical Humid" },
  { value: "tropical_volcanic", icon: <Mountain className="w-4 h-4" />, labelKey: "garden.climate.tropical_volcanic", defaultLabel: "Tropical Volcanic" },
  { value: "tropical_cyclonic", icon: <CloudLightning className="w-4 h-4" />, labelKey: "garden.climate.tropical_cyclonic", defaultLabel: "Tropical Cyclonic" },
  { value: "humid_insular", icon: <Waves className="w-4 h-4" />, labelKey: "garden.climate.humid_insular", defaultLabel: "Humid Insular" },
  { value: "subtropical_humid", icon: <Droplets className="w-4 h-4" />, labelKey: "garden.climate.subtropical_humid", defaultLabel: "Subtropical Humid" },
  { value: "equatorial", icon: <TreePalm className="w-4 h-4" />, labelKey: "garden.climate.equatorial", defaultLabel: "Equatorial" },
  { value: "windswept_coastal", icon: <Anchor className="w-4 h-4" />, labelKey: "garden.climate.windswept_coastal", defaultLabel: "Windswept Coastal" },
];

export const GardenClimateEditor: React.FC<{
  garden: Garden | null;
  onSaved: () => Promise<void>;
  canEdit: boolean;
}> = ({ garden, onSaved, canEdit }) => {
  const { t } = useTranslation("common");
  const [selected, setSelected] = React.useState<GardenClimate[]>(garden?.climate ?? []);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setSelected(garden?.climate ?? []);
  }, [garden?.climate]);

  const toggle = (value: GardenClimate) => {
    if (!canEdit) return;
    setSaveError(null);
    setSaved(false);
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const dirty = React.useMemo(() => {
    const orig = garden?.climate ?? [];
    if (orig.length !== selected.length) return true;
    return !orig.every((v) => selected.includes(v));
  }, [garden?.climate, selected]);

  const save = async () => {
    if (!garden || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("gardens")
        .update({ climate: selected })
        .eq("id", garden.id);
      if (error) throw error;
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Failed to save climate", e);
      setSaveError(e?.message || t("common.errorUnknown", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CLIMATE_OPTIONS.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!canEdit}
              onClick={() => toggle(opt.value)}
              className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 shadow-sm"
                  : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600"
              } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span className={active ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}>
                {opt.icon}
              </span>
              <span>{t(opt.labelKey, { defaultValue: opt.defaultLabel })}</span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-stone-400 dark:text-stone-500 italic">
          {t("garden.climate.noneSelected", { defaultValue: "No climate selected — plant recommendations won't be filtered by climate." })}
        </p>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          {saveError && (
            <span className="text-xs text-red-500 dark:text-red-400 mr-auto">{saveError}</span>
          )}
          {saved && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mr-auto">
              <Check className="w-3.5 h-3.5" />
              {t("common.saved", { defaultValue: "Saved" })}
            </span>
          )}
          <Button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-2xl"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        </div>
      )}
    </div>
  );
};

export { CLIMATE_OPTIONS };
