import React from "react";
import { useTranslation } from "react-i18next";
import type { SeedlingTrayCell } from "@/types/garden";
import type { Plant } from "@/types/plant";
import { SeedlingStageIcon } from "./SeedlingStageIcon";

const STAGE_CELL_CLASSES: Record<string, string> = {
  empty: "bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600",
  sown: "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700",
  germinating: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-800",
  sprouted: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 dark:border-emerald-700",
  ready: "bg-emerald-200 dark:bg-emerald-800/30 border-emerald-500 dark:border-emerald-600",
};

interface SeedlingTrayGridProps {
  cells: SeedlingTrayCell[];
  rows: number;
  cols: number;
  trayName: string;
  plantMap: Record<string, Plant>;
  onCellClick: (index: number) => void;
  selectMode: boolean;
  selected: Set<number>;
  onToggleSelectMode: () => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onOpenMultiEdit: () => void;
  onExitSelectMode: () => void;
}

export const SeedlingTrayGrid: React.FC<SeedlingTrayGridProps> = ({
  cells,
  rows: _rows,
  cols,
  trayName,
  plantMap,
  onCellClick,
  selectMode,
  selected,
  onToggleSelectMode,
  onSelectAll,
  onSelectNone,
  onOpenMultiEdit,
  onExitSelectMode,
}) => {
  const { t } = useTranslation("common");

  const daysDiff = (d: string | null) => {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  };

  const stages = [
    { id: "empty", label: t("seedlingTray.stages.empty", "Empty") },
    { id: "sown", label: t("seedlingTray.stages.sown", "Sown") },
    { id: "germinating", label: t("seedlingTray.stages.germinating", "Germinating") },
    { id: "sprouted", label: t("seedlingTray.stages.sprouted", "Sprouted") },
    { id: "ready", label: t("seedlingTray.stages.ready", "Ready") },
  ] as const;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-base font-semibold truncate">{trayName}</div>
        <div className="flex gap-2 items-center flex-shrink-0">
          {selectMode ? (
            <>
              <span className="text-xs text-muted-foreground">
                {t("seedlingTray.selected", { count: selected.size, defaultValue: "{{count}} selected" })}
              </span>
              <button
                onClick={onSelectAll}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {t("seedlingTray.all", "All")}
              </button>
              <button
                onClick={onSelectNone}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {t("seedlingTray.none", "None")}
              </button>
              <button
                onClick={onOpenMultiEdit}
                disabled={selected.size === 0}
                className={`px-3.5 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                  selected.size > 0
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : "border-border text-muted-foreground opacity-50 cursor-default"
                }`}
              >
                {t("seedlingTray.edit", "Edit")} {selected.size > 0 ? selected.size : ""}
              </button>
              <button
                onClick={onExitSelectMode}
                className="px-3.5 py-1.5 rounded-lg border border-red-800/40 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              >
                {t("seedlingTray.cancel", "Cancel")}
              </button>
            </>
          ) : (
            <button
              onClick={onToggleSelectMode}
              className="px-3.5 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              {t("seedlingTray.select", "Select")}
            </button>
          )}
        </div>
      </div>

      {/* Select hint */}
      {selectMode && (
        <div className="mb-2.5 px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-muted-foreground">
          {t("seedlingTray.selectHint", "Click cells to select them, then hit")} <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t("seedlingTray.edit", "Edit")}</span> {t("seedlingTray.selectHintEnd", "to apply changes to all at once.")}
        </div>
      )}

      {/* Grid */}
      <div className={`bg-card rounded-2xl p-4 border transition-colors ${selectMode ? "border-emerald-500/50" : "border-border"}`}>
        <div
          className="grid gap-1.5 w-full"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {cells.map((cell, i) => {
            const plant = cell.plantId ? plantMap[cell.plantId] : null;
            const needsWater = cell.plantId && (!cell.lastWatered || (daysDiff(cell.lastWatered) ?? 99) >= 2);
            const isSel = selected.has(i);
            const stageClass = STAGE_CELL_CLASSES[cell.stage] || STAGE_CELL_CLASSES.empty;

            return (
              <button
                key={cell.id || i}
                type="button"
                onClick={() => onCellClick(i)}
                className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 p-1 relative transition-all cursor-pointer ${stageClass} ${
                  isSel ? "!border-emerald-500 ring-2 ring-emerald-500/30" : ""
                }`}
              >
                {isSel && (
                  <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-stone-900" />
                  </div>
                )}
                <SeedlingStageIcon stage={cell.stage} size={16} />
                {plant && (
                  <div className="text-[9px] text-muted-foreground text-center leading-tight overflow-hidden max-w-full truncate">
                    {plant.name || plant.id}
                  </div>
                )}
                {needsWater && !isSel && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {stages.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <SeedlingStageIcon stage={s.id} size={10} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-xs text-muted-foreground">{t("seedlingTray.needsWater", "Needs water")}</span>
        </div>
      </div>
    </div>
  );
};
