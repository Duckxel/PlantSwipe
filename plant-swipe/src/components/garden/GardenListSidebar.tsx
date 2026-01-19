import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sprout, Check, X } from "lucide-react";
import type { GardenInvite } from "@/types/notification";
import type { TFunction } from "i18next";
import type { User } from "@supabase/supabase-js";

// Helper to compare Sets by content for React.memo optimization
const areSetsEqual = <T,>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

interface TaskOccurrence {
  id: string;
  taskId: string;
  gardenPlantId: string;
  dueAt: string;
  requiredCount: number;
  completedCount: number;
  completedAt: string | null;
  taskType?: "water" | "fertilize" | "harvest" | "cut" | "custom";
  taskEmoji?: string | null;
}

interface MinimalPlant {
  id: string;
  gardenId: string;
  nickname: string | null;
  plant: { name?: string } | null;
}

interface GardenListSidebarProps {
  user: User | null;
  t: TFunction<"common">;

  // Stats
  totalTasks: number;
  totalDone: number;

  // Actions & State
  onMarkAllCompleted: () => void;
  markingAllCompleted: boolean;
  loadingTasks: boolean;
  mismatchReloadAttempts: number;

  // Data
  gardensWithTasks: Array<{
    gardenId: string;
    gardenName: string;
    plants: MinimalPlant[];
    req: number;
    done: number;
  }>;
  todayTaskOccurrences: TaskOccurrence[];
  progressByGarden: Record<string, { due: number; completed: number }>;

  // Reload
  onReloadTasks: () => void;

  // Garden Completion
  onCompleteAllForGarden: (gardenId: string) => void;
  completingGardenIds: Set<string>;

  // Task Occurrences helpers
  occsByPlant: Record<string, TaskOccurrence[]>;
  onProgressOccurrence: (occId: string, inc: number) => void;
  progressingOccIds: Set<string>;

  // Invites
  gardenInvites: GardenInvite[];
  handleAcceptInvite: (id: string) => void;
  handleDeclineInvite: (id: string) => void;
  processingInviteId: string | null;
}

// Custom comparison function for React.memo to properly compare Sets
const arePropsEqual = (
  prevProps: GardenListSidebarProps,
  nextProps: GardenListSidebarProps
): boolean => {
  // Compare primitive and reference types with shallow equality
  if (
    prevProps.user !== nextProps.user ||
    prevProps.totalTasks !== nextProps.totalTasks ||
    prevProps.totalDone !== nextProps.totalDone ||
    prevProps.markingAllCompleted !== nextProps.markingAllCompleted ||
    prevProps.loadingTasks !== nextProps.loadingTasks ||
    prevProps.mismatchReloadAttempts !== nextProps.mismatchReloadAttempts ||
    prevProps.processingInviteId !== nextProps.processingInviteId ||
    prevProps.onMarkAllCompleted !== nextProps.onMarkAllCompleted ||
    prevProps.onReloadTasks !== nextProps.onReloadTasks ||
    prevProps.onCompleteAllForGarden !== nextProps.onCompleteAllForGarden ||
    prevProps.onProgressOccurrence !== nextProps.onProgressOccurrence ||
    prevProps.handleAcceptInvite !== nextProps.handleAcceptInvite ||
    prevProps.handleDeclineInvite !== nextProps.handleDeclineInvite
  ) {
    return false;
  }

  // Compare Sets by content (not reference)
  if (!areSetsEqual(prevProps.completingGardenIds, nextProps.completingGardenIds)) {
    return false;
  }
  if (!areSetsEqual(prevProps.progressingOccIds, nextProps.progressingOccIds)) {
    return false;
  }

  // Compare arrays and objects by reference (React best practice - parent should memoize these)
  if (
    prevProps.gardensWithTasks !== nextProps.gardensWithTasks ||
    prevProps.todayTaskOccurrences !== nextProps.todayTaskOccurrences ||
    prevProps.progressByGarden !== nextProps.progressByGarden ||
    prevProps.occsByPlant !== nextProps.occsByPlant ||
    prevProps.gardenInvites !== nextProps.gardenInvites
  ) {
    return false;
  }

  return true;
};

