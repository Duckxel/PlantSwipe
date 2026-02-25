/**
 * Profile Actions Configuration
 *
 * Defines onboarding actions shown on the user's profile page.
 * To add a new action: append an entry to PROFILE_ACTIONS with a unique id,
 * translation keys (titleKey + descKey — add matching keys in locales/en and
 * locales/fr), the target route, an icon identifier, and a completion predicate.
 */

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
  /** Returns true when the action is considered completed */
  isCompleted: (data: ActionCheckData) => boolean
}

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

// ---- Skip / dismiss persistence (localStorage) ----

const STORAGE_KEY = 'plantswipe.actions.skipped'

export function getSkippedActionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

export function skipAction(actionId: string): Set<string> {
  const set = getSkippedActionIds()
  set.add(actionId)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])) } catch {}
  return set
}

export function unskipAction(actionId: string): Set<string> {
  const set = getSkippedActionIds()
  set.delete(actionId)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])) } catch {}
  return set
}

/**
 * Compute the remaining (not done AND not skipped) action count.
 * Used by TopBar / MobileNavBar to show a badge.
 */
export function getRemainingCount(
  data: ActionCheckData | null,
  skipped: Set<string>,
): number {
  if (!data) return 0
  return PROFILE_ACTIONS.filter(
    (a) => !a.isCompleted(data) && !skipped.has(a.id),
  ).length
}

// ---- "All done" dismissal persistence ----
// Stores the total action count at the time the user clicked "Hooray".
// The card stays hidden until a new action is added (count increases).

const DISMISSED_KEY = 'plantswipe.actions.dismissed_at_count'

export function dismissAllDone(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(PROFILE_ACTIONS.length))
  } catch {}
}

export function isDismissedAllDone(): boolean {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    if (stored === null) return false
    return Number(stored) >= PROFILE_ACTIONS.length
  } catch {}
  return false
}
