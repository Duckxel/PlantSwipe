import React from 'react'
import { type UserRole, ROLE_CONFIG, USER_ROLES } from '@/constants/userRoles'

// SVG Icons for each role badge
const ProVerifiedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Instagram/Twitter style verified checkmark badge */}
    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5c-1.51 0-2.816.917-3.437 2.25-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
  </svg>
)

// Simplified Shield with Sword
const AdminBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Shield with sword */}
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
    <path d="M17.5 6.5l-8 8-3-3 1.4-1.4 1.6 1.6 6.6-6.6 1.4 1.4z" fill="white"/>
  </svg>
)

const PlusBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Plus badge with sparkle effect */}
    <defs>
      <linearGradient id="silver-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#silver-gradient)" />
    <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    {/* Sparkle effects */}
    <circle cx="18" cy="6" r="1.5" fill="white" fillOpacity="0.8" />
    <circle cx="6" cy="18" r="1" fill="white" fillOpacity="0.6" />
  </svg>
)

const VipBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* VIP Crown/Star badge */}
    <defs>
      <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#gold-gradient)" />
    <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    {/* Crown effect */}
    <path d="M7 8l2 3 3-4 3 4 2-3" stroke="#fef3c7" strokeWidth="1.5" fill="none" strokeOpacity="0.8"/>
    {/* Sparkle effects */}
    <circle cx="18" cy="5" r="2" fill="white" fillOpacity="0.9" />
    <circle cx="5" cy="7" r="1.5" fill="white" fillOpacity="0.7" />
    <circle cx="19" cy="17" r="1" fill="white" fillOpacity="0.6" />
  </svg>
)

const MerchantBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Store/Shop badge */}
    <path d="M4 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7H4z"/>
    <path d="M20 5H4L2 9h20l-2-4z" fillOpacity="0.7"/>
    <circle cx="7" cy="9" r="2" fill="white" fillOpacity="0.3"/>
    <circle cx="12" cy="9" r="2" fill="white" fillOpacity="0.3"/>
    <circle cx="17" cy="9" r="2" fill="white" fillOpacity="0.3"/>
    <rect x="10" y="13" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.8"/>
  </svg>
)

const CreatorBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Star/Creator badge */}
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    <circle cx="12" cy="12" r="3" fill="white" fillOpacity="0.3"/>
  </svg>
)

const EditorBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Pen/Edit badge */}
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
)

// Icon mapping for each role
const RoleIcons: Record<UserRole, React.FC<{ className?: string }>> = {
  admin: AdminBadgeIcon,
  editor: EditorBadgeIcon,
  pro: ProVerifiedIcon,
  merchant: MerchantBadgeIcon,
  creator: CreatorBadgeIcon,
  vip: VipBadgeIcon,
  plus: PlusBadgeIcon,
}

