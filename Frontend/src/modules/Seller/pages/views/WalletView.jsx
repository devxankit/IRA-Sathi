import { useState, useMemo, useEffect, useRef } from 'react'
import { useSellerState } from '../../context/SellerContext'
import { useSellerApi } from '../../hooks/useSellerApi'
import * as sellerApi from '../../services/sellerApi'
import { cn } from '../../../../lib/cn'
import { WalletIcon, TrendingUpIcon, TrendingDownIcon, SparkIcon, ChartIcon, CreditIcon, BankIcon, PlusIcon } from '../../components/icons'
import { Trans } from '../../../../components/Trans'
import { TransText } from '../../../../components/TransText'
import { useTranslation } from '../../../../context/TranslationContext'

const FILTER_TABS = [
  { id: 'all', label: <Trans>All</Trans> },
  { id: 'commission', label: <Trans>Commission</Trans> },
  { id: 'withdrawal', label: <Trans>Withdrawal</Trans> },
]

export function WalletView({ openPanel }) {
  const { dashboard, profile } = useSellerState()
  const { translate } = useTranslation()
  const { fetchWalletData, requestWithdrawal, getBankDetails, updateBankDetails, getCommissionSummary, getBankAccounts } = useSellerApi()
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [showTransactionDetail, setShowTransactionDetail] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [commissionSummary, setCommissionSummary] = useState({
    totalCommission: 0,
    thisMonthCommission: 0,
    availableBalance: 0,
    pendingWithdrawal: 0,
    commissionByRate: { low: 0, high: 0 },
    lastCommissionDate: null,
  })
  const [bankAccounts, setBankAccounts] = useState([])
  const bankAccountsSectionRef = useRef(null)

  const wallet = dashboard.wallet || {}

  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount === 'number') {
      return amount >= 100000
        ? <><Trans>₹</Trans>{(amount / 100000).toFixed(1)} <Trans>L</Trans></>
        : `₹${amount.toLocaleString('en-IN')}`
    }
    return amount || '₹0'
  }

  // Fetch wallet data on mount and when bank accounts are added
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch wallet balance (stored in context)
        await fetchWalletData()

        // Fetch commission summary
        const summaryResult = await getCommissionSummary()
        if (summaryResult.data) {
          setCommissionSummary(summaryResult.data)
        }

        // Fetch bank accounts
        const bankAccountsResult = await getBankAccounts()
        if (bankAccountsResult.data?.bankAccounts) {
          setBankAccounts(bankAccountsResult.data.bankAccounts)
        }

        // Fetch transactions (commissions)
        const transactionsResult = await sellerApi.getWalletTransactions({ limit: 50 })

        // Fetch withdrawal requests
        const withdrawalsResult = await sellerApi.getWithdrawalRequests({ limit: 50 })

        const allTransactions = []

        // Add commission transactions
        if (transactionsResult.success && transactionsResult.data?.transactions) {
          const commissionTransactions = transactionsResult.data.transactions.map((txn) => {
            const userId = txn.userId?._id || txn.userId
            const userName = txn.userId?.name || translate('User')
            const orderNumber = txn.orderId?.orderNumber || translate('N/A')

            return {
              id: txn._id || txn.id,
              type: 'commission',
              transactionType: 'commission',
              amount: txn.commissionAmount || 0,
              description: translate('Commission for order {{orderNumber}}', { orderNumber }),
              note: translate('Commission earned from {{userName}}', { userName }),
              reason: translate('Order {{orderNumber}}', { orderNumber }),
              status: txn.status === 'credited' ? translate('Completed') : txn.status || translate('Completed'),
              date: txn.createdAt || txn.creditedAt,
              createdAt: txn.createdAt || txn.creditedAt,
              userId: userId,
              userName: userName,
              orderId: txn.orderId?._id || txn.orderId,
              orderNumber: orderNumber,
              commissionRate: txn.commissionRate || 0,
              orderAmount: txn.orderAmount || 0,
            }
          })
          allTransactions.push(...commissionTransactions)
        }

        // Add withdrawal transactions
        if (withdrawalsResult.success && withdrawalsResult.data?.withdrawals) {
          const withdrawalTransactions = withdrawalsResult.data.withdrawals.map((wd) => ({
            id: wd._id || wd.id,
            type: 'withdrawal',
            transactionType: 'withdrawal',
            amount: -(wd.amount || 0), // Negative for withdrawals
            description: <Trans>Withdrawal request</Trans>,
            note: wd.notes || translate('Withdrawal of {{amount}}', { amount: formatCurrency(wd.amount) }),
            reason: <Trans>Withdrawal request</Trans>,
            status: wd.status === 'approved' ? translate('Completed') : wd.status === 'rejected' ? translate('Rejected') : translate('Pending'),
            date: wd.createdAt,
            createdAt: wd.createdAt,
            withdrawalId: wd._id || wd.id,
            paymentMethod: wd.paymentMethod || 'bank_transfer',
          }))
          allTransactions.push(...withdrawalTransactions)
        }

        // Sort by date (newest first)
        allTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))

        setTransactions(allTransactions)
      } catch (error) {
        console.error('Failed to fetch wallet data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // Listen for bank account refresh event
    const handleRefresh = () => {
      fetchData()
    }
    window.addEventListener('seller-refresh-bank-accounts', handleRefresh)

    return () => {
      window.removeEventListener('seller-refresh-bank-accounts', handleRefresh)
    }
  }, [fetchWalletData, getCommissionSummary, getBankAccounts, translate])

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (activeFilter === 'all') {
      return transactions
    }
    return transactions.filter((txn) => {
      const type = txn.type || txn.transactionType
      return type === activeFilter || (activeFilter === 'commission' && type === 'credit') || (activeFilter === 'withdrawal' && type === 'debit')
    })
  }, [transactions, activeFilter])


  const getTransactionIcon = (type) => {
    return type === 'commission' ? (
      <TrendingUpIcon className="h-5 w-5" />
    ) : (
      <TrendingDownIcon className="h-5 w-5" />
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return translate('N/A')
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

  const commissionMetrics = [
    { label: <Trans>Total Commission</Trans>, value: formatCurrency(commissionSummary.totalCommission || wallet.totalEarned || 0), icon: WalletIcon, tone: 'success' },
    { label: <Trans>Available Balance</Trans>, value: formatCurrency(commissionSummary.availableBalance || wallet.balance || 0), icon: SparkIcon, tone: 'success' },
    { label: <Trans>Pending Withdrawal</Trans>, value: formatCurrency(commissionSummary.pendingWithdrawal || wallet.pending || 0), icon: CreditIcon, tone: 'warn' },
    { label: <Trans>This Month</Trans>, value: formatCurrency(commissionSummary.thisMonthCommission || 0), icon: ChartIcon, tone: 'teal' },
  ]

  return (
    <div className="seller-wallet space-y-6">
      {/* Wallet Hero Card */}
      <section id="seller-wallet-hero" className="seller-wallet-hero">
        <div className="seller-wallet-hero__card">
          <div className="seller-wallet-hero__header">
            <div>
              <h2 className="seller-wallet-hero__title"><Trans>Wallet</Trans></h2>
              <p className="seller-wallet-hero__subtitle"><Trans>Your earnings & balance</Trans></p>
            </div>
            <div className="seller-wallet-hero__badge">
              <WalletIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="seller-wallet-hero__balance">
            <div>
              <p className="seller-wallet-hero__label"><Trans>Available Balance</Trans></p>
              <p className="seller-wallet-hero__value">{formatCurrency(commissionSummary.availableBalance || wallet.balance || 0)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const balance = commissionSummary.availableBalance || wallet.balance || 0
                if (balance < 5000) {
                  // Warning will be shown in parent component
                }
                openPanel('request-withdrawal', { availableBalance: balance, bankAccounts })
              }}
              className="seller-wallet-hero__cta"
              disabled={bankAccounts.length === 0}
            >
              <Trans>Withdraw</Trans>
            </button>
          </div>
          <div className="seller-wallet-hero__stats">
            <div className="seller-wallet-stat">
              <p className="seller-wallet-stat__label"><Trans>Pending</Trans></p>
              <span className="seller-wallet-stat__value">{formatCurrency(commissionSummary.pendingWithdrawal || wallet.pending || 0)}</span>
            </div>
            <div className="seller-wallet-stat">
              <p className="seller-wallet-stat__label"><Trans>Total Earned</Trans></p>
              <span className="seller-wallet-stat__value">{formatCurrency(commissionSummary.totalCommission || wallet.totalEarned || 0)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openPanel('view-performance')}
            className="seller-wallet-hero__view-earnings"
          >
            <TrendingUpIcon className="h-4 w-4" />
            <Trans>View Earnings</Trans>
          </button>
        </div>
      </section>

      {/* Commission Summary Metrics */}
      <section id="commission-metrics" className="seller-section">
        <div className="seller-section__header">
          <div>
            <h3 className="seller-section__title"><Trans>Commission Summary</Trans></h3>
          </div>
        </div>
        <div className="seller-wallet-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {commissionMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className="seller-wallet-metric-card" style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    background: metric.tone === 'warn' ? '#fef3c7' : metric.tone === 'teal' ? '#d1fae5' : '#dcfce7',
                    color: metric.tone === 'warn' ? '#d97706' : metric.tone === 'teal' ? '#059669' : '#16a34a'
                  }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>{metric.label}</p>
                </div>
                <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>{metric.value}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Commission Rate Breakdown */}
      {(commissionSummary.commissionByRate?.low > 0 || commissionSummary.commissionByRate?.high > 0) && (
        <section id="commission-breakdown" className="seller-section">
          <div className="seller-section__header">
            <div>
              <h3 className="seller-section__title"><Trans>Commission by Rate</Trans></h3>
              <p className="seller-section__subtitle"><Trans>Breakdown of commissions by rate tier</Trans></p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}><Trans>2% Commission (Up to ₹50,000)</Trans></p>
              <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827' }}>{formatCurrency(commissionSummary.commissionByRate.low || 0)}</p>
            </div>
            <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}><Trans>3% Commission (Above ₹50,000)</Trans></p>
              <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827' }}>{formatCurrency(commissionSummary.commissionByRate.high || 0)}</p>
            </div>
          </div>
        </section>
      )}

      {/* Bank Account Management */}
      <section id="bank-accounts" ref={bankAccountsSectionRef} className="seller-section">
        <div className="seller-section__header">
          <div>
            <h3 className="seller-section__title"><Trans>Bank Accounts</Trans></h3>
            <p className="seller-section__subtitle"><Trans>Manage your bank accounts for withdrawals</Trans></p>
          </div>
          {bankAccounts.length === 0 && (
            <button
              type="button"
              onClick={() => {
                openPanel('add-bank-account')
                // Scroll to bank accounts section after a short delay to allow panel to open
                setTimeout(() => {
                  if (bankAccountsSectionRef.current) {
                    bankAccountsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }, 300)
              }}
              className="seller-section__cta"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <PlusIcon className="h-4 w-4" />
              <Trans>Add Account</Trans>
            </button>
          )}
        </div>
        {bankAccounts.length === 0 ? (
          <div className="seller-wallet-empty">
            <BankIcon className="seller-wallet-empty__icon" />
            <p className="seller-wallet-empty__text"><Trans>No bank accounts added yet</Trans></p>
            <p className="seller-wallet-empty__subtext"><Trans>Please add a bank account to receive withdrawals</Trans></p>
          </div>
        ) : (
          <div className="seller-bank-accounts-list">
            {bankAccounts.map((account) => (
              <div key={account._id || account.id} className="seller-bank-account-card">
                <div className="seller-bank-account-card__icon">
                  <BankIcon className="h-6 w-6" />
                </div>
                <div className="seller-bank-account-card__content">
                  <h4 className="seller-bank-account-card__name">{account.accountHolderName}</h4>
                  <div className="seller-bank-account-card__details">
                    <span className="seller-bank-account-card__account-number">**** {account.accountNumber?.slice(-4) || translate('N/A')}</span>
                    <span className="seller-bank-account-card__separator">•</span>
                    <span className="seller-bank-account-card__bank">{account.bankName}</span>
                  </div>
                  <p className="seller-bank-account-card__ifsc">IFSC: {account.ifscCode}</p>
                </div>
                <div className="seller-bank-account-card__badge">
                  <span><Trans>Active</Trans></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filter Tabs */}
      <section id="seller-wallet-filters" className="seller-section">
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

      {/* Transactions List */}
      <section id="seller-wallet-transactions" className="seller-section">
        <div className="seller-section__header">
          <div>
            <h3 className="seller-section__title"><Trans>Transaction History</Trans></h3>
            <p className="seller-section__subtitle"><TransText>{filteredTransactions.length} transactions</TransText></p>
          </div>
        </div>
        {loading ? (
          <div className="seller-wallet-empty">
            <WalletIcon className="seller-wallet-empty__icon" />
            <p className="seller-wallet-empty__text"><Trans>Loading transactions...</Trans></p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="seller-wallet-empty">
            <WalletIcon className="seller-wallet-empty__icon" />
            <p className="seller-wallet-empty__text"><Trans>No transactions found</Trans></p>
            <p className="seller-wallet-empty__subtext">
              {activeFilter === 'all'
                ? <Trans>Your transaction history will appear here</Trans>
                : translate('No {{activeFilter}} transactions yet', { activeFilter })}
            </p>
          </div>
        ) : (
          <div className="seller-wallet-transactions">
            {filteredTransactions.map((transaction) => {
              const type = transaction.type || transaction.transactionType || 'commission'
              const isCredit = type === 'commission' || type === 'credit' || (transaction.amount && transaction.amount > 0)
              const amount = typeof transaction.amount === 'number'
                ? (isCredit ? `+₹${transaction.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(transaction.amount).toLocaleString('en-IN')}`)
                : transaction.amount || '₹0'
              const description = transaction.description || transaction.note || transaction.reason || translate('Transaction')
              const status = transaction.status || translate('Completed')
              const date = transaction.date || transaction.createdAt || new Date().toISOString()

              return (
                <div
                  key={transaction.id || transaction._id}
                  className="seller-transaction-card"
                  onClick={() => {
                    setSelectedTransaction(transaction)
                    setShowTransactionDetail(true)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="seller-transaction-card__icon">
                    <div
                      className={cn(
                        'seller-transaction-icon',
                        isCredit ? 'is-credit' : 'is-debit',
                      )}
                    >
                      {getTransactionIcon(type)}
                    </div>
                  </div>
                  <div className="seller-transaction-card__info">
                    <div className="seller-transaction-card__row">
                      <h4 className="seller-transaction-card__description"><TransText>{description}</TransText></h4>
                      <span
                        className={cn(
                          'seller-transaction-card__amount',
                          amount.startsWith('+') ? 'is-credit' : 'is-debit',
                        )}
                      >
                        {amount}
                      </span>
                    </div>
                    <div className="seller-transaction-card__meta">
                      <span
                        className={cn(
                          'seller-transaction-card__type',
                          isCredit ? 'is-commission' : 'is-withdrawal',
                        )}
                      >
                        {isCredit ? <Trans>Commission</Trans> : <Trans>Withdrawal</Trans>}
                      </span>
                      <span className="seller-transaction-card__date">{formatDate(date)}</span>
                      <span
                        className={cn(
                          'seller-transaction-card__status',
                          (status === 'Completed' || status === 'completed') ? 'is-completed' : 'is-pending',
                        )}
                      >
                        <TransText>{status}</TransText>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Transaction Detail Sheet */}
      {selectedTransaction && showTransactionDetail && (
        <div className={cn('seller-activity-sheet', showTransactionDetail && 'is-open')}>
          <div
            className={cn('seller-activity-sheet__overlay', showTransactionDetail && 'is-open')}
            onClick={() => {
              setShowTransactionDetail(false)
              setTimeout(() => setSelectedTransaction(null), 260)
            }}
          />
          <div className={cn('seller-activity-sheet__panel', showTransactionDetail && 'is-open')}>
            <div className="seller-activity-sheet__header">
              <h4><Trans>Transaction Details</Trans></h4>
              <button
                type="button"
                onClick={() => {
                  setShowTransactionDetail(false)
                  setTimeout(() => setSelectedTransaction(null), 260)
                }}
              >
                <Trans>Close</Trans>
              </button>
            </div>
            <div className="seller-activity-sheet__body">
              <div className="seller-transaction-detail">
                <div className="seller-transaction-detail__header">
                  <div
                    className={cn(
                      'seller-transaction-icon',
                      (selectedTransaction.type === 'commission' || selectedTransaction.type === 'credit') ? 'is-credit' : 'is-debit',
                    )}
                  >
                    {getTransactionIcon(selectedTransaction.type || selectedTransaction.transactionType)}
                  </div>
                  <div className="seller-transaction-detail__info">
                    <h3 className="seller-transaction-detail__description">
                      <TransText>{selectedTransaction.description || selectedTransaction.note || 'Transaction'}</TransText>
                    </h3>
                    <span
                      className={cn(
                        'seller-transaction-detail__amount',
                        (selectedTransaction.amount && selectedTransaction.amount.toString().startsWith('+')) || (typeof selectedTransaction.amount === 'number' && selectedTransaction.amount > 0) ? 'is-credit' : 'is-debit',
                      )}
                    >
                      {typeof selectedTransaction.amount === 'number'
                        ? (selectedTransaction.amount > 0 ? `+₹${selectedTransaction.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(selectedTransaction.amount).toLocaleString('en-IN')}`)
                        : selectedTransaction.amount || '₹0'}
                    </span>
                  </div>
                </div>
                <div className="seller-transaction-detail__meta">
                  <div className="seller-transaction-detail__meta-item">
                    <span className="seller-transaction-detail__meta-label"><Trans>Type</Trans></span>
                    <span
                      className={cn(
                        'seller-transaction-card__type',
                        (selectedTransaction.type === 'commission' || selectedTransaction.type === 'credit') ? 'is-commission' : 'is-withdrawal',
                      )}
                    >
                      {(selectedTransaction.type === 'commission' || selectedTransaction.type === 'credit') ? <Trans>Commission</Trans> : <Trans>Withdrawal</Trans>}
                    </span>
                  </div>
                  <div className="seller-transaction-detail__meta-item">
                    <span className="seller-transaction-detail__meta-label"><Trans>Status</Trans></span>
                    <span
                      className={cn(
                        'seller-transaction-card__status',
                        (selectedTransaction.status === 'Completed' || selectedTransaction.status === 'completed') ? 'is-completed' : 'is-pending',
                      )}
                    >
                      <TransText>{selectedTransaction.status || 'Completed'}</TransText>
                    </span>
                  </div>
                  <div className="seller-transaction-detail__meta-item">
                    <span className="seller-transaction-detail__meta-label"><Trans>Date</Trans></span>
                    <span className="seller-transaction-detail__meta-value">
                      {(() => {
                        const dateString = selectedTransaction.date || selectedTransaction.createdAt
                        if (!dateString) return 'N/A'
                        try {
                          const date = new Date(dateString)
                          const now = new Date()
                          const diff = now - date
                          const minutes = Math.floor(diff / 60000)
                          const hours = Math.floor(diff / 3600000)
                          const days = Math.floor(diff / 86400000)

                          if (minutes < 1) return <Trans>Just now</Trans>
                          if (minutes < 60) return <Trans>{`${minutes}m ago`}</Trans>
                          if (hours < 24) return <Trans>{`${hours}h ago`}</Trans>
                          if (days < 7) return <Trans>{`${days}d ago`}</Trans>
                          return date.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        } catch {
                          return dateString
                        }
                      })()}
                    </span>
                  </div>
                  <div className="seller-transaction-detail__meta-item">
                    <span className="seller-transaction-detail__meta-label"><Trans>Transaction ID</Trans></span>
                    <span className="seller-transaction-detail__meta-value">{selectedTransaction.id || selectedTransaction._id || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

