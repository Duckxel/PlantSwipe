/**
 * Profile Actions Configuration
 *
 * Defines onboarding actions shown on the user's profile page.
 * Action completion and skip state is stored in the `user_action_status` DB
 * table so it syncs across devices.  Once an action is marked completed in
 * the DB it is NEVER reverted — even if the user later deletes the underlying
 * resource (e.g. removes their garden).
 *
 * To add a new action: append an entry to PROFILE_ACTIONS with a unique id,
 * translation keys (titleKey + descKey — add matching keys in locales/en and
 * locales/fr), the target route, an icon identifier, and a completion predicate.
 */

import { supabase } from '@/lib/supabaseClient'

// ---- Types ----

export type ActionCheckData = {
  gardensCount: number
  plantsTotal: number
  friendsCount: number
  bookmarkCount: number
  hasBio: boolean
}

export type ProfileActionDef = {
  id: string
  /** i18n key for the action title */
  titleKey: string
  /** i18n key for the short description shown below the title */
  descKey: string
  /** Route the user should visit to complete this action */
  link: string
  /** Icon identifier resolved in the component */
  iconId: 'garden' | 'plant' | 'friend' | 'profile' | 'bookmark'
  /** Returns true when the action is considered completed (live check) */
  isCompleted: (data: ActionCheckData) => boolean
}

export type ActionStatusRow = {
  action_id: string
  completed_at: string | null
  skipped_at: string | null
}

/** Map from action_id → DB row. */
export type ActionStatusMap = Map<string, ActionStatusRow>

// ---- Action definitions ----

export const PROFILE_ACTIONS: ProfileActionDef[] = [
  {
    id: 'create_garden',
    titleKey: 'profileActions.createGarden',
    descKey: 'profileActions.createGardenDesc',
    link: '/gardens',
    iconId: 'garden',
    isCompleted: (d) => d.gardensCount >= 1,
  },
  {
    id: 'add_plant',
    titleKey: 'profileActions.addPlant',
    descKey: 'profileActions.addPlantDesc',
    link: '/gardens',
    iconId: 'plant',
    isCompleted: (d) => d.plantsTotal >= 1,
  },
  {
    id: 'add_friend',
    titleKey: 'profileActions.addFriend',
    descKey: 'profileActions.addFriendDesc',
    link: '/friends',
    iconId: 'friend',
    isCompleted: (d) => d.friendsCount >= 1,
  },
  {
    id: 'complete_profile',
    titleKey: 'profileActions.completeProfile',
    descKey: 'profileActions.completeProfileDesc',
    link: '/u/_me',
    iconId: 'profile',
    isCompleted: (d) => d.hasBio,
  },
  {
    id: 'add_bookmark',
    titleKey: 'profileActions.addBookmark',
    descKey: 'profileActions.addBookmarkDesc',
    link: '/u/_me#bookmarks',
    iconId: 'bookmark',
    isCompleted: (d) => d.bookmarkCount >= 1,
  },
]

// ---- Internal constants ----

const DISMISSED_ACTION_ID = '__all_done_dismissed'

// ---- DB operations ----

let _migrated = false

/**
 * Fetch all action statuses for a user from the DB.
 * On first call, migrates any existing localStorage data.
 * Returns `null` when the DB query fails so callers can keep their
 * existing state instead of replacing it with an empty map.
 */
export async function fetchActionStatuses(userId: string): Promise<ActionStatusMap | null> {
  const { data, error } = await supabase
    .from('user_action_status')
    .select('action_id, completed_at, skipped_at')
    .eq('user_id', userId)

  if (error) return null

  const map: ActionStatusMap = new Map()
  if (data) {
    for (const row of data) {
      map.set(row.action_id, row)
    }
  }

  // One-time migration from localStorage
  if (!_migrated) {
    await migrateFromLocalStorage(userId, map)
    _migrated = true
  }

  return map
}

/**
 * Sync live completion state to the DB. For each action that is completed
 * live but not yet marked completed in the DB, persists the completion
 * (sticky — never reverts).  Returns an updated map.
 */
export async function syncCompletionsToDb(
  userId: string,
  liveData: ActionCheckData,
  dbStatuses: ActionStatusMap,
): Promise<ActionStatusMap> {
  const toMark: string[] = []
  for (const action of PROFILE_ACTIONS) {
    if (action.isCompleted(liveData) && !dbStatuses.get(action.id)?.completed_at) {
      toMark.push(action.id)
    }
  }
  if (toMark.length === 0) return dbStatuses

  // Single batched RPC call
  await supabase.rpc('bulk_mark_actions_completed', {
    _user_id: userId,
    _action_ids: toMark,
  })

  // Update in-memory map
  const updated = new Map(dbStatuses)
  const now = new Date().toISOString()
  for (const id of toMark) {
    const existing = updated.get(id)
    updated.set(id, {
      action_id: id,
      completed_at: now,
      skipped_at: existing?.skipped_at ?? null,
    })
  }
  return updated
}

/**
 * Skip an action. Returns an optimistically-updated map.
 * The DB write happens in the background with automatic retry so
 * the skip survives across page reloads even on transient failures.
 */
