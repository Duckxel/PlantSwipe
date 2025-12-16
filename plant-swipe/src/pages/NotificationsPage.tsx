import React from "react"
import { useTranslation } from "react-i18next"
import { useNotifications } from "@/hooks/useNotifications"
import { formatDistanceToNow } from "date-fns"
import { enUS, fr } from "date-fns/locale"
import { useLanguage } from "@/lib/i18nRouting"
import { Bell, Check, ExternalLink, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "@/components/i18n/Link"

export default function NotificationsPage() {
  const { t } = useTranslation('common')
  const { notifications, loading, error, markAsRead, markAllAsRead, refresh } = useNotifications()
  const currentLang = useLanguage()
  const dateLocale = currentLang === 'fr' ? fr : enUS

  const { newNotifications, earlierNotifications } = React.useMemo(() => {
    const newItems = []
    const earlierItems = []

    // Group by seen_at
    // "New" = unseen
    // "Earlier" = seen

    for (const n of notifications) {
      if (!n.seen_at) {
        newItems.push(n)
      } else {
        earlierItems.push(n)
      }
    }
    return { newNotifications: newItems, earlierNotifications: earlierItems }
  }, [notifications])

  if (loading && notifications.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8 text-center opacity-60">
        {t('common.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8 text-center text-red-600">
        {t('common.error')}: {error}
        <Button onClick={refresh} variant="outline" className="mt-4">
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    )
  }

  const NotificationItem = ({ notification }: { notification: any }) => {
    const isUnread = !notification.seen_at

    const handleClick = () => {
      if (isUnread) {
        markAsRead(notification.id)
      }
    }

    // Parse date
    const date = new Date(notification.delivered_at || notification.scheduled_for || notification.created_at)
    const timeAgo = formatDistanceToNow(date, { addSuffix: true, locale: dateLocale })

    // Determine link
    const link = notification.cta_url || notification.payload?.ctaUrl

    const Content = (
      <div className={`relative flex gap-4 p-4 rounded-2xl transition-colors ${isUnread ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30' : 'bg-white dark:bg-[#252526] border border-stone-100 dark:border-[#3e3e42]'}`}>
        <div className="shrink-0 mt-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUnread ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-stone-100 text-stone-500 dark:bg-[#2d2d30] dark:text-stone-400'}`}>
            <Bell className="w-5 h-5" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className={`text-base font-semibold ${isUnread ? 'text-black dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>
              {notification.title}
            </h3>
            <span className="text-xs text-stone-400 whitespace-nowrap shrink-0">
              {timeAgo}
            </span>
          </div>
          <div className="mt-1 text-sm text-stone-600 dark:text-stone-400 break-words" dangerouslySetInnerHTML={{ __html: notification.message }} />

          {link && (
            <div className="mt-3">
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                {t('common.view', { defaultValue: 'View' })} <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          )}
        </div>
        {isUnread && (
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </div>
    )

    if (link) {
      // Check if external link
      const isExternal = link.startsWith('http')
      if (isExternal) {
        return (
          <a href={link} target="_blank" rel="noopener noreferrer" className="block no-underline" onClick={handleClick}>
            {Content}
          </a>
        )
      }
      return (
        <Link to={link} className="block no-underline" onClick={handleClick}>
          {Content}
        </Link>
      )
    }

    return (
      <div onClick={handleClick} className="cursor-pointer">
        {Content}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('notifications.title', { defaultValue: 'Notifications' })}</h1>
        {newNotifications.length > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4 mr-1" />
            {t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 opacity-60">
          <div className="w-16 h-16 bg-stone-100 dark:bg-[#2d2d30] rounded-full flex items-center justify-center mx-auto mb-4">
            <BellOff className="w-8 h-8 text-stone-400" />
          </div>
          <p>{t('notifications.empty', { defaultValue: 'No notifications yet' })}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {newNotifications.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider pl-1">
                {t('notifications.new', { defaultValue: 'New' })}
              </h2>
              <div className="space-y-3">
                {newNotifications.map(n => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            </div>
          )}

          {earlierNotifications.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider pl-1">
                {t('notifications.earlier', { defaultValue: 'Earlier' })}
              </h2>
              <div className="space-y-3">
                {earlierNotifications.map(n => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
