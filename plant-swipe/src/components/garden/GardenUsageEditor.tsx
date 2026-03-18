import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { Flower2, Salad, Heart, Wind, Bug, Leaf, Loader2, Check } from "lucide-react";
import type { Garden, GardenUsage } from "@/types/garden";

const USAGE_OPTIONS: Array<{
  value: GardenUsage;
  icon: React.ReactNode;
  labelKey: string;
  defaultLabel: string;
}> = [
  { value: "decorative", icon: <Flower2 className="w-5 h-5" />, labelKey: "garden.usage.decorative", defaultLabel: "Decorative" },
  { value: "edible", icon: <Salad className="w-5 h-5" />, labelKey: "garden.usage.edible", defaultLabel: "Edible / Kitchen" },
  { value: "medicinal", icon: <Heart className="w-5 h-5" />, labelKey: "garden.usage.medicinal", defaultLabel: "Medicinal" },
  { value: "aromatic", icon: <Wind className="w-5 h-5" />, labelKey: "garden.usage.aromatic", defaultLabel: "Aromatic / Fragrant" },
  { value: "pollinator_friendly", icon: <Bug className="w-5 h-5" />, labelKey: "garden.usage.pollinator_friendly", defaultLabel: "Pollinator Friendly" },
  { value: "air_purifying", icon: <Leaf className="w-5 h-5" />, labelKey: "garden.usage.air_purifying", defaultLabel: "Air Purifying" },
];

export const GardenUsageEditor: React.FC<{
  garden: Garden | null;
  onSaved: () => Promise<void>;
  canEdit: boolean;
}> = ({ garden, onSaved, canEdit }) => {
  const { t } = useTranslation("common");
  const [selected, setSelected] = React.useState<GardenUsage[]>(garden?.usage ?? []);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setSelected(garden?.usage ?? []);
  }, [garden?.usage]);

  const toggle = (value: GardenUsage) => {
    if (!canEdit) return;
    setSaveError(null);
    setSaved(false);
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const dirty = React.useMemo(() => {
    const orig = garden?.usage ?? [];
    if (orig.length !== selected.length) return true;
    return !orig.every((v) => selected.includes(v));
  }, [garden?.usage, selected]);

  const save = async () => {
    if (!garden || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("gardens")
        .update({ usage: selected })
        .eq("id", garden.id);
      if (error) throw error;
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Failed to save usage", e);
      setSaveError(e?.message || t("common.errorUnknown", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {USAGE_OPTIONS.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!canEdit}
              onClick={() => toggle(opt.value)}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-sm font-medium transition-all cursor-pointer ${
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
          {t("garden.usage.noneSelected", { defaultValue: "No usage selected — plant recommendations won't be filtered by usage." })}
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

export { USAGE_OPTIONS };