export function skipAction(
  userId: string,
  actionId: string,
  dbStatuses: ActionStatusMap,
): ActionStatusMap {
  const doRpc = () =>
    supabase.rpc('skip_action', { _user_id: userId, _action_id: actionId })

  // Fire with retry — the first .then() triggers the lazy PostgrestBuilder
  doRpc().then(
    ({ error }) => {
      if (error) {
        // PostgREST-level error (e.g. auth expired) — retry once after 2 s
        setTimeout(() => doRpc().then(null, () => {}), 2000)
      }
    },
    () => {
      // Network-level rejection — retry once after 2 s
      setTimeout(() => doRpc().then(null, () => {}), 2000)
    },
  )

  const next = new Map(dbStatuses)
  const existing = dbStatuses.get(actionId)
  next.set(actionId, {
    action_id: actionId,
    completed_at: existing?.completed_at ?? null,
    skipped_at: new Date().toISOString(),
  })
  return next
}

/**
 * Dismiss the "all done" celebration card.
 * Returns an optimistically-updated map.
 */
export function dismissAllDone(
  userId: string,
  dbStatuses: ActionStatusMap,
): ActionStatusMap {
  const doRpc = () =>
    supabase.rpc('mark_action_completed', {
      _user_id: userId,
      _action_id: DISMISSED_ACTION_ID,
    })

  doRpc().then(
    ({ error }) => {
      if (error) setTimeout(() => doRpc().then(null, () => {}), 2000)
    },
    () => setTimeout(() => doRpc().then(null, () => {}), 2000),
  )

  const next = new Map(dbStatuses)
  next.set(DISMISSED_ACTION_ID, {
    action_id: DISMISSED_ACTION_ID,
    completed_at: new Date().toISOString(),
    skipped_at: null,
  })
  return next
}

// ---- Pure helpers (no DB calls) ----

/**
 * Check if an action is "done" — either marked completed in the DB (sticky)
 * OR currently completed according to live data.
 */
export function isActionDone(
  action: ProfileActionDef,
  liveData: ActionCheckData,
  dbStatuses: ActionStatusMap,
): boolean {
  if (dbStatuses.get(action.id)?.completed_at) return true
  return action.isCompleted(liveData)
}

/** Check if an action is skipped in the DB. */
export function isActionSkipped(
  actionId: string,
  dbStatuses: ActionStatusMap,
): boolean {
  return dbStatuses.get(actionId)?.skipped_at != null
}

/** Derive the set of skipped action IDs from the DB status map. */
export function getSkippedSet(dbStatuses: ActionStatusMap): Set<string> {
  const set = new Set<string>()
  for (const [id, row] of dbStatuses) {
    if (row.skipped_at && id !== DISMISSED_ACTION_ID) set.add(id)
  }
  return set
}

/**
 * Check if the "all done" celebration was dismissed.
 * Returns true only if the dismiss row exists AND all current actions are
 * either completed or skipped — so adding a new action automatically
 * un-dismisses.
 */
export function isDismissedAllDone(
  dbStatuses: ActionStatusMap,
  liveData: ActionCheckData,
): boolean {
  if (!dbStatuses.get(DISMISSED_ACTION_ID)?.completed_at) return false
  return PROFILE_ACTIONS.every(
    (a) => isActionDone(a, liveData, dbStatuses) || isActionSkipped(a.id, dbStatuses),
  )
}

/**
 * Compute the remaining (not done AND not skipped) action count.
 * Used by TopBar / MobileNavBar to show a badge.
 */
export function getRemainingCount(
  data: ActionCheckData | null,
  dbStatuses: ActionStatusMap,
): number {
  if (!data) return 0
  return PROFILE_ACTIONS.filter(
    (a) => !isActionDone(a, data, dbStatuses) && !isActionSkipped(a.id, dbStatuses),
  ).length
}

// ---- localStorage migration (runs once) ----

async function migrateFromLocalStorage(
  userId: string,
  dbMap: ActionStatusMap,
): Promise<void> {
  const MIGRATED_KEY = 'plantswipe.actions.migrated_to_db'
  try {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(MIGRATED_KEY)) return

    const skippedRaw = localStorage.getItem('plantswipe.actions.skipped')
    const dismissedRaw = localStorage.getItem('plantswipe.actions.dismissed_at_count')
    const hasLocalData = skippedRaw || dismissedRaw

    if (!hasLocalData) {
      localStorage.setItem(MIGRATED_KEY, '1')
      return
    }

    // Migrate skipped actions
    if (skippedRaw) {
      const skippedIds: string[] = JSON.parse(skippedRaw)
      const toSkip = skippedIds.filter((id) => !dbMap.get(id)?.skipped_at)
      for (const id of toSkip) {
        await supabase.rpc('skip_action', { _user_id: userId, _action_id: id })
        const existing = dbMap.get(id)
        dbMap.set(id, {
          action_id: id,
          completed_at: existing?.completed_at ?? null,
          skipped_at: new Date().toISOString(),
        })
      }
    }

    // Migrate "all done dismissed"
    if (dismissedRaw && Number(dismissedRaw) >= PROFILE_ACTIONS.length) {
      if (!dbMap.get(DISMISSED_ACTION_ID)?.completed_at) {
        await supabase.rpc('mark_action_completed', {
          _user_id: userId,
          _action_id: DISMISSED_ACTION_ID,
        })
        dbMap.set(DISMISSED_ACTION_ID, {
          action_id: DISMISSED_ACTION_ID,
          completed_at: new Date().toISOString(),
          skipped_at: null,
        })
      }
    }

    localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    // Silently fail — will retry on next page load
  }
}
