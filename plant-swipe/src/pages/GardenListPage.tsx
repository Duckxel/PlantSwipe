// @ts-nocheck
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Sprout, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserGardens,
  createGarden,
  fetchServerNowISO,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getGardenTodayProgressUltraFast,
  getGardensTodayProgressBatchCached,
  getGardenPlantsMinimal,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  listGardenTasksMinimal,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  listOccurrencesForTasks,
  listOccurrencesForMultipleGardens,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resyncTaskOccurrencesForGarden,
  resyncMultipleGardensTasks,
  listTasksForMultipleGardensMinimal,
  getGardenMemberCountsBatch,
  progressTaskOccurrence,
  listCompletionsForOccurrences,
  logGardenActivity,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getGardenTodayOccurrencesCached,
  getUserGardensTasksTodayCached,
  refreshGardenTaskCache,
  refreshUserTaskCache,
} from "@/lib/gardens";
import { getPendingGardenInvites, acceptGardenInvite, declineGardenInvite } from "@/lib/notifications";
import type { GardenInvite } from "@/types/notification";
import { useAuthActions } from "@/context/AuthActionsContext";
import { supabase } from "@/lib/supabaseClient";
import {
  addGardenBroadcastListener,
  broadcastGardenUpdate,
  type GardenRealtimeKind,
} from "@/lib/realtime";
import type { Garden } from "@/types/garden";
import { useTranslation } from "react-i18next";
import { useLanguageNavigate } from "@/lib/i18nRouting";
import { Link } from "@/components/i18n/Link";
import { GardenListSkeleton } from "@/components/garden/GardenSkeletons";
import { updateTaskNotificationState } from "@/hooks/useTaskNotification";

