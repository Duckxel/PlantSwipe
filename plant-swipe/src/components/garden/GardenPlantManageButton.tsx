/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React from "react";
import { Camera, Loader2, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select } from "@/components/ui/select";
import { getPrimaryPhotoUrl } from "@/lib/photos";
import {
  createPatternTask,
  deletePlantTask,
  listPlantTasks,
  logGardenActivity,
  refreshGardenTaskCache,
  resyncTaskOccurrencesForGarden,
  updatePatternTask,
} from "@/lib/gardens";
import { broadcastGardenUpdate } from "@/lib/realtime";
import { supabase } from "@/lib/supabaseClient";
import { platformPickCameraPhoto } from "@/platform/camera";

type Period = "week" | "month" | "year";

const TASK_EMOJIS: Record<string, string> = {
  water: "💧",
  fertilize: "🍽️",
  harvest: "🌾",
  cut: "✂️",
};

const TASK_TYPES = [
  { type: "water", emoji: "💧" },
  { type: "fertilize", emoji: "🍽️" },
  { type: "harvest", emoji: "🌾" },
  { type: "cut", emoji: "✂️" },
  { type: "custom", emoji: "✨" },
];

const CUSTOM_EMOJI_PRESETS = ["🧴", "🧪", "🧹", "🪴", "📌", "🌸", "🐛", "🪱", "☀️", "🌡️"];
const MONDAY_FIRST_MAP = [1, 2, 3, 4, 5, 6, 0];

