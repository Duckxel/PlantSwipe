/**
 * User Roles System for Aphylia
 * 
 * Roles that can be assigned to users:
 * - Admin: access to admin features
 * - Editor: access to plant creation, admin requests, admin blog, admin email, admin notifications
 * - Pro: verified professional gardener
 * - Merchant: for future - access to sell on the platform (not yet implemented)
 * - Creator: partnered social media influencer
 * - VIP: paid account access without having to pay
 * - Plus: paid account (cannot be manually assigned by admin)
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  PRO: 'pro',
  MERCHANT: 'merchant',
  CREATOR: 'creator',
  VIP: 'vip',
  PLUS: 'plus',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

/**
 * Roles that can be assigned by admin (all except Plus which is payment-based)
 */
export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EDITOR,
  USER_ROLES.PRO,
  USER_ROLES.MERCHANT,
  USER_ROLES.CREATOR,
  USER_ROLES.VIP,
]

/**
 * Role display information
 */
export const ROLE_CONFIG: Record<UserRole, {
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  darkBgColor: string
  darkBorderColor: string
  iconColor: string
  darkIconColor: string
}> = {
  admin: {
    label: 'Admin',
    description: 'Access to admin features',
    color: 'purple',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    darkBgColor: 'dark:bg-purple-900/40',
    darkBorderColor: 'dark:border-purple-700',
    iconColor: 'text-purple-600',
    darkIconColor: 'dark:text-purple-400',
  },
  editor: {
    label: 'Editor',
    description: 'Access to plant creation, blog, and notifications',
    color: 'blue',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    darkBgColor: 'dark:bg-blue-900/40',
    darkBorderColor: 'dark:border-blue-700',
    iconColor: 'text-blue-600',
    darkIconColor: 'dark:text-blue-400',
  },
  pro: {
    label: 'Pro',
    description: 'Verified professional gardener',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    darkBgColor: 'dark:bg-emerald-900/40',
    darkBorderColor: 'dark:border-emerald-700',
    iconColor: 'text-emerald-600',
    darkIconColor: 'dark:text-emerald-400',
  },
  merchant: {
    label: 'Merchant',
    description: 'Access to sell on the platform (coming soon)',
    color: 'sky',
    bgColor: 'bg-sky-100',
    borderColor: 'border-sky-300',
    darkBgColor: 'dark:bg-sky-900/40',
    darkBorderColor: 'dark:border-sky-700',
    iconColor: 'text-sky-600',
    darkIconColor: 'dark:text-sky-400',
  },
  creator: {
    label: 'Creator',
    description: 'Partnered social media influencer',
    color: 'pink',
    bgColor: 'bg-pink-100',
    borderColor: 'border-pink-300',
    darkBgColor: 'dark:bg-pink-900/40',
    darkBorderColor: 'dark:border-pink-700',
    iconColor: 'text-pink-600',
    darkIconColor: 'dark:text-pink-400',
  },
  vip: {
    label: 'VIP',
    description: 'Premium account access',
    color: 'amber',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    darkBgColor: 'dark:bg-amber-900/40',
    darkBorderColor: 'dark:border-amber-700',
    iconColor: 'text-amber-600',
    darkIconColor: 'dark:text-amber-400',
  },
  plus: {
    label: 'Plus',
    description: 'Paid account subscriber',
    color: 'slate',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    darkBgColor: 'dark:bg-slate-800/40',
    darkBorderColor: 'dark:border-slate-600',
    iconColor: 'text-slate-600',
    darkIconColor: 'dark:text-slate-300',
  },
}

/**
 * Check if user has a specific role
 */
export function hasRole(roles: UserRole[] | null | undefined, role: UserRole): boolean {
  if (!roles || !Array.isArray(roles)) return false
  return roles.includes(role)
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roles: UserRole[] | null | undefined, checkRoles: UserRole[]): boolean {
  if (!roles || !Array.isArray(roles)) return false
  return checkRoles.some(role => roles.includes(role))
}

/**
 * Check if user has admin-level access (admin or editor)
 */
export function hasAdminAccess(roles: string[] | null | undefined): boolean {
  return hasAnyRole(roles as UserRole[] | null | undefined, [USER_ROLES.ADMIN, USER_ROLES.EDITOR])
}

/**
 * Check if user has full admin access (admin role only)
 */
export function hasFullAdminAccess(roles: string[] | null | undefined, isAdmin?: boolean | null): boolean {
  if (isAdmin === true) return true
  return hasRole(roles as UserRole[] | null | undefined, USER_ROLES.ADMIN)
}

/**
 * Check if user has editor access (admin or editor role)
 * Editors can access: plant creation/editing, requests, blog, notifications, emails
 */
export function hasEditorAccess(roles: string[] | null | undefined, isAdmin?: boolean | null): boolean {
  if (isAdmin === true) return true
  return hasAnyRole(roles as UserRole[] | null | undefined, [USER_ROLES.ADMIN, USER_ROLES.EDITOR])
}

/**
 * Check access from a profile object (supports both roles array and legacy is_admin)
 */
export function checkEditorAccess(profile: { is_admin?: boolean | null; roles?: string[] | null } | null | undefined): boolean {
  if (!profile) return false
  if (profile.is_admin === true) return true
  return hasEditorAccess(profile.roles)
}

/**
 * Check full admin access from a profile object
 */
export function checkFullAdminAccess(profile: { is_admin?: boolean | null; roles?: string[] | null } | null | undefined): boolean {
  if (!profile) return false
  if (profile.is_admin === true) return true
  return hasRole(profile.roles as UserRole[] | null | undefined, USER_ROLES.ADMIN)
}
