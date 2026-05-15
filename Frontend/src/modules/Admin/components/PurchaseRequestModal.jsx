import { Package, CheckCircle, XCircle, IndianRupee, Calendar, FileText } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { cn } from '../../../lib/cn'

export function PurchaseRequestModal({ isOpen, onClose, request, onApprove, onReject, loading }) {
  if (!request) return null

  const handleApprove = () => {
    onApprove(request.id)
  }

  const handleReject = () => {
    const reason = window.prompt('Please provide a reason for rejection:')
    if (reason) {
      onReject(request.id, { reason })
    }
  }

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vendor Purchase Request Review" size="lg">
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
                {request.products.map((product, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-white p-3">
                    <span className="text-sm text-gray-700">{product.name || product}</span>
                    {product.quantity && (
                      <span className="text-xs text-gray-500">Qty: {product.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {request.description && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-700">{request.description}</p>
            </div>
          )}

          {request.documents && request.documents.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs text-gray-500">Supporting Documents</p>
              <div className="space-y-2">
                {request.documents.map((doc, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{doc.name || doc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Vendor Performance Info */}
        {request.vendorPerformance && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="mb-2 text-xs font-bold text-blue-900">Vendor Performance Summary</p>
            <div className="grid gap-2 text-xs text-blue-800 sm:grid-cols-2">
              {request.vendorPerformance.creditUtilization && (
                <div>
                  <span className="font-semibold">Credit Utilization: </span>
                  <span>{request.vendorPerformance.creditUtilization}%</span>
                </div>
              )}
              {request.vendorPerformance.repaymentHistory && (
                <div>
                  <span className="font-semibold">Repayment History: </span>
                  <span>{request.vendorPerformance.repaymentHistory}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {loading ? 'Processing...' : 'Approve Request'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

