import React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, CheckCircle2, Loader2 } from "lucide-react";
import type { SeedlingTrayCell } from "@/types/garden";
import type { Plant } from "@/types/plant";
import { SeedlingStageIcon } from "./SeedlingStageIcon";

interface SeedlingTasksSectionProps {
  cells: SeedlingTrayCell[];
  plantMap: Record<string, Plant>;
  onWater: (cellId: string) => Promise<void>;
  onWaterAll: () => Promise<void>;
}

const daysDiff = (d: string | null) => {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

export const SeedlingTasksSection: React.FC<SeedlingTasksSectionProps> = ({
  cells,
  plantMap,
  onWater,
  onWaterAll,
}) => {
  const { t } = useTranslation("common");
  const [wateringId, setWateringId] = React.useState<string | null>(null);
  const [wateringAll, setWateringAll] = React.useState(false);

  const plantedCells = cells.filter((c) => c.plantId && c.stage !== "empty");
  const needsWaterCells = plantedCells.filter(
    (c) => !c.lastWatered || (daysDiff(c.lastWatered) ?? 99) >= 1
  );
  const wateredCells = plantedCells.filter(
    (c) => c.lastWatered && (daysDiff(c.lastWatered) ?? 99) < 1
  );

  const totalTasks = plantedCells.length;
  const doneTasks = wateredCells.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleWater = async (cellId: string) => {
    setWateringId(cellId);
    try {
      await onWater(cellId);
    } finally {
      setWateringId(null);
    }
  };

  const handleWaterAll = async () => {
    setWateringAll(true);
    try {
      await onWaterAll();
    } finally {
      setWateringAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold">
            {t("seedlingTray.tasks.dailyWatering", "Daily Watering")}
          </div>
          <div className="text-sm text-muted-foreground">
            {doneTasks} / {totalTasks}
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {totalTasks === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-2">
            {t("seedlingTray.tasks.noPlants", "No seedlings planted yet. Add plants to cells to start tracking.")}
          </div>
        ) : doneTasks === totalTasks ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            {t("seedlingTray.tasks.allWatered", "All seedlings watered today!")}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t("seedlingTray.tasks.needsWaterCount", {
                count: needsWaterCells.length,
                defaultValue: "{{count}} cells need watering",
              })}
            </div>
            {needsWaterCells.length > 1 && (
              <Button
                size="sm"
                className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handleWaterAll}
                disabled={wateringAll}
              >
                {wateringAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Droplets className="h-3.5 w-3.5 mr-1" />
                )}
                {t("seedlingTray.tasks.waterAll", "Water All")}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Individual cell tasks */}
      {needsWaterCells.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground px-1">
            {t("seedlingTray.tasks.needsWater", "Needs Watering")}
          </div>
          {needsWaterCells.map((cell) => {
            const plant = cell.plantId ? plantMap[cell.plantId] : null;
            const dw = cell.lastWatered ? daysDiff(cell.lastWatered) : null;
            const isWatering = wateringId === cell.id;
            return (
              <Card
                key={cell.id}
                className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-[#1f1f1f]/90 px-4 py-3 flex items-center gap-3"
              >
                <SeedlingStageIcon stage={cell.stage} size={18} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {plant?.name || cell.plantId}
                    <span className="text-muted-foreground font-normal text-xs ml-1.5">
                      · {t("seedlingTray.cellTitle", { index: cell.position + 1, defaultValue: "Cell {{index}}" })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dw === null
                      ? t("seedlingTray.tasks.neverWatered", "Never watered")
                      : t("seedlingTray.tasks.lastWateredDays", {
                          days: dw,
                          defaultValue: "Last watered {{days}}d ago",
                        })}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white h-8 px-3"
                  onClick={() => handleWater(cell.id)}
                  disabled={isWatering}
                >
                  {isWatering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Droplets className="h-3.5 w-3.5 mr-1" />
                      {t("seedlingTray.care.water", "Water")}
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed today */}
      {wateredCells.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground px-1">
            {t("seedlingTray.tasks.wateredToday", "Watered Today")}
          </div>
          {wateredCells.map((cell) => {
            const plant = cell.plantId ? plantMap[cell.plantId] : null;
            return (
              <Card
                key={cell.id}
                className="rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 px-4 py-3 flex items-center gap-3 opacity-70"
              >
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {plant?.name || cell.plantId}
                    <span className="text-muted-foreground font-normal text-xs ml-1.5">
                      · {t("seedlingTray.cellTitle", { index: cell.position + 1, defaultValue: "Cell {{index}}" })}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {t("seedlingTray.tasks.done", "Done")}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