const GardenListSidebarComponent: React.FC<GardenListSidebarProps> = ({
  user,
  t,
  totalTasks,
  totalDone,
  onMarkAllCompleted,
  markingAllCompleted,
  loadingTasks,
  mismatchReloadAttempts,
  gardensWithTasks,
  todayTaskOccurrences,
  progressByGarden,
  onReloadTasks,
  onCompleteAllForGarden,
  completingGardenIds,
  occsByPlant,
  onProgressOccurrence,
  progressingOccIds,
  gardenInvites,
  handleAcceptInvite,
  handleDeclineInvite,
  processingInviteId,
}) => {
  if (!user) return null;

  return (
    <aside className="mt-6 lg:mt-6 lg:pl-6 rounded-[32px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/70 dark:bg-[#1f1f1f]/70 backdrop-blur p-6 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.65)]">
      <div className="space-y-4">
        <div className="text-lg font-semibold">{t("garden.tasks")}</div>
        <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5 shadow-sm">
          <div className="text-sm opacity-60 mb-2">
            {t("garden.allGardens")}
          </div>
          <div className="h-2 bg-stone-200 dark:bg-[#3e3e42] rounded-full overflow-hidden">
            <div
              className="h-2 bg-emerald-500"
              style={{
                width: `${totalTasks === 0 ? 100 : Math.min(100, Math.round((totalDone / totalTasks) * 100))}%`,
              }}
            />
          </div>
          <div className="text-xs opacity-70 mt-1">
            {t("garden.today")}: {totalDone} / {totalTasks}
          </div>
        </Card>
        {totalTasks > totalDone && (
          <div>
            <Button
              className="rounded-2xl w-full"
              onClick={onMarkAllCompleted}
              disabled={markingAllCompleted}
            >
              {markingAllCompleted ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("garden.completing")}
                </span>
              ) : (
                t("garden.markAllCompleted")
              )}
            </Button>
          </div>
        )}
        {loadingTasks && (
          <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-4 text-sm opacity-70 shadow-sm">
            {t("garden.loadingTasks")}
            {mismatchReloadAttempts > 0 && (
              <div className="text-xs opacity-60 mt-1">
                Reload attempt {mismatchReloadAttempts}/3
              </div>
            )}
          </Card>
        )}
        {!loadingTasks &&
          gardensWithTasks.length === 0 &&
          todayTaskOccurrences.length === 0 && (
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5 shadow-sm">
              <div className="text-sm opacity-70 mb-2">
                {t("garden.noTasksToday")}
              </div>
              {/* Show reload button if progress indicates tasks exist */}
              {Object.values(progressByGarden).some(
                (prog) => (prog.due || 0) > 0,
              ) && (
                <Button
                  className="rounded-xl w-full mt-2"
                  variant="outline"
                  onClick={onReloadTasks}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Tasks
                </Button>
              )}
            </Card>
          )}
        {!loadingTasks &&
          gardensWithTasks.length > 0 &&
          gardensWithTasks.map((gw) => (
            <Card
              key={gw.gardenId}
              className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-4 shadow-sm"
            >
              {/* Garden header with Complete All button */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{gw.gardenName}</div>
                  <div className="text-xs opacity-70">
                    {gw.done} / {gw.req} {t("garden.done")}
                  </div>
                </div>
                {gw.done < gw.req && (
                  <Button
                    size="sm"
                    className="rounded-xl flex-shrink-0"
                    onClick={() => onCompleteAllForGarden(gw.gardenId)}
                    disabled={completingGardenIds.has(gw.gardenId)}
                  >
                    {completingGardenIds.has(gw.gardenId) ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </span>
                    ) : (
                      t("garden.completeAll")
                    )}
                  </Button>
                )}
              </div>
              {/* Tasks list - compact mobile-friendly layout */}
              <div className="space-y-2">
                {gw.plants.flatMap((gp) => {
                  const occs = occsByPlant[gp.id] || [];
                  return occs.map((o) => {
                    const tt = o.taskType || "custom";
                    const badgeClass = `${tt === "water" ? "bg-blue-600 dark:bg-blue-500" : tt === "fertilize" ? "bg-green-600 dark:bg-green-500" : tt === "harvest" ? "bg-yellow-500 dark:bg-yellow-400" : tt === "cut" ? "bg-orange-600 dark:bg-orange-500" : "bg-purple-600 dark:bg-purple-500"} ${tt === "harvest" ? "text-black dark:text-black" : "text-white"}`;
                    const taskEmoji = o.taskEmoji;
                    const icon =
                      taskEmoji &&
                      taskEmoji !== "??" &&
                      taskEmoji !== "???" &&
                      taskEmoji.trim() !== ""
                        ? taskEmoji
                        : tt === "water"
                          ? "💧"
                          : tt === "fertilize"
                            ? "🍽️"
                            : tt === "harvest"
                              ? "🌾"
                              : tt === "cut"
                                ? "✂️"
                                : "🪴";
                    const isDone =
                      Number(o.completedCount || 0) >=
                      Number(o.requiredCount || 1);
                    const remaining = Math.max(
                      0,
                      Number(o.requiredCount || 1) - Number(o.completedCount || 0),
                    );
                    return (
                      <div
                        key={o.id}
                        className={`flex items-center gap-2 text-sm rounded-xl p-2 ${isDone ? "bg-stone-50/80 dark:bg-[#2d2d30]/80 opacity-60" : "bg-white/80 dark:bg-[#1f1f1f]/70"}`}
                      >
                        {/* Icon */}
                        <span className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-[#2d2d30]">
                          {icon}
                        </span>
                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeClass}`}
                            >
                              {t(`garden.taskTypes.${tt}`)}
                            </span>
                            <span className="text-xs text-stone-600 dark:text-stone-400 truncate">
                              {gp.nickname || gp.plant?.name}
                            </span>
                          </div>
                          {o.requiredCount > 1 && !isDone && (
                            <div className="text-[10px] opacity-60 mt-0.5">
                              {o.completedCount || 0} / {o.requiredCount}
                            </div>
                          )}
                        </div>
                        {/* Complete button */}
                        {!isDone ? (
                          <Button
                            className="rounded-lg h-7 px-2 text-xs flex-shrink-0"
                            size="sm"
                            onClick={() =>
                              onProgressOccurrence(o.id, remaining)
                            }
                            disabled={progressingOccIds.has(o.id)}
                            aria-label={`${t("garden.complete", "Complete")} ${t(`garden.taskTypes.${tt}`)} ${t("garden.activity.plant")} ${gp.nickname || gp.plant?.name || t("garden.activity.plant")}`}
                          >
                            {progressingOccIds.has(o.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              t("garden.complete", "Complete")
                            )}
                          </Button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs flex-shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </Card>
          ))}

        {/* Garden Invitations Section */}
        {gardenInvites.length > 0 && (
          <div className="mt-6 pt-6 border-t border-stone-200/70 dark:border-[#3e3e42]/70">
            <div className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-500" />
              {t("gardenInvites.title", { defaultValue: "Garden Invitations" })}
              <span className="ml-auto text-sm font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                {gardenInvites.length}
              </span>
            </div>
            <div className="space-y-3">
              {gardenInvites.map((invite) => (
                <Card
                  key={invite.id}
                  className="rounded-[20px] border border-emerald-200/70 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 p-4"
                >
                  <div className="flex items-start gap-3">
                    {invite.gardenCoverImageUrl ? (
                      <img
                        src={invite.gardenCoverImageUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <Sprout className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 dark:text-white truncate">
                        {invite.gardenName}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {t("gardenInvites.sentBy", { defaultValue: "from" })} {invite.inviterName || t("friends.unknown", { defaultValue: "Unknown" })}
                      </p>
                    </div>
                  </div>
                  {invite.message && (
                    <p className="mt-2 text-xs text-stone-600 dark:text-stone-400 italic">
                      "{invite.message}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-9 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => handleDeclineInvite(invite.id)}
                      disabled={processingInviteId === invite.id}
                    >
                      {processingInviteId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          {t("gardenInvites.declineInvite", { defaultValue: "Decline" })}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleAcceptInvite(invite.id)}
                      disabled={processingInviteId === invite.id}
                    >
                      {processingInviteId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          {t("gardenInvites.acceptInvite", { defaultValue: "Accept" })}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

// Export the memoized component with custom comparison and displayName for DevTools
export const GardenListSidebar = React.memo(GardenListSidebarComponent, arePropsEqual);
GardenListSidebar.displayName = "GardenListSidebar";
