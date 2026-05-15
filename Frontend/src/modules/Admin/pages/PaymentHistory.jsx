import { useState, useEffect, useCallback } from 'react'
import { History, IndianRupee, Filter, Search, Calendar, TrendingUp, TrendingDown, Wallet, Factory, ShieldCheck, Users, X, Loader2 } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { cn } from '../../../lib/cn'

const columns = [
  { Header: 'Date', accessor: 'date' },
  { Header: 'Activity Type', accessor: 'activityType' },
  { Header: 'Entity', accessor: 'entity' },
  { Header: 'Amount', accessor: 'amount' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Description', accessor: 'description' },
]

// All activity types from PaymentHistory model
const ACTIVITY_TYPES = [
  { value: 'all', label: 'All Activities' },
  // User Payments
  { value: 'user_payment_advance', label: 'User Advance Payments' },
  { value: 'user_payment_remaining', label: 'User Remaining Payments' },
  // Vendor Payments
  { value: 'vendor_earning_credited', label: 'Vendor Earnings Credited' },
  { value: 'vendor_credit_repayment', label: 'Vendor Credit Repayments' },
  { value: 'vendor_withdrawal_requested', label: 'Vendor Withdrawal Requests' },
  { value: 'vendor_withdrawal_approved', label: 'Vendor Withdrawals Approved' },
  { value: 'vendor_withdrawal_rejected', label: 'Vendor Withdrawals Rejected' },
  { value: 'vendor_withdrawal_completed', label: 'Vendor Withdrawals Completed' },
  // Seller Payments
  { value: 'seller_commission_credited', label: 'Seller Commissions Credited' },
  { value: 'seller_withdrawal_requested', label: 'Seller Withdrawal Requests' },
  { value: 'seller_withdrawal_approved', label: 'Seller Withdrawals Approved' },
  { value: 'seller_withdrawal_rejected', label: 'Seller Withdrawals Rejected' },
  { value: 'seller_withdrawal_completed', label: 'Seller Withdrawals Completed' },
  // Bank Account Operations
  { value: 'bank_account_added', label: 'Bank Account Added' },
  { value: 'bank_account_updated', label: 'Bank Account Updated' },
  { value: 'bank_account_deleted', label: 'Bank Account Deleted' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'credited', label: 'Credited' },
]

export function PaymentHistoryPage() {
  const { getPaymentHistory, getPaymentHistoryStats, getUsers, getVendors, getSellers, getOrders, loading } = useAdminApi()
  const { error: showError } = useToast()

  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({
    totalUserPayments: 0,
    totalVendorEarnings: 0,
    totalSellerCommissions: 0,
    totalVendorWithdrawals: 0,
    totalSellerWithdrawals: 0,
    totalActivities: 0,
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = useState({
    activityType: 'all',
    status: 'all',
    search: '',
    startDate: '',
    endDate: '',
    userId: '',
    vendorId: '',
    sellerId: '',
    orderId: '',
    minAmount: '',
    maxAmount: '',
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // Options for entity filters
  const [userOptions, setUserOptions] = useState([])
  const [vendorOptions, setVendorOptions] = useState([])
  const [sellerOptions, setSellerOptions] = useState([])
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [vendorSearchQuery, setVendorSearchQuery] = useState('')
  const [sellerSearchQuery, setSellerSearchQuery] = useState('')

  // Fetch entity options for filters
  useEffect(() => {
    const fetchEntityOptions = async () => {
      try {
        // Fetch users for filter dropdown
        const usersResult = await getUsers({ limit: 100 })
        if (usersResult.data?.users) {
          setUserOptions(usersResult.data.users)
        }

        // Fetch vendors for filter dropdown
        const vendorsResult = await getVendors({ limit: 100 })
        if (vendorsResult.data?.vendors) {
          setVendorOptions(vendorsResult.data.vendors)
        }

        // Fetch sellers for filter dropdown
        const sellersResult = await getSellers({ limit: 100 })
        if (sellersResult.data?.sellers) {
          setSellerOptions(sellersResult.data.sellers)
        }
      } catch (error) {
        console.error('Failed to fetch entity options:', error)
      }
    }
    fetchEntityOptions()
  }, [getUsers, getVendors, getSellers])

  const fetchHistory = useCallback(async () => {
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.activityType !== 'all' && { activityType: filters.activityType }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.vendorId && { vendorId: filters.vendorId }),
        ...(filters.sellerId && { sellerId: filters.sellerId }),
        ...(filters.orderId && { orderId: filters.orderId }),
      }

      console.log('🔍 [PaymentHistory Frontend] Fetching with params:', params);
      const result = await getPaymentHistory(params)
      console.log('📊 [PaymentHistory Frontend] API Response:', {
        success: result.success,
        historyCount: result.data?.history?.length || 0,
        pagination: result.data?.pagination,
        summary: result.data?.summary,
        hasData: !!result.data,
        hasHistory: !!result.data?.history,
      });
      
      // Check if we have data (either from result.data.history or result.data directly)
      const historyData = result.data?.history || (Array.isArray(result.data) ? result.data : [])
      
      if (historyData.length > 0 || result.data) {
        const originalTotal = result.data?.pagination?.total || historyData.length
        let filteredHistoryData = [...historyData]
        
        // Apply amount range filter on frontend if provided
        // Note: This filters only the current page of results
        if (filters.minAmount || filters.maxAmount) {
          const minAmount = filters.minAmount ? parseFloat(filters.minAmount) : 0
          const maxAmount = filters.maxAmount ? parseFloat(filters.maxAmount) : Infinity
          filteredHistoryData = filteredHistoryData.filter(item => {
            const amount = item.amount || 0
            return amount >= minAmount && amount <= maxAmount
          })
        }

        console.log(`✅ [PaymentHistory Frontend] Setting ${filteredHistoryData.length} history records (from ${historyData.length} total)`);
        setHistory(filteredHistoryData)
        setPagination((prev) => ({
          ...prev,
          // Note: When amount filter is active, total may not be accurate as it only filters current page
          total: (filters.minAmount || filters.maxAmount) ? filteredHistoryData.length : originalTotal,
          totalPages: (filters.minAmount || filters.maxAmount) 
            ? (filteredHistoryData.length > 0 ? 1 : 0) // Show as single page when filtering
            : (result.data?.pagination?.totalPages || Math.ceil(originalTotal / prev.limit)),
        }))
      } else if (result.error) {
        console.error('❌ [PaymentHistory Frontend] API Error:', result.error);
        showError(result.error.message || 'Failed to fetch payment history', 5000)
        setHistory([])
      } else {
        console.warn('⚠️ [PaymentHistory Frontend] No data in response:', result);
        setHistory([])
      }
    } catch (error) {
      console.error('❌ [PaymentHistory Frontend] Exception:', error)
      showError(error.message || 'Failed to fetch payment history', 5000)
    }
  }, [getPaymentHistory, pagination.page, pagination.limit, filters, showError])

  const fetchStats = useCallback(async () => {
    try {
      const params = {
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
      }
      console.log('📊 [PaymentHistory Frontend] Fetching stats with params:', params);
      const result = await getPaymentHistoryStats(params)
      console.log('📊 [PaymentHistory Frontend] Stats response:', result);
      if (result.success && result.data) {
        console.log('✅ [PaymentHistory Frontend] Setting stats:', result.data);
        setStats(result.data)
      } else {
        console.warn('⚠️ [PaymentHistory Frontend] Stats response missing data:', result);
      }
    } catch (error) {
      console.error('❌ [PaymentHistory Frontend] Failed to fetch stats:', error)
    }
  }, [getPaymentHistoryStats, filters.startDate, filters.endDate, filters.status])

  useEffect(() => {
    fetchHistory()
    fetchStats()
  }, [fetchHistory, fetchStats])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      activityType: 'all',
      status: 'all',
      search: '',
      startDate: '',
      endDate: '',
      userId: '',
      vendorId: '',
      sellerId: '',
      orderId: '',
      minAmount: '',
      maxAmount: '',
    })
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters = () => {
    return filters.activityType !== 'all' ||
           filters.status !== 'all' ||
           filters.search ||
           filters.startDate ||
           filters.endDate ||
           filters.userId ||
           filters.vendorId ||
           filters.sellerId ||
           filters.orderId ||
           filters.minAmount ||
           filters.maxAmount
  }

  const formatCurrency = (value) => {
    if (typeof value === 'string') return value
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
    return `₹${value.toLocaleString('en-IN')}`
  }

  const formatActivityType = (type) => {
    const typeMap = {
      user_payment_advance: 'User Advance Payment',
      user_payment_remaining: 'User Remaining Payment',
      vendor_earning_credited: 'Vendor Earning Credited',
      vendor_credit_repayment: 'Vendor Credit Repayment',
      seller_commission_credited: 'Seller Commission Credited',
      vendor_withdrawal_requested: 'Vendor Withdrawal Request',
      vendor_withdrawal_approved: 'Vendor Withdrawal Approved',
      vendor_withdrawal_rejected: 'Vendor Withdrawal Rejected',
      vendor_withdrawal_completed: 'Vendor Withdrawal Completed',
      seller_withdrawal_requested: 'Seller Withdrawal Request',
      seller_withdrawal_approved: 'Seller Withdrawal Approved',
      seller_withdrawal_rejected: 'Seller Withdrawal Rejected',
      seller_withdrawal_completed: 'Seller Withdrawal Completed',
      bank_account_added: 'Bank Account Added',
      bank_account_updated: 'Bank Account Updated',
      bank_account_deleted: 'Bank Account Deleted',
    }
    return typeMap[type] || type
  }

  const getActivityIcon = (type) => {
    if (type.includes('user_payment')) return Users
    if (type.includes('vendor')) return Factory
    if (type.includes('seller')) return ShieldCheck
    if (type.includes('bank_account')) return Wallet
    return Wallet
  }

  const getActivityColor = (type) => {
    if (type.includes('user_payment')) return 'blue'
    if (type.includes('vendor_earning')) return 'green'
    if (type.includes('vendor_credit_repayment')) return 'teal'
    if (type.includes('seller_commission')) return 'yellow'
    if (type.includes('withdrawal')) return 'orange'
    if (type.includes('bank_account')) return 'purple'
    return 'gray'
  }

  const tableColumns = columns.map((column) => {
    if (column.accessor === 'date') {
      return {
        ...column,
        Cell: (row) => {
          const date = row.createdAt || row.processedAt
          return date ? new Date(date).toLocaleString('en-IN') : 'N/A'
        },
      }
    }
    if (column.accessor === 'activityType') {
      return {
        ...column,
        Cell: (row) => {
          const Icon = getActivityIcon(row.activityType)
          const color = getActivityColor(row.activityType)
          return (
            <div className="flex items-center gap-2">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', {
                'bg-blue-100 text-blue-600': color === 'blue',
                'bg-[rgba(1,120,39,0.1)] text-[#017827]': color === 'green',
                'bg-teal-100 text-teal-600': color === 'teal',
                'bg-yellow-100 text-yellow-600': color === 'yellow',
                'bg-orange-100 text-orange-600': color === 'orange',
                'bg-purple-100 text-purple-600': color === 'purple',
                'bg-gray-100 text-gray-600': color === 'gray',
              })}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{formatActivityType(row.activityType)}</span>
            </div>
          )
        },
      }
    }
    if (column.accessor === 'entity') {
      return {
        ...column,
        Cell: (row) => {
          if (row.vendor?.name) {
            return <span className="text-sm">Vendor: {row.vendor.name} ({row.vendor.vendorId || row.vendor.phone})</span>
          }
          if (row.seller?.name) {
            return <span className="text-sm">Seller: {row.seller.name} ({row.seller.sellerId || row.seller.phone})</span>
          }
          if (row.user?.name) {
            return <span className="text-sm">User: {row.user.name} ({row.user.userId || row.user.phone})</span>
          }
          if (row.order?.orderNumber) {
            return <span className="text-sm">Order: {row.order.orderNumber}</span>
          }
          return <span className="text-sm text-gray-400">N/A</span>
        },
      }
    }
    if (column.accessor === 'amount') {
      return {
        ...column,
        Cell: (row) => (
          <span className={cn('text-sm font-bold', {
            'text-[#017827]': row.activityType.includes('earning') || row.activityType.includes('commission'),
            'text-teal-600': row.activityType.includes('credit_repayment'),
            'text-red-600': row.activityType.includes('withdrawal'),
            'text-blue-600': row.activityType.includes('payment'),
            'text-gray-900': !row.activityType || row.activityType.includes('bank_account'),
          })}>
            {formatCurrency(row.amount || 0)}
          </span>
        ),
      }
    }
    if (column.accessor === 'status') {
      return {
        ...column,
        Cell: (row) => {
          const status = row.status || 'completed'
          const tone = status === 'completed' || status === 'credited' || status === 'approved' ? 'success' 
            : status === 'pending' || status === 'requested' ? 'warning' 
            : status === 'rejected' || status === 'failed' || status === 'cancelled' ? 'neutral' 
            : 'default'
          return <StatusBadge tone={tone}>{status.charAt(0).toUpperCase() + status.slice(1)}</StatusBadge>
        },
      }
    }
    if (column.accessor === 'description') {
      return {
        ...column,
        Cell: (row) => (
          <span className="text-sm text-gray-600">
            {row.description || row.formattedDescription || row.metadata?.orderNumber || 'N/A'}
          </span>
        ),
      }
    }
    return column
  })

  // Filter entity options based on search
  const filteredUserOptions = userOptions.filter(user => 
    !userSearchQuery || 
    user.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.phone?.includes(userSearchQuery) ||
    user.userId?.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  const filteredVendorOptions = vendorOptions.filter(vendor => 
    !vendorSearchQuery || 
    vendor.name?.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
    vendor.phone?.includes(vendorSearchQuery) ||
    vendor.vendorId?.toLowerCase().includes(vendorSearchQuery.toLowerCase())
  )

  const filteredSellerOptions = sellerOptions.filter(seller => 
    !sellerSearchQuery || 
    seller.name?.toLowerCase().includes(sellerSearchQuery.toLowerCase()) ||
    seller.phone?.includes(sellerSearchQuery) ||
    seller.sellerId?.toLowerCase().includes(sellerSearchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Finance • History</p>
          <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
          <p className="text-sm text-gray-600">Complete audit log of all payment, earnings, and withdrawal activities</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-3xl border border-blue-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-gray-600">User Payments</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalUserPayments || 0)}</p>
        </div>
        <div className="rounded-3xl border border-[rgba(1,120,39,0.25)] bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <Factory className="h-4 w-4 text-[#017827]" />
            <p className="text-xs text-gray-600">Vendor Earnings</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalVendorEarnings || 0)}</p>
        </div>
        <div className="rounded-3xl border border-yellow-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-yellow-600" />
            <p className="text-xs text-gray-600">Seller Commissions</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalSellerCommissions || 0)}</p>
        </div>
        <div className="rounded-3xl border border-orange-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-orange-600" />
            <p className="text-xs text-gray-600">Vendor Withdrawals</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalVendorWithdrawals || 0)}</p>
        </div>
        <div className="rounded-3xl border border-orange-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-orange-600" />
            <p className="text-xs text-gray-600">Seller Withdrawals</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalSellerWithdrawals || 0)}</p>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4 text-gray-600" />
            <p className="text-xs text-gray-600">Total Activities</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.totalActivities || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Filters</span>
            {hasActiveFilters() && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-2 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
              >
                <X className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="ml-auto text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          </button>
        </div>

        {/* Basic Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <select
              value={filters.activityType}
              onChange={(e) => handleFilterChange('activityType', e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-w-[200px]"
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-w-[150px]"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="border-none bg-transparent text-sm outline-none"
              placeholder="Start Date"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="border-none bg-transparent text-sm outline-none"
              placeholder="End Date"
            />
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 min-w-[250px]">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by description, order number, name..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="flex-1 border-none bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* User Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Filter by User</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search user..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                {filters.userId && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('userId', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {userSearchQuery && filteredUserOptions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredUserOptions.slice(0, 10).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        handleFilterChange('userId', user.id)
                        setUserSearchQuery('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {user.name} ({user.phone || user.userId})
                    </button>
                  ))}
                </div>
              )}
              {filters.userId && (
                <div className="mt-1 flex items-center gap-2 rounded bg-blue-50 px-2 py-1 text-xs">
                  <span className="text-blue-700">
                    {userOptions.find(u => u.id === filters.userId)?.name || 'Selected User'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('userId', '')}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Vendor Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Filter by Vendor</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search vendor..."
                  value={vendorSearchQuery}
                  onChange={(e) => setVendorSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                {filters.vendorId && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('vendorId', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {vendorSearchQuery && filteredVendorOptions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredVendorOptions.slice(0, 10).map((vendor) => (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => {
                        handleFilterChange('vendorId', vendor.id)
                        setVendorSearchQuery('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {vendor.name} ({vendor.phone || vendor.vendorId})
                    </button>
                  ))}
                </div>
              )}
              {filters.vendorId && (
                <div className="mt-1 flex items-center gap-2 rounded bg-[rgba(1,120,39,0.04)] px-2 py-1 text-xs">
                  <span className="text-[#017827]">
                    {vendorOptions.find(v => v.id === filters.vendorId)?.name || 'Selected Vendor'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('vendorId', '')}
                    className="text-[#017827] hover:text-[#015c1f]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Seller Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Filter by Seller</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search seller..."
                  value={sellerSearchQuery}
                  onChange={(e) => setSellerSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                {filters.sellerId && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('sellerId', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {sellerSearchQuery && filteredSellerOptions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredSellerOptions.slice(0, 10).map((seller) => (
                    <button
                      key={seller.id}
                      type="button"
                      onClick={() => {
                        handleFilterChange('sellerId', seller.id)
                        setSellerSearchQuery('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {seller.name} ({seller.phone || seller.sellerId})
                    </button>
                  ))}
                </div>
              )}
              {filters.sellerId && (
                <div className="mt-1 flex items-center gap-2 rounded bg-yellow-50 px-2 py-1 text-xs">
                  <span className="text-yellow-700">
                    {sellerOptions.find(s => s.id === filters.sellerId)?.name || 'Selected Seller'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('sellerId', '')}
                    className="text-yellow-600 hover:text-yellow-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Order ID Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Filter by Order ID</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter order number..."
                  value={filters.orderId}
                  onChange={(e) => handleFilterChange('orderId', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                {filters.orderId && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('orderId', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Amount Range Filters */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Min Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minAmount}
                onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Max Amount (₹)</label>
              <input
                type="number"
                placeholder="No limit"
                value={filters.maxAmount}
                onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
        {loading && history.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <DataTable
              columns={tableColumns}
              rows={history}
              emptyState="No payment history found matching your filters"
              loading={loading}
            />
            {pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1 || loading}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
