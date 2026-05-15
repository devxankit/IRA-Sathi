import { useEffect, useRef, useState } from 'react'
import { useUserState, useUserDispatch } from '../context/UserContext'
import { cn } from '../../../lib/cn'
import { BellIcon, XIcon } from './icons'
import { playNotificationSoundIfEnabled } from '../../../utils/notificationSound'

export function NotificationsDropdown({ isOpen, onClose }) {
  const { notifications } = useUserState()
  const dispatch = useUserDispatch()
  const dropdownRef = useRef(null)
  const [mounted, setMounted] = useState(false)
  const prevUnreadCountRef = useRef(0)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Play sound when new notifications arrive
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current && prevUnreadCountRef.current !== 0) {
      playNotificationSoundIfEnabled()
    }
    prevUnreadCountRef.current = unreadCount
  }, [unreadCount])

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

  const handleMarkAsRead = (id) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { id } })
  }

  const handleMarkAllAsRead = () => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' })
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  if (!mounted) return null

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'user-notifications-dropdown',
        isOpen && 'user-notifications-dropdown--open'
      )}
    >
      <div className="user-notifications-dropdown__header">
        <div className="user-notifications-dropdown__header-content">
          <h3 className="user-notifications-dropdown__title">Notifications</h3>
          {unreadCount > 0 && (
            <span className="user-notifications-dropdown__badge">{unreadCount}</span>
          )}
        </div>
        <div className="user-notifications-dropdown__header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="user-notifications-dropdown__mark-all"
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            className="user-notifications-dropdown__close"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="user-notifications-dropdown__body">
        {notifications.length === 0 ? (
          <div className="user-notifications-dropdown__empty">
            <BellIcon className="user-notifications-dropdown__empty-icon" />
            <p className="user-notifications-dropdown__empty-text">No notifications yet</p>
            <p className="user-notifications-dropdown__empty-subtext">We'll notify you when something happens</p>
          </div>
        ) : (
          <div className="user-notifications-dropdown__list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'user-notification-item',
                  !notification.read && 'user-notification-item--unread'
                )}
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <div className="user-notification-item__indicator" />
                <div className="user-notification-item__content">
                  <h4 className="user-notification-item__title">{notification.title}</h4>
                  {notification.message && (
                    <p className="user-notification-item__message">{notification.message}</p>
                  )}
                  <span className="user-notification-item__time">{formatTime(notification.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