const HEALTH_STATUSES = [
  { key: "thriving", label: "Thriving", emoji: "🌟", color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  { key: "healthy", label: "Healthy", emoji: "💚", color: "text-green-600 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/30" },
  { key: "okay", label: "Okay", emoji: "🌱", color: "text-lime-700 dark:text-lime-300", bg: "bg-lime-100 dark:bg-lime-900/30" },
  { key: "struggling", label: "Struggling", emoji: "🥀", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "critical", label: "Critical", emoji: "⚠️", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/30" },
];

export function GardenPlantManageButton({
  gp,
  gardenId,
  onChanged,
  actorColorCss,
  gardenType,
  taskCount = 0,
  dueTodayCount = 0,
}: {
  gp: any;
  gardenId: string;
  onChanged: () => Promise<void>;
  actorColorCss?: string | null;
  gardenType?: string;
  taskCount?: number;
  dueTodayCount?: number;
}) {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [nickname, setNickname] = React.useState(gp.nickname || "");
  const [count, setCount] = React.useState<number>(Number(gp.plantsOnHand ?? 0));
  const [healthStatus, setHealthStatus] = React.useState<string>(gp.healthStatus || "");
  const [notes, setNotes] = React.useState(gp.notes || "");
  const [submitting, setSubmitting] = React.useState(false);

  const [currentImageUrl, setCurrentImageUrl] = React.useState<string | null>(gp.gardenPlantImageUrl || null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [imageSourceOpen, setImageSourceOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [tasks, setTasks] = React.useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = React.useState(false);
  const [tasksError, setTasksError] = React.useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = React.useState<string | null>(null);

  const [taskEditorOpen, setTaskEditorOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<any | null>(null);
  const [taskType, setTaskType] = React.useState("water");
  const [taskCustomName, setTaskCustomName] = React.useState("");
  const [taskEmoji, setTaskEmoji] = React.useState("");
  const [taskPeriod, setTaskPeriod] = React.useState<Period>("week");
  const [taskAmount, setTaskAmount] = React.useState(1);
  const [weeklyDays, setWeeklyDays] = React.useState<number[]>([]);
  const [monthlyNthWeekdays, setMonthlyNthWeekdays] = React.useState<string[]>([]);
  const [yearlyDays, setYearlyDays] = React.useState<string[]>([]);
  const [taskSaving, setTaskSaving] = React.useState(false);
  const [taskFormError, setTaskFormError] = React.useState<string | null>(null);

  const speciesImageUrl = React.useMemo(() => {
    return (
      gp.gardenPlantImageUrl ||
      (gp.plant?.photos?.length ? getPrimaryPhotoUrl(gp.plant.photos) : null) ||
      gp.plant?.image ||
      null
    );
  }, [gp]);

  const displayName = nickname.trim() || gp.nickname || gp.plant?.name || t("gardenDashboard.plantsSection.unknownPlant", "Unknown Plant");
  const speciesName = gp.plant?.name || null;
  const selectedHealthStatus = React.useMemo(
    () => HEALTH_STATUSES.find((status) => status.key === healthStatus) || null,
    [healthStatus],
  );
  const lastHealthUpdatedLabel = React.useMemo(() => {
    if (!gp.lastHealthUpdate) return null;
    try {
      return new Date(gp.lastHealthUpdate).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  }, [gp.lastHealthUpdate]);

  React.useEffect(() => {
    setNickname(gp.nickname || "");
    setCount(Number(gp.plantsOnHand ?? 0));
    setHealthStatus(gp.healthStatus || "");
    setNotes(gp.notes || "");
    setCurrentImageUrl(gp.gardenPlantImageUrl || speciesImageUrl || null);
  }, [gp, speciesImageUrl]);

  const loadTasks = React.useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const rows = await listPlantTasks(gp.id);
      rows.sort((a, b) => scoreTask(b) - scoreTask(a));
      setTasks(rows);
    } catch (error) {
      setTasksError(error instanceof Error ? error.message : t("gardenDashboard.taskDialog.failedToLoad"));
    } finally {
      setTasksLoading(false);
    }
  }, [gp.id, t]);

  React.useEffect(() => {
    if (!open) return;
    loadTasks().catch(() => {});
  }, [open, loadTasks]);

  const emitTasksRealtime = React.useCallback(
    (metadata?: Record<string, unknown>) => {
      try {
        window.dispatchEvent(new CustomEvent("garden:tasks_changed"));
      } catch {}
      broadcastGardenUpdate({
        gardenId,
        kind: "tasks",
        metadata,
        actorId: user?.id ?? null,
      }).catch(() => {});
    },
    [gardenId, user?.id],
  );

  const resetTaskEditor = React.useCallback(() => {
    setEditingTask(null);
    setTaskEditorOpen(false);
    setTaskType("water");
    setTaskCustomName("");
    setTaskEmoji("");
    setTaskPeriod("week");
    setTaskAmount(1);
    setWeeklyDays([]);
    setMonthlyNthWeekdays([]);
    setYearlyDays([]);
    setTaskFormError(null);
    setConfirmDeleteTaskId(null);
  }, []);

  const openCreateTask = React.useCallback(() => {
    setEditingTask(null);
    setTaskEditorOpen(true);
    setTaskType("water");
    setTaskCustomName("");
    setTaskEmoji("");
    setTaskPeriod("week");
    setTaskAmount(1);
    setWeeklyDays([]);
    setMonthlyNthWeekdays([]);
    setYearlyDays([]);
    setTaskFormError(null);
  }, []);

  const openEditTask = React.useCallback((task: any) => {
    setEditingTask(task);
    setTaskEditorOpen(true);
    setTaskType(task.type || "water");
    setTaskCustomName(task.customName || "");
    setTaskEmoji(task.emoji || "");
    setTaskPeriod((task.period as Period) || "week");
    setTaskAmount(Number(task.amount || 1));
    setWeeklyDays(Array.isArray(task.weeklyDays) ? [...task.weeklyDays] : []);
    setMonthlyNthWeekdays(Array.isArray(task.monthlyNthWeekdays) ? [...task.monthlyNthWeekdays] : []);
    setYearlyDays(Array.isArray(task.yearlyDays) ? [...task.yearlyDays] : []);
    setTaskFormError(null);
  }, []);

  const selectedTaskCount =
    taskPeriod === "week" ? weeklyDays.length : taskPeriod === "month" ? monthlyNthWeekdays.length : yearlyDays.length;
  const maxTaskSelections = taskPeriod === "week" ? 7 : taskPeriod === "month" ? 12 : 52;
  const disableMoreSelections = selectedTaskCount >= taskAmount;

  const uploadGardenPlantPhoto = React.useCallback(
    async (file: File) => {
      if (!file || uploadingImage) return;
      setUploadingImage(true);
      setImageError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) {
          throw new Error(t("gardenDashboard.plantsSection.imageUploadAuthError", "You must be signed in to upload a photo."));
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "plants");

        const response = await fetch(`/api/garden/${gardenId}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "same-origin",
          body: formData,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.url) {
          throw new Error(body?.error || t("gardenDashboard.plantsSection.imageUploadError", "Failed to upload photo."));
        }

        const { error } = await supabase.from("garden_plant_images").insert({
          garden_plant_id: gp.id,
          image_url: body.url,
          uploaded_by: user?.id ?? null,
        });
        if (error) throw new Error(error.message);

        setCurrentImageUrl(body.url);
        await Promise.resolve(onChanged()).catch(() => {});
      } catch (error) {
        setImageError(error instanceof Error ? error.message : t("gardenDashboard.plantsSection.imageUploadError", "Failed to upload photo."));
      } finally {
        setUploadingImage(false);
      }
    },
    [gardenId, gp.id, onChanged, t, uploadingImage, user?.id],
  );

  const handleTakePhoto = React.useCallback(async () => {
    try {
      const result = await platformPickCameraPhoto();
      if (!result?.file) return;
      await uploadGardenPlantPhoto(result.file);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : t("gardenDashboard.plantsSection.imageUploadError", "Failed to upload photo."));
    }
  }, [t, uploadGardenPlantPhoto]);

  const handleOpenFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChooseUpload = React.useCallback(() => {
    setImageSourceOpen(false);
    handleOpenFilePicker();
  }, [handleOpenFilePicker]);

  const handleChooseTakePhoto = React.useCallback(async () => {
    setImageSourceOpen(false);
    await handleTakePhoto();
  }, [handleTakePhoto]);

  const savePlantDetails = React.useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updateData: Record<string, any> = {
        nickname: nickname.trim() || null,
        plants_on_hand: Math.max(0, Number(count || 0)),
        health_status: healthStatus || null,
        notes: notes.trim() || null,
      };
      if ((healthStatus || null) !== (gp.healthStatus || null)) {
        updateData.last_health_update = new Date().toISOString();
      }

      await supabase.from("garden_plants").update(updateData).eq("id", gp.id);

      try {
        const parts: string[] = [];
        if ((gp.nickname || "") !== (nickname.trim() || "")) {
          parts.push(`name: "${nickname.trim() || "-"}"`);
        }
        if (Number(gp.plantsOnHand || 0) !== Math.max(0, Number(count || 0))) {
          parts.push(`count: ${Math.max(0, Number(count || 0))}`);
        }
        if ((gp.healthStatus || null) !== (healthStatus || null)) {
          parts.push(`health: ${selectedHealthStatus ? selectedHealthStatus.label : "none"}`);
        }
        if ((gp.notes || "") !== (notes.trim() || "")) {
          parts.push("notes updated");
        }
        if (parts.length > 0) {
          await logGardenActivity({
            gardenId,
            kind: "plant_updated",
            message: `updated ${displayName}: ${parts.join(", ")}`,
            plantName: displayName,
            actorColor: actorColorCss || null,
          });
        }
      } catch {}

      await Promise.resolve(onChanged()).catch(() => {});
      setOpen(false);
    } catch {
      // Keep parity with the previous edit dialog: the page owns global error surfaces.
    } finally {
      setSubmitting(false);
    }
  }, [
    actorColorCss,
    count,
    displayName,
    gardenId,
    gp.healthStatus,
    gp.id,
    gp.nickname,
    gp.notes,
    gp.plantsOnHand,
    healthStatus,
    nickname,
    notes,
    onChanged,
    selectedHealthStatus,
    submitting,
  ]);

  const syncTaskSideEffects = React.useCallback(
    async (action: "create" | "update" | "delete", taskName: string, taskId?: string) => {
      emitTasksRealtime({ action, taskId, gardenPlantId: gp.id });
      const sync = () => {
        const now = new Date();
        const startIso = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
        const endIso = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString();
        resyncTaskOccurrencesForGarden(gardenId, startIso, endIso)
          .then(() => refreshGardenTaskCache(gardenId).catch(() => {}))
          .catch(() => {});
        logGardenActivity({
          gardenId,
          kind: "note",
          message:
            action === "create"
              ? t("gardenDashboard.taskDialog.addedTask", { taskName })
              : action === "update"
                ? t("gardenDashboard.taskDialog.updatedTask", { taskName })
                : t("gardenDashboard.taskDialog.deletedTask", { taskName }),
          taskName,
          actorColor: null,
        }).catch(() => {});
      };

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(sync, { timeout: 1000 });
      } else {
        setTimeout(sync, 100);
      }

      await loadTasks();
      await Promise.resolve(onChanged()).catch(() => {});
    },
    [emitTasksRealtime, gardenId, gp.id, loadTasks, onChanged, t],
  );

  const handleSaveTask = React.useCallback(async () => {
    if (taskSaving) return;
    setTaskFormError(null);
    if (selectedTaskCount !== taskAmount) {
      const unit =
        taskPeriod === "week"
          ? t("gardenDashboard.taskDialog.daysPerWeek", "day(s) per week")
          : taskPeriod === "month"
            ? t("gardenDashboard.taskDialog.daysPerMonth", "day(s) per month")
            : t("gardenDashboard.taskDialog.timesPerYear", "time(s) per year");
      setTaskFormError(t("gardenDashboard.taskDialog.selectExactly", { amount: taskAmount, period: unit }));
      return;
    }

    setTaskSaving(true);
    try {
      const taskName =
        taskType === "custom"
          ? taskCustomName.trim() || t("garden.taskTypes.custom")
          : t(`garden.taskTypes.${taskType}`);

      const payload = {
        type: taskType,
        customName: taskType === "custom" ? taskCustomName.trim() || null : null,
        emoji: taskType === "custom" ? taskEmoji.trim() || null : null,
        period: taskPeriod,
        amount: taskAmount,
        weeklyDays: taskPeriod === "week" ? [...weeklyDays].sort((a, b) => a - b) : null,
        monthlyDays: taskPeriod === "month" ? [] : null,
        yearlyDays: taskPeriod === "year" ? [...yearlyDays].sort() : null,
        monthlyNthWeekdays: taskPeriod === "month" ? [...monthlyNthWeekdays].sort() : null,
      };

      if (editingTask) {
        await updatePatternTask({
          taskId: editingTask.id,
          ...payload,
          requiredCount: editingTask.requiredCount || 1,
        });
        await syncTaskSideEffects("update", taskName, editingTask.id);
      } else {
        const createdTaskId = await createPatternTask({
          gardenId,
          gardenPlantId: gp.id,
          ...payload,
          requiredCount: 1,
        });
        await syncTaskSideEffects("create", taskName, createdTaskId);
      }

      resetTaskEditor();
    } catch (error) {
      setTaskFormError(error instanceof Error ? error.message : t("gardenDashboard.taskDialog.failedToCreate"));
    } finally {
      setTaskSaving(false);
    }
  }, [
    editingTask,
    gardenId,
    gp.id,
    monthlyNthWeekdays,
    resetTaskEditor,
    selectedTaskCount,
    syncTaskSideEffects,
    t,
    taskAmount,
    taskCustomName,
    taskEmoji,
    taskPeriod,
    taskSaving,
    taskType,
    weeklyDays,
    yearlyDays,
  ]);

  const handleDeleteTask = React.useCallback(
    async (task: any) => {
      try {
        await deletePlantTask(task.id);
        const taskName = task.type === "custom" ? task.customName || t("garden.taskTypes.custom") : t(`garden.taskTypes.${task.type}`);
        setConfirmDeleteTaskId(null);
        if (editingTask?.id === task.id) {
          resetTaskEditor();
        }
        await syncTaskSideEffects("delete", taskName, task.id);
      } catch (error) {
        setTasksError(error instanceof Error ? error.message : t("gardenDashboard.taskDialog.failedToDelete"));
      }
    },
    [editingTask?.id, resetTaskEditor, syncTaskSideEffects, t],
  );

  return (
    <>
      <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(true)}>
        {t("gardenDashboard.plantsSection.managePlant", "Manage")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideCloseButton
          className="w-[calc(100vw-1rem)] max-w-5xl overflow-hidden rounded-[28px] border border-stone-200/70 bg-white/95 p-0 pr-0 shadow-[0_35px_95px_-45px_rgba(15,23,42,0.65)] backdrop-blur sm:w-full sm:rounded-[30px] dark:border-[#3e3e42]/70 dark:bg-[#1f1f1f]/95"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("gardenDashboard.plantsSection.managePlant", "Manage plant")}</DialogTitle>
            <DialogDescription>{t("gardenDashboard.plantsSection.managePlantDescription", "Edit your plant details, photo, and routine in one place.")}</DialogDescription>
          </DialogHeader>

          <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
            <button
              type="button"
              onClick={() => setImageSourceOpen(true)}
              aria-label={t("gardenDashboard.plantsSection.editPhoto", "Edit photo")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/65 bg-white/95 text-stone-900 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-black/30"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close", "Close")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-stone-900 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-black/30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[92dvh] overflow-y-auto lg:grid lg:max-h-[85vh] lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
            <div className="relative min-h-[168px] overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 sm:min-h-[220px] lg:min-h-[280px]">
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt={displayName}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-7xl">🌿</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/10" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (event.currentTarget) event.currentTarget.value = "";
                  if (file) uploadGardenPlantPhoto(file);
                }}
              />
              <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 text-white sm:space-y-3 sm:p-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                    {t("gardenDashboard.plantsSection.plantProfile", "Plant profile")}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-tight sm:text-2xl">{displayName}</div>
                  {speciesName && speciesName !== displayName && (
                    <div className="text-xs text-white/80 sm:text-sm">{speciesName}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {gardenType !== "seedling" && (
                    <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-medium backdrop-blur">
                      {Math.max(0, Number(count || 0))} {t("gardenDashboard.plantsSection.onHand", "On hand")}
                    </span>
                  )}
                  <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-medium backdrop-blur">
                    {taskCount} {t("gardenDashboard.plantsSection.tasks", "Tasks")}
                  </span>
                  {dueTodayCount > 0 && (
                    <span className="rounded-full bg-blue-500/80 px-3 py-1 text-xs font-medium">
                      {dueTodayCount} {t("gardenDashboard.plantsSection.dueToday", "Due today")}
                    </span>
                  )}
                </div>
                {imageError && (
                  <div className="rounded-2xl bg-red-500/20 px-3 py-2 text-xs text-white/95 backdrop-blur">
                    {imageError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <div className="space-y-5 sm:space-y-6">
                <section className="space-y-5 rounded-[24px] border border-stone-200/80 bg-stone-50/75 p-4 shadow-inner sm:space-y-5 sm:rounded-[26px] sm:p-5 dark:border-stone-700 dark:bg-stone-900/20">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                      {t("gardenDashboard.plantsSection.detailsTitle", "Plant details")}
                    </h3>
                    <p className="text-xs leading-5 text-stone-500 dark:text-stone-400 sm:text-sm sm:leading-6">
                      {t("gardenDashboard.plantsSection.detailsDescription", "Update the core info for this plant without leaving the modal.")}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-stone-700 dark:text-stone-200">
                        {t("gardenDashboard.plantsSection.plantName", "Plant name")}
                      </label>
                      <p className="px-1 text-xs leading-5 text-stone-400 dark:text-stone-500">
                        {t("gardenDashboard.plantsSection.plantNameDescription", "Use a nickname if this plant needs a custom label in your garden.")}
                      </p>
                    </div>
                    <Input
                      value={nickname}
                      maxLength={30}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder={t("gardenDashboard.plantsSection.optionalNickname", "Optional nickname")}
                      className="h-12 rounded-2xl border-stone-200 bg-white px-4 dark:border-stone-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                      {t("gardenDashboard.plantsSection.statusRowTitle", "Quick status")}
                    </p>
                    <p className="text-xs leading-5 text-stone-400 dark:text-stone-500">
                      {t("gardenDashboard.plantsSection.statusRowDescription", "Adjust the plant count and health together.")}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {gardenType !== "seedling" && (
                      <div className="space-y-1.5">
                        <p className="px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                          {t("gardenDashboard.plantsSection.numberOfPlants", "Number of plants")}
                        </p>
                        <NumberStepper
                          value={Math.max(0, Number(count || 0))}
                          onChange={setCount}
                          min={0}
                          className="h-12 rounded-2xl border-stone-200 bg-white dark:border-stone-700"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                          {t("gardenDashboard.plantsSection.healthStatus", "Plant health")}
                        </p>
                        {selectedHealthStatus ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${selectedHealthStatus.bg} ${selectedHealthStatus.color}`}>
                            <span>{selectedHealthStatus.emoji}</span>
                            <span>{t(`gardenDashboard.plantsSection.health.${selectedHealthStatus.key}`, selectedHealthStatus.label)}</span>
                          </span>
                        ) : null}
                      </div>
                      <Select
                        value={healthStatus}
                        onChange={(event) => setHealthStatus(event.target.value)}
                        className="h-12 rounded-2xl border-stone-200 bg-white px-4 dark:border-stone-700"
                      >
                        <option value="">{t("gardenDashboard.plantsSection.healthStatusUnset", "Not set yet")}</option>
                        {HEALTH_STATUSES.map((status) => (
                          <option key={status.key} value={status.key}>
                            {status.emoji} {t(`gardenDashboard.plantsSection.health.${status.key}`, status.label)}
                          </option>
                        ))}
                      </Select>
                      {lastHealthUpdatedLabel && (
                        <p className="px-1 text-xs leading-5 text-stone-500 dark:text-stone-400">
                          {t("gardenDashboard.plantsSection.healthStatusUpdated", "Last updated")} {lastHealthUpdatedLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-200">
                      {t("gardenDashboard.plantsSection.notes", "Notes")}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder={t("gardenDashboard.plantsSection.notesPlaceholder", "Add observations about this plant...")}
                      className="min-h-[132px] w-full rounded-[22px] border border-stone-200 bg-white px-4 py-3.5 text-sm leading-6 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-stone-700 dark:bg-[#2d2d30] dark:text-white"
                    />
                  </div>
                </section>

                <section className="space-y-4 rounded-[24px] border border-stone-200/80 bg-stone-50/80 p-3.5 shadow-inner sm:rounded-[26px] sm:p-4 dark:border-stone-700 dark:bg-stone-900/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                        {t("gardenDashboard.taskDialog.tasks", "Tasks")}
                      </h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {t("gardenDashboard.plantsSection.managePlantTasks", "Keep this plant’s routine in sync without leaving the modal.")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="w-full rounded-2xl gap-2 sm:w-auto"
                      variant={taskEditorOpen ? "secondary" : "default"}
                      onClick={() => {
                        if (taskEditorOpen) resetTaskEditor();
                        else openCreateTask();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {taskEditorOpen
                        ? t("gardenDashboard.plantsSection.closeTaskEditor", "Close editor")
                        : t("gardenDashboard.taskDialog.addTask", "Add Task")}
                    </Button>
                  </div>

                  {tasksError && (
                    <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                      {tasksError}
                    </div>
                  )}

                  {tasksLoading ? (
                    <div className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                      {t("gardenDashboard.taskDialog.loading", "Loading...")}
                    </div>
                  ) : tasks.length > 0 ? (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 rounded-[22px] border border-stone-200 bg-white px-3 py-3 dark:border-stone-700 dark:bg-[#262629]"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-xl dark:bg-stone-800">
                            {getTaskEmoji(task)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-stone-900 dark:text-white">
                              {getTaskName(task, t)}
                            </div>
                            <div className="truncate text-xs text-stone-500 dark:text-stone-400">
                              {renderTaskSummary(task, t)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
                              aria-label={t("gardenDashboard.taskDialog.edit", "Edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {confirmDeleteTaskId === task.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task)}
                                  className="rounded-xl bg-red-600 px-2.5 py-2 text-xs font-medium text-white transition hover:bg-red-700"
                                >
                                  {t("gardenDashboard.taskDialog.confirmDelete", "Delete")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTaskId(null)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTaskId(task.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                                aria-label={t("gardenDashboard.taskDialog.delete", "Delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-stone-200 bg-white px-4 py-8 text-center dark:border-stone-700 dark:bg-[#262629]">
                      <div className="text-3xl">🌱</div>
                      <div className="mt-2 text-sm font-medium text-stone-800 dark:text-stone-200">
                        {t("gardenDashboard.taskDialog.noTasksYet", "No tasks yet")}
                      </div>
                      <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {t("gardenDashboard.taskDialog.addFirstTask", "Add a task to get started")}
                      </div>
                    </div>
                  )}

                  {taskEditorOpen && (
                    <div className="space-y-5 rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-[#262629]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-stone-900 dark:text-white">
                            {editingTask
                              ? t("gardenDashboard.plantsSection.editTaskInline", "Edit task")
                              : t("gardenDashboard.taskDialog.createTask", "Create task")}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400">
                            {t("gardenDashboard.taskDialog.createTaskDescription", "All tasks repeat. Choose frequency and calendar.")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={resetTaskEditor}
                          className="rounded-full px-2 py-1 text-xs text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          {t("cancel", "Cancel")}
                        </button>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                          {t("gardenDashboard.taskDialog.taskType", "Task Type")}
                        </label>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {TASK_TYPES.map(({ type, emoji }) => {
                            const isActive = taskType === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setTaskType(type)}
                                className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center text-[10px] font-medium transition sm:min-h-[72px] sm:text-[11px] ${
                                  isActive
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-300"
                                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-600"
                                }`}
                              >
                                <span className="text-xl">{emoji}</span>
                                <span>{t(`garden.taskTypes.${type}`)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {taskType === "custom" && (
                        <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900/30">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                              {t("gardenDashboard.taskDialog.customTaskName", "Task name")}
                            </label>
                            <Input
                              value={taskCustomName}
                              onChange={(event) => setTaskCustomName(event.target.value)}
                              placeholder={t("gardenDashboard.taskDialog.customTaskNamePlaceholder", "e.g., Mist leaves")}
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                              {t("gardenDashboard.taskDialog.emoji", "Emoji")}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {CUSTOM_EMOJI_PRESETS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => setTaskEmoji(taskEmoji === emoji ? "" : emoji)}
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                                    taskEmoji === emoji
                                      ? "border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-900/30"
                                      : "border-stone-200 bg-white hover:scale-105 dark:border-stone-700 dark:bg-stone-800"
                                  }`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {taskType === "water" && (gp.plant?.wateringFrequencyWarm || gp.plant?.wateringFrequencyCold) && (
                        <div className="rounded-2xl border border-sky-200/60 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-800 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-200">
                          <span className="font-semibold">{t("gardenDashboard.taskDialog.recommendedFrequency", "Recommended:")}</span>{" "}
                          {gp.plant?.wateringFrequencyWarm
                            ? t("gardenDashboard.taskDialog.warmSeason", "{{count}}x/week (warm)", { count: gp.plant.wateringFrequencyWarm })
                            : null}
                          {gp.plant?.wateringFrequencyWarm && gp.plant?.wateringFrequencyCold ? " · " : null}
                          {gp.plant?.wateringFrequencyCold
                            ? t("gardenDashboard.taskDialog.coldSeason", "{{count}}x/week (cold)", { count: gp.plant.wateringFrequencyCold })
                            : null}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                          {t("gardenDashboard.taskDialog.frequency", "How often?")}
                        </label>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <div className="flex items-center overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
                            <button
                              type="button"
                              onClick={() => setTaskAmount((current) => Math.max(1, current - 1))}
                              disabled={taskAmount <= 1}
                              className="flex h-10 w-10 items-center justify-center text-stone-500 transition hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-700"
                            >
                              −
                            </button>
                            <span className="w-11 text-center text-lg font-bold tabular-nums">{taskAmount}</span>
                            <button
                              type="button"
                              onClick={() => setTaskAmount((current) => Math.min(maxTaskSelections, current + 1))}
                              disabled={taskAmount >= maxTaskSelections}
                              className="flex h-10 w-10 items-center justify-center text-stone-500 transition hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-700"
                            >
                              +
                            </button>
                          </div>
                          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
                            {(["week", "month", "year"] as Period[]).map((period) => (
                              <button
                                key={period}
                                type="button"
                                onClick={() => {
                                  setTaskPeriod(period);
                                  setWeeklyDays([]);
                                  setMonthlyNthWeekdays([]);
                                  setYearlyDays([]);
                                  setTaskAmount((current) => Math.min(period === "week" ? 7 : period === "month" ? 12 : 52, current));
                                }}
                                className={`h-10 px-3 text-sm font-medium capitalize transition ${
                                  taskPeriod === period
                                    ? "bg-emerald-600 text-white"
                                    : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
                                }`}
                              >
                                {t(`gardenDashboard.taskDialog.${period}`, period)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                            {t("gardenDashboard.taskDialog.pickSchedule", "Pick your days")}
                          </label>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            selectedTaskCount === taskAmount
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                          }`}>
                            {selectedTaskCount} / {taskAmount}
                          </span>
                        </div>

                        {taskPeriod === "week" && (
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                            {[
                              t("gardenDashboard.taskDialog.dayLabels.mon", "Mon"),
                              t("gardenDashboard.taskDialog.dayLabels.tue", "Tue"),
                              t("gardenDashboard.taskDialog.dayLabels.wed", "Wed"),
                              t("gardenDashboard.taskDialog.dayLabels.thu", "Thu"),
                              t("gardenDashboard.taskDialog.dayLabels.fri", "Fri"),
                              t("gardenDashboard.taskDialog.dayLabels.sat", "Sat"),
                              t("gardenDashboard.taskDialog.dayLabels.sun", "Sun"),
                            ].map((label, index) => {
                              const dayNumber = MONDAY_FIRST_MAP[index];
                              const selected = weeklyDays.includes(dayNumber);
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() =>
                                    setWeeklyDays((current) => {
                                      if (current.includes(dayNumber)) return current.filter((value) => value !== dayNumber);
                                      if (disableMoreSelections) return current;
                                      return [...current, dayNumber];
                                    })
                                  }
                                  disabled={!selected && disableMoreSelections}
                                  className={`h-11 rounded-xl border-2 text-xs font-medium transition sm:h-12 sm:text-sm ${
                                    selected
                                      ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-600"
                                  } ${!selected && disableMoreSelections ? "opacity-40" : ""}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {taskPeriod === "month" && (
                          <div className="overflow-x-auto pb-1">
                            <div className="min-w-[430px] space-y-1.5">
                            <div className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                              <div />
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                                <div key={label} className="text-center text-[10px] font-medium text-stone-400 dark:text-stone-500">
                                  {label}
                                </div>
                              ))}
                            </div>
                            {["1st", "2nd", "3rd", "4th"].map((weekName, rowIndex) => (
                              <div key={weekName} className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                                <div className="text-center text-xs font-medium text-stone-400 dark:text-stone-500">{weekName}</div>
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => {
                                  const key = `${rowIndex + 1}-${MONDAY_FIRST_MAP[index]}`;
                                  const selected = monthlyNthWeekdays.includes(key);
                                  return (
                                    <button
                                      key={`${weekName}-${label}`}
                                      type="button"
                                      onClick={() =>
                                        setMonthlyNthWeekdays((current) => {
                                          if (current.includes(key)) return current.filter((value) => value !== key);
                                          if (disableMoreSelections) return current;
                                          return [...current, key];
                                        })
                                      }
                                      disabled={!selected && disableMoreSelections}
                                      className={`h-10 rounded-xl border-2 text-[11px] font-medium transition ${
                                        selected
                                          ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                                          : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                                      } ${!selected && disableMoreSelections ? "opacity-40" : ""}`}
                                      aria-label={`${weekName} ${label}`}
                                    >
                                      {selected ? label.slice(0, 2) : ""}
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                          </div>
                        )}

                        {taskPeriod === "year" && (
                          <InlineYearlyPicker
                            selected={yearlyDays}
                            disabledMore={disableMoreSelections}
                            onToggle={(key) =>
                              setYearlyDays((current) => {
                                if (current.includes(key)) return current.filter((value) => value !== key);
                                if (disableMoreSelections) return current;
                                return [...current, key];
                              })
                            }
                            onRemove={(key) => setYearlyDays((current) => current.filter((value) => value !== key))}
                          />
                        )}
                      </div>

                      {taskFormError && (
                        <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                          {taskFormError}
                        </div>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="secondary" className="flex-1 rounded-2xl" onClick={resetTaskEditor} disabled={taskSaving}>
                          {t("cancel", "Cancel")}
                        </Button>
                        <Button className="flex-1 rounded-2xl" onClick={handleSaveTask} disabled={taskSaving || selectedTaskCount !== taskAmount}>
                          {taskSaving
                            ? editingTask
                              ? t("gardenDashboard.settingsSection.saving", "Saving...")
                              : t("gardenDashboard.taskDialog.creating", "Creating…")
                            : editingTask
                              ? t("save", "Save")
                              : t("gardenDashboard.taskDialog.createTaskButton", "Create task")}
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
                </div>
              </div>
              <div className="border-t border-stone-200 bg-white/95 p-4 sm:px-6 sm:py-4 lg:sticky lg:bottom-0 dark:border-stone-700 dark:bg-[#1f1f1f]/95">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" className="w-full rounded-2xl sm:w-auto" onClick={() => setOpen(false)}>
                    {t("cancel", "Cancel")}
                  </Button>
                  <Button className="w-full rounded-2xl sm:w-auto" onClick={savePlantDetails} disabled={submitting || uploadingImage}>
                    {submitting ? t("gardenDashboard.settingsSection.saving", "Saving...") : t("save", "Save")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageSourceOpen} onOpenChange={setImageSourceOpen}>
        <DialogContent
          priorityZIndex={120}
          className="max-w-sm rounded-[24px] border border-stone-200/70 bg-white/95 p-0 shadow-[0_25px_80px_-35px_rgba(15,23,42,0.65)] dark:border-[#3e3e42]/70 dark:bg-[#1f1f1f]/95"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-4 p-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base">
                {t("gardenDashboard.plantsSection.imageSourceTitle", "Update plant photo")}
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-500 dark:text-stone-400">
                {t("gardenDashboard.plantsSection.imageSourceDescription", "Choose how you want to add an image for this plant.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5">
              <Button type="button" className="h-12 w-full justify-start gap-3 rounded-2xl" onClick={handleChooseUpload}>
                <UploadCloud className="h-4 w-4" />
                {t("gardenDashboard.plantsSection.uploadImage", "Upload")}
              </Button>
              <Button type="button" variant="secondary" className="h-12 w-full justify-start gap-3 rounded-2xl" onClick={handleChooseTakePhoto}>
                <Camera className="h-4 w-4" />
                {t("gardenDashboard.plantsSection.takePhoto", "Take photo")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function scoreTask(task: any): number {
  try {
    if (task.scheduleKind === "repeat_pattern") {
      const amount = Math.max(1, Number(task.amount || 1));
      const required = Math.max(1, Number(task.requiredCount || 1));
      const period = (task.period || "week") as Period;
      const perWeek = period === "week" ? amount : period === "month" ? amount / 4.345 : amount / 52;
      return perWeek * required;
    }
  } catch {}
  return 0;
}

function getTaskEmoji(task: any) {
  return task.type === "custom" ? task.emoji || "🪴" : TASK_EMOJIS[task.type] || "📋";
}

function getTaskName(task: any, t: ReturnType<typeof useTranslation<"common">>["t"]) {
  return task.type === "custom" ? task.customName || t("garden.taskTypes.custom") : t(`garden.taskTypes.${task.type}`);
}

function renderTaskSummary(task: any, t: ReturnType<typeof useTranslation<"common">>["t"]) {
  if (task.scheduleKind === "one_time_date") {
    return t("gardenDashboard.taskDialog.taskSummary.oneTimeOn", {
      date: task.dueAt ? new Date(task.dueAt).toLocaleString() : "—",
    });
  }
  if (task.scheduleKind === "one_time_duration") {
    return t("gardenDashboard.taskDialog.taskSummary.oneTimeIn", {
      amount: task.intervalAmount,
      unit: task.intervalUnit,
    });
  }
  if (task.scheduleKind === "repeat_duration") {
    return t("gardenDashboard.taskDialog.taskSummary.everyNeed", {
      amount: task.intervalAmount,
      unit: task.intervalUnit,
      required: task.requiredCount,
    });
  }
  if (task.scheduleKind === "repeat_pattern") {
    if (task.period === "week") {
      return t("gardenDashboard.taskDialog.taskSummary.perWeek", { count: (task.weeklyDays || []).length });
    }
    if (task.period === "month") {
      return t("gardenDashboard.taskDialog.taskSummary.perMonth", {
        count: (task.monthlyNthWeekdays || task.monthlyDays || []).length,
      });
    }
    return t("gardenDashboard.taskDialog.taskSummary.perYear", { count: (task.yearlyDays || []).length });
  }
  return "";
}

function InlineYearlyPicker({
  selected,
  onToggle,
  onRemove,
  disabledMore,
}: {
  selected: string[];
  onToggle: (key: string) => void;
  onRemove: (key: string) => void;
  disabledMore: boolean;
}) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekLabels = ["1st", "2nd", "3rd", "4th"];
  const weekdayToUi: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  const [activeMonth, setActiveMonth] = React.useState<number | null>(null);

  const countByMonth = React.useMemo(() => {
    const counts: Record<number, number> = {};
    for (const key of selected) {
      const month = parseInt(key.split("-")[0], 10);
      if (month >= 1 && month <= 12) counts[month] = (counts[month] || 0) + 1;
    }
    return counts;
  }, [selected]);

  const formatKey = (key: string) => {
    const [month, weekIndex, weekday] = key.split("-").map(Number);
    return `${months[month - 1]} · ${weekLabels[weekIndex - 1]} ${dayLabels[weekdayToUi[weekday] ?? 0]}`;
  };

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...selected].sort().map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
            >
              {formatKey(key)}
              <button type="button" onClick={() => onRemove(key)} className="hover:text-red-600 dark:hover:text-red-400">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {months.map((label, index) => {
          const selectedCount = countByMonth[index + 1] || 0;
          const isActive = activeMonth === index;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveMonth(isActive ? null : index)}
              className={`relative h-10 rounded-xl border-2 text-xs font-medium transition ${
                isActive
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-600"
              }`}
            >
              {label}
              {selectedCount > 0 && !isActive && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeMonth !== null && (
        <div className="space-y-1.5 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
          <div className="text-xs font-medium text-stone-600 dark:text-stone-300">{months[activeMonth]}</div>
          <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-1 items-center">
            <div />
            {dayLabels.map((label) => (
              <div key={label} className="text-center text-[9px] font-medium text-stone-400">
                {label}
              </div>
            ))}
          </div>
          {weekLabels.map((weekLabel, rowIndex) => (
            <div key={weekLabel} className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-1 items-center">
              <div className="text-center text-[10px] text-stone-400">{weekLabel}</div>
              {dayLabels.map((label, index) => {
                const key = `${String(activeMonth + 1).padStart(2, "0")}-${rowIndex + 1}-${MONDAY_FIRST_MAP[index]}`;
                const isSelected = selected.includes(key);
                return (
                  <button
                    key={`${weekLabel}-${label}`}
                    type="button"
                    onClick={() => onToggle(key)}
                    disabled={!isSelected && disabledMore}
                    className={`h-9 rounded-lg border-2 text-[10px] font-medium transition ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                    } ${!isSelected && disabledMore ? "opacity-40" : ""}`}
                    aria-label={`${months[activeMonth]} ${weekLabel} ${label}`}
                  >
                    {isSelected ? label.slice(0, 2) : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
