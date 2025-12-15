import React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Droplets, Scissors, Leaf, Package, Sparkles, ChevronRight } from "lucide-react";

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
  } | null;
}

interface TodaysTasksWidgetProps {
  plants: Plant[];
  todayTaskOccurrences: TaskOccurrence[];
  onProgressOccurrence: (id: string, inc: number) => Promise<void>;
  progressingOccIds: Set<string>;
  completingPlantIds: Set<string>;
  completeAllTodayForPlant: (gardenPlantId: string) => Promise<void>;
  onNavigateToPlants?: () => void;
  compact?: boolean;
}

const taskTypeConfig = {
  water: { 
    icon: Droplets, 
    color: "text-blue-600 dark:text-blue-400", 
    bg: "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20", 
    border: "border-blue-300 dark:border-blue-700/60",
    buttonOutline: "border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30",
    emoji: "💧" 
  },
  fertilize: { 
    icon: Leaf, 
    color: "text-green-600 dark:text-green-400", 
    bg: "bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20", 
    border: "border-green-300 dark:border-green-700/60",
    buttonOutline: "border-green-400 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30",
    emoji: "🌱" 
  },
  harvest: { 
    icon: Package, 
    color: "text-amber-600 dark:text-amber-400", 
    bg: "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20", 
    border: "border-amber-300 dark:border-amber-700/60",
    buttonOutline: "border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30",
    emoji: "🌾" 
  },
  cut: { 
    icon: Scissors, 
    color: "text-orange-600 dark:text-orange-400", 
    bg: "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20", 
    border: "border-orange-300 dark:border-orange-700/60",
    buttonOutline: "border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30",
    emoji: "✂️" 
  },
  custom: { 
    icon: Sparkles, 
    color: "text-purple-600 dark:text-purple-400", 
    bg: "bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20", 
    border: "border-purple-300 dark:border-purple-700/60",
    buttonOutline: "border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30",
    emoji: "🪴" 
  },
};

