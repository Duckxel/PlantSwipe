import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Garden } from "@/types/garden";
import { resizeSeedlingTray } from "@/lib/gardens";
import { Loader2, Minus, Plus } from "lucide-react";

interface SeedlingTrayDimensionEditorProps {
  garden: Garden | null;
  onSaved: () => Promise<void>;
  canEdit: boolean;
}

export const SeedlingTrayDimensionEditor: React.FC<SeedlingTrayDimensionEditorProps> = ({
  garden,
  onSaved,
  canEdit,
}) => {
  const { t } = useTranslation("common");
  const [rows, setRows] = useState(garden?.trayRows ?? 4);
  const [cols, setCols] = useState(garden?.trayCols ?? 6);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!garden || garden.gardenType !== "seedling") return null;

  const changed = rows !== (garden.trayRows ?? 4) || cols !== (garden.trayCols ?? 6);
  const isSmaller =
    rows * cols < (garden.trayRows ?? 4) * (garden.trayCols ?? 6);

  const handleSave = async () => {
    if (!garden || !canEdit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await resizeSeedlingTray(garden.id, rows, cols);
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resize tray");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-1">
          {t("seedlingTray.settings.trayConfig", "Tray Configuration")}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("seedlingTray.settings.currentSize", {
            rows: garden.trayRows ?? 4,
            cols: garden.trayCols ?? 6,
            total: (garden.trayRows ?? 4) * (garden.trayCols ?? 6),
            defaultValue: "Current size: {{rows}} × {{cols}} ({{total}} cells)",
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {([
          [t("seedlingTray.rows", "Rows"), rows, setRows, 1, 8] as const,
          [t("seedlingTray.cols", "Columns"), cols, setCols, 1, 12] as const,
        ]).map(([label, val, setter, min, max]) => (
          <div key={label}>
            <div className="text-xs text-muted-foreground mb-2">{label}</div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={!canEdit || val <= min}
                onClick={() => setter((v) => Math.max(min, v - 1))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-lg font-semibold min-w-[28px] text-center">{val}</div>
              <button
                type="button"
                disabled={!canEdit || val >= max}
                onClick={() => setter((v) => Math.min(max, v + 1))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default text-emerald-600 dark:text-emerald-400"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        {t("garden.trayTotalCells", { count: rows * cols, defaultValue: "Total: {{count}} cells" })}
      </div>

      {/* Mini preview */}
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="w-4 h-4 rounded bg-muted border border-border" />
        ))}
      </div>

      {isSmaller && changed && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          {t(
            "seedlingTray.settings.resizeWarning",
            "Reducing dimensions may remove cells. Planted cells in removed positions will be lost."
          )}
        </div>
      )}

      {error && <div className="text-xs text-red-500">{error}</div>}

      {changed && canEdit && (
        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t("common.save", "Save")}
        </Button>
      )}
    </div>
  );
};
