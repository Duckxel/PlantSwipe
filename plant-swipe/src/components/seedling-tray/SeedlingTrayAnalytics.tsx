import React from "react";
import { useTranslation } from "react-i18next";
import type { SeedlingTrayCell, SeedlingStage } from "@/types/garden";
import type { Plant } from "@/types/plant";
import { SeedlingStageIcon } from "./SeedlingStageIcon";

interface SeedlingTrayAnalyticsProps {
  cells: SeedlingTrayCell[];
  plantMap: Record<string, Plant>;
}

const STAGES: Array<{ id: SeedlingStage; label: string }> = [
  { id: "empty", label: "Empty" },
  { id: "sown", label: "Sown" },
  { id: "germinating", label: "Germinating" },
  { id: "sprouted", label: "Sprouted" },
  { id: "ready", label: "Ready" },
];

const STAGE_BAR_CLASSES: Record<SeedlingStage, string> = {
  empty: "bg-stone-400 dark:bg-stone-600",
  sown: "bg-amber-500 dark:bg-amber-600",
  germinating: "bg-emerald-600 dark:bg-emerald-500",
  sprouted: "bg-emerald-500 dark:bg-emerald-400",
  ready: "bg-emerald-400 dark:bg-emerald-300",
};

export const SeedlingTrayAnalytics: React.FC<SeedlingTrayAnalyticsProps> = ({ cells, plantMap }) => {
  const { t } = useTranslation("common");
  const total = cells.length;
  const planted = cells.filter((c) => c.stage !== "empty").length;

  // Unique plants with their counts
  const plantCounts: Array<{ plantId: string; name: string; count: number }> = [];
  const seen = new Map<string, number>();
  for (const cell of cells) {
    if (!cell.plantId) continue;
    const existing = seen.get(cell.plantId);
    if (existing !== undefined) {
      plantCounts[existing].count++;
    } else {
      seen.set(cell.plantId, plantCounts.length);
      const plant = plantMap[cell.plantId];
      plantCounts.push({ plantId: cell.plantId, name: plant?.name || cell.plantId, count: 1 });
    }
  }

  return (
    <div>
      <div className="text-base font-semibold mb-4">
        {t("gardenDashboard.analytics", "Analytics")}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Stage breakdown */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="text-sm text-muted-foreground mb-3">
            {t("seedlingTray.analytics.stageBreakdown", "Stage breakdown")}
          </div>
          {STAGES.map((s) => {
            const cnt = cells.filter((c) => c.stage === s.id).length;
            const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
            return (
              <div key={s.id} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t(`seedlingTray.stages.${s.id}`, s.label)}</span>
                  <span className="font-medium">{cnt}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${STAGE_BAR_CLASSES[s.id]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Plants overview */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="text-sm text-muted-foreground mb-3">
            {t("seedlingTray.analytics.plantsOverview", "Plants overview")}
          </div>
          {plantCounts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("seedlingTray.analytics.noPlants", "No plants added yet")}
            </div>
          ) : (
            plantCounts.map((pc) => (
              <div key={pc.plantId} className="flex items-center justify-between mb-2">
                <span className="text-sm">{pc.name}</span>
                <div className="flex gap-1">
                  {Array.from({ length: pc.count }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-emerald-500" />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tray utilization */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="text-sm text-muted-foreground mb-2">
          {t("seedlingTray.analytics.trayUtilization", "Tray utilization")}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: total > 0 ? `${Math.round((planted / total) * 100)}%` : "0%" }}
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>
                {t("seedlingTray.analytics.planted", "Planted")}: {planted}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
              <span>
                {t("seedlingTray.analytics.empty", "Empty")}: {total - planted}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
