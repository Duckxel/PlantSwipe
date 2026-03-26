import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Flower2, ChevronRight, ChevronLeft, Sprout } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getUserGardens, addPlantToGarden, clearSeedlingTrayCell } from "@/lib/gardens";
import { supabase } from "@/lib/supabaseClient";
import type { Garden, SeedlingTrayCell } from "@/types/garden";
import type { Plant } from "@/types/plant";

interface TransplantToGardenDialogProps {
  open: boolean;
  onClose: () => void;
  cell: SeedlingTrayCell;
  plant: Plant;
  userId: string;
  onTransplanted: () => void;
}

export const TransplantToGardenDialog: React.FC<TransplantToGardenDialogProps> = ({
  open,
  onClose,
  cell,
  plant,
  userId,
  onTransplanted,
}) => {
  const { t } = useTranslation("common");
  const [gardens, setGardens] = React.useState<Garden[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedGarden, setSelectedGarden] = React.useState<Garden | null>(null);
  const [step, setStep] = React.useState<"select" | "details">("select");
  const [nickname, setNickname] = React.useState("");
  const [count, setCount] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelectedGarden(null);
      setStep("select");
      setNickname("");
      setCount(1);
      setError(null);
      setSubmitting(false);
      (async () => {
        setLoading(true);
        try {
          const data = await getUserGardens(userId);
          // Only show non-seedling gardens
          setGardens(data.filter((g) => g.gardenType !== "seedling"));
        } catch (e) {
          console.error(e);
          setError(t("seedlingTray.transplantError", { defaultValue: "Failed to load gardens" }));
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open, userId, t]);

  const handleSelectGarden = (garden: Garden) => {
    setSelectedGarden(garden);
    setStep("details");
  };

  const handleBack = () => {
    setStep("select");
    setSelectedGarden(null);
    setNickname("");
    setCount(1);
    setError(null);
  };

  const handleTransplant = async () => {
    if (!selectedGarden || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const trimmedName = nickname.trim();
      const nicknameVal =
        trimmedName.length > 0 && trimmedName !== (plant.name || "").trim()
          ? trimmedName
          : null;

      const qty = Math.max(1, Number(count || 1));

      // Create plant entry in target garden
      const gp = await addPlantToGarden({
        gardenId: selectedGarden.id,
        plantId: cell.plantId!,
        nickname: nicknameVal || undefined,
        plantedAt: new Date().toISOString(),
        plantsOnHand: qty,
      });

      // Transfer notes if present
      if (cell.notes && cell.notes.trim()) {
        await supabase
          .from("garden_plants")
          .update({ notes: cell.notes })
          .eq("id", gp.id);
      }

      // Clear the tray cell
      await clearSeedlingTrayCell(cell.id);

      onClose();
      onTransplanted();
    } catch (e: unknown) {
      console.error(e);
      const errMessage = e instanceof Error ? e.message : String(e);
      setError(errMessage || t("seedlingTray.transplantError", { defaultValue: "Failed to transplant" }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-emerald-600" />
            {step === "select"
              ? t("seedlingTray.transplantToGarden", "Transplant to Garden")
              : t("seedlingTray.transplantConfirm", "Confirm Transplant")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === "select"
              ? t("seedlingTray.selectGarden", "Select a garden to transplant this seedling to")
              : t("seedlingTray.transplantingPlant", {
                  plant: plant.name,
                  defaultValue: `Transplanting ${plant.name}`,
                })}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="py-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-stone-400" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            ) : gardens.length === 0 ? (
              <div className="text-center py-6 text-stone-500 dark:text-stone-400 text-sm">
                {t("seedlingTray.noGardensAvailable", "No gardens available. Create a Default or Beginner garden first.")}
              </div>
            ) : (
              gardens.map((garden) => (
                <button
                  key={garden.id}
                  onClick={() => handleSelectGarden(garden)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-12 w-12 rounded-lg bg-stone-200 dark:bg-[#3e3e42] overflow-hidden flex-shrink-0">
                      {garden.coverImageUrl ? (
                        <img
                          src={garden.coverImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-stone-400">
                          <Flower2 className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{garden.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {garden.gardenType}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="py-2 space-y-4">
            {selectedGarden && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="h-10 w-10 rounded-lg bg-stone-200 dark:bg-[#3e3e42] overflow-hidden flex-shrink-0">
                  {selectedGarden.coverImageUrl ? (
                    <img
                      src={selectedGarden.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-stone-400">
                      <Flower2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{selectedGarden.name}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t("seedlingTray.transplantingPlant", {
                      plant: plant.name,
                      defaultValue: `Transplanting ${plant.name}`,
                    })}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">
                {t("seedlingTray.nickname", "Nickname")}
              </label>
              <Input
                value={nickname}
                maxLength={30}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNickname(e.target.value)}
                placeholder={t("gardenDashboard.plantsSection.optionalNickname", { defaultValue: "Optional nickname" })}
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t("seedlingTray.plantsOnHand", "Plants on hand")}
              </label>
              <Input
                type="number"
                min={1}
                value={String(count)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCount(Number(e.target.value))}
                className="mt-1 rounded-xl"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("gardenDashboard.plantsSection.back", { defaultValue: "Back" })}
              </Button>
              <Button
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleTransplant}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("seedlingTray.transplanting", "Transplanting...")}
                  </>
                ) : (
                  <>
                    <Sprout className="mr-2 h-4 w-4" />
                    {t("seedlingTray.transplantAction", "Transplant")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
