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
  water: { icon: Droplets, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
  fertilize: { icon: Leaf, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30" },
  harvest: { icon: Package, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  cut: { icon: Scissors, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
  custom: { icon: Sparkles, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
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

  if (totalTasks === 0) {
    return (
      <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-[#1f1f1f] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {t("gardenDashboard.todaysTasks.title", "Today's Tasks")}
          </h3>
        </div>
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🌿</div>
          <p className="text-muted-foreground">
            {t("gardenDashboard.todaysTasks.allDone", "All done for today!")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("gardenDashboard.todaysTasks.enjoyYourDay", "Enjoy your day, your plants are happy.")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200/50 dark:border-stone-700/50 bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-900/20 dark:to-[#1f1f1f]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {t("gardenDashboard.todaysTasks.title", "Today's Tasks")}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {completedTasks}/{totalTasks}
            </span>
            <div className="w-20 h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className={`divide-y divide-stone-100 dark:divide-stone-800 ${compact ? "max-h-72 overflow-y-auto" : ""}`}>
        {plantsWithTasks.slice(0, compact ? 4 : undefined).map((plant) => {
          const occs = occsByPlant[plant.id] || [];
          const allDone = occs.every(
            (o) => (o.completedCount || 0) >= Math.max(1, o.requiredCount || 1)
          );
          const isCompleting = completingPlantIds.has(plant.id);

          return (
            <div key={plant.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm truncate">
                  {plant.nickname || plant.plant?.name || "Plant"}
                </div>
                {!allDone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    onClick={() => completeAllTodayForPlant(plant.id)}
                    disabled={isCompleting}
                  >
                    {isCompleting ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      t("garden.completeAll", "Complete All")
                    )}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {occs.map((occ) => {
                  const taskType = occ.taskType || "custom";
                  const config = taskTypeConfig[taskType];
                  const Icon = config.icon;
                  const isDone = (occ.completedCount || 0) >= Math.max(1, occ.requiredCount || 1);
                  const isProgressing = progressingOccIds.has(occ.id);

                  return (
                    <button
                      key={occ.id}
                      onClick={() => !isDone && !isProgressing && onProgressOccurrence(occ.id, 1)}
                      disabled={isDone || isProgressing}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                        isDone
                          ? "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500"
                          : `${config.bg} ${config.color} hover:scale-105 active:scale-95`
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isProgressing ? (
                        <span className="w-3.5 h-3.5 animate-spin">⏳</span>
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                      <span className={isDone ? "line-through" : ""}>
                        {t(`garden.taskTypes.${taskType}`, taskType)}
                      </span>
                      {occ.requiredCount > 1 && (
                        <span className="text-[10px] opacity-70">
                          {occ.completedCount || 0}/{occ.requiredCount}
                        </span>
                      )}
                    </button>
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
          className="w-full p-3 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 flex items-center justify-center gap-1 border-t border-stone-100 dark:border-stone-800"
        >
          {t("gardenDashboard.todaysTasks.viewAll", "View all {{count}} plants with tasks", { count: plantsWithTasks.length })}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </Card>
  );
};

export default TodaysTasksWidget;
