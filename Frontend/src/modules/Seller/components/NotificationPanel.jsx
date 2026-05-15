import { useEffect, useRef } from 'react'
import { cn } from '../../../lib/cn'
import { CloseIcon, BellIcon } from './icons'
import { Trans } from '../../../components/Trans'

export function NotificationPanel({ isOpen, onClose, notifications, onMarkAsRead, onMarkAllAsRead }) {
  const panelRef = useRef(null)

  // Show max 3 recent notifications
  const recentNotifications = (notifications || [])
    .filter((n) => !n.read)
    .slice(0, 3)
    .sort((a, b) => new Date(b.timestamp || b.createdAt || b.date || 0) - new Date(a.timestamp || a.createdAt || a.date || 0))

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return <Trans>Just now</Trans>
    if (diffMins < 60) return <Trans>{diffMins}m ago</Trans>
    if (diffHours < 24) return <Trans>{diffHours}h ago</Trans>
    if (diffDays < 7) return <Trans>{diffDays}d ago</Trans>
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'commission':
      case 'cashback':
        return '💰'
      case 'target':
      case 'target_achieved':
        return '🎯'
      case 'announcement':
        return '📢'
      case 'withdrawal':
      case 'withdrawal_approved':
      case 'withdrawal_rejected':
        return '💸'
      case 'commission_rate_change':
      case 'policy_update':
        return '📋'
      default:
        return '🔔'
    }
  }

  const handleNotificationClick = (notification) => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id)
    }
  }

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={cn('seller-notification-panel', isOpen && 'is-open')}>
      <div className={cn('seller-notification-panel__overlay', isOpen && 'is-open')} onClick={onClose} />
      <div className={cn('seller-notification-panel__content', isOpen && 'is-open')} ref={panelRef}>
        <div className="seller-notification-panel__header">
          <div className="seller-notification-panel__header-content">
            <div className="seller-notification-panel__icon">
              <BellIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="seller-notification-panel__title"><Trans>Notifications</Trans></h3>
              <p className="seller-notification-panel__subtitle">
                {recentNotifications.length > 0 ? <Trans>{recentNotifications.length} new</Trans> : <Trans>No new notifications</Trans>}
              </p>
            </div>
          </div>
          <button type="button" className="seller-notification-panel__close" onClick={onClose} aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="seller-notification-panel__body">
          {recentNotifications.length === 0 ? (
            <div className="seller-notification-panel__empty">
              <BellIcon className="h-12 w-12" style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p className="seller-notification-panel__empty-text"><Trans>No new notifications</Trans></p>
              <p className="seller-notification-panel__empty-subtext"><Trans>You're all caught up!</Trans></p>
            </div>
          ) : (
            <>
              {recentNotifications.length > 0 && (
                <div className="seller-notification-panel__actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (onMarkAllAsRead) {
                        onMarkAllAsRead()
                      }
                    }}
                    className="seller-notification-panel__mark-all"
                  >
                    <Trans>Mark all as read</Trans>
                  </button>
                </div>
              )}
              <div className="seller-notification-panel__list">
                {recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'seller-notification-item',
                      !notification.read && 'is-unread',
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="seller-notification-item__icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="seller-notification-item__content">
                      <div className="seller-notification-item__header">
                        <h4 className="seller-notification-item__title">
                          {notification.title || <Trans>Notification</Trans>}
                        </h4>
                        {!notification.read && (
                          <span className="seller-notification-item__badge" />
                        )}
                      </div>
                      <p className="seller-notification-item__message">
                        {notification.message || <Trans>You have a new notification</Trans>}
                      </p>
                      <span className="seller-notification-item__time">
                        {formatTime(notification.timestamp || notification.createdAt || notification.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}




















