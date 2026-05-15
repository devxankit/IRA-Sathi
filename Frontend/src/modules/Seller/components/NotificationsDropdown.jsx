import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'
import { BellIcon } from './icons'
import { CloseIcon } from './icons'
import { Trans } from '../../../components/Trans'

export function NotificationsDropdown({ isOpen, onClose, notifications = [], onMarkAsRead, onMarkAllAsRead }) {
  const dropdownRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  // Show max 3 recent unread notifications
  const recentNotifications = (notifications || [])
    .filter((n) => !n.read)
    .slice(0, 3)
    .sort((a, b) => new Date(b.timestamp || b.createdAt || b.date || 0) - new Date(a.timestamp || a.createdAt || a.date || 0))

  const unreadCount = (notifications || []).filter((n) => !n.read).length

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
    } else {
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const formatTime = (dateString) => {
    if (!dateString) return 'Just now'
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return <Trans>Just now</Trans>
    if (minutes < 60) return <Trans>{minutes}m ago</Trans>
    if (hours < 24) return <Trans>{hours}h ago</Trans>
    if (days < 7) return <Trans>{days}d ago</Trans>
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

  if (!mounted) return null

  return (
    <div
      ref={dropdownRef}
      className={cn('seller-notifications-dropdown', isOpen && 'seller-notifications-dropdown--open')}
    >
      <div className="seller-notifications-dropdown__header">
        <div className="seller-notifications-dropdown__header-content">
          <h3 className="seller-notifications-dropdown__title"><Trans>Notifications</Trans></h3>
          {unreadCount > 0 && <span className="seller-notifications-dropdown__badge">{unreadCount}</span>}
        </div>
        <div className="seller-notifications-dropdown__header-actions">
          <button
            type="button"
            className="seller-notifications-dropdown__close"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="seller-notifications-dropdown__body">
        {recentNotifications.length === 0 ? (
          <div className="seller-notifications-dropdown__empty">
            <BellIcon className="seller-notifications-dropdown__empty-icon" />
            <p className="seller-notifications-dropdown__empty-text"><Trans>No new notifications</Trans></p>
            <p className="seller-notifications-dropdown__empty-subtext"><Trans>You're all caught up!</Trans></p>
          </div>
        ) : (
          <>
            {recentNotifications.length > 0 && onMarkAllAsRead && (
              <div className="seller-notifications-dropdown__actions">
                <button
                  type="button"
                  onClick={() => {
                    if (onMarkAllAsRead) {
                      onMarkAllAsRead()
                    }
                  }}
                  className="seller-notifications-dropdown__mark-all"
                >
                  <Trans>Mark all as read</Trans>
                </button>
              </div>
            )}
            <div className="seller-notifications-dropdown__list">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn('seller-notification-item', !notification.read && 'seller-notification-item--unread')}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="seller-notification-item__icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="seller-notification-item__content">
                    <div className="seller-notification-item__header">
                      <h4 className="seller-notification-item__title">{notification.title || <Trans>Notification</Trans>}</h4>
                      {!notification.read && (
                        <span className="seller-notification-item__badge" />
                      )}
                    </div>
                    {notification.message && (
                      <p className="seller-notification-item__message">{notification.message}</p>
                    )}
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
  )
}

