import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { Home, Trees, FlaskConical, Warehouse, Loader2, Check } from "lucide-react";
import type { Garden, GardenLivingSpace } from "@/types/garden";

const LIVING_SPACE_OPTIONS: Array<{
  value: GardenLivingSpace;
  icon: React.ReactNode;
  labelKey: string;
  defaultLabel: string;
}> = [
  { value: "indoor", icon: <Home className="w-5 h-5" />, labelKey: "garden.livingSpaceOptions.indoor", defaultLabel: "Indoor" },
  { value: "outdoor", icon: <Trees className="w-5 h-5" />, labelKey: "garden.livingSpaceOptions.outdoor", defaultLabel: "Outdoor" },
  { value: "terrarium", icon: <FlaskConical className="w-5 h-5" />, labelKey: "garden.livingSpaceOptions.terrarium", defaultLabel: "Terrarium" },
  { value: "greenhouse", icon: <Warehouse className="w-5 h-5" />, labelKey: "garden.livingSpaceOptions.greenhouse", defaultLabel: "Greenhouse" },
];

export const GardenLivingSpaceEditor: React.FC<{
  garden: Garden | null;
  onSaved: () => Promise<void>;
  canEdit: boolean;
}> = ({ garden, onSaved, canEdit }) => {
  const { t } = useTranslation("common");
  const [selected, setSelected] = React.useState<GardenLivingSpace[]>(garden?.livingSpace ?? []);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const gardenLivingSpaceJson = JSON.stringify(garden?.livingSpace ?? []);
  React.useEffect(() => {
    setSelected(JSON.parse(gardenLivingSpaceJson));
  }, [gardenLivingSpaceJson]);

  const toggle = (value: GardenLivingSpace) => {
    if (!canEdit) return;
    setSaveError(null);
    setSaved(false);
    // Single-select: always replace with the clicked value (or deselect if same)
    setSelected((prev) =>
      prev.includes(value) ? [] : [value]
    );
  };

  const dirty = React.useMemo(() => {
    const orig = garden?.livingSpace ?? [];
    if (orig.length !== selected.length) return true;
    return !orig.every((v) => selected.includes(v));
  }, [gardenLivingSpaceJson, selected]);

  const save = async () => {
    if (!garden || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("gardens")
        .update({ living_space: selected })
        .eq("id", garden.id);
      if (error) throw error;
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Failed to save living space", e);
      setSaveError(e?.message || t("common.errorUnknown", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {LIVING_SPACE_OPTIONS.map((opt) => {
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

      {/* Save button — always visible when canEdit, enabled when dirty */}
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

export { LIVING_SPACE_OPTIONS };
