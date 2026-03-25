import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { SeedlingTrayCell } from "@/types/garden";
import type { Plant } from "@/types/plant";
import { SeedlingStageIcon } from "./SeedlingStageIcon";
import { Sprout } from "lucide-react";

interface SeedlingCareListProps {
  cells: SeedlingTrayCell[];
  plantMap: Record<string, Plant>;
  onWater: (cellId: string) => void;
  onEdit: (index: number) => void;
  onTransplant?: (cell: SeedlingTrayCell) => void;
}

const daysDiff = (d: string | null) => {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

export const SeedlingCareList: React.FC<SeedlingCareListProps> = ({
  cells,
  plantMap,
  onWater,
  onEdit,
  onTransplant,
}) => {
  const { t } = useTranslation("common");
  const plantedCells = cells.filter((c) => c.plantId);

  if (plantedCells.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {t("seedlingTray.care.noPlants", "No plants yet. Go to Tray and click a cell to add one.")}
      </div>
    );
  }

  return (
    <div>
      <div className="text-base font-semibold mb-4">
        {t("seedlingTray.care.title", "Care Schedule")}
      </div>
      <div className="flex flex-col gap-2">
        {plantedCells.map((cell) => {
          const plant = cell.plantId ? plantMap[cell.plantId] : null;
          const dw = cell.lastWatered ? daysDiff(cell.lastWatered) : null;
          const needsWater = !cell.lastWatered || (dw !== null && dw >= 2);
          const stageLabel = t(`seedlingTray.stages.${cell.stage}`, cell.stage);

          return (
            <div
              key={cell.id}
              className={`bg-card rounded-xl px-4 py-3 border flex items-center gap-3.5 ${
                needsWater ? "border-red-300 dark:border-red-800" : "border-border"
              }`}
            >
              <SeedlingStageIcon stage={cell.stage} size={20} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">
                  {plant?.name || cell.plantId}{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    · {t("seedlingTray.cellTitle", { index: cell.position + 1, defaultValue: "Cell {{index}}" })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {stageLabel}
                  {cell.sowDate ? ` · ${t("seedlingTray.sowDate", "Sown")} ${cell.sowDate}` : ""}
                </div>
              </div>
              <div className="text-right flex flex-col gap-1.5 items-end flex-shrink-0">
                {needsWater ? (
                  <div className="text-xs text-red-500">{t("seedlingTray.needsWater", "Needs water")}</div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {t("seedlingTray.care.wateredAgo", { days: dw, defaultValue: "Watered {{days}}d ago" })}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onWater(cell.id)}
                    className="h-7 px-2.5 text-xs rounded-lg border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                  >
                    {t("seedlingTray.care.water", "Water")}
                  </Button>
                  {cell.stage === "ready" && onTransplant && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTransplant(cell)}
                      className="h-7 px-2.5 text-xs rounded-lg border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    >
                      <Sprout className="h-3 w-3 mr-1" />
                      {t("seedlingTray.transplantAction", "Transplant")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(cell.position)}
                    className="h-7 px-2.5 text-xs rounded-lg"
                  >
                    {t("seedlingTray.edit", "Edit")}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
