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
  Flower2,
  Loader2,
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

interface WeekTaskOccurrence {
  id: string;
  taskId: string;
  gardenPlantId: string;
  dueAt: string;
  requiredCount: number;
  completedCount: number;
  completedAt: string | null;
  taskType: "water" | "fertilize" | "harvest" | "cut" | "custom";
  taskEmoji?: string | null;
  dayIndex: number;
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
  weekTaskOccurrences?: WeekTaskOccurrence[];
}

const taskTypeConfig = {
  water: {
    icon: Droplets,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20",
    border: "border-blue-300 dark:border-blue-700/60",
    barColor: "bg-blue-500",
    emoji: "💧",
    gradient: "from-blue-500/10 to-blue-500/5",
    buttonBg: "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500",
    buttonOutline: "border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30",
  },
  fertilize: {
    icon: Leaf,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20",
    border: "border-green-300 dark:border-green-700/60",
    barColor: "bg-green-500",
    emoji: "🌱",
    gradient: "from-green-500/10 to-green-500/5",
    buttonBg: "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500",
    buttonOutline: "border-green-400 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30",
  },
  harvest: {
    icon: Package,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20",
    border: "border-amber-300 dark:border-amber-700/60",
    barColor: "bg-amber-500",
    emoji: "🌾",
    gradient: "from-amber-500/10 to-amber-500/5",
    buttonBg: "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500",
    buttonOutline: "border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30",
  },
  cut: {
    icon: Scissors,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20",
    border: "border-orange-300 dark:border-orange-700/60",
    barColor: "bg-orange-500",
    emoji: "✂️",
    gradient: "from-orange-500/10 to-orange-500/5",
    buttonBg: "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500",
    buttonOutline: "border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30",
  },
  custom: {
    icon: Sparkles,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20",
    border: "border-purple-300 dark:border-purple-700/60",
    barColor: "bg-purple-500",
    emoji: "🪴",
    gradient: "from-purple-500/10 to-purple-500/5",
    buttonBg: "bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-500",
    buttonOutline: "border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30",
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
  weekTaskOccurrences = [],
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

  // Full day names
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

  // Get upcoming week tasks (not due today) with task details
  const upcomingWeekTasks = React.useMemo(() => {
    const today = serverToday;
    if (!today) return [];

    // Filter week occurrences that are upcoming (after today) and incomplete
    return weekTaskOccurrences
      .filter((o) => {
        const dayIso = new Date(o.dueAt).toISOString().slice(0, 10);
        const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0));
        return remaining > 0 && dayIso > today;
      })
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [weekTaskOccurrences, serverToday]);

  // Plants with upcoming tasks (fallback if no weekTaskOccurrences)
  const plantsWithUpcoming = plants.filter(
    (gp) =>
      (dueThisWeekByPlant[gp.id]?.length || 0) > 0 && !duePlantIds?.has(gp.id)
  );

  const getTaskIcon = (taskType: string, emoji?: string | null) => {
    if (emoji && emoji !== "??" && emoji !== "???" && emoji.trim() !== "") {
      return emoji;
    }
    return taskTypeConfig[taskType as keyof typeof taskTypeConfig]?.emoji || "🪴";
  };

  const getPlantName = (gardenPlantId: string) => {
    const plant = plants.find((p) => p.id === gardenPlantId);
    return plant?.nickname || plant?.plant?.name || t("garden.plant", "Plant");
  };

  const formatTaskDate = (dueAt: string, dayIndex: number) => {
    const date = new Date(dueAt);
    const dayName = dayLabelsFull[dayIndex] || dayLabels[dayIndex];
    const dayNum = date.getDate();
    return { dayName, dayNum };
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Weekly Overview Card */}
      <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#1f1f1f]/95 backdrop-blur overflow-hidden shadow-sm">
        <div className="p-4 md:p-5 border-b border-stone-100 dark:border-stone-800/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 dark:from-blue-900/10 dark:to-indigo-900/10">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              {t("gardenDashboard.routineSection.thisWeek", "This Week")}
            </h3>
          </div>
        </div>
        <div className="p-4 md:p-5">
          {/* Week bar chart */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2.5">
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
                  className="flex flex-col items-center gap-1 md:gap-1.5"
                >
                  <div className={`text-[10px] md:text-xs font-medium ${isToday ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {dayLabels[idx]}
                  </div>
                  <div
                    className={`w-full h-16 md:h-24 rounded-lg md:rounded-xl overflow-hidden flex flex-col justify-end transition-all ${
                      isToday
                        ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-[#1f1f1f]"
                        : "bg-stone-100 dark:bg-stone-800/50"
                    }`}
                  >
                    {count > 0 ? (
                      <>
                        {water > 0 && (
                          <div
                            className="bg-gradient-to-t from-blue-500 to-blue-400 transition-all"
                            style={{ height: `${(water / maxCount) * 100}%` }}
                          />
                        )}
                        {fert > 0 && (
                          <div
                            className="bg-gradient-to-t from-green-500 to-green-400 transition-all"
                            style={{ height: `${(fert / maxCount) * 100}%` }}
                          />
                        )}
                        {harv > 0 && (
                          <div
                            className="bg-gradient-to-t from-amber-500 to-amber-400 transition-all"
                            style={{ height: `${(harv / maxCount) * 100}%` }}
                          />
                        )}
                        {cut > 0 && (
                          <div
                            className="bg-gradient-to-t from-orange-500 to-orange-400 transition-all"
                            style={{ height: `${(cut / maxCount) * 100}%` }}
                          />
                        )}
                        {cust > 0 && (
                          <div
                            className="bg-gradient-to-t from-purple-500 to-purple-400 transition-all"
                            style={{ height: `${(cust / maxCount) * 100}%` }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-stone-100 dark:bg-stone-800/50" />
                    )}
                  </div>
                  <div className={`text-xs md:text-sm font-semibold ${isToday ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 md:gap-4 mt-4 md:mt-5 justify-center">
            {[
              { key: "water", label: t("garden.taskTypes.water"), color: "bg-blue-500" },
              { key: "fertilize", label: t("garden.taskTypes.fertilize"), color: "bg-green-500" },
              { key: "harvest", label: t("garden.taskTypes.harvest"), color: "bg-amber-500" },
              { key: "cut", label: t("garden.taskTypes.cut"), color: "bg-orange-500" },
              { key: "custom", label: t("garden.taskTypes.custom"), color: "bg-purple-500" },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-1.5 text-xs md:text-sm">
                <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${item.color}`} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Today's Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg md:text-xl flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            {t("gardenDashboard.routineSection.today", "Today")}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-medium text-muted-foreground">
              {completedTasks}/{totalTasks}
            </span>
            <div className="w-20 md:w-32 h-2 md:h-2.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm md:text-base font-semibold text-emerald-600 dark:text-emerald-400">
              {progressPct}%
            </span>
          </div>
        </div>

        {plantsWithTasks.length === 0 ? (
          <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#1f1f1f]/95 p-8 md:p-12 text-center">
            <div className="text-4xl md:text-5xl mb-3">🌿</div>
            <p className="text-lg md:text-xl font-medium text-foreground">
              {t("gardenDashboard.todaysTasks.allDone", "All done for today!")}
            </p>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              {t("gardenDashboard.todaysTasks.enjoyYourDay", "Enjoy your day, your plants are happy.")}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              const plantProgressPct = plantTotalReq > 0 ? Math.round((plantTotalDone / plantTotalReq) * 100) : 100;

              return (
                <Card 
                  key={plant.id} 
                  className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                    allDone 
                      ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10" 
                      : "border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#1f1f1f]/95"
                  }`}
                >
                  {/* Plant Header */}
                  <div className={`p-4 border-b ${allDone ? "border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5" : "border-stone-100 dark:border-stone-800/50"}`}>
                    {/* Plant info row */}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        allDone 
                          ? "bg-emerald-100 dark:bg-emerald-900/30" 
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}>
                        <Flower2 className={`w-5 h-5 md:w-6 md:h-6 ${allDone ? "text-emerald-600 dark:text-emerald-400" : "text-stone-500 dark:text-stone-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-sm md:text-base line-clamp-2">
                            {plant.nickname || plant.plant?.name || "Plant"}
                          </div>
                          {allDone && (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="text-sm font-medium hidden sm:inline">
                                {t("gardenDashboard.routineSection.completed", "Done")}
                              </span>
                            </div>
                          )}
                        </div>
                        {plant.nickname && plant.plant?.name && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {plant.plant.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress bar and Complete All button */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              allDone ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${plantProgressPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {plantTotalDone}/{plantTotalReq}
                        </span>
                      </div>
                      {!allDone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs h-8 px-3 flex-shrink-0 border-2 border-emerald-400 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-semibold transition-all"
                          onClick={() => completeAllTodayForPlant(plant.id)}
                          disabled={isCompleting}
                        >
                          {isCompleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              {t("garden.completeAll", "Complete All")}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="p-3 space-y-2">
                    {occs.map((occ) => {
                      const taskType = occ.taskType || "custom";
                      const config = taskTypeConfig[taskType] || taskTypeConfig.custom;
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
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all shadow-sm ${
                            isDone
                              ? "bg-stone-50/50 dark:bg-stone-800/20 opacity-70"
                              : `${config.bg} ${config.border} border-2`
                          }`}
                        >
                          {/* Task Icon */}
                          <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                            isDone ? "bg-stone-200/50 dark:bg-stone-700/30" : "bg-white dark:bg-stone-900/80 border border-white/50"
                          }`}>
                            <span className="text-xl md:text-2xl">
                              {getTaskIcon(taskType, occ.taskEmoji)}
                            </span>
                          </div>
                          
                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm md:text-base font-semibold ${isDone ? "line-through text-muted-foreground" : config.color}`}>
                              {t(`garden.taskTypes.${taskType}`, taskType)}
                            </div>
                            {occ.requiredCount > 1 && !isDone && (
                              <div className="text-xs text-muted-foreground">
                                {occ.completedCount || 0}/{occ.requiredCount} {t("garden.times", "times")}
                              </div>
                            )}
                            {isDone && completions.length > 0 && (
                              <div className="text-xs text-muted-foreground truncate">
                                {t("gardenDashboard.routineSection.doneBy", "Done by")} {completions
                                  .map((c) => c.displayName || t("garden.someone", "Someone"))
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                          
                          {/* Complete Button - Secondary/Outline style with task color */}
                          {!isDone ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`rounded-xl h-9 px-4 text-xs font-semibold flex-shrink-0 border-2 transition-all ${config.buttonOutline}`}
                              onClick={() => onProgressOccurrence(occ.id, remaining)}
                              disabled={isProgressing}
                            >
                              {isProgressing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  {t("garden.complete", "Complete")}
                                </>
                              )}
                            </Button>
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Due This Week Section */}
      {(upcomingWeekTasks.length > 0 || plantsWithUpcoming.length > 0) && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold text-lg md:text-xl">
              {t("gardenDashboard.routineSection.dueThisWeek", "Due This Week")}
            </h3>
          </div>

          {upcomingWeekTasks.length > 0 ? (
            /* Grid of individual task cards when we have full task data */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {upcomingWeekTasks.map((task) => {
                const taskType = task.taskType || "custom";
                const config = taskTypeConfig[taskType] || taskTypeConfig.custom;
                const { dayName, dayNum } = formatTaskDate(task.dueAt, task.dayIndex);
                const plantName = getPlantName(task.gardenPlantId);

                return (
                  <Card 
                    key={task.id}
                    className={`rounded-xl border overflow-hidden transition-all hover:shadow-md hover:scale-[1.02] ${config.border} ${config.bg}`}
                  >
                    <div className={`p-3 bg-gradient-to-br ${config.gradient}`}>
                      {/* Date badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-lg md:text-xl font-bold ${config.color}`}>
                            {dayNum}
                          </span>
                          <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
                            {dayName.slice(0, 3)}
                          </span>
                        </div>
                      </div>

                      {/* Task type icon */}
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 bg-white/80 dark:bg-stone-900/50 shadow-sm`}>
                        <span className="text-xl md:text-2xl">
                          {getTaskIcon(taskType, task.taskEmoji)}
                        </span>
                      </div>

                      {/* Task type name */}
                      <div className={`text-xs md:text-sm font-semibold mb-1 ${config.color}`}>
                        {t(`garden.taskTypes.${taskType}`, taskType)}
                      </div>

                      {/* Plant name */}
                      <div className="text-xs text-muted-foreground line-clamp-2 leading-tight" title={plantName}>
                        {plantName}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Fallback: Plant-based cards when we don't have full task data */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {plantsWithUpcoming.map((plant) => {
                const dueDays = dueThisWeekByPlant[plant.id] || [];

                return (
                  <Card
                    key={plant.id}
                    className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <Flower2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {plant.nickname || plant.plant?.name || "Plant"}
                          </div>
                          {plant.nickname && plant.plant?.name && (
                            <div className="text-xs text-muted-foreground truncate">
                              {plant.plant.name}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Days displayed as badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {dueDays.map((dayIdx) => (
                          <span
                            key={dayIdx}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          >
                            {dayLabelsFull[dayIdx]}
                          </span>
                        ))}
                      </div>
                      {plant.plant?.care?.water && (
                        <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30 text-xs text-muted-foreground flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5" />
                          <span className="truncate">{plant.plant.care.water}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state if no tasks at all */}
      {plantsWithTasks.length === 0 && plantsWithUpcoming.length === 0 && upcomingWeekTasks.length === 0 && weekCounts.every((c) => c === 0) && (
        <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#1f1f1f]/95 p-8 md:p-12 text-center">
          <div className="text-4xl md:text-5xl mb-3">📋</div>
          <p className="text-lg md:text-xl font-medium">
            {t("gardenDashboard.routineSection.noTasks", "No tasks scheduled")}
          </p>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            {t("gardenDashboard.routineSection.noTasksHint", "Add tasks to your plants to see them here")}
          </p>
        </Card>
      )}
    </div>
  );
};

export default GardenTasksSection;
