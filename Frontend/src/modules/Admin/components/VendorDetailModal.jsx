import { Building2, MapPin, IndianRupee, Calendar, TrendingUp, AlertTriangle, History } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { Timeline } from './Timeline'
import { cn } from '../../../lib/cn'

export function VendorDetailModal({ isOpen, onClose, vendor, onUpdateCreditPolicy }) {
  if (!vendor) return null

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  const creditLimit = typeof vendor.creditLimit === 'number' 
    ? vendor.creditLimit 
    : parseFloat(vendor.creditLimit?.replace(/[₹,\sL]/g, '') || '0') * 100000

  const dues = typeof vendor.dues === 'number'
    ? vendor.dues
    : parseFloat(vendor.dues?.replace(/[₹,\sL]/g, '') || '0') * 100000

  const creditUtilization = creditLimit > 0 ? ((dues / creditLimit) * 100).toFixed(1) : 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vendor Details & Performance" size="xl">
      <div className="space-y-6">
        {/* Vendor Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{vendor.name}</h3>
                <p className="text-sm text-gray-600">Vendor ID: {vendor.id}</p>
                <div className="mt-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{vendor.region}</span>
                </div>
              </div>
            </div>
            <StatusBadge tone={vendor.status === 'On Track' || vendor.status === 'on_track' ? 'success' : vendor.status === 'Delayed' || vendor.status === 'delayed' ? 'warning' : 'neutral'}>
              {vendor.status || 'Unknown'}
            </StatusBadge>
          </div>
        </div>

        {/* Credit Performance Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Credit Limit</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(creditLimit)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Outstanding Dues</p>
            <p className="mt-1 text-lg font-bold text-red-600">
              {formatCurrency(dues)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Credit Utilization</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {creditUtilization}%
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  parseFloat(creditUtilization) > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : parseFloat(creditUtilization) > 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gradient-to-r from-[#017827] to-[#0a9937]',
                )}
                style={{ width: `${Math.min(creditUtilization, 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Repayment Days</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {vendor.repaymentDays || vendor.repayment || 'N/A'}
            </p>
          </div>
        </div>

        {/* Coverage & Policy */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-blue-900">Coverage Radius</h4>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {vendor.coverageRadius ? `${vendor.coverageRadius} km` : 'N/A'}
                </p>
                {vendor.serviceArea && (
                  <p className="text-xs text-blue-700">{vendor.serviceArea}</p>
                )}
              </div>
              <StatusBadge tone={vendor.coverageConflicts?.length ? 'warning' : 'success'}>
                {vendor.coverageConflicts?.length ? 'Conflict' : 'Compliant'}
              </StatusBadge>
            </div>
            {vendor.coverageConflicts?.length ? (
              <ul className="mt-4 space-y-2 text-xs text-blue-900">
                {vendor.coverageConflicts.map((conflict) => {
                  const otherVendor =
                    conflict.vendorA.id === vendor.id ? conflict.vendorB : conflict.vendorA
                  return (
                    <li
                      key={`${vendor.id}-${otherVendor.id}`}
                      className="rounded-lg border border-blue-200 bg-white/80 px-3 py-2"
                    >
                      <p className="font-semibold">{otherVendor.name}</p>
                      <p className="text-[0.7rem] text-blue-700">
                        Distance: {conflict.distanceKm} km • Overlap: {conflict.overlapKm} km
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-blue-800">
                No overlapping vendors detected within the 20 km exclusivity rule.
              </p>
            )}
          </div>

          {/* Credit Policy */}
          <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#014a19]">Credit Policy</h4>
                <div className="mt-2 grid gap-2 text-xs text-[#015c1f] sm:grid-cols-3">
                  <div>
                    <span className="font-semibold">Limit: </span>
                    <span>{formatCurrency(creditLimit)}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Repayment: </span>
                    <span>{vendor.repaymentDays || vendor.repayment || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Penalty: </span>
                    <span>{vendor.penaltyRate || vendor.penalty || 'N/A'}</span>
                  </div>
                </div>
              </div>
              {onUpdateCreditPolicy && (
                <button
                  type="button"
                  onClick={() => onUpdateCreditPolicy(vendor)}
                  className="rounded-lg border border-[rgba(1,120,39,0.4)] bg-white px-4 py-2 text-xs font-bold text-[#017827] transition-all hover:bg-[rgba(1,120,39,0.1)]"
                >
                  Update Policy
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Repayment History */}
        {vendor.repaymentHistory && vendor.repaymentHistory.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-blue-600" />
              <h4 className="text-sm font-bold text-gray-900">Repayment History</h4>
            </div>
            <Timeline
              events={vendor.repaymentHistory.map((entry, index) => ({
                id: `history-${index}`,
                title: entry.title || `Payment ${index + 1}`,
                timestamp: entry.date || entry.timestamp || 'N/A',
                description: entry.description || formatCurrency(entry.amount || 0),
                status: entry.status || 'completed',
              }))}
            />
          </div>
        )}

        {/* Performance Alerts */}
        {parseFloat(creditUtilization) > 80 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-900">High Credit Utilization Alert</p>
                <p className="mt-1 text-xs text-red-700">
                  This vendor has exceeded 80% credit utilization. Consider reviewing their credit limit or requesting immediate repayment.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

