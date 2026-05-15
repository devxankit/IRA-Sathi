import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useSellerDispatch, useSellerState } from '../context/SellerContext'
import { useSellerApi } from '../hooks/useSellerApi'
import { MobileShell } from '../components/MobileShell'
import { BottomNavItem } from '../components/BottomNavItem'
import { MenuList } from '../components/MenuList'
import { HomeIcon, UsersIcon, WalletIcon, BellIcon, MenuIcon, SearchIcon, UserIcon } from '../components/icons'
import { sellerSnapshot } from '../services/sellerData'
import { cn } from '../../../lib/cn'
import { useToast } from '../components/ToastNotification'
import { OverviewView } from './views/OverviewView'
import { ReferralsView } from './views/ReferralsView'
import { WalletView } from './views/WalletView'
import { AnnouncementsView } from './views/AnnouncementsView'
import { PerformanceView } from './views/PerformanceView'
import { ProfileView } from './views/ProfileView'
import { WithdrawalRequestPanel } from '../components/WithdrawalRequestPanel'
import { ShareSellerIdPanel } from '../components/ShareSellerIdPanel'
import { BankAccountForm } from '../components/BankAccountForm'
import { NotificationPanel } from '../components/NotificationPanel'
import '../seller.css'
import { Trans } from '../../../components/Trans'
import { TransText } from '../../../components/TransText'
import { playNotificationSoundIfEnabled } from '../../../utils/notificationSound'
import { removeFCMTokenFromBackend } from '../../../utils/pushNotificationService'

const NAV_ITEMS = [
  {
    id: 'overview',
    label: <Trans>Overview</Trans>,
    description: <Trans>Target, wallet, stats</Trans>,
    icon: HomeIcon,
  },
  {
    id: 'referrals',
    label: <Trans>Referrals</Trans>,
    description: <Trans>Network & commission</Trans>,
    icon: UsersIcon,
  },
  {
    id: 'wallet',
    label: <Trans>Wallet</Trans>,
    description: <Trans>Withdrawals & history</Trans>,
    icon: WalletIcon,
  },
  {
    id: 'announcements',
    label: <Trans>Updates</Trans>,
    description: <Trans>Admin announcements</Trans>,
    icon: BellIcon,
  },
  {
    id: 'profile',
    label: <Trans>Profile</Trans>,
    description: <Trans>Settings & account</Trans>,
    icon: UserIcon,
  },
]

