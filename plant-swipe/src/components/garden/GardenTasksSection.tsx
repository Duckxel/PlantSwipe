import React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Droplets,
  Scissors,
  Leaf,
  Package,
  Sparkles,
  Calendar,
  Clock,
} from "lucide-react";
import { listCompletionsForOccurrences } from "@/lib/gardens";

interface TaskOccurrence {
  id: string;
  taskId: string;
  gardenPlantId: string;
  dueAt: string;
  requiredCount: number;
  completedCount: number;
  completedAt: string | null;
  taskType?: "water" | "fertilize" | "harvest" | "cut" | "custom";
  taskEmoji?: string;
}

interface Plant {
  id: string;
  nickname?: string | null;
  plant?: {
    id: string;
    name: string;
    photos?: unknown;
    care?: { water?: string };
  } | null;
}

interface GardenTasksSectionProps {
  plants: Plant[];
  todayTaskOccurrences: TaskOccurrence[];
  onProgressOccurrence: (id: string, inc: number) => Promise<void>;
  progressingOccIds: Set<string>;
  completingPlantIds: Set<string>;
  completeAllTodayForPlant: (gardenPlantId: string) => Promise<void>;
  weekDays: string[];
  weekCounts: number[];
  weekCountsByType: {
    water: number[];
    fertilize: number[];
    harvest: number[];
    cut: number[];
    custom: number[];
  };
  serverToday: string | null;
  dueThisWeekByPlant: Record<string, number[]>;
  duePlantIds: Set<string> | null;
}

const taskTypeConfig = {
  water: {
    icon: Droplets,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    barColor: "bg-blue-500",
    emoji: "💧",
  },
  fertilize: {
    icon: Leaf,
    color: "text-green-500",
    bg: "bg-green-100 dark:bg-green-900/30",
    barColor: "bg-green-500",
    emoji: "🌱",
  },
  harvest: {
    icon: Package,
    color: "text-yellow-500",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    barColor: "bg-yellow-500",
    emoji: "🌾",
  },
  cut: {
    icon: Scissors,
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    barColor: "bg-orange-500",
    emoji: "✂️",
  },
  custom: {
    icon: Sparkles,
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    barColor: "bg-purple-500",
    emoji: "🪴",
  },
};