export const GardenListPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { openLogin } = useAuthActions();
  const navigate = useLanguageNavigate();
  const { t } = useTranslation("common");
  const [gardens, setGardens] = React.useState<Garden[]>([]);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [progressByGarden, setProgressByGarden] = React.useState<
    Record<string, { due: number; completed: number }>
  >({});
  const [memberCountsByGarden, setMemberCountsByGarden] = React.useState<
    Record<string, number>
  >({});
  const [serverToday, setServerToday] = React.useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = React.useState(false);
  const [mismatchReloadAttempts, setMismatchReloadAttempts] = React.useState(0);
  const mismatchReloadAttemptsRef = React.useRef(0);
  const lastSuccessfulLoadRef = React.useRef<number>(0);
  const [allPlants, setAllPlants] = React.useState<any[]>([]);
  const [todayTaskOccurrences, setTodayTaskOccurrences] = React.useState<
    Array<{
      id: string;
      taskId: string;
      gardenPlantId: string;
      dueAt: string;
      requiredCount: number;
      completedCount: number;
      completedAt: string | null;
      taskType?: "water" | "fertilize" | "harvest" | "cut" | "custom";
      taskEmoji?: string | null;
    }>
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [completionsByOcc, setCompletionsByOcc] = React.useState<
    Record<string, any[]>
  >({});
  const [progressingOccIds, setProgressingOccIds] = React.useState<Set<string>>(
    new Set(),
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [completingPlantIds, setCompletingPlantIds] = React.useState<
    Set<string>
  >(new Set());
  const [completingGardenIds, setCompletingGardenIds] = React.useState<
    Set<string>
  >(new Set());
  const [markingAllCompleted, setMarkingAllCompleted] = React.useState(false);
  // Garden invites state
  const [gardenInvites, setGardenInvites] = React.useState<GardenInvite[]>([]);
  const [processingInviteId, setProcessingInviteId] = React.useState<string | null>(null);

  const reloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastReloadRef = React.useRef<number>(0);
  const gardenIdsRef = React.useRef<Set<string>>(new Set());
  const gardensRef = React.useRef<typeof gardens>([]);
  const serverTodayRef = React.useRef<string | null>(null);
  // Cache for resync operations - skip if done recently
  const resyncCacheRef = React.useRef<Record<string, number>>({});
  const taskDataCacheRef = React.useRef<{
    data: any;
    timestamp: number;
    today: string;
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const CACHE_TTL = 30 * 1000; // 30 seconds cache for resync
  const TASK_DATA_CACHE_TTL = 10 * 1000; // 10 seconds cache for task data
  const LOCALSTORAGE_TASK_CACHE_TTL = 60 * 1000; // 1 minute cache in localStorage
  const LOCALSTORAGE_GARDEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache for gardens

  // localStorage cache helpers
  const getLocalStorageCache = React.useCallback((key: string): any | null => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      const parsed = JSON.parse(item);
      if (parsed.expires && Date.now() > parsed.expires) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }, []);

  const setLocalStorageCache = React.useCallback(
    (key: string, data: any, ttl: number) => {
      try {
        const item = {
          data,
          expires: Date.now() + ttl,
          timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(item));
      } catch (e) {
        // Ignore quota errors
        console.warn("[GardenList] localStorage cache failed:", e);
      }
    },
    [],
  );

  const clearLocalStorageCache = React.useCallback((keyPrefix?: string) => {
    try {
      if (keyPrefix) {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith(keyPrefix),
        );
        keys.forEach((k) => localStorage.removeItem(k));
      } else {
        localStorage.removeItem("garden_list_cache");
        localStorage.removeItem("garden_tasks_cache");
        localStorage.removeItem("server_time_offset");
      }
    } catch {}
  }, []);

  const emitGardenRealtime = React.useCallback(
    (
      gardenId: string,
      kind: GardenRealtimeKind = "tasks",
      metadata?: Record<string, unknown>,
    ) => {
      try {
        window.dispatchEvent(new CustomEvent("garden:tasks_changed"));
      } catch {}
      broadcastGardenUpdate({
        gardenId,
        kind,
        metadata,
        actorId: user?.id ?? null,
      }).catch(() => {});
    },
    [user?.id],
  );

  const load = React.useCallback(async () => {
    if (!user?.id) {
      setGardens([]);
      gardensRef.current = [];
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Try to load from localStorage cache first
      const cacheKey = `garden_list_cache_${user.id}`;
      const cachedGardens = getLocalStorageCache(cacheKey);

      let data: Garden[];
      let nowIso: string = "";

      if (cachedGardens && cachedGardens.gardens) {
        // Use cached gardens immediately for instant display
        data = cachedGardens.gardens;
        setGardens(data);
        gardensRef.current = data;
        setLoading(false);

        // Try cached server time offset
        const timeOffset = getLocalStorageCache("server_time_offset");
        if (timeOffset && timeOffset.offset !== undefined) {
          const estimatedServerTime = new Date(Date.now() + timeOffset.offset);
          const today = estimatedServerTime.toISOString().slice(0, 10);
          setServerToday(today);
          serverTodayRef.current = today;
        }

        // Load fresh data in background
        Promise.all([getUserGardens(user.id), fetchServerNowISO()])
          .then(([freshData, freshNowIso]) => {
            // Update if data changed
            if (JSON.stringify(freshData) !== JSON.stringify(data)) {
              setGardens(freshData);
              gardensRef.current = freshData;
            }

            // Cache fresh data
            setLocalStorageCache(
              cacheKey,
              { gardens: freshData },
              LOCALSTORAGE_GARDEN_CACHE_TTL,
            );

            // Cache server time offset
            const clientTime = Date.now();
            const serverTime = new Date(freshNowIso).getTime();
            const offset = serverTime - clientTime;
            setLocalStorageCache(
              "server_time_offset",
              { offset },
              24 * 60 * 60 * 1000,
            ); // 24 hours

            const today = freshNowIso.slice(0, 10);
            setServerToday(today);
            serverTodayRef.current = today;

            // Update progress with fresh data - use DIRECT cache queries (FASTEST)
            if (user?.id) {
              getUserGardensTasksTodayCached(user.id, today)
                .then((progMap) => {
                  const converted: Record<
                    string,
                    { due: number; completed: number }
                  > = {};
                  for (const [gid, prog] of Object.entries(progMap)) {
                    converted[gid] = {
                      due: prog.due,
                      completed: prog.completed,
                    };
                  }
                  setProgressByGarden(converted);
                })
                .catch(() => {
                  // On error, keep existing progress
                });
            } else {
              getGardensTodayProgressBatchCached(
                freshData.map((g) => g.id),
                today,
              )
                .then((progMap) => {
                  setProgressByGarden(progMap);
                })
                .catch(() => {});
            }

            // Fetch member counts for fresh gardens
            if (freshData.length > 0) {
              const gardenIds = freshData.map((g) => g.id);
              supabase
                .from("garden_members")
                .select("garden_id")
                .in("garden_id", gardenIds)
                .then(({ data: memberRows }) => {
                  if (memberRows) {
                    const counts: Record<string, number> = {};
                    for (const row of memberRows) {
                      const gid = String(row.garden_id);
                      counts[gid] = (counts[gid] || 0) + 1;
                    }
                    setMemberCountsByGarden(counts);
                  }
                })
                .catch(() => {});
            }
          })
          .catch(() => {
            // If background fetch fails, keep using cached data
          });

        // Load progress for cached gardens - use DIRECT cache queries (FASTEST)
        const today =
          serverTodayRef.current ?? new Date().toISOString().slice(0, 10);
        if (user?.id) {
          getUserGardensTasksTodayCached(user.id, today)
            .then((progMap) => {
              const converted: Record<
                string,
                { due: number; completed: number }
              > = {};
              for (const [gid, prog] of Object.entries(progMap)) {
                converted[gid] = { due: prog.due, completed: prog.completed };
              }
              setProgressByGarden(converted);
            })
            .catch(() => {
              // On error, set empty progress
              setProgressByGarden({});
            });
        } else {
          getGardensTodayProgressBatchCached(
            data.map((g) => g.id),
            today,
          )
            .then((progMap) => {
              setProgressByGarden(progMap);
            })
            .catch(() => {
              setProgressByGarden({});
            });
        }

        // Fetch member counts for cached gardens
        if (data.length > 0) {
          const gardenIds = data.map((g) => g.id);
          supabase
            .from("garden_members")
            .select("garden_id")
            .in("garden_id", gardenIds)
            .then(({ data: memberRows }) => {
              if (memberRows) {
                const counts: Record<string, number> = {};
                for (const row of memberRows) {
                  const gid = String(row.garden_id);
                  counts[gid] = (counts[gid] || 0) + 1;
                }
                setMemberCountsByGarden(counts);
              }
            })
            .catch(() => {});
        }

        // Fetch member counts for cached gardens - use batch fetch
        if (data.length > 0) {
          const gardenIds = data.map((g) => g.id);
          getGardenMemberCountsBatch(gardenIds)
            .then((counts) => {
              setMemberCountsByGarden(counts);
            })
            .catch(() => {});
        }

        return;
      }

      // No cache - fetch fresh data
      [data, nowIso] = await Promise.all([
        getUserGardens(user.id),
        fetchServerNowISO(),
      ]);

      setGardens(data);
      gardensRef.current = data;
      const today = nowIso.slice(0, 10);
      setServerToday(today);
      serverTodayRef.current = today;

      // Cache the data
      setLocalStorageCache(
        cacheKey,
        { gardens: data },
        LOCALSTORAGE_GARDEN_CACHE_TTL,
      );

      // Cache server time offset
      const clientTime = Date.now();
      const serverTime = new Date(nowIso).getTime();
      const offset = serverTime - clientTime;
      setLocalStorageCache(
        "server_time_offset",
        { offset },
        24 * 60 * 60 * 1000,
      ); // 24 hours

      // Fetch member counts for all gardens - use batch fetch
      if (data.length > 0) {
        const gardenIds = data.map((g) => g.id);
        getGardenMemberCountsBatch(gardenIds)
          .then((counts) => {
            setMemberCountsByGarden(counts);
          })
          .catch(() => {});
      }

      // Set loading to false immediately so gardens render
      setLoading(false);

      // Load progress using DIRECT cache table queries (INSTANT - no RPC overhead)
      // This is the FASTEST approach - directly reads from cache tables
      // Cache should already be populated by database triggers, so we just read it
      if (user?.id) {
        // Use direct cache query - fastest possible, no blocking operations
        getUserGardensTasksTodayCached(user.id, today)
          .then((progMap) => {
            // Convert to the format expected by progressByGarden
            const converted: Record<
              string,
              { due: number; completed: number }
            > = {};
            for (const [gid, prog] of Object.entries(progMap)) {
              converted[gid] = { due: prog.due, completed: prog.completed };
            }
            setProgressByGarden(converted);
          })
          .catch(() => {
            // On error, try fallback
            getGardensTodayProgressBatchCached(
              data.map((g) => g.id),
              today,
            )
              .then((progMap) => {
                setProgressByGarden(progMap);
              })
              .catch(() => {
                setProgressByGarden({});
              });
          });
      } else {
        // For non-logged-in users, use garden-level cache
        getGardensTodayProgressBatchCached(
          data.map((g) => g.id),
          today,
        )
          .then((progMap) => {
            setProgressByGarden(progMap);
          })
          .catch(() => {
            setProgressByGarden({});
          });
      }
    } catch (e: any) {
      setError(e?.message || t("garden.failedToLoad"));
      setLoading(false);
    }
  }, [user?.id, t, getLocalStorageCache, setLocalStorageCache]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Load all gardens' tasks due today for the sidebar
  const loadAllTodayOccurrences = React.useCallback(
    async (
      gardensOverride?: typeof gardens,
      todayOverride?: string | null,
      skipResync = false,
    ) => {
      const today = todayOverride ?? serverTodayRef.current ?? serverToday;
      const gardensList = gardensOverride ?? gardensRef.current ?? gardens;
      if (!today) return;
      if (gardensList.length === 0) {
        setAllPlants([]);
        setTodayTaskOccurrences([]);
        return;
      }

      // Multi-layer cache check: memory -> localStorage -> API
      const cacheKey = `${today}::${gardensList
        .map((g) => g.id)
        .sort()
        .join(",")}`;
      const now = Date.now();

      // 1. Check memory cache first (fastest)
      const cached = taskDataCacheRef.current;
      if (
        cached &&
        cached.today === today &&
        now - cached.timestamp < TASK_DATA_CACHE_TTL
      ) {
        // IMPORTANT: If memory cache has empty occurrences but skipResync=false, invalidate cache
        // This ensures we reload when resync is requested
        if (cached.data.occurrences.length === 0 && !skipResync) {
          const cacheAge = now - cached.timestamp;
          if (cacheAge < 1000) {
            // Very fresh cache with no tasks - might be stale, clear it
            console.warn(
              "[GardenList] Fresh memory cache has no tasks, clearing to force reload",
            );
            taskDataCacheRef.current = null;
            // Fall through to load from DB
          } else {
            // Use cache but it's empty - mismatch detection will catch this
            setTodayTaskOccurrences(cached.data.occurrences);
            setCompletionsByOcc(cached.data.completions || {});
            setAllPlants(cached.data.plants);
            setLoadingTasks(false);
            return;
          }
        } else {
          // Cache has tasks or skipResync is true - use it
          setTodayTaskOccurrences(cached.data.occurrences);
          setCompletionsByOcc(cached.data.completions || {});
          setAllPlants(cached.data.plants);
          setLoadingTasks(false);
          return;
        }
      }

      // 2. Check localStorage cache (persists across page reloads)
      const localStorageKey = `garden_tasks_cache_${cacheKey}`;
      const localStorageCache = getLocalStorageCache(localStorageKey);
      if (localStorageCache && localStorageCache.data) {
        // IMPORTANT: If cache has empty occurrences but progress shows tasks exist, invalidate cache
        const cachedOccs = localStorageCache.data.occurrences || [];
        if (cachedOccs.length === 0 && !skipResync) {
          // Check if progress indicates tasks should exist - if so, invalidate cache
          // We can't check progressByGarden here (it's not in scope), so we'll rely on mismatch detection
          // But we can still check if cache is very fresh (< 1 second) - if so, it might be stale
          const cacheAge = localStorageCache.timestamp
            ? now - localStorageCache.timestamp
            : Infinity;
          if (cacheAge < 1000) {
            // Very fresh cache with no tasks - might be stale, clear it
            console.warn(
              "[GardenList] Fresh cache has no tasks, clearing to force reload",
            );
            clearLocalStorageCache(localStorageKey);
            taskDataCacheRef.current = null;
            // Fall through to load from DB
          } else {
            // Cache is older, use it but refresh in background
            setTodayTaskOccurrences(cachedOccs);
            setCompletionsByOcc(localStorageCache.data.completions || {});
            setAllPlants(localStorageCache.data.plants || []);
            setLoadingTasks(false);

            // Also update memory cache
            taskDataCacheRef.current = {
              data: localStorageCache.data,
              timestamp: localStorageCache.timestamp || now,
              today,
            };

            // Refresh in background if cache is getting stale
            if (
              localStorageCache.timestamp &&
              now - localStorageCache.timestamp >
                LOCALSTORAGE_TASK_CACHE_TTL / 2
            ) {
              // Cache is half-expired, refresh in background
              setTimeout(() => {
                loadAllTodayOccurrences(
                  gardensOverride,
                  todayOverride,
                  skipResync,
                );
              }, 100);
            }
            return;
          }
        } else {
          // Cache has tasks or skipResync is true - use it
          setTodayTaskOccurrences(cachedOccs);
          setCompletionsByOcc(localStorageCache.data.completions || {});
          setAllPlants(localStorageCache.data.plants || []);
          setLoadingTasks(false);

          // Also update memory cache
          taskDataCacheRef.current = {
            data: localStorageCache.data,
            timestamp: localStorageCache.timestamp || now,
            today,
          };

          // Refresh in background if cache is getting stale
          if (
            localStorageCache.timestamp &&
            now - localStorageCache.timestamp > LOCALSTORAGE_TASK_CACHE_TTL / 2
          ) {
            // Cache is half-expired, refresh in background
            setTimeout(() => {
              loadAllTodayOccurrences(
                gardensOverride,
                todayOverride,
                skipResync,
              );
            }, 100);
          }
          return;
        }
      }

      setLoadingTasks(true);
      try {
        const startIso = `${today}T00:00:00.000Z`;
        const endIso = `${today}T23:59:59.999Z`;
        // Optimization: Fetch tasks for ALL relevant gardens in one batch
        const gardenIdsToLoad = gardensList.map(g => g.id);
        const tasksByGardenId = await listTasksForMultipleGardensMinimal(gardenIdsToLoad);

        const taskTypeById: Record<
          string,
          "water" | "fertilize" | "harvest" | "cut" | "custom"
        > = {};
        const taskEmojiById: Record<string, string | null> = {};
        const taskIdsByGarden: Record<string, string[]> = {};

        for (const g of gardensList) {
          const tasks = tasksByGardenId[g.id] || [];
          taskIdsByGarden[g.id] = tasks.map((t) => t.id);
          for (const t of tasks) {
            taskTypeById[t.id] = t.type;
            taskEmojiById[t.id] = t.emoji || null;
          }
        }

        // 2) Resync only if needed and not cached recently
        // IMPORTANT: When skipResync=false, always resync to ensure task occurrences exist
        if (!skipResync) {
          // Use optimized server-side batch resync
          const gardenIdsToSync = gardensList.map((g) => g.id);
          await resyncMultipleGardensTasks(gardenIdsToSync, startIso, endIso);

          // Update cache timestamps
          const now = Date.now();
          for (const g of gardensList) {
            const cacheKey = `${g.id}::${today}`;
            resyncCacheRef.current[cacheKey] = now;
          }
        }

        // 3) Load occurrences for all gardens in a single batched query (reduces egress)
        const occsByGarden = await listOccurrencesForMultipleGardens(
          taskIdsByGarden,
          startIso,
          endIso,
        );
        const occsAugmented: Array<any> = [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [gardenId, arr] of Object.entries(occsByGarden)) {
          for (const o of arr || []) {
            occsAugmented.push({
              ...o,
              taskType: taskTypeById[o.taskId] || "custom",
              taskEmoji: taskEmojiById[o.taskId] || null,
            });
          }
        }
        setTodayTaskOccurrences(occsAugmented);
        // Fetch completions for all occurrences
        const ids = occsAugmented.map((o) => o.id);
        const compMap =
          ids.length > 0 ? await listCompletionsForOccurrences(ids) : {};
        setCompletionsByOcc(compMap || {});
        // 4) Load plants for all gardens - use minimal version to reduce egress by ~80%
        const gardenIds = gardensList.map((g) => g.id);
        const plantsMinimal = await getGardenPlantsMinimal(gardenIds);
        const idToGardenName = gardensList.reduce<Record<string, string>>(
          (acc, g) => {
            acc[g.id] = g.name;
            return acc;
          },
          {},
        );
        const all = plantsMinimal.map((gp) => ({
          id: gp.id,
          gardenId: gp.gardenId,
          nickname: gp.nickname,
          plant: gp.plantName ? { name: gp.plantName } : null,
          gardenName: idToGardenName[gp.gardenId] || "",
        }));
        setAllPlants(all);

        // Reset mismatch counter on successful load
        mismatchReloadAttemptsRef.current = 0;
        setMismatchReloadAttempts(0);
        lastSuccessfulLoadRef.current = Date.now();

        console.log(
          "[GardenList] Successfully loaded",
          occsAugmented.length,
          "task occurrences and",
          all.length,
          "plants",
        );

        // Cache the results in both memory and localStorage
        const cacheData = {
          occurrences: occsAugmented,
          completions: compMap,
          plants: all,
        };

        // Memory cache (fast access)
        taskDataCacheRef.current = {
          data: cacheData,
          timestamp: now,
          today,
        };

        // localStorage cache (persists across page reloads)
        setLocalStorageCache(
          localStorageKey,
          cacheData,
          LOCALSTORAGE_TASK_CACHE_TTL,
        );
      } catch (e) {
        console.error("[GardenList] Failed to load task occurrences:", e);
        // On error, clear cache and try to reload once more
        taskDataCacheRef.current = null;
        clearLocalStorageCache(localStorageKey);
        // Don't set empty array - keep previous data if available
      } finally {
        setLoadingTasks(false);
      }
    },
    [gardens, serverToday, getLocalStorageCache, setLocalStorageCache],
  );

  const scheduleReload = React.useCallback(() => {
    const execute = async () => {
      lastReloadRef.current = Date.now();
      // Clear cache on reload
      taskDataCacheRef.current = null;
      await load();
      // Skip resync on scheduled reloads unless it's been a while
      await loadAllTodayOccurrences(undefined, undefined, false);
    };

    const now = Date.now();
    const since = now - (lastReloadRef.current || 0);
    const minInterval = 750;

    if (since < minInterval) {
      if (reloadTimerRef.current) return;
      const wait = Math.max(0, minInterval - since);
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        execute().catch(() => {});
      }, wait);
      return;
    }

    if (reloadTimerRef.current) return;
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      execute().catch(() => {});
    }, 50);
  }, [load, loadAllTodayOccurrences]);

  React.useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        try {
          clearTimeout(reloadTimerRef.current);
        } catch {}
        reloadTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    gardenIdsRef.current = new Set(gardens.map((g) => g.id));
  }, [gardens]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const notifyTasksChanged = React.useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("garden:tasks_changed"));
    } catch {}
  }, []);

  // SSE: listen for server-driven membership updates for instant garden list refresh
  React.useEffect(() => {
    if (!user?.id) return;
    let es: EventSource | null = null;
    (async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const url = token
          ? `/api/self/memberships/stream?token=${encodeURIComponent(token)}`
          : "/api/self/memberships/stream";
        es = new EventSource(url, { withCredentials: true });
        const handler = () => scheduleReload();
        es.addEventListener("ready", () => {});
        es.addEventListener("memberships", handler as any);
        es.onerror = () => {};
      } catch {}
    })();
    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [scheduleReload, user?.id]);

  // SSE: listen to all-gardens activity and refresh on any activity event
  React.useEffect(() => {
    if (!user?.id) return;
    let es: EventSource | null = null;
    (async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const url = token
          ? `/api/self/gardens/activity/stream?token=${encodeURIComponent(token)}`
          : "/api/self/gardens/activity/stream";
        es = new EventSource(url, { withCredentials: true });
        const handler = () => scheduleReload();
        es.addEventListener("ready", () => {});
        es.addEventListener("membership", handler as any);
        es.addEventListener("activity", handler as any);
        es.onerror = () => {};
      } catch {}
    })();
    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [scheduleReload, user?.id]);

  // Realtime: Refresh cache on changes, then read from cache (FAST - cache-first approach)
  React.useEffect(() => {
    if (!user?.id) return;
    const today =
      serverTodayRef.current ?? new Date().toISOString().slice(0, 10);

    // Helper to refresh cache and update UI from cache
    // Database triggers update cache synchronously, so we read from cache immediately
    const refreshCacheAndUpdate = async (gardenId?: string) => {
      try {
        const today =
          serverTodayRef.current ?? new Date().toISOString().slice(0, 10);

        // Read from cache immediately (triggers have already updated it synchronously)
        // This is FAST - direct cache read
        getUserGardensTasksTodayCached(user.id, today)
          .then((progMap) => {
            const converted: Record<
              string,
              { due: number; completed: number }
            > = {};
            for (const [gid, prog] of Object.entries(progMap)) {
              converted[gid] = { due: prog.due, completed: prog.completed };
            }
            setProgressByGarden(converted);
          })
          .catch(() => {});

        // Trigger background refresh only if needed (non-blocking)
        // This ensures cache is eventually consistent, but UI updates instantly
        setTimeout(() => {
          const promises: Promise<any>[] = [];
          if (gardenId) {
            promises.push(refreshGardenTaskCache(gardenId, today));
          }
          promises.push(refreshUserTaskCache(user.id, today));
          Promise.all(promises).catch(() => {}); // Fire and forget
        }, 0);
      } catch {}
    };

    const ch = supabase
      .channel(`rt-gardens-for-${user.id}`)
      // Membership changes - reload garden list (metadata changed)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "garden_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshUserTaskCache(user.id, today).catch(() => {});
          scheduleReload(); // Need to reload garden list
        },
      )
      // Garden metadata changes - reload garden list only
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gardens" },
        () => {
          scheduleReload(); // Need to reload garden metadata
        },
      )
      // Task/occurrence changes - refresh cache and update UI (FAST)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "garden_plant_task_occurrences",
        },
        (payload) => {
          // Database triggers update cache synchronously, but add small delay to ensure trigger completed
          setTimeout(() => {
            // Get garden_id from the change
            const occurrenceId = payload.new?.id || payload.old?.id;
            if (occurrenceId) {
              // Find garden_id from occurrence (via task) - fast query
              supabase
                .from("garden_plant_task_occurrences")
                .select("task_id, garden_plant_tasks!inner(garden_id)")
                .eq("id", occurrenceId)
                .single()
                .then(({ data }) => {
                  const gardenId = data?.garden_plant_tasks
                    ? (data.garden_plant_tasks as any).garden_id
                    : null;
                  if (gardenId) {
                    refreshCacheAndUpdate(gardenId);
                  } else {
                    // Fallback: refresh all user gardens cache
                    refreshCacheAndUpdate();
                  }
                  // Clear task sidebar cache to force fresh reload
                  taskDataCacheRef.current = null;
                  clearLocalStorageCache(`garden_tasks_cache_`);
                  // Reload task sidebar with resync to ensure all occurrences are loaded
                  setTimeout(() => {
                    loadAllTodayOccurrences(undefined, undefined, false).catch(
                      () => {},
                    );
                  }, 200); // Longer delay to ensure triggers completed
                })
                .catch(() => {
                  // Fallback: refresh all user gardens cache
                  refreshCacheAndUpdate();
                  taskDataCacheRef.current = null;
                  clearLocalStorageCache(`garden_tasks_cache_`);
                  // Force reload
                  setTimeout(() => {
                    loadAllTodayOccurrences(undefined, undefined, false).catch(
                      () => {},
                    );
                  }, 200);
                });
            } else {
              // No occurrence ID - refresh all
              refreshCacheAndUpdate();
              taskDataCacheRef.current = null;
              clearLocalStorageCache(`garden_tasks_cache_`);
              // Force reload
              setTimeout(() => {
                loadAllTodayOccurrences(undefined, undefined, false).catch(
                  () => {},
                );
              }, 200);
            }
          }, 50); // Small delay to ensure triggers completed
        },
      )
      // Task changes - refresh cache for affected gardens
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "garden_plant_tasks" },
        (payload) => {
          // Database triggers update cache synchronously, but add small delay to ensure trigger completed
          setTimeout(() => {
            const gardenId = payload.new?.garden_id || payload.old?.garden_id;
            if (gardenId) {
              refreshCacheAndUpdate(gardenId);
              // Clear ALL caches to force fresh reload
              taskDataCacheRef.current = null;
              clearLocalStorageCache(`garden_tasks_cache_`);
              // Clear resync cache to force resync
              const today =
                serverTodayRef.current ?? new Date().toISOString().slice(0, 10);
              delete resyncCacheRef.current[`${gardenId}::${today}`];
              // Force reload with resync to ensure task occurrences are created
              setTimeout(() => {
                loadAllTodayOccurrences(undefined, undefined, false).catch(
                  () => {},
                );
              }, 200); // Longer delay to ensure resync completes
            } else {
              refreshCacheAndUpdate();
              taskDataCacheRef.current = null;
              clearLocalStorageCache(`garden_tasks_cache_`);
              // Clear all resync caches
              const today =
                serverTodayRef.current ?? new Date().toISOString().slice(0, 10);
              Object.keys(resyncCacheRef.current).forEach((key) => {
                if (key.endsWith(`::${today}`)) {
                  delete resyncCacheRef.current[key];
                }
              });
              setTimeout(() => {
                loadAllTodayOccurrences(undefined, undefined, false).catch(
                  () => {},
                );
              }, 200);
            }
          }, 50); // Small delay to ensure triggers completed
        },
      )
      // Plant changes - refresh cache for affected gardens
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "garden_plants" },
        (payload) => {
          // Database triggers update cache synchronously, but add small delay to ensure trigger completed
          setTimeout(() => {
            const gardenId = payload.new?.garden_id || payload.old?.garden_id;
            if (gardenId) {
              refreshCacheAndUpdate(gardenId);
              // Clear ALL caches to force fresh reload
              taskDataCacheRef.current = null;
              clearLocalStorageCache(`garden_tasks_cache_`);
              // Clear resync cache to force resync
              const today =
                serverTodayRef.current ?? new Date().toISOString().slice(0, 10);
              delete resyncCacheRef.current[`${gardenId}::${today}`];
              setTimeout(() => {
                loadAllTodayOccurrences(undefined, undefined, false).catch(
                  () => {},
                );
              }, 200); // Longer delay to ensure resync completes
            } else {
              refreshCacheAndUpdate();
              taskDataCacheRef.current = null;
              clearLocalStorageCache(`garden_tasks_cache_`);
              // Clear all resync caches
              const today =
                serverTodayRef.current ?? new Date().toISOString().slice(0, 10);
              Object.keys(resyncCacheRef.current).forEach((key) => {
                if (key.endsWith(`::${today}`)) {
                  delete resyncCacheRef.current[key];
                }
              });
              setTimeout(() => {
                loadAllTodayOccurrences(undefined, undefined, false).catch(
                  () => {},
                );
              }, 200);
            }
          }, 50); // Small delay to ensure triggers completed
        },
      );

    const subscription = ch.subscribe();
    if (subscription instanceof Promise) subscription.catch(() => {});
    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [user?.id, clearLocalStorageCache, loadAllTodayOccurrences]);

  // Defer task loading until after gardens are displayed (non-blocking)
  // Use requestIdleCallback for better performance when browser is idle
  React.useEffect(() => {
    // Only load tasks after gardens are loaded
    if (!loading && gardens.length > 0) {
      let cancelled = false;
      const backgroundTimer: ReturnType<typeof setTimeout> | null = null;

      // Use requestIdleCallback if available, otherwise use setTimeout
      const scheduleTask = (callback: () => void, delay: number = 0) => {
        if ("requestIdleCallback" in window) {
          return window.requestIdleCallback(callback, { timeout: delay + 100 });
        }
        return setTimeout(callback, delay);
      };

      // Load tasks immediately but skip resync for instant display
      const timer = scheduleTask(() => {
        if (cancelled) return;
        // On initial load, always do resync to ensure task occurrences exist
        loadAllTodayOccurrences(undefined, undefined, false); // skipResync = false to ensure occurrences are created

        // Background refresh after initial load completes
        setTimeout(() => {
          if (cancelled) return;
          const today = serverTodayRef.current ?? serverToday;
          if (today && gardens.length > 0) {
            // Refresh cache after resync completes
            Promise.all(
              gardens.map((g) => {
                const cacheKey = `${g.id}::${today}`;
                return refreshGardenTaskCache(g.id, today)
                  .then(() => {
                    if (!cancelled) {
                      resyncCacheRef.current[cacheKey] = Date.now();
                    }
                  })
                  .catch(() => {});
              }),
            )
              .then(() => {
                // Reload tasks after cache refresh
                if (!cancelled) {
                  loadAllTodayOccurrences(undefined, undefined, true).catch(
                    () => {},
                  );
                }
              })
              .catch(() => {});
          }
        }, 500); // Wait for resync to complete
      }, 0); // Start immediately when idle

      return () => {
        cancelled = true;
        if (typeof timer === "number") {
          clearTimeout(timer);
        } else if ("cancelIdleCallback" in window) {
          window.cancelIdleCallback(timer as number);
        }
        if (backgroundTimer) clearTimeout(backgroundTimer);
      };
    }
  }, [loading, gardens.length, loadAllTodayOccurrences, serverToday, gardens]);

  React.useEffect(() => {
    let active = true;
    let teardown: (() => Promise<void>) | null = null;

    addGardenBroadcastListener((message) => {
      if (message.actorId && user?.id && message.actorId === user.id) return;
      if (!gardenIdsRef.current.has(message.gardenId)) return;

      // Database triggers update cache synchronously, but add small delay to ensure trigger completed
      setTimeout(() => {
        const today =
          serverTodayRef.current ?? new Date().toISOString().slice(0, 10);

        // Read from cache immediately (triggers have already updated it synchronously)
        // This is FAST - direct cache read
        if (user?.id) {
          getUserGardensTasksTodayCached(user.id, today)
            .then((progMap) => {
              if (!active) return;
              const converted: Record<
                string,
                { due: number; completed: number }
              > = {};
              for (const [gid, prog] of Object.entries(progMap)) {
                converted[gid] = { due: prog.due, completed: prog.completed };
              }
              setProgressByGarden(converted);
            })
            .catch(() => {});
        }

        // Trigger background refresh (non-blocking)
        refreshGardenTaskCache(message.gardenId, today).catch(() => {});
        if (user?.id) {
          refreshUserTaskCache(user.id, today).catch(() => {});
        }

        // Clear cache on broadcast updates - force fresh reload
        taskDataCacheRef.current = null;
        clearLocalStorageCache(`garden_tasks_cache_`);
        // Clear resync cache to force resync
        Object.keys(resyncCacheRef.current).forEach((key) => {
          if (key.endsWith(`::${today}`)) {
            delete resyncCacheRef.current[key];
          }
        });
        scheduleReload();
        // Also reload tasks with resync
        setTimeout(() => {
          loadAllTodayOccurrences(undefined, undefined, false).catch(() => {});
        }, 200);
      }, 50); // Small delay to ensure triggers completed
    })
      .then((unsubscribe) => {
        if (!active) {
          unsubscribe().catch(() => {});
        } else {
          teardown = unsubscribe;
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      if (teardown) teardown().catch(() => {});
    };
  }, [scheduleReload, user?.id, clearLocalStorageCache]);

  // ⚡ Shared lookup memos - O(1) lookups instead of O(n) .find()/.filter() calls
  // NOTE: These MUST be defined before callbacks that use them to avoid TDZ errors
  const plantsById = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of allPlants) {
      map[p.id] = p;
    }
    return map;
  }, [allPlants]);

  const gardensById = React.useMemo(() => {
    const map: Record<string, (typeof gardens)[0]> = {};
    for (const g of gardens) {
      map[g.id] = g;
    }
    return map;
  }, [gardens]);

  const plantIdsByGarden = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const p of allPlants) {
      if (!map[p.gardenId]) map[p.gardenId] = new Set();
      map[p.gardenId].add(p.id);
    }
    return map;
  }, [allPlants]);

  const onProgressOccurrence = React.useCallback(
    async (occId: string, inc: number) => {
      // Set loading state
      setProgressingOccIds((prev) => new Set(prev).add(occId));

      let broadcastGardenId: string | null = null;
      let gp: any = null;
      const o = todayTaskOccurrences.find((x: any) => x.id === occId);

      // Optimistic update - update UI immediately
      if (o) {
        const optimisticOcc = {
          ...o,
          completedCount: Number(o.completedCount || 0) + inc,
        };
        setTodayTaskOccurrences((prev) =>
          prev.map((x: any) => (x.id === occId ? optimisticOcc : x)),
        );

        // ⚡ O(1) lookup instead of O(P) .find()
        gp = plantsById[o.gardenPlantId];
        broadcastGardenId = gp?.gardenId || null;
      }

      try {
        await progressTaskOccurrence(occId, inc);
        // Log activity for the appropriate garden
        try {
          if (o && broadcastGardenId) {
            // Reuse gp from above - no need to find again
            const type = (o as any).taskType || "custom";
            const taskTypeLabel = t(`garden.taskTypes.${type}`);
            const plantName = gp?.nickname || gp?.plant?.name || null;
            const newCount = Number(o.completedCount || 0) + inc;
            const required = Math.max(1, Number(o.requiredCount || 1));
            const done = newCount >= required;
            const kind = done ? "task_completed" : "task_progressed";
            const msg = done
              ? t("garden.activity.completedTask", {
                  taskType: taskTypeLabel,
                  plantName: plantName || t("garden.activity.plant"),
                })
              : t("garden.activity.progressedTask", {
                  taskType: taskTypeLabel,
                  plantName: plantName || t("garden.activity.plant"),
                  completed: Math.min(newCount, required),
                  required,
                });
            // Don't await - fire and forget for speed
            logGardenActivity({
              gardenId: broadcastGardenId,
              kind: kind as any,
              message: msg,
              plantName: plantName || null,
              taskName: taskTypeLabel,
              actorColor: null,
            }).catch(() => {});
            // Broadcast update BEFORE reload to ensure other clients receive it
            broadcastGardenUpdate({
              gardenId: broadcastGardenId,
              kind: "tasks",
              actorId: user?.id ?? null,
            }).catch((err) => {
              console.warn(
                "[GardenList] Failed to broadcast task update:",
                err,
              );
            });
            // Also broadcast activity update to refresh activity list in Garden Dashboard
            broadcastGardenUpdate({
              gardenId: broadcastGardenId,
              kind: "activity",
              actorId: user?.id ?? null,
            }).catch((err) => {
              console.warn(
                "[GardenList] Failed to broadcast activity update:",
                err,
              );
            });
          }
        } catch {}
      } catch (error) {
        // Revert optimistic update on error
        if (o) {
          setTodayTaskOccurrences((prev) =>
            prev.map((x: any) => (x.id === occId ? o : x)),
          );
        }
        throw error;
      } finally {
        // Clear loading state
        setProgressingOccIds((prev) => {
          const next = new Set(prev);
          next.delete(occId);
          return next;
        });

        // Refresh in background without blocking UI
        const today = serverTodayRef.current ?? serverToday;
        if (today && broadcastGardenId) {
          delete resyncCacheRef.current[`${broadcastGardenId}::${today}`];
          clearLocalStorageCache(`garden_tasks_cache_`);
        }
        taskDataCacheRef.current = null;

        // Use requestIdleCallback for background refresh
        // Database triggers have already updated cache, just read from cache
        const refreshFn = () => {
          const today = serverTodayRef.current ?? serverToday;
          // Read from cache immediately (triggers updated it)
          if (today && user?.id) {
            getUserGardensTasksTodayCached(user.id, today)
              .then((progMap) => {
                const converted: Record<
                  string,
                  { due: number; completed: number }
                > = {};
                for (const [gid, prog] of Object.entries(progMap)) {
                  converted[gid] = { due: prog.due, completed: prog.completed };
                }
                setProgressByGarden(converted);
              })
              .catch(() => {});
          }
          // Reload task sidebar
          loadAllTodayOccurrences(undefined, undefined, false).catch(() => {});
          if (broadcastGardenId) {
            emitGardenRealtime(broadcastGardenId, "tasks");
          }
        };

        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(refreshFn, { timeout: 500 });
        } else {
          setTimeout(refreshFn, 100);
        }
      }
    },
    [
      plantsById,
      emitGardenRealtime,
      loadAllTodayOccurrences,
      todayTaskOccurrences,
      serverToday,
      user?.id,
      clearLocalStorageCache,
      t,
    ],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onCompleteAllForPlant = React.useCallback(
    async (gardenPlantId: string) => {
      // Set loading state
      setCompletingPlantIds((prev) => new Set(prev).add(gardenPlantId));

      // ⚡ O(1) lookup instead of O(P) .find()
      const gp = plantsById[gardenPlantId];
      const gardenId = gp?.gardenId ? String(gp.gardenId) : null;

      // Optimistic update - mark all as completed immediately
      const occs = todayTaskOccurrences.filter(
        (o) => o.gardenPlantId === gardenPlantId,
      );
      // Build lookup map for O(1) updates
      const occsById = new Map(occs.map((o) => [o.id, o]));

      const optimisticOccs = occs.map((o) => ({
        ...o,
        completedCount: Math.max(
          Number(o.requiredCount || 1),
          Number(o.completedCount || 0),
        ),
      }));
      const optimisticById = new Map(optimisticOccs.map((o) => [o.id, o]));
      setTodayTaskOccurrences((prev) =>
        prev.map((x: any) => optimisticById.get(x.id) || x),
      );

      try {
        // Process all completions in parallel for speed
        const promises = occs.map(async (o) => {
          const remaining = Math.max(
            0,
            Number(o.requiredCount || 1) - Number(o.completedCount || 0),
          );
          if (remaining <= 0) return;
          // Process all increments in parallel
          return Promise.all(
            Array.from({ length: remaining }, () =>
              progressTaskOccurrence(o.id, 1),
            ),
          );
        });
        await Promise.all(promises);

        // Log summary activity for this plant/garden (fire and forget)
        if (gardenId) {
          const plantName =
            gp?.nickname || gp?.plant?.name || t("garden.activity.plant");
          logGardenActivity({
            gardenId,
            kind: "task_completed" as any,
            message: t("garden.activity.completedAllTasks", { plantName }),
            plantName,
            actorColor: null,
          }).catch(() => {});
          broadcastGardenUpdate({
            gardenId,
            kind: "tasks",
            actorId: user?.id ?? null,
          }).catch((err) => {
            console.warn("[GardenList] Failed to broadcast task update:", err);
          });
          // Also broadcast activity update to refresh activity list in Garden Dashboard
          broadcastGardenUpdate({
            gardenId,
            kind: "activity",
            actorId: user?.id ?? null,
          }).catch((err) => {
            console.warn(
              "[GardenList] Failed to broadcast activity update:",
              err,
            );
          });
        }
      } catch (error) {
        // Revert optimistic update on error using O(1) Map lookup
        setTodayTaskOccurrences((prev) =>
          prev.map((x: any) => occsById.get(x.id) || x),
        );
        throw error;
      } finally {
        // Clear loading state
        setCompletingPlantIds((prev) => {
          const next = new Set(prev);
          next.delete(gardenPlantId);
          return next;
        });

        // Refresh in background
        const today = serverTodayRef.current ?? serverToday;
        if (today && gardenId) {
          delete resyncCacheRef.current[`${gardenId}::${today}`];
          clearLocalStorageCache(`garden_tasks_cache_`);
        }
        taskDataCacheRef.current = null;

        // Database triggers have already updated cache, just read from cache
        const refreshFn = () => {
          const today = serverTodayRef.current ?? serverToday;
          // Read from cache immediately (triggers updated it)
          if (today && user?.id) {
            getUserGardensTasksTodayCached(user.id, today)
              .then((progMap) => {
                const converted: Record<
                  string,
                  { due: number; completed: number }
                > = {};
                for (const [gid, prog] of Object.entries(progMap)) {
                  converted[gid] = { due: prog.due, completed: prog.completed };
                }
                setProgressByGarden(converted);
              })
              .catch(() => {});
          }
          // Reload task sidebar
          loadAllTodayOccurrences(undefined, undefined, false).catch(() => {});
          if (gardenId) {
            emitGardenRealtime(gardenId, "tasks");
          }
        };

        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(refreshFn, { timeout: 500 });
        } else {
          setTimeout(refreshFn, 100);
        }
      }
    },
    [
      plantsById,
      emitGardenRealtime,
      loadAllTodayOccurrences,
      todayTaskOccurrences,
      serverToday,
      user?.id,
      clearLocalStorageCache,
      t,
    ],
  );

  const onCompleteAllForGarden = React.useCallback(
    async (gardenId: string) => {
      // Set loading state
      setCompletingGardenIds((prev) => new Set(prev).add(gardenId));

      // ⚡ O(O) using Set lookup instead of O(P) filter + O(O*P) includes
      const gardenPlantIdSet = plantIdsByGarden[gardenId];
      const occs = gardenPlantIdSet
        ? todayTaskOccurrences.filter((o) => gardenPlantIdSet.has(o.gardenPlantId))
        : [];

      // Build lookup map for O(1) updates
      const occsById = new Map(occs.map((o) => [o.id, o]));

      // Optimistic update - mark all as completed immediately
      const optimisticOccs = occs.map((o) => ({
        ...o,
        completedCount: Math.max(
          Number(o.requiredCount || 1),
          Number(o.completedCount || 0),
        ),
      }));
      const optimisticById = new Map(optimisticOccs.map((o) => [o.id, o]));
      setTodayTaskOccurrences((prev) =>
        prev.map((x: any) => optimisticById.get(x.id) || x),
      );

      try {
        // Process all completions in parallel for speed
        const promises = occs.map(async (o) => {
          const remaining = Math.max(
            0,
            Number(o.requiredCount || 1) - Number(o.completedCount || 0),
          );
          if (remaining <= 0) return;
          return progressTaskOccurrence(o.id, remaining);
        });
        await Promise.all(promises);

        // Log activity for completing all garden tasks (fire and forget)
        const gardenName = gardensById[gardenId]?.name || t("garden.garden");
        logGardenActivity({
          gardenId,
          kind: "task_completed" as any,
          message: t("garden.activity.completedAllGardenTasks", { gardenName }),
          actorColor: null,
        }).catch(() => {});
        broadcastGardenUpdate({
          gardenId,
          kind: "tasks",
          actorId: user?.id ?? null,
        }).catch(() => {});
        broadcastGardenUpdate({
          gardenId,
          kind: "activity",
          actorId: user?.id ?? null,
        }).catch(() => {});
      } catch (error) {
        // Revert optimistic update on error using O(1) Map lookup
        setTodayTaskOccurrences((prev) =>
          prev.map((x: any) => occsById.get(x.id) || x),
        );
        throw error;
      } finally {
        // Clear loading state
        setCompletingGardenIds((prev) => {
          const next = new Set(prev);
          next.delete(gardenId);
          return next;
        });

        // Refresh in background
        const today = serverTodayRef.current ?? serverToday;
        if (today) {
          delete resyncCacheRef.current[`${gardenId}::${today}`];
          clearLocalStorageCache(`garden_tasks_cache_`);
        }
        taskDataCacheRef.current = null;

        const refreshFn = () => {
          const today = serverTodayRef.current ?? serverToday;
          if (today && user?.id) {
            getUserGardensTasksTodayCached(user.id, today)
              .then((progMap) => {
                const converted: Record<
                  string,
                  { due: number; completed: number }
                > = {};
                for (const [gid, prog] of Object.entries(progMap)) {
                  converted[gid] = { due: prog.due, completed: prog.completed };
                }
                setProgressByGarden(converted);
              })
              .catch(() => {});
          }
          loadAllTodayOccurrences(undefined, undefined, false).catch(() => {});
          emitGardenRealtime(gardenId, "tasks");
        };

        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(refreshFn, { timeout: 500 });
        } else {
          setTimeout(refreshFn, 100);
        }
      }
    },
    [
      plantIdsByGarden,
      gardensById,
      emitGardenRealtime,
      loadAllTodayOccurrences,
      todayTaskOccurrences,
      serverToday,
      user?.id,
      clearLocalStorageCache,
      t,
    ],
  );

  const onMarkAllCompleted = React.useCallback(async () => {
    // Set loading state
    setMarkingAllCompleted(true);

    const affectedGardenIds = new Set<string>();

    // ⚡ Optimistic update using O(1) plantsById lookup instead of O(P) .find()
    const optimisticOccs = todayTaskOccurrences.map((o) => {
      const gp = plantsById[o.gardenPlantId];
      if (gp?.gardenId) affectedGardenIds.add(String(gp.gardenId));
      return {
        ...o,
        completedCount: Math.max(
          Number(o.requiredCount || 1),
          Number(o.completedCount || 0),
        ),
      };
    });
    setTodayTaskOccurrences(optimisticOccs as any);

    try {
      // Process all completions in parallel for speed
      const ops: Promise<any>[] = [];
      for (const o of todayTaskOccurrences) {
        const remaining = Math.max(
          0,
          Number(o.requiredCount || 1) - Number(o.completedCount || 0),
        );
        if (remaining > 0) ops.push(progressTaskOccurrence(o.id, remaining));
      }
      if (ops.length > 0) await Promise.all(ops);

      // Log activity and broadcast updates for all affected gardens (fire and forget)
      Promise.all(
        Array.from(affectedGardenIds).map(async (gid) => {
          // Log activity for completing all tasks
          try {
            await logGardenActivity({
              gardenId: gid,
              kind: "task_completed" as any,
              message: t("garden.activity.completedAllTasks", {
                plantName: t("garden.allGardens"),
              }),
              actorColor: null,
            });
          } catch {}
          // Broadcast task update
          broadcastGardenUpdate({
            gardenId: gid,
            kind: "tasks",
            actorId: user?.id ?? null,
          }).catch((err) => {
            console.warn(
              "[GardenList] Failed to broadcast task update for garden:",
              gid,
              err,
            );
          });
          // Broadcast activity update to refresh activity list in Garden Dashboard
          broadcastGardenUpdate({
            gardenId: gid,
            kind: "activity",
            actorId: user?.id ?? null,
          }).catch((err) => {
            console.warn(
              "[GardenList] Failed to broadcast activity update for garden:",
              gid,
              err,
            );
          });
        }),
      ).catch(() => {});
    } catch (error) {
      // Revert optimistic update on error
      setTodayTaskOccurrences(todayTaskOccurrences as any);
      throw error;
    } finally {
      // Clear loading state
      setMarkingAllCompleted(false);

      // Refresh in background
      const today = serverTodayRef.current ?? serverToday;
      if (today) {
        affectedGardenIds.forEach((gid) => {
          delete resyncCacheRef.current[`${gid}::${today}`];
        });
        clearLocalStorageCache(`garden_tasks_cache_`);
      }
      taskDataCacheRef.current = null;

      // Database triggers have already updated cache, just read from cache
      const refreshFn = () => {
        const today = serverTodayRef.current ?? serverToday;
        // Read from cache immediately (triggers updated it)
        if (today && user?.id) {
          getUserGardensTasksTodayCached(user.id, today)
            .then((progMap) => {
              const converted: Record<
                string,
                { due: number; completed: number }
              > = {};
              for (const [gid, prog] of Object.entries(progMap)) {
                converted[gid] = { due: prog.due, completed: prog.completed };
              }
              setProgressByGarden(converted);
            })
            .catch(() => {});
        }
        // Reload task sidebar
        loadAllTodayOccurrences(undefined, undefined, false).catch(() => {});
        // Emit realtime events for all affected gardens
        affectedGardenIds.forEach((gid) => {
          emitGardenRealtime(gid, "tasks");
        });
      };

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(refreshFn, { timeout: 500 });
      } else {
        setTimeout(refreshFn, 100);
      }
    }
  }, [
    plantsById,
    emitGardenRealtime,
    loadAllTodayOccurrences,
    todayTaskOccurrences,
    serverToday,
    user?.id,
    clearLocalStorageCache,
    t,
  ]);

  const onCreate = async () => {
    if (!user?.id) return;
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Private users should have their gardens set to friends_only by default
      const defaultPrivacy = profile?.is_private ? 'friends_only' : 'public';
      const garden = await createGarden({
        name: name.trim(),
        coverImageUrl: imageUrl.trim() || null,
        ownerUserId: user.id,
        privacy: defaultPrivacy as any,
      });
      setOpen(false);
      setName("");
      setImageUrl("");
      // Navigate to the new garden dashboard
      navigate(`/garden/${garden.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create garden");
    } finally {
      setSubmitting(false);
    }
  };

  // Derived helpers for tasks sidebar
  const occsByPlant = React.useMemo(() => {
    const map: Record<string, typeof todayTaskOccurrences> = {};
    for (const o of todayTaskOccurrences) {
      if (!map[o.gardenPlantId]) map[o.gardenPlantId] = [] as any;
      map[o.gardenPlantId].push(o);
    }
    return map;
  }, [todayTaskOccurrences]);

  // Detect mismatch: progress shows tasks but task list is empty - force reload
  // This runs whenever progress or task list changes
  React.useEffect(() => {
    if (loadingTasks) return; // Don't check while loading

    // Don't check mismatch immediately after a successful load (give it 500ms to render)
    const timeSinceLastLoad = Date.now() - lastSuccessfulLoadRef.current;
    if (timeSinceLastLoad < 500) {
      return;
    }

    if (todayTaskOccurrences.length > 0) {
      // Reset mismatch counter when tasks are found
      mismatchReloadAttemptsRef.current = 0;
      setMismatchReloadAttempts(0);
      return;
    }

    // Prevent infinite loops - max 3 reload attempts
    if (mismatchReloadAttemptsRef.current >= 3) {
      console.warn(
        "[GardenList] Mismatch detected but max reload attempts reached, stopping",
      );
      return;
    }

    // Check if progress shows tasks exist
    const totalDueFromProgress = Object.values(progressByGarden).reduce(
      (sum, prog) => sum + (prog.due || 0),
      0,
    );
    if (totalDueFromProgress > 0) {
      // Progress shows tasks exist but task list is empty - cache is stale!
      console.warn(
        "[GardenList] Mismatch detected: progress shows",
        totalDueFromProgress,
        "tasks but list is empty - forcing reload (attempt",
        mismatchReloadAttemptsRef.current + 1,
        ")",
      );
      mismatchReloadAttemptsRef.current += 1;
      setMismatchReloadAttempts(mismatchReloadAttemptsRef.current);

      // Clear all caches immediately
      taskDataCacheRef.current = null;
      clearLocalStorageCache(`garden_tasks_cache_`);
      // Clear resync cache to force resync
      const today = serverTodayRef.current ?? serverToday;
      if (today) {
        Object.keys(resyncCacheRef.current).forEach((key) => {
          if (key.endsWith(`::${today}`)) {
            delete resyncCacheRef.current[key];
          }
        });
      }
      // Set loading state
      setLoadingTasks(true);
      // Force reload with resync immediately (no delay)
      loadAllTodayOccurrences(undefined, undefined, false)
        .then(() => {
          // Reset mismatch counter on successful load
          mismatchReloadAttemptsRef.current = 0;
          setMismatchReloadAttempts(0);
          lastSuccessfulLoadRef.current = Date.now();
        })
        .catch((e) => {
          console.error(
            "[GardenList] Failed to reload tasks after mismatch:",
            e,
          );
          setLoadingTasks(false);
        });
    }
  }, [
    progressByGarden,
    todayTaskOccurrences.length,
    loadingTasks,
    loadAllTodayOccurrences,
    clearLocalStorageCache,
    serverToday,
  ]);

  // Also check mismatch periodically (every 5 seconds) as a fail-safe, but only if no recent attempts
  React.useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      if (loadingTasks) return;
      if (todayTaskOccurrences.length > 0) {
        mismatchReloadAttemptsRef.current = 0;
        return;
      }

      // Don't trigger if we've already tried recently
      if (mismatchReloadAttemptsRef.current >= 3) return;

      const totalDueFromProgress = Object.values(progressByGarden).reduce(
        (sum, prog) => sum + (prog.due || 0),
        0,
      );
      if (totalDueFromProgress > 0) {
        console.warn(
          "[GardenList] Periodic mismatch check: progress shows tasks but list is empty - forcing reload",
        );
        mismatchReloadAttemptsRef.current += 1;
        setMismatchReloadAttempts(mismatchReloadAttemptsRef.current);

        taskDataCacheRef.current = null;
        clearLocalStorageCache(`garden_tasks_cache_`);
        const today = serverTodayRef.current ?? serverToday;
        if (today) {
          Object.keys(resyncCacheRef.current).forEach((key) => {
            if (key.endsWith(`::${today}`)) {
              delete resyncCacheRef.current[key];
            }
          });
        }
        setLoadingTasks(true);
        loadAllTodayOccurrences(undefined, undefined, false).catch((e) => {
          console.error(
            "[GardenList] Failed to reload tasks after periodic mismatch:",
            e,
          );
          setLoadingTasks(false);
        });
      }
    }, 5000); // Check every 5 seconds (less aggressive)

    return () => clearInterval(interval);
  }, [
    user?.id,
    progressByGarden,
    todayTaskOccurrences.length,
    loadingTasks,
    loadAllTodayOccurrences,
    clearLocalStorageCache,
    serverToday,
  ]);

  const gardensWithTasks = React.useMemo(() => {
    // ⚡ Optimized: Single-pass O(T + G) using shared plantsById lookup
    const gardenData: Record<
      string,
      { plantIds: Set<string>; plants: any[]; req: number; done: number }
    > = {};

    // O(T): Single pass over occurrences - compute plants, req, done simultaneously
    for (const o of todayTaskOccurrences) {
      const plant = plantsById[o.gardenPlantId];
      if (!plant) continue;

      const gardenId = plant.gardenId;
      let data = gardenData[gardenId];
      if (!data) {
        data = { plantIds: new Set(), plants: [], req: 0, done: 0 };
        gardenData[gardenId] = data;
      }

      // Accumulate task counts
      const reqCount = Math.max(1, Number(o.requiredCount || 1));
      data.req += reqCount;
      data.done += Math.min(reqCount, Number(o.completedCount || 0));

      // Track unique plants (Set for O(1) dedup)
      if (!data.plantIds.has(o.gardenPlantId)) {
        data.plantIds.add(o.gardenPlantId);
        data.plants.push(plant);
      }
    }

    // O(G): Build result array in garden order
    const byGarden: Array<{
      gardenId: string;
      gardenName: string;
      plants: any[];
      req: number;
      done: number;
    }> = [];

    for (const g of gardens) {
      const data = gardenData[g.id];
      if (!data || data.plants.length === 0) continue;
      byGarden.push({
        gardenId: g.id,
        gardenName: g.name,
        plants: data.plants,
        req: data.req,
        done: data.done,
      });
    }

    console.log(
      "[GardenList] gardensWithTasks computed:",
      byGarden.length,
      "gardens,",
      todayTaskOccurrences.length,
      "occurrences",
    );
    return byGarden;
  }, [gardens, plantsById, todayTaskOccurrences]);

  // ⚡ Single-pass computation of totalTasks and totalDone
  const { totalTasks, totalDone } = React.useMemo(() => {
    let tasks = 0;
    let done = 0;
    for (const o of todayTaskOccurrences) {
      const req = Math.max(1, Number(o.requiredCount || 1));
      tasks += req;
      done += Math.min(req, Number(o.completedCount || 0));
    }
    return { totalTasks: tasks, totalDone: done };
  }, [todayTaskOccurrences]);

  // ⚡ Update task notification state immediately when we have fresh task data
  // This ensures the red dot indicator in the nav is instantly accurate
  React.useEffect(() => {
    if (!user?.id) return;
    if (loadingTasks) return; // Don't update while still loading
    // Has unfinished tasks if totalTasks > totalDone
    const hasUnfinished = totalTasks > totalDone;
    updateTaskNotificationState(user.id, hasUnfinished);
  }, [user?.id, totalTasks, totalDone, loadingTasks]);

  // Load garden invites
  const loadGardenInvites = React.useCallback(async () => {
    if (!user?.id) {
      setGardenInvites([]);
      return;
    }
    try {
      const invites = await getPendingGardenInvites(user.id);
      setGardenInvites(invites);
    } catch (e) {
      console.warn('[GardenList] Failed to load garden invites:', e);
    }
  }, [user?.id]);

  React.useEffect(() => {
    loadGardenInvites();
  }, [loadGardenInvites]);

  // Handle accept garden invite
  const handleAcceptInvite = React.useCallback(async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      await acceptGardenInvite(inviteId);
      await Promise.all([loadGardenInvites(), loadGardens()]);
    } catch (e: any) {
      console.error('Failed to accept invite:', e);
    } finally {
      setProcessingInviteId(null);
    }
  }, [loadGardenInvites]);

  // Handle decline garden invite
  const handleDeclineInvite = React.useCallback(async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      await declineGardenInvite(inviteId);
      await loadGardenInvites();
    } catch (e: any) {
      console.error('Failed to decline invite:', e);
    } finally {
      setProcessingInviteId(null);
    }
  }, [loadGardenInvites]);

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0 pb-16">
      <div
        className={`grid grid-cols-1 ${user ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""} gap-8`}
      >
        <div className="max-w-3xl mx-auto w-full space-y-6">
          <div className="mt-6 mb-6 relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] p-6 md:p-10 shadow-[0_35px_60px_-15px_rgba(16,185,129,0.35)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div
              className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-emerald-200/60 dark:bg-emerald-500/10 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="absolute -left-20 bottom-0 h-32 w-32 rounded-full bg-emerald-100/70 dark:bg-emerald-500/5 blur-3xl"
              aria-hidden="true"
            />
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight relative z-10">
              {t("garden.yourGardens")}
            </h1>
            {user && (
              <Button
                className="rounded-2xl relative z-10 shadow-lg shadow-emerald-500/20"
                onClick={() => setOpen(true)}
              >
                {t("garden.create")}
              </Button>
            )}
          </div>
          {loading && <GardenListSkeleton />}
          {error && <div className="p-6 text-sm text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gardens.map((g, idx) => (
                <Card
                  key={g.id}
                  className={`group relative overflow-hidden rounded-[28px] border border-stone-200/80 dark:border-[#3e3e42]/80 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_35px_95px_-45px_rgba(16,185,129,0.75)] shadow-[0_25px_70px_-40px_rgba(15,23,42,0.65)] cursor-pointer ${dragIndex === idx ? "ring-2 ring-emerald-500" : ""}`}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === idx) return;
                    const arr = gardens.slice();
                    const [moved] = arr.splice(dragIndex, 1);
                    arr.splice(idx, 0, moved);
                    setGardens(arr);
                    setDragIndex(null);
                  }}
                >
                  {progressByGarden[g.id] &&
                    (() => {
                      const { due, completed } = progressByGarden[g.id];
                      const done = due === 0 || completed >= due;
                      const inProgress =
                        due > 0 && completed > 0 && completed < due;
                      const color = done
                        ? "bg-emerald-500 text-white shadow-emerald-500/40"
                        : inProgress
                          ? "bg-amber-500 text-white shadow-amber-500/40"
                          : "bg-rose-500 text-white shadow-rose-500/40";
                      const label = done
                        ? t("garden.allDone")
                        : `${completed} / ${due}`;
                      return (
                        <div
                          className={`pointer-events-none absolute top-3 right-3 rounded-2xl px-3 py-1.5 text-sm font-semibold z-20 backdrop-blur-sm shadow-lg ${color}`}
                        >
                          {label}
                        </div>
                      );
                    })()}
                  {!progressByGarden[g.id] && (
                    // Show loading indicator if cache is being populated
                    <div className="pointer-events-none absolute top-2 right-2 rounded-2xl px-2 py-0.5 text-xs font-medium shadow z-10 bg-gray-200/80 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300 backdrop-blur">
                      ...
                    </div>
                  )}
                  <Link
                    to={`/garden/${g.id}`}
                    className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 rounded-[28px]"
                  >
                    <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
                      {g.coverImageUrl ? (
                        <img
                          src={g.coverImageUrl}
                          alt={g.name}
                          className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                          <div className="text-6xl opacity-30">🌱</div>
                        </div>
                      )}
                      {/* Gradient overlay for better text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-5 bg-transparent relative z-10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xl truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-2">
                            {g.name}
                          </h3>
                          <div className="flex items-center flex-wrap gap-4 text-sm text-stone-600 dark:text-stone-300">
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              <span>
                                {memberCountsByGarden[g.id] ?? 1}{" "}
                                {memberCountsByGarden[g.id] === 1
                                  ? t("garden.member")
                                  : t("garden.members")}
                              </span>
                            </div>
                            {(g.streak ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5">
                                <svg
                                  className="w-4 h-4 text-orange-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                                </svg>
                                <span className="font-medium">
                                  {g.streak} {t("garden.streak")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-stone-400 dark:text-stone-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          )}
          {!loading && !error && gardens.length === 0 && (
            <div className="p-10 text-center">
              {!user ? (
                <Card className="rounded-[28px] border border-stone-200/80 dark:border-[#3e3e42]/80 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6 max-w-md mx-auto shadow-[0_25px_70px_-40px_rgba(15,23,42,0.65)]">
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">
                      {t("common.login")}
                    </div>
                    <div className="text-sm opacity-70">
                      {t("garden.noGardens")}. {t("garden.createFirst")}
                    </div>
                    <Button className="rounded-2xl w-full" onClick={openLogin}>
                      {t("auth.login")}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="opacity-60 text-sm">
                  {t("garden.noGardens")}. {t("garden.createFirst")}
                </div>
              )}
            </div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur">
              <DialogHeader>
                <DialogTitle>{t("garden.createGarden")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    {t("garden.name")}
                  </label>
                  <Input
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setName(e.target.value)
                    }
                    placeholder={t("garden.namePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    {t("garden.coverImageUrl")}
                  </label>
                  <Input
                    value={imageUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setImageUrl(e.target.value)
                    }
                    placeholder={t("garden.coverImageUrlPlaceholder")}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="secondary"
                    className="rounded-2xl"
                    onClick={() => setOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    className="rounded-2xl"
                    onClick={onCreate}
                    disabled={!name.trim() || submitting}
                  >
                    {submitting ? t("garden.creating") : t("common.create")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right-side Tasks sidebar for all gardens - hidden for non-logged-in users */}
        {user && (
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
                        onClick={() => {
                          // Reset mismatch counter
                          mismatchReloadAttemptsRef.current = 0;
                          setMismatchReloadAttempts(0);
                          // Clear all caches and force reload
                          taskDataCacheRef.current = null;
                          clearLocalStorageCache(`garden_tasks_cache_`);
                          const today = serverTodayRef.current ?? serverToday;
                          if (today) {
                            Object.keys(resyncCacheRef.current).forEach(
                              (key) => {
                                if (key.endsWith(`::${today}`)) {
                                  delete resyncCacheRef.current[key];
                                }
                              },
                            );
                          }
                          setLoadingTasks(true);
                          loadAllTodayOccurrences(
                            undefined,
                            undefined,
                            false,
                          ).catch(() => {
                            setLoadingTasks(false);
                          });
                        }}
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
                      {gw.plants.flatMap((gp: any) => {
                        const occs = occsByPlant[gp.id] || [];
                        return occs.map((o: any) => {
                          const tt = (o as any).taskType || "custom";
                          const badgeClass = `${tt === "water" ? "bg-blue-600 dark:bg-blue-500" : tt === "fertilize" ? "bg-green-600 dark:bg-green-500" : tt === "harvest" ? "bg-yellow-500 dark:bg-yellow-400" : tt === "cut" ? "bg-orange-600 dark:bg-orange-500" : "bg-purple-600 dark:bg-purple-500"} ${tt === "harvest" ? "text-black dark:text-black" : "text-white"}`;
                          const taskEmoji = (o as any).taskEmoji;
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
        )}
      </div>
    </div>
  );
};
