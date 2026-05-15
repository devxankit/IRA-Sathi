import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, AlertTriangle, IndianRupee, Calendar, Building2, Eye, CheckCircle, XCircle } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminState } from '../context/AdminContext'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { cn } from '../../../lib/cn'

const columns = [
  { Header: 'Vendor', accessor: 'name' },
  { Header: 'Vendor ID', accessor: 'id' },
  { Header: 'Outstanding Dues', accessor: 'outstanding' },
  { Header: 'Order Count', accessor: 'orderCount' },
  { Header: 'Repayment Status', accessor: 'repaymentStatus' },
  { Header: 'Penalty Eligibility', accessor: 'eligible' },
  { Header: 'Actions', accessor: 'actions' },
]

export function PenaltiesPage({ navigate }) {
  const { vendors: vendorsState } = useAdminState()
  const {
    getVendors,
    getVendorCreditBalances,
    applyVendorPenalty,
    getVendorCreditHistory,
    loading,
  } = useAdminApi()
  const { success, error: showError, warning: showWarning } = useToast()

  const [vendorsList, setVendorsList] = useState([])
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorCreditHistory, setVendorCreditHistory] = useState([])
  const [penaltyAmount, setPenaltyAmount] = useState('')
  const [penaltyReason, setPenaltyReason] = useState('')
  const [showApplyPenalty, setShowApplyPenalty] = useState(false)

  // Format currency
  const formatCurrency = (value) => {
    if (typeof value === 'string') return value
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
    return `₹${value.toLocaleString('en-IN')}`
  }

  // Fetch vendors eligible for penalties
  // Criteria: Has outstanding dues, has not done repayment, has ordered 3 times without any repayment
  const fetchPenaltyEligibleVendors = useCallback(async () => {
    const vendorsResult = await getVendors()
    const creditsResult = await getVendorCreditBalances()
    
    const vendors = vendorsResult.data?.vendors || []
    const credits = creditsResult.data?.credits || []
    
    // Create a map of vendor credits
    const creditMap = new Map()
    credits.forEach((credit) => {
      creditMap.set(credit.vendorId || credit.id, credit)
    })
    
    // Filter vendors eligible for penalties
    const eligibleVendors = vendors
      .map((vendor) => {
        const credit = creditMap.get(vendor.id)
        const outstanding = credit?.creditUsed || credit?.overdue || vendor.dues || 0
        const orderCount = vendor.orderCount || vendor.totalOrders || 0
        
        // Check eligibility: outstanding > 0, orderCount >= 3, no recent repayment
        const isEligible = outstanding > 0 && orderCount >= 3
        
        return {
          ...vendor,
          outstanding: typeof outstanding === 'number' ? outstanding : parseFloat(outstanding?.replace(/[₹,\sL]/g, '') || '0') * 100000,
          orderCount,
          eligible: isEligible,
          repaymentStatus: credit?.status === 'overdue' ? 'Overdue' : credit?.status === 'dueSoon' ? 'Due Soon' : 'On Track',
        }
      })
      .filter((v) => v.eligible)
      .map((v) => ({
        ...v,
        outstanding: formatCurrency(v.outstanding),
      }))
    
    setVendorsList(eligibleVendors)
  }, [getVendors, getVendorCreditBalances])

  useEffect(() => {
    fetchPenaltyEligibleVendors()
  }, [fetchPenaltyEligibleVendors])

  const handleViewVendorDetails = async (vendor) => {
    const originalVendor = vendorsState.data?.vendors?.find((v) => v.id === vendor.id) || vendor
    setSelectedVendor(originalVendor)
    
    // Fetch credit history
    const result = await getVendorCreditHistory(originalVendor.id)
    if (result.data?.history) {
      setVendorCreditHistory(result.data.history)
    }
    
    setShowApplyPenalty(true)
  }

  const handleApplyPenalty = async () => {
    if (!selectedVendor || !penaltyAmount || !penaltyReason.trim()) {
      showError('Please provide penalty amount and reason', 5000)
      return
    }

    const amount = parseFloat(penaltyAmount.replace(/[₹,\s]/g, ''))
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid penalty amount', 5000)
      return
    }

    try {
      const result = await applyVendorPenalty(selectedVendor.id, {
        amount,
        reason: penaltyReason.trim(),
      })
      if (result.data) {
        setShowApplyPenalty(false)
        setSelectedVendor(null)
        setPenaltyAmount('')
        setPenaltyReason('')
        setVendorCreditHistory([])
        fetchPenaltyEligibleVendors()
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

  const handleBackToList = () => {
    setShowApplyPenalty(false)
    setSelectedVendor(null)
    setPenaltyAmount('')
    setPenaltyReason('')
    setVendorCreditHistory([])
    if (navigate) navigate('finance/overview')
  }

  const tableColumns = columns.map((column) => {
    if (column.accessor === 'eligible') {
      return {
        ...column,
        Cell: (row) => (
          <StatusBadge tone={row.eligible ? 'warning' : 'success'}>
            {row.eligible ? 'Eligible' : 'Not Eligible'}
          </StatusBadge>
        ),
      }
    }
    if (column.accessor === 'repaymentStatus') {
      return {
        ...column,
        Cell: (row) => {
          const tone = row.repaymentStatus === 'Overdue' ? 'error' : row.repaymentStatus === 'Due Soon' ? 'warning' : 'success'
          return <StatusBadge tone={tone}>{row.repaymentStatus}</StatusBadge>
        },
      }
    }
    if (column.accessor === 'actions') {
      return {
        ...column,
        Cell: (row) => {
          const originalVendor = vendorsState.data?.vendors?.find((v) => v.id === row.id) || row
          return (
            <button
              type="button"
              onClick={() => handleViewVendorDetails(originalVendor)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-pink-500 hover:bg-pink-50 hover:text-pink-700"
              title="View details and apply penalty"
            >
              <Eye className="h-4 w-4" />
            </button>
          )
        },
      }
    }
    return column
  })

  // Show apply penalty screen
  if (showApplyPenalty && selectedVendor) {
    const vendor = selectedVendor
    const outstanding = typeof vendor.dues === 'number'
      ? vendor.dues
      : parseFloat(vendor.dues?.replace(/[₹,\sL]/g, '') || '0') * 100000

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Penalties
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 7 • Credit & Finance</p>
            <h2 className="text-2xl font-bold text-gray-900">Apply Penalty</h2>
            <p className="text-sm text-gray-600">
              Apply penalty to vendor {vendor.name} for outstanding dues and non-repayment.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            {/* Vendor Info */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{vendor.name}</h3>
                  <p className="text-sm text-gray-600">Vendor ID: {vendor.id}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-gray-500">Outstanding Dues</p>
                      <p className="mt-1 text-lg font-bold text-red-600">{formatCurrency(outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Order Count</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{vendor.orderCount || vendor.totalOrders || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <StatusBadge tone="warning">Eligible for Penalty</StatusBadge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit History */}
            {vendorCreditHistory.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="mb-3 text-sm font-bold text-gray-900">Recent Credit History</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vendorCreditHistory.slice(0, 10).map((entry, index) => (
                    <div key={entry.id || index} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{entry.type || 'Credit Transaction'}</p>
                        <p className="text-xs text-gray-600">
                          {entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-sm font-bold',
                          entry.amount > 0 ? 'text-red-600' : 'text-[#017827]'
                        )}>
                          {entry.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(entry.amount || 0))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Penalty Form */}
            <div className="space-y-4">
              <div>
                <label htmlFor="penaltyAmount" className="mb-2 block text-sm font-bold text-gray-900">
                  Penalty Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="penaltyAmount"
                    type="text"
                    value={penaltyAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '')
                      setPenaltyAmount(value)
                    }}
                    placeholder="Enter penalty amount"
                    className="w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 py-3 text-sm transition-all focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Recommended: {formatCurrency(outstanding * 0.02)} (2% of outstanding dues)
                </p>
              </div>

              <div>
                <label htmlFor="penaltyReason" className="mb-2 block text-sm font-bold text-gray-900">
                  Reason for Penalty <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="penaltyReason"
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  placeholder="Enter reason for applying penalty (e.g., Outstanding dues not repaid, ordered 3+ times without repayment)"
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="text-xs text-red-900">
                  <p className="font-bold">Penalty Application Guidelines</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Penalty is applied to vendors with outstanding dues who have not done repayment</li>
                    <li>Vendor must have ordered 3+ times without any repayment to be eligible</li>
                    <li>Penalty amount will be added to vendor's outstanding balance</li>
                    <li>Vendor will be notified of the penalty application</li>
                  </ul>
                </div>
              </div>
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
              <button
                type="button"
                onClick={handleApplyPenalty}
                disabled={loading || !penaltyAmount || !penaltyReason.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(236,72,153,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(236,72,153,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4" />
                {loading ? 'Applying...' : 'Apply Penalty'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main penalties list view
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 7 • Credit & Finance</p>
          <h2 className="text-2xl font-bold text-gray-900">Penalties Management</h2>
          <p className="text-sm text-gray-600">
            View and apply penalties to vendors who have outstanding dues, have not done repayment, and have ordered 3+ times without any repayment.
          </p>
        </div>
      </header>

      {vendorsList.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-sm font-bold text-gray-900">No Vendors Eligible for Penalties</p>
          <p className="mt-2 text-xs text-gray-600">
            All vendors are up to date with their repayments or do not meet the penalty eligibility criteria.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-pink-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Vendors Eligible for Penalties</h3>
            <DataTable
              columns={tableColumns}
              rows={vendorsList}
              emptyState="No vendors eligible for penalties"
            />
          </div>

          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div>
                <h3 className="text-sm font-bold text-yellow-900">Penalty Eligibility Criteria</h3>
                <ul className="mt-2 space-y-1 text-xs text-yellow-800 list-disc list-inside">
                  <li>Vendor has outstanding dues (credit used but not repaid)</li>
                  <li>Vendor has ordered 3 or more times without any repayment</li>
                  <li>Vendor has not made any repayment in the current cycle</li>
                </ul>
                <p className="mt-3 text-xs text-yellow-700">
                  Penalties are automatically calculated based on vendor's credit policy penalty rate and outstanding amount.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

