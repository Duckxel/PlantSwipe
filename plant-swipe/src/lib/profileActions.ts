/**
 * Profile Actions Configuration
 *
 * Defines onboarding actions shown on the user's profile page.
 * To add a new action: append an entry to PROFILE_ACTIONS with a unique id,
 * a translation key (add matching keys in locales/en and locales/fr),
 * the target route, an icon identifier, and a completion predicate.
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
  /** i18n key under "profileActions.<id>.title" */
  titleKey: string
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
    link: '/gardens',
    iconId: 'garden',
    isCompleted: (d) => d.gardensCount >= 1,
  },
  {
    id: 'add_plant',
    titleKey: 'profileActions.addPlant',
    link: '/discovery',
    iconId: 'plant',
    isCompleted: (d) => d.plantsTotal >= 1,
  },
  {
    id: 'add_friend',
    titleKey: 'profileActions.addFriend',
    link: '/friends',
    iconId: 'friend',
    isCompleted: (d) => d.friendsCount >= 1,
  },
  {
    id: 'complete_profile',
    titleKey: 'profileActions.completeProfile',
    link: '/u/_me',
    iconId: 'profile',
    isCompleted: (d) => d.hasBio,
  },
  {
    id: 'add_bookmark',
    titleKey: 'profileActions.addBookmark',
    link: '/discovery',
    iconId: 'bookmark',
    isCompleted: (d) => d.bookmarkCount >= 1,
  },
]
