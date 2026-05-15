import { useState, useEffect, useCallback } from 'react'
import { Wallet, ShieldCheck, Eye, CheckCircle, XCircle, Calendar, IndianRupee, Filter, Search, MoreVertical } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { SellerWithdrawalApprovalScreen } from '../components/SellerWithdrawalApprovalScreen'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { cn } from '../../../lib/cn'
import { getMaskedBankDetails } from '../../../utils/maskSensitiveData'

const columns = [
  { Header: 'IRA Partner', accessor: 'sellerName' },
  { Header: 'Amount', accessor: 'amount' },
  { Header: 'Request Date', accessor: 'date' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Actions', accessor: 'actions' },
]

export function SellerWithdrawalsPage({ subRoute = null, navigate }) {
  const {
    getSellerWithdrawalRequests,
    approveSellerWithdrawal,
    rejectSellerWithdrawal,
    loading,
  } = useAdminApi()
  const { success, error: showError } = useToast()

  const [withdrawals, setWithdrawals] = useState([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ status: 'all', search: '' })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // { type: 'approve' | 'reject', requestId: string, reason?: string }
  const [approvingRequest, setApprovingRequest] = useState(null) // Request being approved (for full-screen flow)
  const [openActionsDropdown, setOpenActionsDropdown] = useState(null)

  const fetchWithdrawals = useCallback(async () => {
    try {
      const params = {
        limit: 50,
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      }
      const result = await getSellerWithdrawalRequests(params)
      if (result.data) {
        setWithdrawals(result.data.withdrawals || [])
        setTotal(result.data.total || 0)
      }
    } catch (error) {
      console.error('Failed to fetch seller withdrawals:', error)
    }
  }, [getSellerWithdrawalRequests, filters])

  useEffect(() => {
    fetchWithdrawals()
  }, [fetchWithdrawals])

  const handleViewRequest = (request) => {
    setSelectedRequest(request)
    setModalOpen(true)
  }

  const handleApprove = () => {
    if (!selectedRequest) return
    // Navigate to full-screen approval page
    if (navigate) {
      setApprovingRequest(selectedRequest)
      navigate(`seller-withdrawals/approve/${selectedRequest.requestId || selectedRequest.id}`)
    } else {
      // Fallback to modal if navigate not available
      setPendingAction({ type: 'approve', requestId: selectedRequest.requestId || selectedRequest.id })
      setConfirmationModalOpen(true)
    }
  }

  const handleReject = (requestId, rejectionData) => {
    setPendingAction({ type: 'reject', requestId, reason: rejectionData?.reason })
    setConfirmationModalOpen(true)
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) return
    setActionLoading(true)
    try {
      let result
      if (pendingAction.type === 'approve') {
        result = await approveSellerWithdrawal(pendingAction.requestId)
      } else if (pendingAction.type === 'reject') {
        result = await rejectSellerWithdrawal(pendingAction.requestId, { reason: pendingAction.reason })
      }

      if (result?.data) {
        success(`Withdrawal ${pendingAction.type === 'approve' ? 'approved' : 'rejected'} successfully!`)
        setModalOpen(false)
        setConfirmationModalOpen(false)
        setSelectedRequest(null)
        setPendingAction(null)
        fetchWithdrawals()
      } else if (result?.error) {
        showError(result.error.message || `Failed to ${pendingAction.type} withdrawal`)
      }
    } catch (error) {
      showError(error.message || `Failed to ${pendingAction.type} withdrawal`)
    } finally {
      setActionLoading(false)
    }
  }

  const formatCurrency = (value) => {
    if (typeof value === 'string') return value
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
    return `₹${value.toLocaleString('en-IN')}`
  }

  const tableColumns = columns.map((column) => {
    if (column.accessor === 'status') {
      return {
        ...column,
        Cell: (row) => {
          const status = row.status || 'pending'
          const tone = status === 'approved' ? 'success' : status === 'rejected' ? 'neutral' : status === 'completed' ? 'success' : 'warning'
          return <StatusBadge tone={tone}>{status.charAt(0).toUpperCase() + status.slice(1)}</StatusBadge>
        },
      }
    }
    if (column.accessor === 'amount') {
      return {
        ...column,
        Cell: (row) => <span className="text-sm font-bold text-gray-900">{formatCurrency(row.amount || 0)}</span>,
      }
    }
    if (column.accessor === 'date') {
      return {
        ...column,
        Cell: (row) => {
          const date = row.date || row.createdAt
          return date ? new Date(date).toLocaleDateString('en-IN') : 'N/A'
        },
      }
    }
    if (column.accessor === 'actions') {
      return {
        ...column,
        Cell: (row) => {
          const isDropdownOpen = openActionsDropdown === row.id
          const status = row.status || 'pending'

          const actionItems = [
            {
              label: 'View details',
              icon: Eye,
              onClick: () => {
                handleViewRequest(row)
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            }
          ]

          if (status === 'pending') {
            actionItems.push({
              label: 'Approve',
              icon: CheckCircle,
              onClick: () => {
                if (navigate) {
                  setApprovingRequest(row)
                  navigate(`seller-withdrawals/approve/${row.requestId || row.id}`)
                } else {
                  setSelectedRequest(row)
                  setPendingAction({ type: 'approve', requestId: row.requestId || row.id })
                  setConfirmationModalOpen(true)
                }
                setOpenActionsDropdown(null)
              },
              className: 'text-[#017827] hover:bg-[rgba(1,120,39,0.05)]'
            })
            actionItems.push({
              label: 'Reject',
              icon: XCircle,
              onClick: () => {
                setSelectedRequest(row)
                const reason = window.prompt('Please provide a reason for rejection:')
                if (reason) {
                  setPendingAction({ type: 'reject', requestId: row.requestId || row.id, reason })
                  setConfirmationModalOpen(true)
                }
                setOpenActionsDropdown(null)
              },
              className: 'text-red-600 hover:bg-red-50'
            })
          }

          return (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenActionsDropdown(isDropdownOpen ? null : row.id)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-yellow-500 hover:bg-yellow-50 hover:text-yellow-700"
                title="Actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpenActionsDropdown(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    {actionItems.map((item, index) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!item.disabled) {
                              item.onClick()
                            }
                          }}
                          disabled={item.disabled}
                          className={cn(
                            'w-full flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                            item.className,
                            item.disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        },
      }
    }
    return column
  })

  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length
  const pendingAmount = withdrawals.filter((w) => w.status === 'pending').reduce((sum, w) => sum + (w.amount || 0), 0)

  // Handle sub-route for approval screen
  useEffect(() => {
    if (subRoute && subRoute.startsWith('approve/')) {
      const requestId = subRoute.replace('approve/', '')
      const request = withdrawals.find((w) => (w.requestId || w.id) === requestId)
      if (request) {
        setApprovingRequest(request)
      }
    } else {
      setApprovingRequest(null)
    }
  }, [subRoute, withdrawals])

  // If approving, show approval screen
  if (approvingRequest && subRoute?.startsWith('approve/')) {
    return (
      <SellerWithdrawalApprovalScreen
        request={approvingRequest}
        onBack={() => {
          setApprovingRequest(null)
          if (navigate) {
            navigate('seller-withdrawals')
          }
        }}
        onSuccess={() => {
          setApprovingRequest(null)
          fetchWithdrawals()
          if (navigate) {
            navigate('seller-withdrawals')
          }
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Finance • Withdrawals</p>
          <h2 className="text-2xl font-bold text-gray-900">IRA Partner Withdrawal Requests</h2>
          <p className="text-sm text-gray-600">Manage IRA Partner (Seller) withdrawal requests and process payments</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-orange-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Pending Requests</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by IRA Partner name..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="flex-1 border-none bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
        <DataTable
          columns={tableColumns}
          rows={withdrawals}
          emptyState="No withdrawal requests found"
          loading={loading}
        />
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setSelectedRequest(null)
          }}
          title="Withdrawal Request Details"
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-gray-600 mb-1">IRA Partner</p>
                <p className="text-sm font-bold text-gray-900">{selectedRequest.sellerName || selectedRequest.sellerId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Amount</p>
                <p className="text-sm font-bold text-[#017827]">{formatCurrency(selectedRequest.amount || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Request Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.date || selectedRequest.createdAt
                    ? new Date(selectedRequest.date || selectedRequest.createdAt).toLocaleDateString('en-IN')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <StatusBadge tone={selectedRequest.status === 'approved' ? 'success' : selectedRequest.status === 'rejected' ? 'neutral' : 'warning'}>
                  {selectedRequest.status?.charAt(0).toUpperCase() + selectedRequest.status?.slice(1) || 'Pending'}
                </StatusBadge>
              </div>
            </div>
            {selectedRequest.bankDetails && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-bold text-gray-600 mb-2">Bank Account Details</p>
                <div className="grid gap-2 md:grid-cols-2 text-sm text-gray-700">
                  {selectedRequest.bankDetails.accountHolderName && (
                    <div>
                      <span className="text-gray-600">Account Holder: </span>
                      <span className="font-medium">{selectedRequest.bankDetails.accountHolderName}</span>
                    </div>
                  )}
                  {selectedRequest.bankDetails.accountNumber && (
                    <div>
                      <span className="text-gray-600">Account: </span>
                      <span className="font-medium">{selectedRequest.bankDetails.accountNumber}</span>
                    </div>
                  )}
                  {selectedRequest.bankDetails.ifscCode && (
                    <div>
                      <span className="text-gray-600">IFSC: </span>
                      <span className="font-medium">{selectedRequest.bankDetails.ifscCode}</span>
                    </div>
                  )}
                  {selectedRequest.bankDetails.bankName && (
                    <div>
                      <span className="text-gray-600">Bank: </span>
                      <span className="font-medium">{selectedRequest.bankDetails.bankName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedRequest.status === 'pending' && (
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleReject}
                  className="flex-1 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-all hover:bg-red-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="flex-1 rounded-xl bg-[#017827] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#015c1f]"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModalOpen}
        onClose={() => {
          setConfirmationModalOpen(false)
          setPendingAction(null)
        }}
        onConfirm={handleConfirmAction}
        title={`Confirm Withdrawal ${pendingAction?.type === 'approve' ? 'Approval' : 'Rejection'}`}
        message={`Please verify all details before ${pendingAction?.type === 'approve' ? 'approving' : 'rejecting'} this withdrawal request. This action cannot be undone.`}
        type={pendingAction?.type === 'reject' ? 'danger' : 'warning'}
        details={selectedRequest && pendingAction ? {
          'IRA Partner': selectedRequest.sellerName || selectedRequest.sellerId || 'N/A',
          'Amount': formatCurrency(selectedRequest.amount || 0),
          'Request Date': selectedRequest.date || 'N/A',
          ...(pendingAction.type === 'reject' && pendingAction.reason ? {
            'Rejection Reason': pendingAction.reason,
          } : {}),
        } : null}
        loading={actionLoading}
        confirmLabel={pendingAction?.type === 'approve' ? 'Approve' : 'Reject'}
      />
    </div>
  )
}

