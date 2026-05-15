import { Building2, IndianRupee, Calendar, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { Timeline } from './Timeline'
import { cn } from '../../../lib/cn'

export function VendorCreditBalanceModal({ isOpen, onClose, vendor, creditData, onApplyPenalty, loading }) {
  if (!vendor || !creditData) return null

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)} Cr`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  const creditUtilization = creditData.creditLimit > 0
    ? (creditData.usedCredit / creditData.creditLimit) * 100
    : 0

  const overdueAmount = creditData.overdueAmount || 0
  const penaltyAmount = creditData.penaltyAmount || 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Credit Balance - ${vendor.name || vendor.vendorName}`} size="xl">
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
              <TrendingUp className="h-4 w-4" />
              <span>Credit Limit</span>
            </div>
            <p className="text-xl font-bold text-blue-900">
              {formatCurrency(creditData.creditLimit || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-4">
            <div className="flex items-center gap-2 text-xs text-[#0a9937] mb-2">
              <IndianRupee className="h-4 w-4" />
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
              <TrendingDown className="h-4 w-4" />
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
        {overdueAmount > 0 && onApplyPenalty && (
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onApplyPenalty(vendor.id || vendor.vendorId)}
              disabled={loading || penaltyAmount > 0}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              <AlertCircle className="h-4 w-4" />
              Apply Penalty
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

