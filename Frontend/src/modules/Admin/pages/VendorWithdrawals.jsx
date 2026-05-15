import { useState, useEffect, useCallback } from 'react'
import { Wallet, Factory, Eye, CheckCircle, XCircle, Calendar, IndianRupee, Filter, Search, MoreVertical } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { VendorWithdrawalApprovalScreen } from '../components/VendorWithdrawalApprovalScreen'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { cn } from '../../../lib/cn'
import { getMaskedBankDetails } from '../../../utils/maskSensitiveData'

const columns = [
  { Header: 'Vendor', accessor: 'vendorName' },
  { Header: 'Amount', accessor: 'amount' },
  { Header: 'Request Date', accessor: 'date' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Actions', accessor: 'actions' },
]

export function VendorWithdrawalsPage({ subRoute = null, navigate }) {
  const {
    getVendorWithdrawalRequests,
    approveVendorWithdrawal,
    rejectVendorWithdrawal,
    completeVendorWithdrawal,
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
  const [pendingAction, setPendingAction] = useState(null) // { type: 'approve' | 'reject' | 'complete', requestId: string }
  const [approvingRequest, setApprovingRequest] = useState(null) // Request being approved (for full-screen flow)
  const [openActionsDropdown, setOpenActionsDropdown] = useState(null)

  const fetchWithdrawals = useCallback(async () => {
    try {
      const params = {
        limit: 50,
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      }
      const result = await getVendorWithdrawalRequests(params)
      if (result.data) {
        setWithdrawals(result.data.withdrawals || [])
        setTotal(result.data.total || 0)
      }
    } catch (error) {
      console.error('Failed to fetch vendor withdrawals:', error)
    }
  }, [getVendorWithdrawalRequests, filters])

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
      navigate(`vendor-withdrawals/approve/${selectedRequest.requestId || selectedRequest.id}`)
    } else {
      // Fallback to modal if navigate not available
      setPendingAction({ type: 'approve', requestId: selectedRequest.requestId || selectedRequest.id })
      setConfirmationModalOpen(true)
    }
  }

  const handleReject = () => {
    if (!selectedRequest) return
    const reason = window.prompt('Please provide a reason for rejection:')
    if (!reason) return
    setPendingAction({ type: 'reject', requestId: selectedRequest.requestId || selectedRequest.id, reason })
    setConfirmationModalOpen(true)
  }

  const handleConfirmAction = async () => {
    if (!pendingAction || !selectedRequest) return
    setActionLoading(true)
    try {
      let result
      if (pendingAction.type === 'approve') {
        result = await approveVendorWithdrawal(pendingAction.requestId)
      } else if (pendingAction.type === 'reject') {
        result = await rejectVendorWithdrawal(pendingAction.requestId, { reason: pendingAction.reason })
      } else if (pendingAction.type === 'complete') {
        result = await completeVendorWithdrawal(pendingAction.requestId, pendingAction.data || {})
      }

      if (result?.data) {
        success(`Withdrawal ${pendingAction.type === 'approve' ? 'approved' : pendingAction.type === 'reject' ? 'rejected' : 'completed'} successfully!`)
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

  const handleComplete = () => {
    if (!selectedRequest) return
    const paymentReference = window.prompt('Enter payment reference number:')
    if (!paymentReference) return
    setPendingAction({
      type: 'complete',
      requestId: selectedRequest.requestId || selectedRequest.id,
      data: {
        paymentReference,
        paymentDate: new Date().toISOString(),
      },
    })
    setConfirmationModalOpen(true)
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
                  navigate(`vendor-withdrawals/approve/${row.requestId || row.id}`)
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
          } else if (status === 'approved') {
            actionItems.push({
              label: 'Mark as Completed',
              icon: CheckCircle,
              onClick: () => {
                setSelectedRequest(row)
                const paymentReference = window.prompt('Enter payment reference number:')
                if (paymentReference) {
                  setPendingAction({
                    type: 'complete',
                    requestId: row.requestId || row.id,
                    data: {
                      paymentReference,
                      paymentDate: new Date().toISOString(),
                    },
                  })
                  setConfirmationModalOpen(true)
                }
                setOpenActionsDropdown(null)
              },
              className: 'text-blue-600 hover:bg-blue-50'
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-[#017827] hover:bg-[rgba(1,120,39,0.05)] hover:text-[#017827]"
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

  // Handle sub-route for approval flow
  useEffect(() => {
    if (subRoute) {
      const parts = subRoute.split('/')
      if (parts[0] === 'approve' && parts[1]) {
        // Find request by ID
        const request = withdrawals.find(w => (w.requestId || w.id) === parts[1])
        if (request) {
          setApprovingRequest(request)
        } else if (withdrawals.length > 0) {
          // Request not found, might need to refetch
          fetchWithdrawals()
        }
      }
    } else {
      // Reset when navigating back
      setApprovingRequest(null)
    }
  }, [subRoute, withdrawals, fetchWithdrawals])

  // If in approval flow, show approval screen
  if (subRoute && subRoute.startsWith('approve/') && approvingRequest) {
    return (
      <VendorWithdrawalApprovalScreen
        request={approvingRequest}
        onBack={() => {
          setApprovingRequest(null)
          if (navigate) navigate('vendor-withdrawals')
        }}
        onSuccess={() => {
          setApprovingRequest(null)
          if (navigate) navigate('vendor-withdrawals')
          fetchWithdrawals()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Finance • Withdrawals</p>
          <h2 className="text-2xl font-bold text-gray-900">Vendor Withdrawal Requests</h2>
          <p className="text-sm text-gray-600">Manage vendor withdrawal requests and process payments</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
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
            placeholder="Search by vendor name..."
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
          title="Vendor Withdrawal Request Review"
          size="md"
        >
          <div className="space-y-6">
            {/* Request Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                    <Factory className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Request #{selectedRequest.requestId || selectedRequest.id || 'N/A'}</h3>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                      <span>{selectedRequest.vendorName || 'Unknown Vendor'}</span>
                    </div>
                    {selectedRequest.date && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(selectedRequest.date).toLocaleDateString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <StatusBadge
                  tone={
                    selectedRequest.status === 'approved' || selectedRequest.status === 'completed'
                      ? 'success'
                      : selectedRequest.status === 'rejected'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {selectedRequest.status || 'Pending'}
                </StatusBadge>
              </div>
            </div>

            {/* Withdrawal Details */}
            <div className="space-y-4">
              <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-5">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <IndianRupee className="h-4 w-4" />
                  <span>Withdrawal Amount</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedRequest.amount || 0)}</p>
              </div>

              {selectedRequest.bankDetails && (() => {
                const maskedDetails = getMaskedBankDetails(selectedRequest.bankDetails)
                return (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-2 text-xs font-bold text-gray-500">Bank Account Details (Masked for Privacy)</p>
                    <div className="space-y-1 text-sm text-gray-700">
                      {maskedDetails.accountHolderName && (
                        <p>Account Holder: {maskedDetails.accountHolderName}</p>
                      )}
                      {maskedDetails.accountNumber && (
                        <p>Account: {maskedDetails.accountNumber}</p>
                      )}
                      {maskedDetails.ifscCode && <p>IFSC: {maskedDetails.ifscCode}</p>}
                      {maskedDetails.bankName && <p>Bank: {maskedDetails.bankName}</p>}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 italic">
                      Note: Account details are masked for security. Full details are available in payment history for processed transactions.
                    </p>
                  </div>
                )
              })()}

              {selectedRequest.reason && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-bold text-gray-500">Rejection Reason</p>
                  <p className="text-sm text-gray-700">{selectedRequest.reason}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false)
                  setSelectedRequest(null)
                }}
                disabled={actionLoading}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
              <div className="flex gap-3">
                {selectedRequest.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4)] disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {actionLoading ? 'Processing...' : 'Approve'}
                    </button>
                  </>
                )}
                {selectedRequest.status === 'approved' && (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {actionLoading ? 'Processing...' : 'Mark as Completed'}
                  </button>
                )}
              </div>
            </div>
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
        title={`Confirm Withdrawal ${pendingAction?.type === 'approve' ? 'Approval' : pendingAction?.type === 'reject' ? 'Rejection' : 'Completion'}`}
        message={`Please verify all details before ${pendingAction?.type === 'approve' ? 'approving' : pendingAction?.type === 'reject' ? 'rejecting' : 'completing'} this withdrawal request. This action cannot be undone.`}
        type={pendingAction?.type === 'reject' ? 'danger' : 'warning'}
        details={selectedRequest && pendingAction ? {
          'Vendor': selectedRequest.vendorName || 'N/A',
          'Amount': formatCurrency(selectedRequest.amount || 0),
          'Request Date': selectedRequest.date || 'N/A',
          ...(pendingAction.type === 'complete' && pendingAction.data?.paymentReference ? {
            'Payment Reference': pendingAction.data.paymentReference,
          } : {}),
          ...(pendingAction.type === 'reject' && pendingAction.reason ? {
            'Rejection Reason': pendingAction.reason,
          } : {}),
        } : null}
        loading={actionLoading}
        confirmLabel={pendingAction?.type === 'approve' ? 'Approve' : pendingAction?.type === 'reject' ? 'Reject' : 'Complete'}
      />
    </div>
  )
}

