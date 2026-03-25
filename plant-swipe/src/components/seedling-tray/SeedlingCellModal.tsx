import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SeedlingTrayCell, SeedlingStage } from "@/types/garden";
import type { Plant } from "@/types/plant";
import { SeedlingStageIcon } from "./SeedlingStageIcon";
import { SearchInput } from "@/components/ui/search-input";
import { Sprout, Plus } from "lucide-react";

const EDITABLE_STAGES: Array<{ id: SeedlingStage; label: string }> = [
  { id: "sown", label: "Sown" },
  { id: "germinating", label: "Germinating" },
  { id: "sprouted", label: "Sprouted" },
  { id: "ready", label: "Ready" },
];

interface SeedlingCellModalProps {
  open: boolean;
  cell: SeedlingTrayCell;
  index: number;
  isMulti: boolean;
  count: number;
  plants: Plant[];
  plantMap: Record<string, Plant>;
  onClose: () => void;
  onSave: (data: Partial<Pick<SeedlingTrayCell, "plantId" | "stage" | "sowDate" | "lastWatered" | "notes">>) => void;
  onClear: () => void;
  onTransplant?: (cell: SeedlingTrayCell) => void;
  onAddNewPlant?: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

const daysDiff = (d: string | null) => {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

const addDays = (d: string, n: number) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
};

export const SeedlingCellModal: React.FC<SeedlingCellModalProps> = ({
  open,
  cell,
  index,
  isMulti,
  count,
  plants,
  plantMap,
  onClose,
  onSave,
  onClear,
  onTransplant,
  onAddNewPlant,
}) => {
  const { t } = useTranslation("common");
  const [plantId, setPlantId] = useState<string | null>(cell.plantId);
  const [stage, setStage] = useState<SeedlingStage>(cell.stage);
  const [sowDate, setSowDate] = useState<string>(cell.sowDate || "");
  const [lastWatered, setLastWatered] = useState<string | null>(cell.lastWatered);
  const [notes, setNotes] = useState<string>(cell.notes);
  const [germDays, setGermDays] = useState<string>("");
  const [transplantDays, setTransplantDays] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setPlantId(cell.plantId);
    setStage(cell.stage);
    setSowDate(cell.sowDate || "");
    setLastWatered(cell.lastWatered);
    setNotes(cell.notes);
    setGermDays("");
    setTransplantDays("");
    setSearchQuery("");
  }, [cell]);

  const selectedPlant = plantId ? plantMap[plantId] : null;
  const dw = lastWatered ? daysDiff(lastWatered) : null;

  const filteredPlants = searchQuery.trim()
    ? plants.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.id || "").toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 50)
    : plants.slice(0, 50);

  const handleSelectPlant = useCallback((pid: string | null) => {
    setPlantId(pid);
    if (pid) {
      setStage("sown");
      setSowDate(today());
    } else {
      setStage("empty");
      setSowDate("");
    }
    setSearchQuery("");
  }, []);

  const handleSave = () => {
    const data: Partial<Pick<SeedlingTrayCell, "plantId" | "stage" | "sowDate" | "lastWatered" | "notes">> = {};
    if (plantId !== cell.plantId) data.plantId = plantId;
    if (stage !== cell.stage) data.stage = stage;
    if (sowDate !== (cell.sowDate || "")) data.sowDate = sowDate || null;
    if (lastWatered !== cell.lastWatered) data.lastWatered = lastWatered;
    if (notes !== cell.notes && !isMulti) data.notes = notes;
    // For multi-edit, include all changed fields; for single, include all
    if (!isMulti) {
      onSave({ plantId, stage, sowDate: sowDate || null, lastWatered, notes });
    } else {
      onSave(data);
    }
  };

  const germDaysNum = germDays ? parseInt(germDays, 10) : null;
  const transplantDaysNum = transplantDays ? parseInt(transplantDays, 10) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <SeedlingStageIcon stage={stage} size={18} />
            <div>
              <DialogTitle className="text-base">
                {isMulti
                  ? t("seedlingTray.cellsSelected", { count, defaultValue: "{{count}} cells selected" })
                  : t("seedlingTray.cellTitle", { index: index + 1, defaultValue: "Cell {{index}}" })}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {isMulti
                  ? t("seedlingTray.changesApplyToAll", "Changes apply to all selected")
                  : selectedPlant
                    ? selectedPlant.name
                    : t("seedlingTray.stages.empty", "Empty")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isMulti && (
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
            {t("seedlingTray.editingMultiple", {
              count,
              defaultValue: "Editing {{count}} cells at once — only fields you change will be applied.",
            })}
          </div>
        )}

        <div className="space-y-4 mt-2">
          {/* Plant species picker */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("seedlingTray.plantSpecies", "Plant species")}
            </Label>
            <SearchInput
              variant="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder={t("seedlingTray.searchPlant", "Search plants...")}
              wrapperClassName="mb-2"
            />
            <div className="max-h-32 overflow-y-auto border border-border rounded-xl">
              {filteredPlants.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPlant(p.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer ${
                    i > 0 ? "border-t border-border" : ""
                  } ${plantId === p.id ? "bg-muted font-medium" : ""}`}
                >
                  {p.name || p.id}
                </button>
              ))}
              {filteredPlants.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  {t("seedlingTray.noPlantsFound", "No plants found")}
                </div>
              )}
            </div>
            {onAddNewPlant && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddNewPlant();
                }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600 text-sm text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("seedlingTray.addNewPlant", "Add New Plant")}
              </button>
            )}
          </div>

          {/* Growth stage selector */}
          {plantId && (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                {t("seedlingTray.growthStage", "Growth stage")}
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {EDITABLE_STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStage(s.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors cursor-pointer ${
                      stage === s.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <SeedlingStageIcon stage={s.id} size={12} />
                    {t(`seedlingTray.stages.${s.id}`, s.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sow date */}
          {plantId && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {t("seedlingTray.sowDate", "Sow date")}
              </Label>
              <Input
                type="date"
                value={sowDate}
                onChange={(e) => setSowDate(e.target.value)}
                className="h-9 text-sm rounded-xl"
              />
            </div>
          )}

          {/* Germination/Transplant day estimates */}
          {plantId && sowDate && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  {t("seedlingTray.germDaysLabel", "Germination (days)")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={germDays}
                  onChange={(e) => setGermDays(e.target.value)}
                  placeholder={t("seedlingTray.germDaysPlaceholder", "e.g. 7")}
                  className="h-9 text-sm rounded-xl"
                />
                {germDaysNum && germDaysNum > 0 && (
                  <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {addDays(sowDate, germDaysNum)}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  {t("seedlingTray.transplantDaysLabel", "Transplant (days)")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={transplantDays}
                  onChange={(e) => setTransplantDays(e.target.value)}
                  placeholder={t("seedlingTray.transplantDaysPlaceholder", "e.g. 42")}
                  className="h-9 text-sm rounded-xl"
                />
                {transplantDaysNum && transplantDaysNum > 0 && (
                  <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {addDays(sowDate, transplantDaysNum)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Watering */}
          {plantId && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {t("seedlingTray.watering", "Watering")}
              </Label>
              <button
                type="button"
                onClick={() => setLastWatered(today())}
                className={`w-full px-3 py-2 rounded-xl border text-sm transition-colors cursor-pointer ${
                  dw !== null && dw < 2
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {lastWatered
                  ? t("seedlingTray.lastWatered", { days: dw, defaultValue: "Last watered {{days}}d ago — mark again" })
                  : t("seedlingTray.markWatered", "Mark as watered")}
              </button>
            </div>
          )}

          {/* Notes (single cell only) */}
          {plantId && !isMulti && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {t("seedlingTray.notes", "Notes")}
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("seedlingTray.notesPlaceholder", "Add notes...")}
                className="w-full min-h-[64px] resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {plantId && (
            <Button
              variant="outline"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="flex-1 rounded-xl border-red-800/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              {isMulti
                ? t("seedlingTray.clearCells", { count, defaultValue: "Clear {{count}} cells" })
                : t("seedlingTray.clearCell", "Clear cell")}
            </Button>
          )}
          {plantId && !isMulti && stage === "ready" && onTransplant && (
            <Button
              variant="outline"
              onClick={() => {
                onTransplant(cell);
                onClose();
              }}
              className="flex-1 rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <Sprout className="h-4 w-4 mr-1" />
              {t("seedlingTray.transplantAction", "Transplant")}
            </Button>
          )}
          <Button
            onClick={() => {
              handleSave();
              onClose();
            }}
            className="flex-[2] rounded-xl"
          >
            {isMulti
              ? t("seedlingTray.saveCells", { count, defaultValue: "Save {{count}} cells" })
              : t("seedlingTray.save", "Save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