export const TodaysTasksWidget: React.FC<TodaysTasksWidgetProps> = ({
  plants,
  todayTaskOccurrences,
  onProgressOccurrence,
  progressingOccIds,
  completingPlantIds,
  completeAllTodayForPlant,
  onNavigateToPlants,
  compact = false,
}) => {
  const { t } = useTranslation("common");

  // Group occurrences by plant
  const occsByPlant: Record<string, TaskOccurrence[]> = {};
  for (const o of todayTaskOccurrences) {
    if (!occsByPlant[o.gardenPlantId]) occsByPlant[o.gardenPlantId] = [];
    occsByPlant[o.gardenPlantId].push(o);
  }

  // Get plants with today's tasks
  const plantsWithTasks = plants.filter((p) => occsByPlant[p.id]?.length > 0);
  const totalTasks = todayTaskOccurrences.length;
  const completedTasks = todayTaskOccurrences.filter(
    (o) => (o.completedCount || 0) >= Math.max(1, o.requiredCount || 1)
  ).length;

  const getTaskIcon = (taskType: string, emoji?: string) => {
    if (emoji && emoji !== "??" && emoji !== "???" && emoji.trim() !== "") {
      return emoji;
    }
    return taskTypeConfig[taskType as keyof typeof taskTypeConfig]?.emoji || "🪴";
  };

  if (totalTasks === 0) {
    return (
      <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-[#1f1f1f] p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            {t("gardenDashboard.todaysTasks.title", "Today's Tasks")}
          </h3>
        </div>
        <div className="text-center py-4 md:py-6">
          <div className="text-3xl md:text-4xl mb-2">🌿</div>
          <p className="text-muted-foreground text-sm md:text-base">
            {t("gardenDashboard.todaysTasks.allDone", "All done for today!")}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {t("gardenDashboard.todaysTasks.enjoyYourDay", "Enjoy your day, your plants are happy.")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-stone-200/50 dark:border-stone-700/50 bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-900/20 dark:to-[#1f1f1f]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            {t("gardenDashboard.todaysTasks.title", "Today's Tasks")}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm text-muted-foreground">
              {completedTasks}/{totalTasks}
            </span>
            <div className="w-16 md:w-20 h-1.5 md:h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className={`p-2 md:p-3 space-y-2 ${compact ? "max-h-72 overflow-y-auto" : ""}`}>
        {plantsWithTasks.slice(0, compact ? 4 : undefined).map((plant) => {
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
                  <div className="font-medium text-xs md:text-sm truncate">
                    {plant.nickname || plant.plant?.name || "Plant"}
                  </div>
                </div>
                {!allDone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 md:h-7 text-[10px] md:text-xs rounded-lg px-2 border-2 border-emerald-400 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-semibold transition-all"
                    onClick={() => completeAllTodayForPlant(plant.id)}
                    disabled={isCompleting}
                  >
                    {isCompleting ? (
                      <span className="animate-pulse">⏳</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                        {t("garden.completeAll", "Complete All")}
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* Task List */}
              <div className="space-y-1.5">
                {occs.map((occ) => {
                  const taskType = occ.taskType || "custom";
                  const config = taskTypeConfig[taskType as keyof typeof taskTypeConfig] || taskTypeConfig.custom;
                  const isDone = (occ.completedCount || 0) >= Math.max(1, occ.requiredCount || 1);
                  const isProgressing = progressingOccIds.has(occ.id);
                  const remaining = Math.max(
                    0,
                    (occ.requiredCount || 1) - (occ.completedCount || 0)
                  );

                  return (
                    <div
                      key={occ.id}
                      className={`flex items-center gap-2 p-2 md:p-2.5 rounded-xl transition-all ${
                        isDone
                          ? "bg-white/50 dark:bg-stone-800/30 opacity-60"
                          : `${config.bg} ${config.border} border shadow-sm`
                      }`}
                    >
                      {/* Task Icon */}
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isDone ? "bg-stone-100 dark:bg-stone-700/30" : "bg-white dark:bg-stone-900/80 shadow-sm"
                      }`}>
                        <span className="text-base md:text-lg">
                          {getTaskIcon(taskType, occ.taskEmoji)}
                        </span>
                      </div>
                      
                      {/* Task Info */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs md:text-sm font-medium ${isDone ? "line-through text-muted-foreground" : config.color}`}>
                          {t(`garden.taskTypes.${taskType}`, taskType)}
                        </span>
                        {occ.requiredCount > 1 && !isDone && (
                          <span className="text-[9px] md:text-[10px] opacity-70 ml-1">
                            {occ.completedCount || 0}/{occ.requiredCount}
                          </span>
                        )}
                      </div>
                      
                      {/* Complete Button - Secondary/Outline style */}
                      {!isDone ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`rounded-lg h-6 md:h-7 px-2 md:px-2.5 text-[10px] md:text-xs font-semibold flex-shrink-0 border-2 transition-all ${config.buttonOutline}`}
                          onClick={() => onProgressOccurrence(occ.id, remaining)}
                          disabled={isProgressing}
                        >
                          {isProgressing ? (
                            <span className="animate-spin text-xs">⏳</span>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 mr-0.5" />
                              {t("garden.complete", "Complete")}
                            </>
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

      {/* Show more link */}
      {compact && plantsWithTasks.length > 4 && onNavigateToPlants && (
        <button
          onClick={onNavigateToPlants}
          className="w-full p-2 md:p-3 text-xs md:text-sm text-emerald-600 dark:text-emerald-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 flex items-center justify-center gap-1 border-t border-stone-100 dark:border-stone-800"
        >
          {t("gardenDashboard.todaysTasks.viewAll", "View all {{count}} plants with tasks", { count: plantsWithTasks.length })}
          <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
        </button>
      )}
    </Card>
  );
};

export default TodaysTasksWidget;
