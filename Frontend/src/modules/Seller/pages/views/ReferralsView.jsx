import React, { useState, useMemo, useEffect } from 'react'
import { useSellerState } from '../../context/SellerContext'
import { useSellerApi } from '../../hooks/useSellerApi'
import { sellerSnapshot } from '../../services/sellerData'
import { cn } from '../../../../lib/cn'
import { UsersIcon, WalletIcon, TrendingUpIcon } from '../../components/icons'
import { Trans } from '../../../../components/Trans'
import { TransText } from '../../../../components/TransText'
import { useTranslation } from '../../../../context/TranslationContext'

const FILTER_TABS = [
  { id: 'all', label: <Trans>All</Trans> },
  { id: 'active', label: <Trans>Active</Trans> },
  { id: 'registered', label: <Trans>New</Trans> },
  { id: 'stalled', label: <Trans>Stalled</Trans> }, // Gap 5A: Users inactive for 2+ months
]

export function ReferralsView({ onNavigate }) {
  const { dashboard } = useSellerState()
  const { translate } = useTranslation()
  const { fetchReferrals } = useSellerApi()
  const [activeFilter, setActiveFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const commissionPolicy = sellerSnapshot.commissionPolicy // Keep policies as is

  // Fetch referrals on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await fetchReferrals({ limit: 100 })
        if (result.data?.referrals) {
          // Transform backend response to frontend format
          const transformedReferrals = result.data.referrals.map((ref) => ({
            id: ref._id || ref.id,
            userId: ref._id || ref.id,
            name: ref.name || <Trans>User</Trans>,
            phone: ref.phone || '',
            email: ref.email || '',
            monthlyPurchases: ref.monthlyPurchases || 0,
            orderCount: ref.orderCount || 0,
            commissionRate: ref.commissionRate || 0.02,
            estimatedCommission: ref.estimatedCommission || 0,
            status: ref.monthlyPurchases > 0 ? <Trans>Active</Trans> : <Trans>Registered</Trans>,
            createdAt: ref.createdAt,
            registeredDate: ref.createdAt,
            totalAmount: ref.monthlyPurchases || 0, // For display purposes
            totalPurchases: ref.orderCount || 0,
          }))
          setReferrals(transformedReferrals)
        }
      } catch (error) {
        console.error('Failed to fetch referrals:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [fetchReferrals])

  const formatCurrency = (value = 0) => {
    const amount = Number(value) || 0
    return amount >= 100000
      ? <><Trans>₹</Trans>{(amount / 100000).toFixed(1)} <Trans>L</Trans></>
      : `₹${amount.toLocaleString('en-IN')}`
  }

  const getCommissionInfo = (amount) => {
    const purchaseAmount = Number(amount) || 0
    // Commission rate: 2% if <= 50000, 3% if > 50000 (based on monthly purchases)
    const rate = purchaseAmount >= 50000 ? 0.03 : 0.02
    const commissionAmount = Math.round(purchaseAmount * rate)
    return {
      purchaseAmount,
      rate,
      commissionAmount,
    }
  }

  const currentMonthLabel =
    commissionPolicy?.currentMonth ||
    new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = referrals.length
    const active = referrals.filter((r) => r.status === 'active' || r.status === 'Active').length
    const aggregates = referrals.reduce(
      (acc, referral) => {
        // Handle both string and number formats
        const lifetimeAmount = typeof referral.totalAmount === 'number'
          ? referral.totalAmount
          : parseFloat((referral.totalAmount || '0').toString().replace(/[₹,\sL]/g, '')) || 0
        const monthlyPurchases = typeof referral.monthlyPurchases === 'number'
          ? referral.monthlyPurchases
          : parseFloat((referral.monthlyPurchases || '0').toString().replace(/[₹,\sL]/g, '')) || 0
        const commissionInfo = getCommissionInfo(monthlyPurchases)
        acc.totalSales += lifetimeAmount
        acc.monthlyPurchases += commissionInfo.purchaseAmount
        acc.monthlyCommission += commissionInfo.commissionAmount
        return acc
      },
      { totalSales: 0, monthlyPurchases: 0, monthlyCommission: 0 },
    )

    return {
      total,
      active,
      monthlyCommission: formatCurrency(aggregates.monthlyCommission),
      monthlyPurchases: formatCurrency(aggregates.monthlyPurchases),
    }
  }, [referrals])

  // Filter referrals
  const filteredReferrals = useMemo(() => {
    let filtered = referrals

    // Status filter
    if (activeFilter === 'active') {
      filtered = filtered.filter((r) => r.status === 'active' || r.status === 'Active')
    } else if (activeFilter === 'registered') {
      filtered = filtered.filter((r) => r.status === 'registered' || r.status === 'Registered' || !r.status)
    } else if (activeFilter === 'stalled') {
      // Gap 5A: Filter users who haven't ordered in 2+ months
      const twoMonthsAgo = new Date()
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
      filtered = filtered.filter((r) => {
        // If no last purchase date, consider stalled
        if (!r.lastPurchase && !r.lastOrderDate) return true
        const lastPurchaseDate = new Date(r.lastPurchase || r.lastOrderDate)
        return lastPurchaseDate < twoMonthsAgo
      })
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) => {
          const name = (r.name || '').toLowerCase()
          const userId = (r.userId || r.id || '').toString().toLowerCase()
          const totalAmount = (r.totalAmount || '').toString().toLowerCase()
          return name.includes(query) || userId.includes(query) || totalAmount.includes(query)
        }
      )
    }

    return filtered
  }, [referrals, activeFilter, searchQuery])

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="seller-referrals space-y-6">
      {/* Header Stats */}
      <section id="seller-referrals-hero" className="seller-referrals-hero">
        <div className="seller-referrals-hero__card">
          <div className="seller-referrals-hero__header">
            <div>
              <h2 className="seller-referrals-hero__title"><Trans>Your Referrals</Trans></h2>
              <p className="seller-referrals-hero__subtitle"><Trans>Track your referral network</Trans></p>
            </div>
            <div className="seller-referrals-hero__badge">
              <UsersIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="seller-referrals-hero__stats">
            <div className="seller-referrals-stat">
              <p className="seller-referrals-stat__label"><Trans>Total Referrals</Trans></p>
              <span className="seller-referrals-stat__value">{stats.total}</span>
            </div>
            <div className="seller-referrals-stat">
              <p className="seller-referrals-stat__label"><Trans>Active Users</Trans></p>
              <span className="seller-referrals-stat__value">{stats.active}</span>
            </div>
            <div className="seller-referrals-stat">
              <p className="seller-referrals-stat__label"><Trans>This Month Commission</Trans></p>
              <span className="seller-referrals-stat__value">{stats.monthlyCommission}</span>
            </div>
            <div className="seller-referrals-stat">
              <p className="seller-referrals-stat__label"><Trans>This Month Purchases</Trans></p>
              <span className="seller-referrals-stat__value">{stats.monthlyPurchases}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Commission Policy Notice */}
      <section className="seller-section">
        <div className="rounded-2xl border border-[rgba(1, 78, 23,0.15)] bg-white/80 p-4">
          <p className="text-sm font-semibold text-[#172022]">
            <Trans>{`Monthly commission tally resets on day ${commissionPolicy?.resetDay || 1} of every month.`}</Trans>
          </p>
          <p className="mt-1 text-xs text-[rgba(26,42,34,0.7)]">
            <Trans>{`Current cycle: ${currentMonthLabel}. Commission rates apply per connected user:`}</Trans>
          </p>
          <ul className="mt-3 space-y-1 text-xs text-[rgba(26,42,34,0.7)]">
            <li>• <Trans>Up to ₹50,000 cumulative purchases: earn 2% commission.</Trans></li>
            <li>• <Trans>Above ₹50,000: the entire month’s purchases earn 3%.</Trans></li>
          </ul>
        </div>
      </section>

      {/* Filter Tabs */}
      <section id="seller-referrals-filters" className="seller-section">
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

      {/* Search Bar */}
      <section id="seller-referrals-search" className="seller-section">
        <div className="seller-search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={translate('Search by name, user ID, or amount...')}
            className="seller-search-bar__input"
            aria-label={translate('Search referrals')}
          />
        </div>
      </section>

      {/* Referrals List */}
      <section id="seller-referrals-list" className="seller-section">
        {loading ? (
          <div className="seller-referrals-empty">
            <UsersIcon className="seller-referrals-empty__icon" />
            <p className="seller-referrals-empty__text"><Trans>Loading referrals...</Trans></p>
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div className="seller-referrals-empty">
            <UsersIcon className="seller-referrals-empty__icon" />
            <p className="seller-referrals-empty__text"><Trans>No referrals found</Trans></p>
            <p className="seller-referrals-empty__subtext">
              {searchQuery ? <Trans>Try adjusting your search or filters</Trans> : <Trans>Start referring users to see them here</Trans>}
            </p>
          </div>
        ) : (
          <div className="seller-referrals-list">
            {filteredReferrals.map((referral) => {
              // Calculate monthly purchases - handle both number and string formats
              const monthlyPurchases = typeof referral.monthlyPurchases === 'number'
                ? referral.monthlyPurchases
                : parseFloat((referral.monthlyPurchases || '0').toString().replace(/[₹,\sL]/g, '')) || 0

              // Always calculate commission rate based on monthlyPurchases (not backend commissionRate)
              const commissionInfo = getCommissionInfo(monthlyPurchases)
              const monthlyPurchaseDisplay = formatCurrency(commissionInfo.purchaseAmount)
              const commissionDisplay = formatCurrency(commissionInfo.commissionAmount)
              const commissionRateLabel = `${Math.round(commissionInfo.rate * 100)}%`
              const amountToNextSlab = Math.max(50000 - commissionInfo.purchaseAmount, 0)
              const amountToNextSlabDisplay = formatCurrency(amountToNextSlab)
              const lifetimeTotal = typeof referral.totalAmount === 'number'
                ? formatCurrency(referral.totalAmount)
                : referral.totalAmount || '₹0'
              const avatar = referral.name ? referral.name.substring(0, 2).toUpperCase() : 'U'
              const status = referral.status || <Trans>Registered</Trans>
              const userId = referral.userId || referral.id || 'N/A'
              const registeredDate = referral.registeredDate || referral.createdAt || new Date().toISOString()
              const totalPurchases = referral.totalPurchases || referral.orderCount || 0
              const lastPurchase = referral.lastPurchase || referral.lastOrderDate
                ? formatDate(referral.lastPurchase || referral.lastOrderDate)
                : <Trans>Never</Trans>

              // Determine commission rate badge style
              const isPremiumRate = commissionInfo.rate >= 0.03

              return (
                <div
                  key={referral.id || referral._id}
                  className={cn('seller-referral-card', expandedId === referral.id && 'is-expanded')}
                >
                  <div
                    className="seller-referral-card__header"
                    onClick={() => setExpandedId(expandedId === referral.id ? null : referral.id)}
                  >
                    <div className="seller-referral-card__avatar">{avatar}</div>
                    <div className="seller-referral-card__info">
                      <div className="seller-referral-card__row">
                        <h3 className="seller-referral-card__name"><TransText>{referral.name || 'User'}</TransText></h3>
                        <div className="seller-referral-card__header-badges">
                          <span
                            className={cn(
                              'seller-referral-card__commission-badge',
                              isPremiumRate ? 'seller-referral-card__commission-badge--premium' : 'seller-referral-card__commission-badge--standard'
                            )}
                            title={`Commission Rate: ${commissionRateLabel} for this month`}
                          >
                            {commissionRateLabel}
                          </span>
                          <span
                            className={cn(
                              'seller-referral-card__status',
                              (status === 'Active' || status === 'active') ? 'is-active' : 'is-registered',
                            )}
                          >
                            <Trans>{status}</Trans>
                          </span>
                        </div>
                      </div>
                      <div className="seller-referral-card__meta">
                        <span className="seller-referral-card__id">{userId}</span>
                        <span className="seller-referral-card__date">
                          <Trans>{`Joined ${formatDate(registeredDate)}`}</Trans>
                        </span>
                      </div>
                    </div>
                    <div className="seller-referral-card__toggle">
                      <TrendingUpIcon
                        className={cn('h-4 w-4', expandedId === referral.id && 'rotate-180')}
                      />
                    </div>
                  </div>

                  {expandedId === referral.id && (
                    <div className="seller-referral-card__details">
                      <div className="seller-referral-card__stats-grid">
                        <div className="seller-referral-stat">
                          <p className="seller-referral-stat__label"><Trans>Total Purchases</Trans></p>
                          <span className="seller-referral-stat__value">{totalPurchases}</span>
                        </div>
                        <div className="seller-referral-stat">
                          <p className="seller-referral-stat__label"><Trans>Lifetime Amount</Trans></p>
                          <span className="seller-referral-stat__value">{lifetimeTotal}</span>
                        </div>
                        <div className="seller-referral-stat">
                          <p className="seller-referral-stat__label">This Month Purchases</p>
                          <span className="seller-referral-stat__value">{monthlyPurchaseDisplay}</span>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.7rem] font-semibold',
                              isPremiumRate ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            )}>
                              <Trans>{`Commission Rate: ${commissionRateLabel}`}</Trans>
                            </span>
                          </div>
                          {commissionInfo.purchaseAmount < 50000 && (
                            <div className="mt-2">
                              {/* Gap 5B: Visual Progress Bar for Commission Threshold */}
                              <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min((commissionInfo.purchaseAmount / 50000) * 100, 100)}%` }}
                                />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[0.65rem]">
                                <span className="text-[rgba(26,42,34,0.6)]">
                                  {Math.round((commissionInfo.purchaseAmount / 50000) * 100)}% to 3%
                                </span>
                                <span className="text-blue-600 font-semibold">
                                  <Trans>{`${amountToNextSlabDisplay} more`}</Trans>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="seller-referral-stat">
                          <p className="seller-referral-stat__label"><Trans>Commission (This Month)</Trans></p>
                          <span className="seller-referral-stat__value seller-referral-stat__value--commission">
                            {commissionDisplay}
                          </span>
                          <p className="mt-1 text-[0.7rem] text-[rgba(26,42,34,0.6)]">
                            <Trans>{`Calculated at ${commissionRateLabel} rate`}</Trans>
                          </p>
                        </div>
                        <div className="seller-referral-stat">
                          <p className="seller-referral-stat__label"><Trans>Last Purchase</Trans></p>
                          <span className="seller-referral-stat__value">{lastPurchase}</span>
                        </div>
                      </div>
                      <div className="seller-referral-card__actions">
                        <button
                          type="button"
                          className="seller-referral-card__action"
                          onClick={() => onNavigate('wallet')}
                        >
                          <WalletIcon className="h-4 w-4" />
                          <Trans>View Transactions</Trans>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Stats (always visible) */}
                  <div className="seller-referral-card__quick-stats">
                    <div className="seller-referral-quick-stat">
                      <span className="seller-referral-quick-stat__label"><Trans>Purchases</Trans></span>
                      <span className="seller-referral-quick-stat__value">{totalPurchases}</span>
                    </div>
                    <div className="seller-referral-quick-stat">
                      <span className="seller-referral-quick-stat__label"><Trans>This Month</Trans></span>
                      <span className="seller-referral-quick-stat__value">{monthlyPurchaseDisplay}</span>
                    </div>
                    <div className="seller-referral-quick-stat seller-referral-quick-stat--commission">
                      <span className="seller-referral-quick-stat__label"><Trans>Commission</Trans></span>
                      <span className="seller-referral-quick-stat__value">{commissionDisplay}</span>
                    </div>
                    <div className={cn(
                      'seller-referral-quick-stat',
                      isPremiumRate ? 'seller-referral-quick-stat--premium' : 'seller-referral-quick-stat--standard'
                    )}>
                      <span className="seller-referral-quick-stat__label"><Trans>Rate</Trans></span>
                      <span className="seller-referral-quick-stat__value">{commissionRateLabel}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