interface UserRoleBadgeProps {
  role: UserRole
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

/**
 * Beautiful role badge component for displaying user roles
 * Features gradient backgrounds, custom icons, and shine effects
 */
export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({
  role,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const config = ROLE_CONFIG[role]
  const IconComponent = RoleIcons[role]
  
  if (!config) return null

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  const labelSizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  }

  // Special styling for different roles
  const getBadgeStyle = () => {
    switch (role) {
      case USER_ROLES.PRO:
        return {
          iconClass: 'text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_3px_rgba(16,185,129,0.5)]',
          wrapperClass: '',
        }
      case USER_ROLES.ADMIN:
        return {
          iconClass: 'text-purple-500 dark:text-purple-400 drop-shadow-[0_0_3px_rgba(147,51,234,0.5)]',
          wrapperClass: '',
        }
      case USER_ROLES.PLUS:
        return {
          iconClass: 'text-slate-400 dark:text-slate-300 drop-shadow-[0_0_4px_rgba(148,163,184,0.6)]',
          wrapperClass: 'animate-pulse-subtle',
        }
      case USER_ROLES.VIP:
        return {
          iconClass: 'text-amber-500 dark:text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.7)]',
          wrapperClass: 'animate-pulse-subtle',
        }
      case USER_ROLES.MERCHANT:
        return {
          iconClass: 'text-sky-500 dark:text-sky-400 drop-shadow-[0_0_3px_rgba(14,165,233,0.5)]',
          wrapperClass: '',
        }
      case USER_ROLES.CREATOR:
        return {
          iconClass: 'text-pink-500 dark:text-pink-400 drop-shadow-[0_0_3px_rgba(236,72,153,0.5)]',
          wrapperClass: '',
        }
      case USER_ROLES.EDITOR:
        return {
          iconClass: 'text-blue-500 dark:text-blue-400 drop-shadow-[0_0_3px_rgba(59,130,246,0.5)]',
          wrapperClass: '',
        }
      default:
        return {
          iconClass: config.iconColor + ' ' + config.darkIconColor,
          wrapperClass: '',
        }
    }
  }

  const badgeStyle = getBadgeStyle()

  if (!showLabel) {
    return (
      <span
        className={`inline-flex items-center ${badgeStyle.wrapperClass} ${className}`}
        title={config.label}
        aria-label={config.label}
      >
        <IconComponent className={`${sizeClasses[size]} ${badgeStyle.iconClass}`} />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${config.bgColor} ${config.darkBgColor} ${config.borderColor} ${config.darkBorderColor} ${labelSizeClasses[size]} ${badgeStyle.wrapperClass} ${className}`}
      title={config.description}
    >
      <IconComponent className={`${sizeClasses[size]} ${badgeStyle.iconClass}`} />
      <span className={`font-medium ${config.iconColor} ${config.darkIconColor}`}>
        {config.label}
      </span>
    </span>
  )
}

interface UserRoleBadgesProps {
  roles: UserRole[] | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  maxDisplay?: number
  className?: string
}

/**
 * Display multiple role badges for a user
 * Shows only visible badges (Pro, Admin, Plus, VIP, Merchant) in the profile
 */
export const UserRoleBadges: React.FC<UserRoleBadgesProps> = ({
  roles,
  size = 'md',
  showLabels = false,
  maxDisplay = 5,
  className = '',
}) => {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return null

  // Order badges by visual importance: Pro, Admin, VIP, Plus, Merchant, Creator, Editor
  const badgeOrder: UserRole[] = [
    USER_ROLES.PRO,
    USER_ROLES.ADMIN,
    USER_ROLES.VIP,
    USER_ROLES.PLUS,
    USER_ROLES.MERCHANT,
    USER_ROLES.CREATOR,
    USER_ROLES.EDITOR,
  ]

  const sortedRoles = [...roles].sort((a, b) => {
    const aIndex = badgeOrder.indexOf(a)
    const bIndex = badgeOrder.indexOf(b)
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
  })

  const displayRoles = sortedRoles.slice(0, maxDisplay)
  const remainingCount = sortedRoles.length - maxDisplay

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {displayRoles.map((role) => (
        <UserRoleBadge
          key={role}
          role={role}
          size={size}
          showLabel={showLabels}
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-stone-500 dark:text-stone-400">
          +{remainingCount}
        </span>
      )}
    </div>
  )
}

/**
 * Display badges that should be visible next to the user's name
 * These are: Pro (verified), Admin, Plus, VIP, Merchant
 */
export const ProfileNameBadges: React.FC<{
  roles: UserRole[] | null | undefined
  isAdmin?: boolean // Legacy is_admin field support
  size?: 'sm' | 'md' | 'lg'
}> = ({ roles, isAdmin, size = 'md' }) => {
  // Build effective roles array
  const effectiveRoles: UserRole[] = []
  
  if (roles && Array.isArray(roles)) {
    effectiveRoles.push(...roles)
  }
  
  // Support legacy is_admin field
  if (isAdmin && !effectiveRoles.includes(USER_ROLES.ADMIN)) {
    effectiveRoles.push(USER_ROLES.ADMIN)
  }

  if (effectiveRoles.length === 0) return null

  // Only show certain badges next to name
  const visibleBadges: UserRole[] = [
    USER_ROLES.PRO,
    USER_ROLES.ADMIN,
    USER_ROLES.VIP,
    USER_ROLES.PLUS,
    USER_ROLES.MERCHANT,
  ]

  const badgesToShow = effectiveRoles.filter(role => visibleBadges.includes(role))

  // Order: Pro first (like Twitter verified), then others
  const badgeOrder: UserRole[] = [
    USER_ROLES.PRO,
    USER_ROLES.ADMIN,
    USER_ROLES.VIP,
    USER_ROLES.PLUS,
    USER_ROLES.MERCHANT,
  ]

  const sortedBadges = [...badgesToShow].sort((a, b) => {
    const aIndex = badgeOrder.indexOf(a)
    const bIndex = badgeOrder.indexOf(b)
    return aIndex - bIndex
  })

  if (sortedBadges.length === 0) return null

  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {sortedBadges.map((role) => (
        <UserRoleBadge key={role} role={role} size={size} />
      ))}
    </span>
  )
}

export default UserRoleBadges