export const GardenTasksSection: React.FC<GardenTasksSectionProps> = ({
  plants,
  todayTaskOccurrences,
  onProgressOccurrence,
  progressingOccIds,
  completingPlantIds,
  completeAllTodayForPlant,
  weekDays,
  weekCounts,
  weekCountsByType,
  serverToday,
  dueThisWeekByPlant,
  duePlantIds,
}) => {
  const { t } = useTranslation("common");
  const [completionsByOcc, setCompletionsByOcc] = React.useState<
    Record<string, Array<{ userId: string; displayName: string | null }>>
  >({});

  // Fetch completions for done occurrences
  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const doneOccIds = (todayTaskOccurrences || [])
          .filter(
            (o) =>
              Number(o.completedCount || 0) >=
              Math.max(1, Number(o.requiredCount || 1))
          )
          .map((o) => o.id);
        if (doneOccIds.length === 0) {
          if (!ignore) setCompletionsByOcc({});
          return;
        }
        const map = await listCompletionsForOccurrences(doneOccIds);
        if (!ignore) setCompletionsByOcc(map);
      } catch {
        // ignore errors
      }
    })();
    return () => {
      ignore = true;
    };
  }, [todayTaskOccurrences]);

  // Group occurrences by plant
  const occsByPlant: Record<string, TaskOccurrence[]> = {};
  for (const o of todayTaskOccurrences) {
    if (!occsByPlant[o.gardenPlantId]) occsByPlant[o.gardenPlantId] = [];
    occsByPlant[o.gardenPlantId].push(o);
  }

  // Get plants with today's tasks
  const plantsWithTasks = plants.filter((p) => occsByPlant[p.id]?.length > 0);
  const totalTasks = todayTaskOccurrences.reduce(
    (sum, o) => sum + Math.max(1, o.requiredCount || 1),
    0
  );
  const completedTasks = todayTaskOccurrences.reduce(
    (sum, o) =>
      sum + Math.min(Math.max(1, o.requiredCount || 1), o.completedCount || 0),
    0
  );
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  // Day labels
  const dayLabels = [
    t("gardenDashboard.routineSection.dayLabels.mon"),
    t("gardenDashboard.routineSection.dayLabels.tue"),
    t("gardenDashboard.routineSection.dayLabels.wed"),
    t("gardenDashboard.routineSection.dayLabels.thu"),
    t("gardenDashboard.routineSection.dayLabels.fri"),
    t("gardenDashboard.routineSection.dayLabels.sat"),
    t("gardenDashboard.routineSection.dayLabels.sun"),
  ];

  // Full day names for mobile
  const dayLabelsFull = [
    t("gardenDashboard.routineSection.dayLabelsFull.mon", "Monday"),
    t("gardenDashboard.routineSection.dayLabelsFull.tue", "Tuesday"),
    t("gardenDashboard.routineSection.dayLabelsFull.wed", "Wednesday"),
    t("gardenDashboard.routineSection.dayLabelsFull.thu", "Thursday"),
    t("gardenDashboard.routineSection.dayLabelsFull.fri", "Friday"),
    t("gardenDashboard.routineSection.dayLabelsFull.sat", "Saturday"),
    t("gardenDashboard.routineSection.dayLabelsFull.sun", "Sunday"),
  ];

  const maxCount = Math.max(1, ...weekCounts);

  // Plants with upcoming tasks (not due today)
  const plantsWithUpcoming = plants.filter(
    (gp) =>
      (dueThisWeekByPlant[gp.id]?.length || 0) > 0 && !duePlantIds?.has(gp.id)
  );

  const getTaskIcon = (taskType: string, emoji?: string) => {
    if (emoji && emoji !== "??" && emoji !== "???" && emoji.trim() !== "") {
      return emoji;
    }
    return taskTypeConfig[taskType as keyof typeof taskTypeConfig]?.emoji || "🪴";
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Weekly Overview Card - Compact on mobile */}
      <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur overflow-hidden">
        <div className="p-3 md:p-4 border-b border-stone-200/50 dark:border-stone-700/50 bg-gradient-to-r from-blue-50/80 to-white dark:from-blue-900/20 dark:to-[#1f1f1f]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
              {t("gardenDashboard.routineSection.thisWeek", "This Week")}
            </h3>
          </div>
        </div>
        <div className="p-3 md:p-4">
          {/* Compact bar chart for mobile */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {weekDays.map((ds, idx) => {
              const count = weekCounts[idx] || 0;
              const isToday = serverToday === ds;
              const water = weekCountsByType.water[idx] || 0;
              const fert = weekCountsByType.fertilize[idx] || 0;
              const harv = weekCountsByType.harvest[idx] || 0;
              const cut = weekCountsByType.cut[idx] || 0;
              const cust = weekCountsByType.custom[idx] || 0;

              return (
                <div
                  key={ds}
                  className="flex flex-col items-center gap-0.5 md:gap-1"
                >
                  <div className="text-[10px] md:text-xs text-muted-foreground">
                    {dayLabels[idx]}
                  </div>
                  <div
                    className={`w-full h-14 md:h-20 rounded-md md:rounded-lg overflow-hidden flex flex-col justify-end ${
                      isToday
                        ? "ring-2 ring-emerald-500 ring-offset-1"
                        : "bg-stone-100 dark:bg-stone-800"
                    }`}
                  >
                    {count > 0 ? (
                      <>
                        {water > 0 && (
                          <div
                            className="bg-blue-500"
                            style={{ height: `${(water / maxCount) * 100}%` }}
                          />
                        )}
                        {fert > 0 && (
                          <div
                            className="bg-green-500"
                            style={{ height: `${(fert / maxCount) * 100}%` }}
                          />
                        )}
                        {harv > 0 && (
                          <div
                            className="bg-yellow-500"
                            style={{ height: `${(harv / maxCount) * 100}%` }}
                          />
                        )}
                        {cut > 0 && (
                          <div
                            className="bg-orange-500"
                            style={{ height: `${(cut / maxCount) * 100}%` }}
                          />
                        )}
                        {cust > 0 && (
                          <div
                            className="bg-purple-500"
                            style={{ height: `${(cust / maxCount) * 100}%` }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-stone-100 dark:bg-stone-800" />
                    )}
                  </div>
                  <div className={`text-[10px] md:text-xs font-medium ${isToday ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend - hide on very small screens */}
          <div className="hidden sm:flex flex-wrap gap-2 md:gap-3 mt-3 md:mt-4 justify-center">
            {[
              { key: "water", label: t("garden.taskTypes.water"), color: "bg-blue-500" },
              { key: "fertilize", label: t("garden.taskTypes.fertilize"), color: "bg-green-500" },
              { key: "harvest", label: t("garden.taskTypes.harvest"), color: "bg-yellow-500" },
              { key: "cut", label: t("garden.taskTypes.cut"), color: "bg-orange-500" },
              { key: "custom", label: t("garden.taskTypes.custom"), color: "bg-purple-500" },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-1 text-[10px] md:text-xs">
                <div className={`w-2 h-2 md:w-3 md:h-3 rounded ${item.color}`} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Today's Tasks - Mobile-optimized layout */}
      <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur overflow-hidden">
        <div className="p-3 md:p-4 border-b border-stone-200/50 dark:border-stone-700/50 bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-900/20 dark:to-[#1f1f1f]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
              {t("gardenDashboard.routineSection.today", "Today")}
            </h3>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xs md:text-sm font-medium">
                {completedTasks}/{totalTasks}
              </span>
              <div className="w-16 md:w-24 h-1.5 md:h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs md:text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {progressPct}%
              </span>
            </div>
          </div>
        </div>

        {plantsWithTasks.length === 0 ? (
          <div className="p-6 md:p-8 text-center">
            <div className="text-3xl md:text-4xl mb-2 md:mb-3">🌿</div>
            <p className="text-base md:text-lg font-medium text-muted-foreground">
              {t("gardenDashboard.todaysTasks.allDone", "All done for today!")}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {t("gardenDashboard.todaysTasks.enjoyYourDay", "Enjoy your day, your plants are happy.")}
            </p>
          </div>
        ) : (
          <div className="p-2 md:p-3 space-y-3">
            {plantsWithTasks.map((plant) => {
              const occs = occsByPlant[plant.id] || [];
              const plantTotalReq = occs.reduce(
                (a, o) => a + Math.max(1, o.requiredCount || 1),
                0
              );
              const plantTotalDone = occs.reduce(
                (a, o) =>
                  a +
                  Math.min(
                    Math.max(1, o.requiredCount || 1),
                    o.completedCount || 0
                  ),
                0
              );
              const allDone = plantTotalDone >= plantTotalReq;
              const isCompleting = completingPlantIds.has(plant.id);

              return (
                <div key={plant.id} className="bg-stone-50/50 dark:bg-stone-900/30 rounded-xl p-2 md:p-3">
                  {/* Plant Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm md:text-base truncate">
                        {plant.nickname || plant.plant?.name || "Plant"}
                      </div>
                      <div className="text-[10px] md:text-xs text-muted-foreground">
                        {plantTotalDone}/{plantTotalReq} {t("garden.done", "done")}
                      </div>
                    </div>
                    {!allDone && (
                      <Button
                        size="sm"
                        className="rounded-lg text-xs h-7 px-2 md:px-3 flex-shrink-0"
                        onClick={() => completeAllTodayForPlant(plant.id)}
                        disabled={isCompleting}
                      >
                        {isCompleting ? (
                          <span className="animate-pulse">⏳</span>
                        ) : (
                          t("garden.completeAll", "Complete All")
                        )}
                      </Button>
                    )}
                    {allDone && (
                      <span className="text-emerald-500 text-xs md:text-sm font-medium flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4" />
                        {t("gardenDashboard.routineSection.completed", "Done")}
                      </span>
                    )}
                  </div>

                  {/* Task List - Clean mobile layout */}
                  <div className="space-y-1.5">
                    {occs.map((occ) => {
                      const taskType = occ.taskType || "custom";
                      const isDone =
                        (occ.completedCount || 0) >=
                        Math.max(1, occ.requiredCount || 1);
                      const isProgressing = progressingOccIds.has(occ.id);
                      const remaining = Math.max(
                        0,
                        (occ.requiredCount || 1) - (occ.completedCount || 0)
                      );
                      const completions = completionsByOcc[occ.id] || [];

                      return (
                        <div
                          key={occ.id}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            isDone
                              ? "bg-white/50 dark:bg-stone-800/30 opacity-60"
                              : "bg-white dark:bg-stone-800/50"
                          }`}
                        >
                          {/* Task Icon */}
                          <span className="text-lg md:text-xl flex-shrink-0">
                            {getTaskIcon(taskType, occ.taskEmoji)}
                          </span>
                          
                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs md:text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              {t(`garden.taskTypes.${taskType}`, taskType)}
                            </div>
                            {occ.requiredCount > 1 && !isDone && (
                              <div className="text-[10px] md:text-xs text-muted-foreground">
                                {occ.completedCount || 0}/{occ.requiredCount}
                              </div>
                            )}
                            {isDone && completions.length > 0 && (
                              <div className="text-[10px] md:text-xs text-muted-foreground truncate">
                                {completions
                                  .map((c) => c.displayName || t("garden.someone", "Someone"))
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                          
                          {/* Complete Button */}
                          {!isDone ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="rounded-lg h-7 px-2 text-xs flex-shrink-0"
                              onClick={() => onProgressOccurrence(occ.id, remaining)}
                              disabled={isProgressing}
                            >
                              {isProgressing ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                t("garden.complete", "Complete")
                              )}
                            </Button>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Upcoming Tasks - Better mobile layout */}
      {plantsWithUpcoming.length > 0 && (
        <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur overflow-hidden">
          <div className="p-3 md:p-4 border-b border-stone-200/50 dark:border-stone-700/50 bg-gradient-to-r from-amber-50/80 to-white dark:from-amber-900/20 dark:to-[#1f1f1f]">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
              {t("gardenDashboard.routineSection.dueThisWeek", "Upcoming This Week")}
            </h3>
          </div>
          <div className="p-2 md:p-3 space-y-2">
            {plantsWithUpcoming.map((plant) => {
              const dueDays = dueThisWeekByPlant[plant.id] || [];

              return (
                <div 
                  key={plant.id} 
                  className="bg-stone-50/50 dark:bg-stone-900/30 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm md:text-base">
                        {plant.nickname || plant.plant?.name || "Plant"}
                      </div>
                      {plant.nickname && plant.plant?.name && (
                        <div className="text-[10px] md:text-xs text-muted-foreground">
                          {plant.plant.name}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Days displayed as list on mobile for better readability */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dueDays.map((dayIdx) => (
                      <span
                        key={dayIdx}
                        className="inline-flex items-center px-2 py-1 text-xs rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      >
                        <span className="hidden sm:inline">{dayLabelsFull[dayIdx]}</span>
                        <span className="sm:hidden">{dayLabels[dayIdx]}</span>
                      </span>
                    ))}
                  </div>
                  {plant.plant?.care?.water && (
                    <div className="mt-2 text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">
                      <Droplets className="w-3 h-3" />
                      {plant.plant.care.water}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty state if no tasks at all */}
      {plantsWithTasks.length === 0 && plantsWithUpcoming.length === 0 && weekCounts.every((c) => c === 0) && (
        <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 p-6 md:p-8 text-center">
          <div className="text-3xl md:text-4xl mb-2 md:mb-3">📋</div>
          <p className="text-base md:text-lg font-medium">
            {t("gardenDashboard.routineSection.noTasks", "No tasks scheduled")}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {t("gardenDashboard.routineSection.noTasksHint", "Add tasks to your plants to see them here")}
          </p>
        </Card>
      )}
    </div>
  );
};

export default GardenTasksSection;