export function SellerDashboard({ onLogout }) {
  const { profile, notifications, dashboard } = useSellerState()
  const dispatch = useSellerDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { tab: urlTab } = useParams()
  const { fetchDashboardOverview, fetchWalletData } = useSellerApi()
  const [activeTab, setActiveTab] = useState('overview')
  const welcomeName = (profile?.name || sellerSnapshot.profile.name || 'Seller').split(' ')[0]
  const { success, error, info, warning } = useToast()
  const [searchMounted, setSearchMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [activePanel, setActivePanel] = useState(null)
  const [panelMounted, setPanelMounted] = useState(false)

  // Valid tabs for navigation
  const validTabs = ['overview', 'referrals', 'wallet', 'announcements', 'profile', 'performance']

  // Initialize tab from URL parameter on mount or when URL changes
  useEffect(() => {
    const tab = urlTab || 'overview'
    if (validTabs.includes(tab)) {
      setActiveTab(tab)
      // Close panels when navigating to a different tab
      setActivePanel(null)
    } else {
      // Invalid tab, redirect to overview
      navigate('/seller/dashboard/overview', { replace: true })
    }
  }, [urlTab, navigate])

  // Navigate function that updates both state and URL
  const navigateToTab = useCallback((tab) => {
    if (validTabs.includes(tab)) {
      setActiveTab(tab)
      navigate(`/seller/dashboard/${tab}`, { replace: false })
      // Close panels when navigating
      setActivePanel(null)
    }
  }, [navigate])

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  // Initialize seller data if not present
  useEffect(() => {
    if (!profile.name || profile.name === 'Guest Seller') {
      dispatch({
        type: 'AUTH_LOGIN',
        payload: sellerSnapshot.profile,
      })
    }
    // Initialize notifications if empty
    if (notifications.length === 0 && sellerSnapshot.announcements.length > 0) {
      sellerSnapshot.announcements.forEach((announcement) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: { ...announcement, read: announcement.read } })
      })
    }
  }, [dispatch, profile, notifications.length])

  const handleLogout = () => {
    // Fire-and-forget FCM token cleanup — must happen before token is removed by context
    removeFCMTokenFromBackend('seller').catch(() => { })
    dispatch({ type: 'AUTH_LOGOUT' })
    onLogout?.()
  }

  const navigateTo = (target) => {
    navigateToTab(target)
  }

  const buildMenuItems = (close) => [
    ...NAV_ITEMS.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      icon: <item.icon className="h-4 w-4" />,
      onSelect: () => {
        navigateToTab(item.id)
        close()
      },
    })),
    {
      id: 'logout',
      label: <Trans>Sign out</Trans>,
      icon: <MenuIcon className="h-4 w-4" />,
      description: <Trans>Log out from IRA Partner account</Trans>,
      onSelect: () => {
        handleLogout()
        close()
      },
    },
  ]

  const openSearch = () => {
    setSearchMounted(true)
    requestAnimationFrame(() => setSearchOpen(true))
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setTimeout(() => {
      setSearchMounted(false)
      setSearchQuery('')
    }, 260)
  }

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [searchOpen])

  const [panelData, setPanelData] = useState({})

  const handlePanelAction = (actionType, data) => {
    switch (actionType) {
      case 'share-seller-id':
        setPanelMounted(true)
        requestAnimationFrame(() => setActivePanel('share-seller-id'))
        break
      case 'request-withdrawal': {
        const wallet = dashboard.wallet || {}
        const balance = data?.availableBalance !== undefined
          ? data.availableBalance
          : (typeof wallet.balance === 'number' ? wallet.balance : parseFloat((wallet.balance || '0').toString().replace(/[₹,\s]/g, '')) || 0)
        setPanelData(data || {})
        setPanelMounted(true)
        requestAnimationFrame(() => setActivePanel('request-withdrawal'))
        break
      }
      case 'add-bank-account':
      case 'edit-bank-account':
      case 'delete-bank-account':
        setPanelData(data || {})
        setPanelMounted(true)
        requestAnimationFrame(() => setActivePanel(actionType))
        break
      case 'view-performance':
        navigateToTab('performance')
        break
      default:
        break
    }
  }

  const closePanel = () => {
    setActivePanel(null)
    setTimeout(() => {
      setPanelMounted(false)
    }, 260)
  }

  const formatCurrency = (amount) => {
    if (typeof amount === 'number') {
      return amount >= 100000 ? <><Trans>₹</Trans>{(amount / 100000).toFixed(1)} <Trans>L</Trans></> : `₹${amount.toLocaleString('en-IN')}`
    }
    return amount || '₹0'
  }

  const handleWithdrawalSuccess = async (data) => {
    success(<Trans>Withdrawal request of {formatCurrency(data.amount)} submitted successfully!</Trans>)
    // Refresh wallet data and dashboard
    await fetchWalletData()
    await fetchDashboardOverview()
    // Navigate to wallet tab if not already there
    if (activeTab !== 'wallet') {
      navigateToTab('wallet')
    }
  }

  const handleShareCopy = (text) => {
    success(<Trans>Copied to clipboard!</Trans>)
  }

  const handleBankAccountSuccess = async (bankAccount) => {
    success(<Trans>Bank account added successfully!</Trans>)
    // Refresh wallet data and dashboard
    await fetchWalletData()
    await fetchDashboardOverview()
    // Trigger refresh in WalletView
    window.dispatchEvent(new CustomEvent('seller-refresh-bank-accounts'))
    // Navigate to wallet tab if not already there
    if (activeTab !== 'wallet') {
      navigateToTab('wallet')
    }
  }

  const unreadNotificationsCount = useMemo(() => (notifications || []).filter((n) => !n.read).length, [notifications])
  const [isNotificationAnimating, setIsNotificationAnimating] = useState(false)
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const previousNotificationsCountRef = useRef(0)

  // Trigger bell animation and sound when new notification arrives
  useEffect(() => {
    const currentUnreadCount = unreadNotificationsCount
    const previousUnreadCount = previousNotificationsCountRef.current

    if (currentUnreadCount > previousUnreadCount && previousUnreadCount !== 0) {
      // New notification arrived
      playNotificationSoundIfEnabled()
      setIsNotificationAnimating(true)

      // Stop animation after 3 seconds
      const animationTimer = setTimeout(() => {
        setIsNotificationAnimating(false)
      }, 3000)

      return () => clearTimeout(animationTimer)
    }

    previousNotificationsCountRef.current = currentUnreadCount
  }, [unreadNotificationsCount])

  // Handle notification panel open/close
  const handleNotificationClick = () => {
    setNotificationPanelOpen(true)
  }

  const handleNotificationPanelClose = () => {
    setNotificationPanelOpen(false)
  }

  // Mark notification as read
  const handleMarkNotificationAsRead = useCallback((notificationId) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { id: notificationId } })
  }, [dispatch])

  // Mark all notifications as read
  const handleMarkAllNotificationsAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' })
  }, [dispatch])

  const tabLabels = useMemo(() => {
    return NAV_ITEMS.reduce((acc, item) => {
      acc[item.id] = item.label
      return acc
    }, {})
  }, [])

  const searchCatalog = useMemo(
    () =>
      [
        {
          id: 'search-overview-hero',
          label: <Trans>My Earnings</Trans>,
          keywords: ['earnings', 'wallet', 'balance', 'money', 'income', 'revenue'],
          tab: 'overview',
          targetId: 'seller-overview-hero',
        },
        {
          id: 'search-overview-services',
          label: <Trans>Quick Actions</Trans>,
          keywords: ['actions', 'shortcuts', 'share', 'referrals', 'quick'],
          tab: 'overview',
          targetId: 'seller-overview-services',
        },
        {
          id: 'search-overview-activity',
          label: <Trans>Recent Activity</Trans>,
          keywords: ['activity', 'recent', 'transactions', 'updates', 'history'],
          tab: 'overview',
          targetId: 'seller-overview-activity',
        },
        {
          id: 'search-overview-snapshot',
          label: <Trans>My Stats</Trans>,
          keywords: ['stats', 'summary', 'metrics', 'numbers', 'performance'],
          tab: 'overview',
          targetId: 'seller-overview-snapshot',
        },
        {
          id: 'search-overview-target',
          label: <Trans>My Target</Trans>,
          keywords: ['target', 'goal', 'progress', 'monthly', 'aim'],
          tab: 'overview',
          targetId: 'seller-target-progress',
        },
        {
          id: 'search-referrals',
          label: <Trans>My Referrals</Trans>,
          keywords: ['referrals', 'users', 'people', 'commission', 'sales'],
          tab: 'referrals',
          targetId: null,
        },
        {
          id: 'search-wallet',
          label: <Trans>My Wallet</Trans>,
          keywords: ['wallet', 'balance', 'money', 'transactions', 'withdrawal', 'commission'],
          tab: 'wallet',
          targetId: null,
        },
        {
          id: 'search-announcements',
          label: <Trans>Updates</Trans>,
          keywords: ['updates', 'announcements', 'news', 'notifications', 'messages'],
          tab: 'announcements',
          targetId: null,
        },
        {
          id: 'search-performance',
          label: <Trans>My Performance</Trans>,
          keywords: ['performance', 'reports', 'analytics', 'insights', 'progress'],
          tab: 'performance',
          targetId: null,
        },
        {
          id: 'search-profile',
          label: <Trans>My Profile</Trans>,
          keywords: ['profile', 'account', 'settings', 'seller id', 'info'],
          tab: 'profile',
          targetId: null,
        },
      ].map((item) => ({
        ...item,
        tabLabel: tabLabels[item.tab],
      })),
    [tabLabels],
  )

  const [pendingScroll, setPendingScroll] = useState(null)

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return searchCatalog.slice(0, 7)
    }
    const tokens = query.split(/\s+/).filter(Boolean)
    const results = searchCatalog
      .map((item) => {
        const haystack = `${item.label} ${item.tabLabel} ${item.keywords.join(' ')}`.toLowerCase()
        const directIndex = haystack.indexOf(query)
        const directScore = directIndex >= 0 ? 200 - directIndex : 0
        const tokenScore = tokens.reduce((score, token) => (haystack.includes(token) ? score + 20 : score), 0)
        const score = directScore + tokenScore
        return { ...item, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
    return results.length ? results : searchCatalog.slice(0, 5)
  }, [searchCatalog, searchQuery])

  const handleSearchNavigate = (item) => {
    if (!item) return
    const delay = item.tab === activeTab ? 150 : 420
    navigateToTab(item.tab)
    if (item.targetId) {
      setPendingScroll({ id: item.targetId, delay })
    }
    closeSearch()
  }

  const handleSearchSubmit = () => {
    if (searchResults.length) {
      handleSearchNavigate(searchResults[0])
    } else {
      closeSearch()
    }
  }

  useEffect(() => {
    if (!pendingScroll) return
    const { id, delay } = pendingScroll
    const timer = setTimeout(() => {
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
      }
      setPendingScroll(null)
    }, delay)
    return () => clearTimeout(timer)
  }, [pendingScroll, activeTab])

  return (
    <>
      <MobileShell
        title={<Trans>Hello {welcomeName}</Trans>}
        subtitle={profile.area || profile.location?.area || <Trans>Location not set</Trans>}
        onSearchClick={openSearch}
        onProfileClick={() => navigateToTab('profile')}
        onNotificationClick={handleNotificationClick}
        notificationsCount={unreadNotificationsCount}
        notifications={notifications}
        isNotificationAnimating={isNotificationAnimating}
        navigation={NAV_ITEMS.map((item) => (
          <BottomNavItem
            key={item.id}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => navigateToTab(item.id)}
            icon={<item.icon active={activeTab === item.id} className="h-5 w-5" />}
          />
        ))}
        menuContent={({ close }) => <MenuList items={buildMenuItems(close)} active={activeTab} />}
      >
        <section className="space-y-6">
          {activeTab === 'overview' && (
            <OverviewView onNavigate={navigateTo} openPanel={handlePanelAction} />
          )}
          {activeTab === 'referrals' && <ReferralsView onNavigate={navigateTo} />}
          {activeTab === 'wallet' && <WalletView openPanel={handlePanelAction} />}
          {activeTab === 'announcements' && <AnnouncementsView />}
          {activeTab === 'performance' && (
            <PerformanceView onBack={() => navigateToTab('overview')} />
          )}
          {activeTab === 'profile' && <ProfileView onLogout={handleLogout} onNavigate={navigateTo} />}
        </section>
      </MobileShell>

      {searchMounted ? (
        <div className={cn('seller-search-sheet', searchOpen && 'is-open')}>
          <div className={cn('seller-search-sheet__overlay', searchOpen && 'is-open')} onClick={closeSearch} />
          <div className={cn('seller-search-sheet__panel', searchOpen && 'is-open')}>
            <div className="seller-search-sheet__header">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSearchSubmit()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearch()
                  }
                }}
                placeholder={translate('Search by name, user ID, or amount...')}
                className="seller-search-input"
                aria-label={translate('Search referrals')}
              />
              <button type="button" className="seller-search-cancel" onClick={closeSearch}>
                <Trans>Cancel</Trans>
              </button>
            </div>
            <div className="seller-search-sheet__body">
              {searchResults.length ? (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSearchNavigate(item)}
                    className="seller-search-result"
                  >
                    <span className="seller-search-result__label">{item.label}</span>
                    <span className="seller-search-result__meta">{item.tabLabel}</span>
                  </button>
                ))
              ) : (
                <p className="seller-search-empty"><Trans>No matches yet. Try another keyword.</Trans></p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Action Panels */}
      {panelMounted && (
        <>
          {activePanel === 'request-withdrawal' && (
            <WithdrawalRequestPanel
              isOpen={activePanel === 'request-withdrawal'}
              onClose={closePanel}
              onSuccess={handleWithdrawalSuccess}
              availableBalance={panelData.availableBalance}
              bankAccounts={panelData.bankAccounts || []}
            />
          )}
          {activePanel === 'share-seller-id' && (
            <ShareSellerIdPanel
              isOpen={activePanel === 'share-seller-id'}
              onClose={closePanel}
              onCopy={handleShareCopy}
            />
          )}
          {activePanel === 'add-bank-account' && (
            <BankAccountForm
              isOpen={activePanel === 'add-bank-account'}
              onClose={closePanel}
              onSuccess={handleBankAccountSuccess}
            />
          )}
        </>
      )}

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={notificationPanelOpen}
        onClose={handleNotificationPanelClose}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
      />
    </>
  )
}
