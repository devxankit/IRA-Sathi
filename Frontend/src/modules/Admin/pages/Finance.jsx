import { useState, useEffect, useCallback } from 'react'
import { BadgeIndianRupee, Sparkles, Building2, Eye, AlertCircle, Package, CheckCircle, XCircle, ArrowLeft, Calendar, MoreVertical } from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { ProgressList } from '../components/ProgressList'
import { Timeline } from '../components/Timeline'
import { OutstandingCreditsView } from '../components/OutstandingCreditsView'
import { RecoveryStatusView } from '../components/RecoveryStatusView'
import { DataTable } from '../components/DataTable'
import { FinancialParametersForm } from '../components/FinancialParametersForm'
import { PenaltiesPage } from './Penalties'
import { useAdminState } from '../context/AdminContext'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
// Mock finance import removed
import { cn } from '../../../lib/cn'

const vendorColumns = [
  { Header: 'Vendor', accessor: 'name' },
  { Header: 'Credit Limit', accessor: 'creditLimit' },
  { Header: 'Used Credit', accessor: 'usedCredit' },
  { Header: 'Overdue', accessor: 'overdue' },
  { Header: 'Penalty', accessor: 'penalty' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Actions', accessor: 'actions' },
]

export function FinancePage({ subRoute = null, navigate }) {
  const { finance: financeState, vendors } = useAdminState()
  const {
    getVendorCreditBalances,
    getFinancialParameters,
    updateFinancialParameters,
    applyPenalty,
    applyVendorPenalty,
    getOutstandingCredits,
    getRecoveryStatus,
    getVendors,
    getVendorPurchaseRequests,
    approveVendorPurchase,
    rejectVendorPurchase,
    sendVendorPurchaseStock,
    confirmVendorPurchaseDelivery,
    getVendorCreditHistory,
    getVendorRepayments,
    loading,
  } = useAdminApi()
  const { success, error: showError, warning: showWarning } = useToast()

  const [vendorCredits, setVendorCredits] = useState([])
  const [financialParameters, setFinancialParameters] = useState(null)
  const [outstandingCredits, setOutstandingCredits] = useState([])
  const [recoveryStatus, setRecoveryStatus] = useState([])
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [purchaseRequestsLoading, setPurchaseRequestsLoading] = useState(false)

  // View states (replacing modals with full-screen views)
  const [currentView, setCurrentView] = useState(null) // 'parameters', 'creditBalance', 'purchaseRequest'
  const [selectedVendorForCredit, setSelectedVendorForCredit] = useState(null)
  const [selectedVendorCreditData, setSelectedVendorCreditData] = useState(null)
  const [selectedPurchaseRequest, setSelectedPurchaseRequest] = useState(null)
  const [selectedVendorRepayments, setSelectedVendorRepayments] = useState([])
  const [repaymentsLoading, setRepaymentsLoading] = useState(false)
  const [approvingPurchase, setApprovingPurchase] = useState(false)
  const [purchaseRejectReasonState, setPurchaseRejectReasonState] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState(null)

  // Fetch purchase requests
  const fetchPurchaseRequests = useCallback(async () => {
    setPurchaseRequestsLoading(true)
    try {
      const result = await getVendorPurchaseRequests({ status: 'pending', limit: 50 })
      if (result.data?.purchases) {
        setPurchaseRequests(result.data.purchases)
      }
    } catch (error) {
      console.error('Failed to fetch purchase requests:', error)
    } finally {
      setPurchaseRequestsLoading(false)
    }
  }, [getVendorPurchaseRequests])

  // Fetch data
  const fetchData = useCallback(async () => {
    // Fetch vendor credit balances
    const creditsResult = await getVendorCreditBalances()
    if (creditsResult.data?.credits) {
      setVendorCredits(creditsResult.data.credits)
    }

    // Fetch financial parameters
    const paramsResult = await getFinancialParameters()
    if (paramsResult.data) {
      setFinancialParameters(paramsResult.data)
    }

    // Fetch outstanding credits
    const outstandingResult = await getOutstandingCredits()
    if (outstandingResult.data?.credits) {
      setOutstandingCredits(outstandingResult.data.credits)
    } else {
      setOutstandingCredits([])
    }

    // Fetch recovery status
    const recoveryResult = await getRecoveryStatus()
    if (recoveryResult.data?.recoveries) {
      setRecoveryStatus(recoveryResult.data.recoveries)
    }

    // Fetch purchase requests
    fetchPurchaseRequests()
  }, [getVendorCreditBalances, getFinancialParameters, getOutstandingCredits, getRecoveryStatus, fetchPurchaseRequests])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Refresh when finance is updated
  useEffect(() => {
    if (financeState.updated) {
      fetchData()
    }
  }, [financeState.updated, fetchData])

  const handleViewCreditBalance = async (vendor) => {
    setSelectedVendorForCredit(vendor)

    // Fetch detailed credit data
    const result = await getVendorCreditBalances({ vendorId: vendor.id || vendor.vendorId })
    if (result.data?.creditData) {
      setSelectedVendorCreditData(result.data.creditData)
    }

    setCurrentView('creditBalance')
  }

  const handleSaveParameters = async (params) => {
    try {
      const result = await updateFinancialParameters(params)
      if (result.data) {
        setCurrentView(null)
        fetchData()
        success('Financial parameters updated successfully!', 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to update financial parameters'
        if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
          showWarning(errorMessage, 5000)
        } else {
          showError(errorMessage, 5000)
        }
      }
    } catch (error) {
      showError(error.message || 'Failed to update financial parameters', 5000)
    }
  }

  const handleBackToList = () => {
    setCurrentView(null)
    setSelectedVendorForCredit(null)
    setSelectedVendorCreditData(null)
    setSelectedPurchaseRequest(null)
    if (navigate) navigate('finance/overview')
  }

  const handleApplyPenalty = async (vendorId) => {
    const confirmed = window.confirm('Are you sure you want to apply penalty for this vendor?')
    if (confirmed) {
      try {
        const result = await applyPenalty(vendorId)
        if (result.data) {
          fetchData()
          setCurrentView(null)
          setSelectedVendorForCredit(null)
          setSelectedVendorCreditData(null)
          success('Penalty applied successfully!', 3000)
        } else if (result.error) {
          const errorMessage = result.error.message || 'Failed to apply penalty'
          if (errorMessage.includes('not eligible') || errorMessage.includes('cannot')) {
            showWarning(errorMessage, 6000)
          } else {
            showError(errorMessage, 5000)
          }
        }
      } catch (error) {
        showError(error.message || 'Failed to apply penalty', 5000)
      }
    }
  }

  const handleViewPurchaseRequest = async (request) => {
    setSelectedPurchaseRequest(request)
    setCurrentView('purchaseRequest')

    // Fetch vendor repayments
    const vendorId = request.vendorId
    if (vendorId) {
      setRepaymentsLoading(true)
      try {
        const result = await getVendorRepayments(vendorId)
        if (result.data?.repayments) {
          setSelectedVendorRepayments(result.data.repayments)
        } else {
          setSelectedVendorRepayments([])
        }
      } catch (error) {
        console.error('Failed to fetch vendor repayments:', error)
        setSelectedVendorRepayments([])
      } finally {
        setRepaymentsLoading(false)
      }
    }
  }

  const handleApprovePurchase = async (requestId) => {
    setApprovingPurchase(true)
    try {
      const result = await approveVendorPurchase(requestId)
      if (result.data) {
        success('Purchase request approved successfully!', 3000)
        // Refresh request data so we can see the "Send Stock" button
        if (selectedPurchaseRequest && selectedPurchaseRequest.id === requestId) {
          setSelectedPurchaseRequest({ ...selectedPurchaseRequest, status: 'approved', deliveryStatus: 'pending' })
        }
        fetchPurchaseRequests()
        fetchData() // Refresh credit balances
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to approve purchase request'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to approve purchase request', 5000)
    } finally {
      setApprovingPurchase(false)
    }
  }

  const handleSendStock = async (requestId) => {
    setApprovingPurchase(true)
    try {
      const result = await sendVendorPurchaseStock(requestId)
      if (result.data) {
        success('Stock marked as in-transit!', 3000)
        // Refresh request data
        if (selectedPurchaseRequest && selectedPurchaseRequest.id === requestId) {
          setSelectedPurchaseRequest({ ...selectedPurchaseRequest, deliveryStatus: 'in_transit' })
        }
        fetchPurchaseRequests()
      } else if (result.error) {
        showError(result.error.message || 'Failed to update delivery status', 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to update delivery status', 5000)
    } finally {
      setApprovingPurchase(false)
    }
  }

  const handleConfirmDelivery = async (requestId) => {
    setApprovingPurchase(true)
    try {
      const result = await confirmVendorPurchaseDelivery(requestId)
      if (result.data) {
        success('Stock delivery confirmed and inventory updated!', 3000)
        setCurrentView(null)
        setSelectedPurchaseRequest(null)
        fetchPurchaseRequests()
        fetchData()
      } else if (result.error) {
        showError(result.error.message || 'Failed to confirm delivery', 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to confirm delivery', 5000)
    } finally {
      setApprovingPurchase(false)
    }
  }

  const handleRejectPurchase = async (requestId, rejectionData) => {
    setApprovingPurchase(true)
    try {
      const result = await rejectVendorPurchase(requestId, rejectionData)
      if (result.data) {
        success('Purchase request rejected successfully!', 3000)
        setCurrentView(null)
        setSelectedPurchaseRequest(null)
        fetchPurchaseRequests()
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to reject purchase request'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to reject purchase request', 5000)
    } finally {
      setApprovingPurchase(false)
    }
  }

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)} Cr`
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  const tableColumns = vendorColumns.map((column) => {
    if (column.accessor === 'status') {
      return {
        ...column,
        Cell: (row) => {
          const utilization = row.creditLimit > 0 ? (row.usedCredit / row.creditLimit) * 100 : 0
          const tone = utilization > 80 ? 'warning' : utilization > 50 ? 'neutral' : 'success'
          return <StatusBadge tone={tone}>{utilization.toFixed(0)}%</StatusBadge>
        },
      }
    }
    if (column.accessor === 'actions') {
      return {
        ...column,
        Cell: (row) => {
          const originalVendor = vendors.data?.vendors?.find((v) => v.id === row.id) || row
          const isDropdownOpen = openActionsDropdown === row.id

          const actionItems = [
            {
              label: 'View Credit Balance',
              icon: Eye,
              onClick: () => {
                handleViewCreditBalance(originalVendor)
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            }
          ]

          return (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenActionsDropdown(isDropdownOpen ? null : row.id)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-pink-500 hover:bg-pink-50 hover:text-pink-700"
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
    if (['creditLimit', 'usedCredit', 'overdue', 'penalty'].includes(column.accessor)) {
      return {
        ...column,
        Cell: (row) => {
          const value = row[column.accessor] || 0
          return <span className="text-sm font-bold text-gray-900">{formatCurrency(value)}</span>
        },
      }
    }
    return column
  })

  // Show Penalties screen when subRoute is 'penalties'
  if (subRoute === 'penalties') {
    return <PenaltiesPage navigate={navigate} />
  }

  // Show full-screen views (replacing modals)
  if (currentView === 'parameters') {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Credits Overview
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 7 • Credit & Finance</p>
            <h2 className="text-2xl font-bold text-gray-900">Update Credit Settings</h2>
            <p className="text-sm text-gray-600">
              Configure global financial parameters for the platform.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <FinancialParametersForm
            parameters={financialParameters}
            onSave={handleSaveParameters}
            onCancel={handleBackToList}
            loading={loading}
          />
        </div>
      </div>
    )
  }

  if (currentView === 'creditBalance' && selectedVendorForCredit && selectedVendorCreditData) {
    const vendor = selectedVendorForCredit
    const creditData = selectedVendorCreditData
    const creditUtilization = creditData.creditLimit > 0
      ? (creditData.usedCredit / creditData.creditLimit) * 100
      : 0
    const overdueAmount = creditData.overdueAmount || 0
    const penaltyAmount = creditData.penaltyAmount || 0

    const formatCurrency = (value) => {
      if (typeof value === 'string') return value
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
      if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`
      return `₹${value.toLocaleString('en-IN')}`
    }

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Credits Overview
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 7 • Credit & Finance</p>
            <h2 className="text-2xl font-bold text-gray-900">Credit Balance - {vendor.name || vendor.vendorName}</h2>
            <p className="text-sm text-gray-600">
              View detailed credit information, repayment history, and overdue payments.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            {/* Vendor Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{vendor.name || vendor.vendorName}</h3>
                    <p className="text-sm text-gray-600">Vendor ID: {vendor.id || vendor.vendorId}</p>
                    {vendor.region && (
                      <p className="text-xs text-gray-500 mt-1">Region: {vendor.region}</p>
                    )}
                  </div>
                </div>
                <StatusBadge tone={creditUtilization > 80 ? 'warning' : creditUtilization > 50 ? 'neutral' : 'success'}>
                  {creditUtilization.toFixed(0)}% Utilized
                </StatusBadge>
              </div>
            </div>

            {/* Credit Summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-xs text-blue-500 mb-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Credit Limit</span>
                </div>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(creditData.creditLimit || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-4">
                <div className="flex items-center gap-2 text-xs text-[#0a9937] mb-2">
                  <BadgeIndianRupee className="h-4 w-4" />
                  <span>Used Credit</span>
                </div>
                <p className="text-xl font-bold text-[#014a19]">
                  {formatCurrency(creditData.usedCredit || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 text-xs text-orange-500 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Overdue</span>
                </div>
                <p className="text-xl font-bold text-orange-900">
                  {formatCurrency(overdueAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-xs text-red-500 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Penalty</span>
                </div>
                <p className="text-xl font-bold text-red-900">
                  {formatCurrency(penaltyAmount)}
                </p>
              </div>
            </div>

            {/* Credit Utilization Progress */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Credit Utilization</h4>
                <span className="text-xs text-gray-600">
                  {formatCurrency(creditData.availableCredit || 0)} available
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-full transition-all',
                    creditUtilization > 80 ? 'bg-red-500' : creditUtilization > 50 ? 'bg-orange-500' : 'bg-[#017827]',
                  )}
                  style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                />
              </div>
            </div>

            {/* Repayment History */}
            {creditData.repaymentHistory && creditData.repaymentHistory.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <h4 className="text-sm font-bold text-gray-900">Repayment History</h4>
                </div>
                <Timeline
                  events={creditData.repaymentHistory.map((payment, index) => ({
                    id: payment.id || `payment-${index}`,
                    title: payment.description || `Repayment ${index + 1}`,
                    timestamp: payment.date || payment.timestamp || 'N/A',
                    description: formatCurrency(payment.amount || 0),
                    status: payment.status || payment.onTime ? 'completed' : 'pending',
                  }))}
                />
              </div>
            )}

            {/* Overdue Payments */}
            {creditData.overduePayments && creditData.overduePayments.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h4 className="text-sm font-bold text-gray-900">Overdue Payments</h4>
                </div>
                <div className="space-y-3">
                  {creditData.overduePayments.map((payment, index) => (
                    <div key={payment.id || index} className="rounded-lg border border-red-300 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{payment.description || `Payment ${index + 1}`}</p>
                          <p className="text-xs text-gray-600">Due: {payment.dueDate || 'N/A'}</p>
                          <p className="text-xs text-red-600">Days overdue: {payment.daysOverdue || 0}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{formatCurrency(payment.amount || 0)}</p>
                          {payment.penaltyApplied && (
                            <StatusBadge tone="warning">Penalty Applied</StatusBadge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {overdueAmount > 0 && (
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleBackToList}
                  disabled={loading}
                  className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPenalty(vendor.id || vendor.vendorId)}
                  disabled={loading || penaltyAmount > 0}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  <AlertCircle className="h-4 w-4" />
                  Apply Penalty
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'purchaseRequest' && selectedPurchaseRequest) {
    const request = selectedPurchaseRequest
    const rejectReason = purchaseRejectReasonState
    const setRejectReason = setPurchaseRejectReasonState

    const formatCurrency = (value) => {
      if (typeof value === 'string') return value
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
      return `₹${value.toLocaleString('en-IN')}`
    }

    const handleRejectWithReason = () => {
      if (!rejectReason.trim()) {
        showError('Please provide a reason for rejection', 5000)
        return
      }
      handleRejectPurchase(request.id, { reason: rejectReason.trim() })
    }

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Credits Overview
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 7 • Credit & Finance</p>
            <h2 className="text-2xl font-bold text-gray-900">Vendor Purchase Request Review</h2>
            <p className="text-sm text-gray-600">
              Review and approve or reject vendor purchase requests.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            {/* Request Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Request #{request.id?.slice(-8) || request.requestId?.slice(-8) || 'N/A'}
                    </h3>
                    <p className="text-sm text-gray-600">Vendor: {request.vendorName || request.vendor}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      {request.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(request.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                      {request.createdAt && !request.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <StatusBadge tone={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'neutral'}>
                  {request.status || 'Pending'}
                </StatusBadge>
              </div>
            </div>

            {/* Vendor Credit Performance */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-900">Vendor Credit Performance</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs text-blue-500">Credit Limit</p>
                  <p className="mt-1 text-lg font-bold text-blue-900">
                    {formatCurrency(request.vendorPerformance?.creditLimit || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <p className="text-xs text-purple-500">Used Credit</p>
                  <p className="mt-1 text-lg font-bold text-purple-900">
                    {formatCurrency(request.vendorPerformance?.creditUsed || 0)}
                  </p>
                </div>
                <div className={cn(
                  "rounded-xl border p-4",
                  request.vendorPerformance?.hasOutstandingDues ? "border-red-200 bg-red-50" : "border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)]"
                )}>
                  <p className={cn("text-xs", request.vendorPerformance?.hasOutstandingDues ? "text-red-500" : "text-[#0a9937]")}>
                    Outstanding Dues
                  </p>
                  <p className={cn("mt-1 text-lg font-bold", request.vendorPerformance?.hasOutstandingDues ? "text-red-900" : "text-[#014a19]")}>
                    {formatCurrency(request.vendorPerformance?.outstandingAmount || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs text-orange-500">Utilization</p>
                  <p className="mt-1 text-lg font-bold text-orange-900">
                    {(request.vendorPerformance?.creditUtilization || 0).toFixed(1)}%
                  </p>
                </div>
              </div>

              {request.vendorPerformance?.hasOutstandingDues && (
                <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100/50 p-3 text-sm text-red-900">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Warning: This vendor had outstanding dues of {formatCurrency(request.vendorPerformance?.outstandingAmount)} at the time of this request.</span>
                </div>
              )}
            </div>

            {/* Purchase Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-900">Purchase Details</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">Request Amount</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {formatCurrency(request.amount || request.value || 0)}
                  </p>
                </div>
                {request.advance && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">Advance Payment (30%)</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {formatCurrency(request.advance)}
                    </p>
                  </div>
                )}
              </div>

              {request.products && request.products.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-xs font-bold text-gray-500">Products Requested</p>
                  <div className="space-y-2">
                    {request.products.map((product, index) => {
                      // Format attribute label
                      const formatAttributeLabel = (key) => {
                        return key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim()
                      }

                      return (
                        <div key={index} className="rounded-lg bg-white p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-900">{product.name || product}</span>
                            {product.quantity && (
                              <span className="text-xs text-gray-500">
                                Qty: {product.quantity} {product.unit || 'kg'}
                              </span>
                            )}
                          </div>
                          {/* Display variant attributes if present */}
                          {product.attributeCombination && Object.keys(product.attributeCombination).length > 0 && (
                            <div className="mt-2 space-y-1 pt-2 border-t border-gray-100">
                              {Object.entries(product.attributeCombination).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-600 font-medium">{formatAttributeLabel(key)}:</span>
                                  <span className="text-gray-900">{value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {product.price && (
                            <div className="mt-1 text-xs text-gray-500">
                              Price: ₹{product.price.toLocaleString('en-IN')}/{product.unit || 'kg'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {request.description && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs text-gray-500">Description</p>
                  <p className="text-sm text-gray-700">{request.description}</p>
                </div>
              )}
            </div>

            {/* Repayment History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Repayment History</h4>
                {repaymentsLoading && <span className="text-xs text-pink-500 animate-pulse">Loading...</span>}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                {selectedVendorRepayments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedVendorRepayments.slice(0, 5).map((repayment, index) => (
                      <div key={repayment.id || index} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            ₹{repayment.amount?.toLocaleString('en-IN') || 0}
                          </p>
                          <p className="text-xs text-gray-500">
                            {repayment.date ? new Date(repayment.date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <StatusBadge tone={repayment.status === 'completed' ? 'success' : 'warning'}>
                          {repayment.status || 'Pending'}
                        </StatusBadge>
                      </div>
                    ))}
                    {selectedVendorRepayments.length > 5 && (
                      <p className="text-center text-xs text-gray-500">
                        View all {selectedVendorRepayments.length} repayments in Vendor Details
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-500 py-4">
                    {repaymentsLoading ? 'Fetching repayment history...' : 'No repayment history found for this vendor.'}
                  </p>
                )}
              </div>
            </div>

            {/* Rejection Reason Input */}
            <div>
              <label htmlFor="rejectReason" className="mb-2 block text-sm font-bold text-gray-900">
                Rejection Reason <span className="text-xs font-normal text-gray-500">(Required for rejection)</span>
              </label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection"
                rows={3}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleBackToList}
                disabled={loading}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRejectWithReason}
                  disabled={loading || !rejectReason.trim()}
                  className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprovePurchase(request.id)}
                  disabled={loading || approvingPurchase}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {approvingPurchase ? 'Processing...' : 'Approve Request'}
                </button>
              </div>
            </div>

            {/* Delivery Actions (Visible after approval) */}
            {request.status === 'approved' && request.deliveryStatus !== 'delivered' && (
              <div className="mt-8 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Stock Delivery Workflow</h4>
                    <p className="text-xs text-gray-600">Current Phase: <span className="font-semibold uppercase text-blue-600">{request.deliveryStatus || 'Pending'}</span></p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {request.deliveryStatus === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleSendStock(request.id)}
                      disabled={approvingPurchase}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Package className="h-4 w-4" />
                      Dispatch Stock (Mark Sent)
                    </button>
                  )}

                  {request.deliveryStatus === 'in_transit' && (
                    <button
                      type="button"
                      onClick={() => handleConfirmDelivery(request.id)}
                      disabled={approvingPurchase}
                      className="flex items-center gap-2 rounded-xl bg-pink-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-pink-700 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Confirm Receipt (Actual Stock Transfer)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show Overview (default when subRoute is null or 'overview')
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 7 • Credit & Finance</p>
          <h2 className="text-2xl font-bold text-gray-900">Recoveries & Policy Control</h2>
          <p className="text-sm text-gray-600">
            Track credit utilisation, configure repayment guardrails, and deploy automatic penalty workflows.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('parameters')}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(236,72,153,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(236,72,153,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:scale-105 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
        >
          <BadgeIndianRupee className="h-4 w-4" />
          Update Credit Settings
        </button>
      </header>

      {/* Pending Purchase Requests */}
      {purchaseRequests.length > 0 && (
        <div className="rounded-3xl border border-orange-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pending Purchase Requests</h3>
                <p className="text-xs text-gray-600">{purchaseRequests.length} request{purchaseRequests.length !== 1 ? 's' : ''} awaiting approval</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {purchaseRequests.slice(0, 5).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 transition-all hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer"
                onClick={() => handleViewPurchaseRequest(request)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-gray-900">{request.vendorName || 'Unknown Vendor'}</p>
                    <StatusBadge tone="warning">Pending</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {request.products?.length || 0} product{request.products?.length !== 1 ? 's' : ''} • {formatCurrency(request.amount || request.value || 0)}
                  </p>
                  {request.date && (
                    <p className="mt-1 text-xs text-gray-500">Requested on {new Date(request.date).toLocaleDateString('en-IN')}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewPurchaseRequest(request)
                  }}
                  className="ml-4 flex h-9 w-9 items-center justify-center rounded-lg border border-orange-300 bg-white text-orange-600 transition-all hover:border-orange-500 hover:bg-orange-50"
                  title="Review request"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            ))}
            {purchaseRequests.length > 5 && (
              <p className="text-center text-xs text-gray-500">
                +{purchaseRequests.length - 5} more request{purchaseRequests.length - 5 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Vendor Credit Balances Table */}
      {vendorCredits.length > 0 && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <h3 className="mb-4 text-lg font-bold text-gray-900">Vendor Credit Balances</h3>
          <DataTable
            columns={tableColumns}
            rows={vendorCredits}
            emptyState="No vendor credit data available"
          />
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-pink-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <h3 className="text-lg font-bold text-pink-700">Global Parameters</h3>
          <p className="text-sm text-gray-600">
            Set default advances, minimum order values, and vendor purchase thresholds for the platform.
          </p>
          <div className="space-y-3">
            {financialParameters ? (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">User Advance Payment %</p>
                    <StatusBadge tone="success">{financialParameters.userAdvancePaymentPercent || 30}%</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">Default advance for all user orders</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">Minimum User Order</p>
                    <StatusBadge tone="success">₹{financialParameters.minimumUserOrder?.toLocaleString('en-IN') || '2,000'}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">Minimum order value for user purchases</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">Minimum Vendor Purchase</p>
                    <StatusBadge tone="success">₹{financialParameters.minimumVendorPurchase?.toLocaleString('en-IN') || '50,000'}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">Minimum purchase value for vendor orders</p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500 italic">
                Loading financial parameters...
              </div>
            )}
          </div>
        </div>
        <OutstandingCreditsView credits={outstandingCredits} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-indigo-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-lg font-bold text-indigo-700">Automated Penalties</h3>
              <p className="text-sm text-gray-600">
                Penalties triggered by repayment delays are auto-applied with configurable grace periods.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              {
                title: 'Grace Period',
                detail: '5 day grace period before penalty kicks in. Update for festive cycles if needed.',
              },
              {
                title: 'Penalty Computation',
                detail: 'Daily penalty applied post grace period. Compounded weekly with automated alerts.',
              },
              {
                title: 'Collections Workflow',
                detail: 'Escalate to finance after 14 days overdue. Trigger legal notices automatically.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-4 hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                <p className="mt-2 text-xs text-gray-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

      </section >

      {/* Recovery Status */}
      {
        recoveryStatus.length > 0 && (
          <RecoveryStatusView recoveryData={recoveryStatus} />
        )
      }

    </div >
  )
}

