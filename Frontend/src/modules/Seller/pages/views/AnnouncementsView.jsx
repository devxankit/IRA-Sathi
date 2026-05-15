import { useState, useMemo } from 'react'
import { sellerSnapshot } from '../../services/sellerData'
import { cn } from '../../../../lib/cn'
import { BellIcon, TargetIcon, SparkIcon, ShareIcon } from '../../components/icons'
import { Trans } from '../../../../components/Trans'
import { TransText } from '../../../../components/TransText'

const FILTER_TABS = [
  { id: 'all', label: <Trans>All</Trans> },
  { id: 'policy', label: <Trans>Policy</Trans> },
  { id: 'target', label: <Trans>Target</Trans> },
  { id: 'update', label: <Trans>Update</Trans> },
]

const TYPE_ICONS = {
  policy: ShareIcon,
  target: TargetIcon,
  update: SparkIcon,
}

const TYPE_LABELS = {
  policy: <Trans>Policy</Trans>,
  target: <Trans>Target</Trans>,
  update: <Trans>Update</Trans>,
}

export function AnnouncementsView({ onShowDetail }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const announcements = sellerSnapshot.announcements

  // Calculate stats
  const stats = useMemo(() => {
    const total = announcements.length
    const unread = announcements.filter((a) => !a.read).length
    const byType = {
      policy: announcements.filter((a) => a.type === 'policy').length,
      target: announcements.filter((a) => a.type === 'target').length,
      update: announcements.filter((a) => a.type === 'update').length,
    }
    return { total, unread, byType }
  }, [announcements])

  // Filter announcements
  const filteredAnnouncements = useMemo(() => {
    let filtered = announcements

    if (activeFilter === 'policy' || activeFilter === 'target' || activeFilter === 'update') {
      filtered = filtered.filter((a) => a.type === activeFilter)
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [announcements, activeFilter])

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date
      const days = Math.floor(diff / 86400000)

      if (days === 0) return <Trans>Today</Trans>
      if (days === 1) return <Trans>Yesterday</Trans>
      if (days < 7) return <Trans>{`${days} days ago`}</Trans>
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const getTypeIcon = (type) => {
    const Icon = TYPE_ICONS[type] || BellIcon
    return <Icon className="h-5 w-5" />
  }

  return (
    <div className="seller-announcements space-y-6">
      {/* Hero Card */}
      <section id="seller-announcements-hero" className="seller-announcements-hero">
        <div className="seller-announcements-hero__card">
          <div className="seller-announcements-hero__header">
            <div>
              <h2 className="seller-announcements-hero__title"><Trans>Announcements</Trans></h2>
              <p className="seller-announcements-hero__subtitle"><Trans>Important updates from admin</Trans></p>
            </div>
            <div className="seller-announcements-hero__badge">
              <BellIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="seller-announcements-hero__stats">
            <div className="seller-announcements-stat">
              <p className="seller-announcements-stat__label"><Trans>Total</Trans></p>
              <span className="seller-announcements-stat__value">{stats.total}</span>
            </div>
            <div className="seller-announcements-stat">
              <p className="seller-announcements-stat__label"><Trans>Unread</Trans></p>
              <span className="seller-announcements-stat__value seller-announcements-stat__value--unread">
                {stats.unread}
              </span>
            </div>
            <div className="seller-announcements-stat">
              <p className="seller-announcements-stat__label"><Trans>Policy</Trans></p>
              <span className="seller-announcements-stat__value">{stats.byType.policy}</span>
            </div>
            <div className="seller-announcements-stat">
              <p className="seller-announcements-stat__label"><Trans>Target</Trans></p>
              <span className="seller-announcements-stat__value">{stats.byType.target}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section id="seller-announcements-filters" className="seller-section">
        <div className="seller-filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={cn('seller-filter-tab', activeFilter === tab.id && 'is-active')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Announcements List */}
      <section id="seller-announcements-list" className="seller-section">
        {filteredAnnouncements.length === 0 ? (
          <div className="seller-announcements-empty">
            <BellIcon className="seller-announcements-empty__icon" />
            <p className="seller-announcements-empty__text"><Trans>No announcements found</Trans></p>
            <p className="seller-announcements-empty__subtext">
              {activeFilter === 'all'
                ? <Trans>You're all caught up! No new announcements.</Trans>
                : <Trans>{`No ${activeFilter} announcements yet`}</Trans>}
            </p>
          </div>
        ) : (
          <div className="seller-announcements-list">
            {filteredAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className={cn(
                  'seller-announcement-card',
                  !announcement.read && 'seller-announcement-card--unread',
                )}
                onClick={() => {
                  setSelectedAnnouncement(announcement)
                  setShowDetailSheet(true)
                  onShowDetail?.(announcement)
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="seller-announcement-card__header">
                  <div className="seller-announcement-card__icon">
                    <div
                      className={cn(
                        'seller-announcement-icon',
                        announcement.type === 'policy'
                          ? 'is-policy'
                          : announcement.type === 'target'
                            ? 'is-target'
                            : 'is-update',
                      )}
                    >
                      {getTypeIcon(announcement.type)}
                    </div>
                  </div>
                  <div className="seller-announcement-card__info">
                    <div className="seller-announcement-card__row">
                      <h3 className="seller-announcement-card__title"><TransText>{announcement.title}</TransText></h3>
                      {!announcement.read && (
                        <span className="seller-announcement-card__badge"><Trans>New</Trans></span>
                      )}
                    </div>
                    <div className="seller-announcement-card__meta">
                      <span
                        className={cn(
                          'seller-announcement-card__type',
                          announcement.type === 'policy'
                            ? 'is-policy'
                            : announcement.type === 'target'
                              ? 'is-target'
                              : 'is-update',
                        )}
                      >
                        {TYPE_LABELS[announcement.type]}
                      </span>
                      <span className="seller-announcement-card__date">{formatDate(announcement.date)}</span>
                    </div>
                  </div>
                </div>
                <div className="seller-announcement-card__body">
                  <p className="seller-announcement-card__message"><TransText>{announcement.message}</TransText></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Announcement Detail Sheet */}
      {selectedAnnouncement && showDetailSheet && (
        <div className={cn('seller-activity-sheet', showDetailSheet && 'is-open')}>
          <div
            className={cn('seller-activity-sheet__overlay', showDetailSheet && 'is-open')}
            onClick={() => {
              setShowDetailSheet(false)
              setTimeout(() => setSelectedAnnouncement(null), 260)
            }}
          />
          <div className={cn('seller-activity-sheet__panel', showDetailSheet && 'is-open')}>
            <div className="seller-activity-sheet__header">
              <h4><TransText>{selectedAnnouncement.title}</TransText></h4>
              <button
                type="button"
                onClick={() => {
                  setShowDetailSheet(false)
                  setTimeout(() => setSelectedAnnouncement(null), 260)
                }}
              >
                <Trans>Close</Trans>
              </button>
            </div>
            <div className="seller-activity-sheet__body">
              <div className="seller-announcement-detail">
                <div className="seller-announcement-detail__meta">
                  <span
                    className={cn(
                      'seller-announcement-card__type',
                      selectedAnnouncement.type === 'policy'
                        ? 'is-policy'
                        : selectedAnnouncement.type === 'target'
                          ? 'is-target'
                          : 'is-update',
                    )}
                  >
                    {TYPE_LABELS[selectedAnnouncement.type]}
                  </span>
                  <span className="seller-announcement-card__date">
                    {formatDate(selectedAnnouncement.date)}
                  </span>
                </div>
                <div className="seller-announcement-detail__content">
                  <h3 className="seller-announcement-detail__title"><TransText>{selectedAnnouncement.title}</TransText></h3>
                  <p className="seller-announcement-detail__message"><TransText>{selectedAnnouncement.message}</TransText></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

