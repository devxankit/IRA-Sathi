import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, IndianRupee, Calendar, Building2, Eye, CheckCircle, XCircle, Clock, Filter, CreditCard } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { cn } from '../../../lib/cn'

const columns = [
  { Header: 'Repayment ID', accessor: 'repaymentId' },
  { Header: 'Vendor', accessor: 'vendorName' },
  { Header: 'Amount', accessor: 'amount' },
  { Header: 'Penalty', accessor: 'penaltyAmount' },
  { Header: 'Total', accessor: 'totalAmount' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Payment Method', accessor: 'paymentMethod' },
  { Header: 'Date', accessor: 'date' },
  { Header: 'Actions', accessor: 'actions' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function RepaymentsPage({ navigate }) {
  const {
    getRepayments,
    getRepaymentDetails,
    getVendors,
    loading,
  } = useAdminApi()
  const { success, error: showError } = useToast()

  const [repayments, setRepayments] = useState([])
  const [summary, setSummary] = useState({
    totalCompleted: 0,
    totalPending: 0,
    totalFailed: 0,
    totalRepaid: 0,
    totalPenaltyPaid: 0,
  })
  const [vendors, setVendors] = useState([])
  const [selectedRepayment, setSelectedRepayment] = useState(null)
  const [repaymentDetails, setRepaymentDetails] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    vendorId: '',
    startDate: '',
    endDate: '',
  })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  })

  // Format currency
  const formatCurrency = (value) => {
    if (typeof value === 'string') return value
    if (!value && value !== 0) return '₹0'
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
    return `₹${Math.round(value).toLocaleString('en-IN')}`
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return 'N/A'
    }
  }

  // Format date with time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'N/A'
    }
  }

  // Fetch vendors for filter
  const fetchVendors = useCallback(async () => {
    try {
      const result = await getVendors({ limit: 1000 })
      if (result.data?.vendors) {
        setVendors(result.data.vendors)
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error)
    }
  }, [getVendors])

  // Fetch repayments
  const fetchRepayments = useCallback(async () => {
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
      }

      if (filters.status) params.status = filters.status
      if (filters.vendorId) params.vendorId = filters.vendorId
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const result = await getRepayments(params)

      if (result.data) {
        // Transform repayments for display
        const transformedRepayments = (result.data.repayments || []).map((repayment) => ({
          id: repayment._id || repayment.id,
          repaymentId: repayment.repaymentId || repayment._id?.toString().slice(-8) || 'N/A',
          vendorId: repayment.vendorId?._id || repayment.vendorId?.id || repayment.vendorId,
          vendorName: repayment.vendorId?.name || 'N/A',
          vendorPhone: repayment.vendorId?.phone || 'N/A',
          amount: repayment.amount || 0,
          penaltyAmount: repayment.penaltyAmount || 0,
          totalAmount: repayment.totalAmount || repayment.amount || 0,
          status: repayment.status || 'pending',
          paymentMethod: repayment.paymentMethod || 'razorpay',
          creditUsedBefore: repayment.creditUsedBefore || 0,
          creditUsedAfter: repayment.creditUsedAfter || 0,
          date: repayment.createdAt || repayment.paidAt || new Date().toISOString(),
          paidAt: repayment.paidAt,
          bankAccount: repayment.bankAccountId,
          razorpayOrderId: repayment.razorpayOrderId,
          razorpayPaymentId: repayment.razorpayPaymentId,
        }))

        setRepayments(transformedRepayments)
        setSummary(result.data.summary || summary)
        setPagination(result.data.pagination || pagination)
      }
    } catch (error) {
      console.error('Failed to fetch repayments:', error)
      showError('Failed to load repayments', 5000)
    }
  }, [getRepayments, filters, pagination.currentPage, pagination.itemsPerPage])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  useEffect(() => {
    fetchRepayments()
  }, [fetchRepayments])

  const handleViewDetails = async (repayment) => {
    try {
      const result = await getRepaymentDetails(repayment.id)
      if (result.data?.repayment) {
        setRepaymentDetails(result.data.repayment)
        setSelectedRepayment(repayment)
        setShowDetails(true)
      }
    } catch (error) {
      showError('Failed to load repayment details', 5000)
    }
  }

  const handleBackToList = () => {
    setShowDetails(false)
    setSelectedRepayment(null)
    setRepaymentDetails(null)
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, currentPage: 1 }))
  }

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }))
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      completed: { tone: 'success', label: 'Completed' },
      pending: { tone: 'warning', label: 'Pending' },
      processing: { tone: 'info', label: 'Processing' },
      failed: { tone: 'error', label: 'Failed' },
      cancelled: { tone: 'neutral', label: 'Cancelled' },
    }
    const statusInfo = statusMap[status] || { tone: 'neutral', label: status }
    return <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>
  }

  const tableColumns = columns.map((column) => {
    if (column.accessor === 'status') {
      return {
        ...column,
        Cell: (row) => getStatusBadge(row.status),
      }
    }
    if (column.accessor === 'amount' || column.accessor === 'penaltyAmount' || column.accessor === 'totalAmount') {
      return {
        ...column,
        Cell: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row[column.accessor])}
          </span>
        ),
      }
    }
    if (column.accessor === 'date') {
      return {
        ...column,
        Cell: (row) => (
          <span className="text-sm text-gray-600">
            {formatDate(row.date)}
          </span>
        ),
      }
    }
    if (column.accessor === 'paymentMethod') {
      return {
        ...column,
        Cell: (row) => (
          <span className="text-sm text-gray-600 capitalize">
            {row.paymentMethod === 'razorpay' ? 'Razorpay' : row.paymentMethod || 'N/A'}
          </span>
        ),
      }
    }
    if (column.accessor === 'actions') {
      return {
        ...column,
        Cell: (row) => (
          <button
            type="button"
            onClick={() => handleViewDetails(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
            title="View repayment details"
          >
            <Eye className="h-4 w-4" />
          </button>
        ),
      }
    }
    return column
  })

  // Show repayment details screen
  if (showDetails && selectedRepayment && repaymentDetails) {
    const repayment = repaymentDetails
    const vendor = repayment.vendorId || {}
    const bankAccount = repayment.bankAccountId || {}

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Repayments
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Credit & Finance</p>
            <h2 className="text-2xl font-bold text-gray-900">Repayment Details</h2>
            <p className="text-sm text-gray-600">
              View detailed information about repayment {repayment.repaymentId || selectedRepayment.repaymentId}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Repayment Info */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Repayment Information</h3>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Repayment ID</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">{repayment.repaymentId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <div className="mt-1">{getStatusBadge(repayment.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(repayment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Penalty</p>
                    <p className="mt-1 text-lg font-bold text-red-600">{formatCurrency(repayment.penaltyAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Amount</p>
                    <p className="mt-1 text-lg font-bold text-[#017827]">{formatCurrency(repayment.totalAmount || repayment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payment Method</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 capitalize">
                      {repayment.paymentMethod === 'razorpay' ? 'Razorpay' : repayment.paymentMethod || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created At</p>
                    <p className="mt-1 text-sm text-gray-900">{formatDateTime(repayment.createdAt)}</p>
                  </div>
                  {repayment.paidAt && (
                    <div>
                      <p className="text-xs text-gray-500">Paid At</p>
                      <p className="mt-1 text-sm text-gray-900">{formatDateTime(repayment.paidAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vendor Info */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Vendor Information</h3>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900">{vendor.name || 'N/A'}</h4>
                  <p className="text-sm text-gray-600">Phone: {vendor.phone || 'N/A'}</p>
                  {vendor.email && (
                    <p className="text-sm text-gray-600">Email: {vendor.email}</p>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-500">Credit Before</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">{formatCurrency(repayment.creditUsedBefore || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Credit After</p>
                      <p className="mt-1 text-sm font-bold text-[#017827]">{formatCurrency(repayment.creditUsedAfter || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Account Info */}
            {bankAccount && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Bank Account</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Account Holder</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{bankAccount.accountHolderName || 'N/A'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-500">Bank Name</p>
                      <p className="mt-1 text-sm text-gray-900">{bankAccount.bankName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Account Number</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {bankAccount.accountNumber ? `****${bankAccount.accountNumber.slice(-4)}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">IFSC Code</p>
                      <p className="mt-1 text-sm text-gray-900">{bankAccount.ifscCode || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Gateway Info */}
            {(repayment.razorpayOrderId || repayment.razorpayPaymentId) && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Payment Gateway Details</h3>
                <div className="space-y-3">
                  {repayment.razorpayOrderId && (
                    <div>
                      <p className="text-xs text-gray-500">Razorpay Order ID</p>
                      <p className="mt-1 text-sm font-mono text-gray-900">{repayment.razorpayOrderId}</p>
                    </div>
                  )}
                  {repayment.razorpayPaymentId && (
                    <div>
                      <p className="text-xs text-gray-500">Razorpay Payment ID</p>
                      <p className="mt-1 text-sm font-mono text-gray-900">{repayment.razorpayPaymentId}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Repayment Amount</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(repayment.amount)}</span>
                </div>
                {repayment.penaltyAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Penalty</span>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(repayment.penaltyAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Total Paid</span>
                    <span className="text-lg font-bold text-[#017827]">{formatCurrency(repayment.totalAmount || repayment.amount)}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Credit Reduction</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {formatCurrency(repayment.creditUsedBefore || 0)} → {formatCurrency(repayment.creditUsedAfter || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main repayments list view
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Credit & Finance</p>
          <h2 className="text-2xl font-bold text-gray-900">Credit Repayments</h2>
          <p className="text-sm text-gray-600">
            View and manage all vendor credit repayments. Track repayment status, amounts, and payment details.
          </p>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Completed</p>
          <p className="mt-1 text-2xl font-bold text-[#017827]">{summary.totalCompleted || 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{summary.totalPending || 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Failed</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{summary.totalFailed || 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Repaid</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(summary.totalRepaid || 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Penalty Collected</p>
          <p className="mt-1 text-lg font-bold text-red-600">{formatCurrency(summary.totalPenaltyPaid || 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Filters:</span>
          </div>
          <div>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filters.vendorId}
              onChange={(e) => handleFilterChange('vendorId', e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="Start Date"
            />
          </div>
          <div>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="End Date"
            />
          </div>
        </div>
      </div>

      {/* Repayments Table */}
      {repayments.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-sm font-bold text-gray-900">No Repayments Found</p>
          <p className="mt-2 text-xs text-gray-600">
            {Object.values(filters).some(f => f) 
              ? 'No repayments match the current filters. Try adjusting your search criteria.'
              : 'No repayments have been made yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-gray-200 bg-white shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <DataTable
              columns={tableColumns}
              rows={repayments}
              emptyState="No repayments found"
            />
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1 || loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages || loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

