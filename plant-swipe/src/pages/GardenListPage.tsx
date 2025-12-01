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
import { RefreshCw } from "lucide-react";
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
  resyncMultipleGardensTasks,
  listTasksForMultipleGardensMinimal,
  getGardenMemberCountsBatch,
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
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache for resync (was 30s)
  const TASK_DATA_CACHE_TTL = 60 * 1000; // 1 minute cache for task data (was 10s)
  const LOCALSTORAGE_TASK_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache in localStorage (was 1 min)
  const LOCALSTORAGE_GARDEN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache for gardens (was 5 min)

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

            // Fetch member counts for fresh gardens using optimized batch
            if (freshData.length > 0) {
              const gardenIds = freshData.map((g) => g.id);
              getGardenMemberCountsBatch(gardenIds)
                .then((counts) => setMemberCountsByGarden(counts))
                .catch(() => {});
            }
          })
          .catch(() => {
            // If background fetch fails, keep using cached data
          });

        // Load progress and member counts in parallel for cached gardens
        const today =
          serverTodayRef.current ?? new Date().toISOString().slice(0, 10);
        const gardenIds = data.map((g) => g.id);
        
        // OPTIMIZED: Single parallel fetch for progress and member counts
        Promise.all([
          user?.id
            ? getUserGardensTasksTodayCached(user.id, today)
            : getGardensTodayProgressBatchCached(gardenIds, today),
          gardenIds.length > 0 ? getGardenMemberCountsBatch(gardenIds) : Promise.resolve({})
        ]).then(([progResult, counts]) => {
          // Handle progress
          if (user?.id && progResult) {
            const converted: Record<string, { due: number; completed: number }> = {};
            for (const [gid, prog] of Object.entries(progResult)) {
              converted[gid] = { due: (prog as any).due, completed: (prog as any).completed };
            }
            setProgressByGarden(converted);
          } else if (progResult) {
            setProgressByGarden(progResult as Record<string, { due: number; completed: number }>);
          }
          // Handle member counts
          if (counts) {
            setMemberCountsByGarden(counts as Record<string, number>);
          }
        }).catch(() => {});

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

      // Set loading to false immediately so gardens render
      setLoading(false);

      // Load progress and member counts in parallel (non-blocking)
      const gardenIds = data.map((g) => g.id);
      Promise.all([
        user?.id
          ? getUserGardensTasksTodayCached(user.id, today)
          : getGardensTodayProgressBatchCached(gardenIds, today),
        gardenIds.length > 0 ? getGardenMemberCountsBatch(gardenIds) : Promise.resolve({})
      ]).then(([progResult, counts]) => {
        // Handle progress
        if (user?.id && progResult) {
          const converted: Record<string, { due: number; completed: number }> = {};
          for (const [gid, prog] of Object.entries(progResult)) {
            converted[gid] = { due: (prog as any).due, completed: (prog as any).completed };
          }
          setProgressByGarden(converted);
        } else if (progResult) {
          setProgressByGarden(progResult as Record<string, { due: number; completed: number }>);
        }
        // Handle member counts
        if (counts) {
          setMemberCountsByGarden(counts as Record<string, number>);
        }
      }).catch(() => {
        setProgressByGarden({});
      });
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
        const cachedOccs = cached.data.occurrences || [];
        const cachedPlants = cached.data.plants || [];
        
        // ONLY use memory cache if it has BOTH occurrences AND plants
        if (cachedOccs.length > 0 && cachedPlants.length > 0) {
          setTodayTaskOccurrences(cachedOccs);
          setCompletionsByOcc(cached.data.completions || {});
          setAllPlants(cachedPlants);
          setLoadingTasks(false);
          return;
        }
        
        // Cache is empty - clear it and fall through to load from DB
        console.warn("[GardenList] Memory cache has no data, clearing");
        taskDataCacheRef.current = null;
      }

      // 2. Check localStorage cache (persists across page reloads)
      const localStorageKey = `garden_tasks_cache_${cacheKey}`;
      const localStorageCache = getLocalStorageCache(localStorageKey);
      if (localStorageCache && localStorageCache.data) {
        const cachedOccs = localStorageCache.data.occurrences || [];
        const cachedPlants = localStorageCache.data.plants || [];
        
        // ONLY use cache if it has BOTH occurrences AND plants
        // If cache is empty, always fall through to load fresh data
        if (cachedOccs.length > 0 && cachedPlants.length > 0) {
          // Cache has valid data - use it
          setTodayTaskOccurrences(cachedOccs);
          setCompletionsByOcc(localStorageCache.data.completions || {});
          setAllPlants(cachedPlants);
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
            setTimeout(() => {
              loadAllTodayOccurrences(gardensOverride, todayOverride, skipResync);
            }, 100);
          }
          return;
        }
        
        // Cache is empty or invalid - clear it and fall through to load from DB
        console.warn("[GardenList] Cache has no data, clearing and loading fresh");
        clearLocalStorageCache(localStorageKey);
        taskDataCacheRef.current = null;
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

        // 2) Resync only if truly needed - this is expensive!
        // Skip if we already synced recently (using resyncCacheRef)
        // Only resync if explicitly requested AND cache is stale
        const gardensNeedingResync: string[] = [];
        if (!skipResync) {
          const now = Date.now();
          for (const g of gardensList) {
            const cacheKey = `${g.id}::${today}`;
            const lastSync = resyncCacheRef.current[cacheKey] || 0;
            // Only resync if last sync was more than CACHE_TTL ago
            if (now - lastSync > CACHE_TTL) {
              gardensNeedingResync.push(g.id);
            }
          }
          
          // Only call expensive resync if there are gardens that need it
          if (gardensNeedingResync.length > 0) {
            await resyncMultipleGardensTasks(gardensNeedingResync, startIso, endIso);
            
            // Update cache timestamps for synced gardens
            for (const gid of gardensNeedingResync) {
              const cacheKey = `${gid}::${today}`;
              resyncCacheRef.current[cacheKey] = now;
            }
          }
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
  // Always do a proper load - the cache checks inside loadAllTodayOccurrences will handle optimization
  React.useEffect(() => {
    // Only load tasks after gardens are loaded AND we have serverToday
    const today = serverTodayRef.current ?? serverToday;
    if (!loading && gardens.length > 0 && today) {
      // Always do full load with resync on initial load
      // The cache logic inside loadAllTodayOccurrences will return early if valid cache exists
      // skipResync=false ensures occurrences are created in the database
      loadAllTodayOccurrences(undefined, undefined, false).catch((err) => {
        console.error("[GardenList] Failed to load tasks:", err);
      });
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
                        <span className="animate-spin">⏳</span>
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
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{gw.gardenName}</div>
                        <div className="text-xs opacity-70">
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
                          <Card
                            key={gp.id}
                            className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#232326] backdrop-blur p-3 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">
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
                                    <span className="flex items-center gap-1">
                                      <span className="animate-spin">⏳</span>
                                      {t("garden.completing")}
                                    </span>
                                  ) : (
                                    t("garden.completeAll")
                                  )}
                                </Button>
                              )}
                            </div>
                            <div className="text-[11px] opacity-60">
                              {done} / {req} {t("garden.done")}
                            </div>
                            <div className="mt-2 space-y-2">
                              {occs.map((o: any) => {
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
                                const completions =
                                  completionsByOcc[o.id] || [];
                                return (
                                  <div
                                    key={o.id}
                                    className={`flex items-center justify-between gap-3 text-sm rounded-[18px] border border-stone-200/80 dark:border-[#3e3e42]/80 p-2 backdrop-blur ${isDone ? "bg-stone-50/80 dark:bg-[#2d2d30]/80" : "bg-white/80 dark:bg-[#1f1f1f]/70"}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="h-6 w-6 flex items-center justify-center rounded-md border border-stone-200/80 dark:border-[#3e3e42]/80 bg-white/90 dark:bg-[#2d2d30]/90">
                                        {icon}
                                      </span>
                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}
                                      >
                                        {t(`garden.taskTypes.${tt}`)}
                                      </span>
                                      <span className="text-xs opacity-70 text-black dark:text-white">
                                        {gp.nickname || gp.plant?.name}
                                      </span>
                                    </div>
                                    {!isDone ? (
                                      <>
                                        <div className="opacity-80 text-black dark:text-white">
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
                                      </>
                                    ) : (
                                      <div className="text-xs opacity-70 truncate max-w-[50%] text-black dark:text-white">
                                        {completions.length === 0
                                          ? t("garden.completed")
                                          : `${t("garden.doneBy")} ${completions.map((c) => c.displayName || t("garden.someone")).join(", ")}`}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </Card>
                ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
