// @ts-nocheck
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Sparkles, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserGardens,
  createGarden,
  fetchServerNowISO,
  getGardenTodayProgressUltraFast,
  getGardensTodayProgressBatchCached,
  getGardenPlantsMinimal,
  listGardenTasksMinimal,
  listOccurrencesForTasks,
  listOccurrencesForMultipleGardens,
  resyncTaskOccurrencesForGarden,
  progressTaskOccurrence,
  listCompletionsForOccurrences,
  logGardenActivity,
  getGardenTodayOccurrencesCached,
  getUserGardensTasksTodayCached,
  refreshGardenTaskCache,
  refreshUserTaskCache,
} from "@/lib/gardens";
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

export const GardenListPage: React.FC = () => {
  const { user } = useAuth();
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
  const [completionsByOcc, setCompletionsByOcc] = React.useState<
    Record<string, any[]>
  >({});
  const [progressingOccIds, setProgressingOccIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [completingPlantIds, setCompletingPlantIds] = React.useState<
    Set<string>
  >(new Set());
  const [markingAllCompleted, setMarkingAllCompleted] = React.useState(false);

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
      let nowIso: string;

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

        return;
      }

      // No cache - fetch fresh data
      const [freshData, freshNowIso] = await Promise.all([
        getUserGardens(user.id),
        fetchServerNowISO(),
      ]);
      data = freshData;
      nowIso = freshNowIso;

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

      // Fetch member counts for all gardens
      if (data.length > 0) {
        const gardenIds = data.map((g) => g.id);
        const { data: memberRows } = await supabase
          .from("garden_members")
          .select("garden_id")
          .in("garden_id", gardenIds);
        if (memberRows) {
          const counts: Record<string, number> = {};
          for (const row of memberRows) {
            const gid = String(row.garden_id);
            counts[gid] = (counts[gid] || 0) + 1;
          }
          setMemberCountsByGarden(counts);
        }
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
        // 1) Fetch tasks per garden in parallel - use minimal version to reduce egress
        const tasksPerGarden = await Promise.all(
          gardensList.map((g) => listGardenTasksMinimal(g.id)),
        );
        const taskTypeById: Record<
          string,
          "water" | "fertilize" | "harvest" | "cut" | "custom"
        > = {};
        const taskEmojiById: Record<string, string | null> = {};
        const taskIdsByGarden: Record<string, string[]> = {};
        for (let i = 0; i < gardensList.length; i++) {
          const g = gardensList[i];
          const tasks = tasksPerGarden[i] || [];
          taskIdsByGarden[g.id] = tasks.map((t) => t.id);
          for (const t of tasks) {
            taskTypeById[t.id] = t.type;
            taskEmojiById[t.id] = t.emoji || null;
          }
        }

        // 2) Resync only if needed and not cached recently
        // IMPORTANT: When skipResync=false, always resync to ensure task occurrences exist
        if (!skipResync) {
          const resyncPromises = gardensList.map(async (g) => {
            const cacheKey = `${g.id}::${today}`;
            const lastResync = resyncCacheRef.current[cacheKey] || 0;
            const now = Date.now();
            // Always resync if skipResync=false, even if cached recently
            // This ensures new tasks get their occurrences created
            await resyncTaskOccurrencesForGarden(g.id, startIso, endIso);
            resyncCacheRef.current[cacheKey] = now;
          });
          await Promise.all(resyncPromises);
        }

        // 3) Load occurrences for all gardens in a single batched query (reduces egress)
        const occsByGarden = await listOccurrencesForMultipleGardens(
          taskIdsByGarden,
          startIso,
          endIso,
        );
        const occsAugmented: Array<any> = [];
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
      let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

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

  const onProgressOccurrence = React.useCallback(
    async (occId: string, inc: number) => {
      // Set loading state
      setProgressingOccIds((prev) => new Set(prev).add(occId));

      let broadcastGardenId: string | null = null;
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

        const gp = allPlants.find((p: any) => p.id === o.gardenPlantId);
        broadcastGardenId = gp?.gardenId || null;
      }

      try {
        await progressTaskOccurrence(occId, inc);
        // Log activity for the appropriate garden
        try {
          if (o && broadcastGardenId) {
            const gp = allPlants.find((p: any) => p.id === o.gardenPlantId);
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
      allPlants,
      emitGardenRealtime,
      loadAllTodayOccurrences,
      todayTaskOccurrences,
      serverToday,
      user?.id,
      clearLocalStorageCache,
      t,
    ],
  );

  const onCompleteAllForPlant = React.useCallback(
    async (gardenPlantId: string) => {
      // Set loading state
      setCompletingPlantIds((prev) => new Set(prev).add(gardenPlantId));

      const gp = allPlants.find((p: any) => p.id === gardenPlantId);
      const gardenId = gp?.gardenId ? String(gp.gardenId) : null;

      // Optimistic update - mark all as completed immediately
      const occs = todayTaskOccurrences.filter(
        (o) => o.gardenPlantId === gardenPlantId,
      );
      const optimisticOccs = occs.map((o) => ({
        ...o,
        completedCount: Math.max(
          Number(o.requiredCount || 1),
          Number(o.completedCount || 0),
        ),
      }));
      setTodayTaskOccurrences((prev) =>
        prev.map((x: any) => {
          const updated = optimisticOccs.find((opt) => opt.id === x.id);
          return updated || x;
        }),
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
        // Revert optimistic update on error
        setTodayTaskOccurrences((prev) =>
          prev.map((x: any) => {
            const original = occs.find((orig) => orig.id === x.id);
            return original || x;
          }),
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
      allPlants,
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

    // Optimistic update - mark all as completed immediately
    const optimisticOccs = todayTaskOccurrences.map((o) => {
      const gp = allPlants.find((p: any) => p.id === o.gardenPlantId);
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
    allPlants,
    emitGardenRealtime,
    loadAllTodayOccurrences,
    todayTaskOccurrences,
    serverToday,
    user?.id,
    clearLocalStorageCache,
  ]);

  const onCreate = async () => {
    if (!user?.id) return;
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const garden = await createGarden({
        name: name.trim(),
        coverImageUrl: imageUrl.trim() || null,
        ownerUserId: user.id,
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
    const byGarden: Array<{
      gardenId: string;
      gardenName: string;
      plants: any[];
      req: number;
      done: number;
    }> = [];
    const idToGardenName = gardens.reduce<Record<string, string>>((acc, g) => {
      acc[g.id] = g.name;
      return acc;
    }, {});
    for (const g of gardens) {
      const plants = allPlants.filter(
        (gp: any) =>
          gp.gardenId === g.id && (occsByPlant[gp.id] || []).length > 0,
      );
      if (plants.length === 0) continue;
      let req = 0,
        done = 0;
      for (const gp of plants) {
        const occs = occsByPlant[gp.id] || [];
        req += occs.reduce(
          (a: number, o: any) => a + Math.max(1, Number(o.requiredCount || 1)),
          0,
        );
        done += occs.reduce(
          (a: number, o: any) =>
            a +
            Math.min(
              Math.max(1, Number(o.requiredCount || 1)),
              Number(o.completedCount || 0),
            ),
          0,
        );
      }
      byGarden.push({
        gardenId: g.id,
        gardenName: idToGardenName[g.id] || "",
        plants,
        req,
        done,
      });
    }
    console.log(
      "[GardenList] gardensWithTasks computed:",
      byGarden.length,
      "gardens with tasks,",
      todayTaskOccurrences.length,
      "occurrences,",
      allPlants.length,
      "plants",
    );
    return byGarden;
  }, [gardens, allPlants, occsByPlant, todayTaskOccurrences.length]);

  const totalTasks = React.useMemo(
    () =>
      todayTaskOccurrences.reduce(
        (a, o) => a + Math.max(1, Number(o.requiredCount || 1)),
        0,
      ),
    [todayTaskOccurrences],
  );
  const totalDone = React.useMemo(
    () =>
      todayTaskOccurrences.reduce(
        (a, o) =>
          a +
          Math.min(
            Math.max(1, Number(o.requiredCount || 1)),
            Number(o.completedCount || 0),
          ),
        0,
      ),
    [todayTaskOccurrences],
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 pb-16 space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]">
        <div
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/30 dark:bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -left-16 bottom-[-25%] h-72 w-72 rounded-full bg-emerald-100/40 dark:bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative space-y-6 p-8 md:p-12">
          <Badge className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur">
            {t("garden.listPage.hero.badge")}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {t("garden.listPage.hero.title")}
          </h1>
          <p className="text-base md:text-lg max-w-2xl text-stone-600 dark:text-stone-300">
            {t("garden.listPage.hero.subtitle")}
          </p>
          <div className="flex flex-wrap gap-3 pt-1.5">
            {user ? (
              <Button className="rounded-2xl" onClick={() => setOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("garden.create")}
              </Button>
            ) : (
              <Button className="rounded-2xl" onClick={openLogin}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("auth.login")}
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/search">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {t("common.search")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div
        className={`grid grid-cols-1 ${user ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""} gap-8`}
      >
        <div className="space-y-6">
          <section className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/75 dark:bg-[#1f1f1f]/75 backdrop-blur px-6 py-6 md:px-8 md:py-8 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">
                  {t("garden.yourGardens")}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  {gardens.length > 0
                    ? t("garden.allGardens")
                    : t("garden.createFirst")}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {gardens.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="rounded-2xl bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur text-stone-700 dark:text-stone-200"
                  >
                    {gardens.length} · {t("garden.allGardens")}
                  </Badge>
                )}
                <Button
                  className="rounded-2xl"
                  variant={user ? "outline" : "default"}
                  onClick={user ? () => setOpen(true) : openLogin}
                >
                  {user ? t("garden.create") : t("auth.login")}
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {loading && <GardenListSkeleton />}
              {error && (
                <div className="rounded-[24px] border border-red-200 bg-red-50/70 px-6 py-4 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}
              {!loading && !error && (
                <>
                  {gardens.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {gardens.map((g, idx) => (
                        <Card
                          key={g.id}
                          className={`group relative overflow-hidden rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${dragIndex === idx ? "ring-2 ring-emerald-400" : ""}`}
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
                                ? "bg-emerald-500 text-white"
                                : inProgress
                                  ? "bg-amber-500 text-white"
                                  : "bg-red-500 text-white";
                              const label = done
                                ? t("garden.allDone")
                                : `${completed} / ${due}`;
                              return (
                                <div
                                  className={`pointer-events-none absolute top-4 right-4 rounded-2xl px-3 py-1.5 text-xs font-semibold shadow-lg ${color}`}
                                >
                                  {label}
                                </div>
                              );
                            })()}
                          {!progressByGarden[g.id] && (
                            <div className="pointer-events-none absolute top-3 right-3 rounded-full border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 px-2 py-1 text-[11px] font-medium text-stone-500 dark:bg-[#1f1f1f]/80 dark:text-stone-300">
                              ...
                            </div>
                          )}
                          <Link
                            to={`/garden/${g.id}`}
                            className="block h-full w-full"
                          >
                            <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 dark:from-[#2d2d30] dark:to-[#252526]">
                              {g.coverImageUrl ? (
                                <img
                                  src={g.coverImageUrl}
                                  alt={g.name}
                                  className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="absolute inset-0 flex h-full w-full items-center justify-center">
                                  <div className="text-6xl opacity-30">🌱</div>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            </div>
                            <div className="space-y-3 bg-transparent p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <h3 className="mb-2 truncate text-xl font-semibold tracking-tight transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                    {g.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600 dark:text-stone-300">
                                    <div className="flex items-center gap-1.5">
                                      <svg
                                        className="h-4 w-4"
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
                                          className="h-4 w-4 text-orange-500"
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
                                <div className="flex-shrink-0 text-stone-400 transition-colors group-hover:text-emerald-600 dark:text-stone-500 dark:group-hover:text-emerald-400">
                                  <svg
                                    className="h-6 w-6"
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
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-stone-300/80 dark:border-[#3e3e42]/80 bg-stone-50/70 px-8 py-12 text-center dark:bg-[#1f1f1f]/50">
                      <div className="space-y-4">
                        <div className="text-4xl">🌿</div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold">
                            {t("garden.noGardens")}
                          </h3>
                          <p className="text-sm text-stone-600 dark:text-stone-400">
                            {t("garden.createFirst")}
                          </p>
                        </div>
                        <Button
                          className="rounded-2xl sm:w-auto"
                          onClick={user ? () => setOpen(true) : openLogin}
                        >
                          {user ? t("garden.create") : t("auth.login")}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-2xl">
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
                <div className="flex justify-end gap-2 pt-2">
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

        {user && (
          <aside className="space-y-6 lg:sticky lg:top-8">
            <section className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/75 dark:bg-[#1f1f1f]/75 backdrop-blur px-5 py-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                    {t("garden.tasks")}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t("garden.allGardens")}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-2xl border-dashed px-3 py-1 text-xs text-stone-600 dark:text-stone-300"
                >
                  {totalDone} / {totalTasks || 0}
                </Badge>
              </div>
              <div className="mt-4 space-y-4">
                <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-[#3e3e42]">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${totalTasks === 0 ? 100 : Math.min(100, Math.round((totalDone / totalTasks) * 100))}%`,
                    }}
                  />
                </div>
                {totalTasks > totalDone && (
                  <Button
                    className="w-full rounded-2xl"
                    onClick={onMarkAllCompleted}
                    disabled={markingAllCompleted}
                  >
                    {markingAllCompleted ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        {t("garden.completing")}
                      </span>
                    ) : (
                      t("garden.markAllCompleted")
                    )}
                  </Button>
                )}
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t("garden.today")}: {totalDone} / {totalTasks}
                </div>
              </div>
            </section>

            {loadingTasks && (
              <div className="rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/70 px-5 py-4 text-sm text-stone-600 dark:bg-[#1f1f1f]/70 dark:text-stone-300">
                {t("garden.loadingTasks")}
                {mismatchReloadAttempts > 0 && (
                  <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Reload attempt {mismatchReloadAttempts}/3
                  </div>
                )}
              </div>
            )}

            {!loadingTasks &&
              gardensWithTasks.length === 0 &&
              todayTaskOccurrences.length === 0 && (
                <div className="rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/75 px-5 py-4 text-sm text-stone-600 dark:bg-[#1f1f1f]/75 dark:text-stone-300">
                  <div className="mb-2 text-sm">{t("garden.noTasksToday")}</div>
                  {Object.values(progressByGarden).some(
                    (prog) => (prog.due || 0) > 0,
                  ) && (
                    <Button
                      className="mt-2 w-full rounded-2xl"
                      variant="outline"
                      onClick={() => {
                        mismatchReloadAttemptsRef.current = 0;
                        setMismatchReloadAttempts(0);
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
                        loadAllTodayOccurrences(
                          undefined,
                          undefined,
                          false,
                        ).catch(() => {
                          setLoadingTasks(false);
                        });
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reload Tasks
                    </Button>
                  )}
                </div>
              )}

            {!loadingTasks &&
              gardensWithTasks.length > 0 &&
              gardensWithTasks.map((gw) => (
                <div
                  key={gw.gardenId}
                  className="rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/75 dark:bg-[#1f1f1f]/75 backdrop-blur px-5 py-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-stone-800 dark:text-stone-100">
                        {gw.gardenName}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        {gw.done} / {gw.req} {t("garden.done")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {gw.plants.map((gp: any) => {
                      const occs = occsByPlant[gp.id] || [];
                      const req = occs.reduce(
                        (a: number, o: any) =>
                          a + Math.max(1, Number(o.requiredCount || 1)),
                        0,
                      );
                      const done = occs.reduce(
                        (a: number, o: any) =>
                          a +
                          Math.min(
                            Math.max(1, Number(o.requiredCount || 1)),
                            Number(o.completedCount || 0),
                          ),
                        0,
                      );
                      return (
                        <div
                          key={gp.id}
                          className="rounded-[20px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 px-4 py-3 dark:bg-[#252526]/80"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-stone-800 dark:text-stone-100">
                              {gp.nickname || gp.plant?.name}
                            </div>
                            {done < req && (
                              <Button
                                size="sm"
                                className="rounded-xl"
                                onClick={() => onCompleteAllForPlant(gp.id)}
                                disabled={completingPlantIds.has(gp.id)}
                              >
                                {completingPlantIds.has(gp.id) ? (
                                  <span className="flex items-center gap-1 text-xs">
                                    <span className="animate-spin">⏳</span>
                                    {t("garden.completing")}
                                  </span>
                                ) : (
                                  t("garden.completeAll")
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {done} / {req} {t("garden.done")}
                          </div>
                          <div className="mt-3 space-y-2">
                            {occs.map((o: any) => {
                              const tt = (o as any).taskType || "custom";
                              const badgeClass = `${tt === "water" ? "bg-blue-600 dark:bg-blue-500" : tt === "fertilize" ? "bg-green-600 dark:bg-green-500" : tt === "harvest" ? "bg-yellow-500 dark:bg-yellow-400 text-black" : tt === "cut" ? "bg-orange-600 dark:bg-orange-500" : "bg-purple-600 dark:bg-purple-500"} ${tt !== "harvest" ? "text-white" : ""}`;
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
                              const completions = completionsByOcc[o.id] || [];
                              return (
                                <div
                                  key={o.id}
                                  className={`flex items-center justify-between gap-3 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 px-3 py-2 text-sm ${isDone ? "bg-stone-50 dark:bg-[#2d2d30]" : "bg-white dark:bg-[#252526]"}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#2d2d30]">
                                      {icon}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                                    >
                                      {t(`garden.taskTypes.${tt}`)}
                                    </span>
                                    <span className="text-xs text-stone-600 dark:text-stone-200">
                                      {gp.nickname || gp.plant?.name}
                                    </span>
                                  </div>
                                  {!isDone ? (
                                    <div className="flex items-center gap-2">
                                      <div className="text-xs text-stone-600 dark:text-stone-200">
                                        {o.completedCount} / {o.requiredCount}
                                      </div>
                                      <Button
                                        className="rounded-xl"
                                        size="sm"
                                        onClick={() =>
                                          onProgressOccurrence(o.id, 1)
                                        }
                                        disabled={
                                          (o.completedCount || 0) >=
                                            (o.requiredCount || 1) ||
                                          progressingOccIds.has(o.id)
                                        }
                                      >
                                        {progressingOccIds.has(o.id) ? (
                                          <span className="animate-spin">
                                            ⏳
                                          </span>
                                        ) : (
                                          "+1"
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="max-w-[50%] truncate text-xs text-stone-500 dark:text-stone-300">
                                      {completions.length === 0
                                        ? t("garden.completed")
                                        : `${t("garden.doneBy")} ${completions.map((c) => c.displayName || t("garden.someone")).join(", ")}`}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </aside>
        )}
      </div>
    </div>
  );
};
