import { Building2, CheckCircle, XCircle, FileText, MapPin, Phone, Mail, AlertTriangle, ExternalLink, Eye } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { cn } from '../../../lib/cn'

export function VendorApprovalModal({ isOpen, onClose, vendor, onApprove, onReject, loading }) {
  if (!vendor) return null

  const hasCoverageConflict = vendor.coverageConflicts?.length > 0
  const hasLocation = vendor.location?.lat && vendor.location?.lng
  const firstConflict = hasCoverageConflict ? vendor.coverageConflicts[0] : null
  const conflictingVendorName = firstConflict
    ? firstConflict.vendorA.id === vendor.id
      ? firstConflict.vendorB.name
      : firstConflict.vendorA.name
    : null

  const handleApprove = () => {
    onApprove(vendor.id)
  }

  const handleReject = () => {
    const reason = window.prompt('Please provide a reason for rejection:')
    if (reason) {
      onReject(vendor.id, { reason })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vendor Application Review" size="lg">
      <div className="space-y-6">
        {/* Vendor Information */}
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
            <StatusBadge tone={vendor.status === 'pending' ? 'warning' : 'neutral'}>
              {vendor.status || 'Pending Review'}
            </StatusBadge>
          </div>

          {/* Contact Information */}
          {(vendor.email || vendor.phone) && (
            <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{vendor.email}</span>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{vendor.phone}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-blue-900">Coverage Compliance</h4>
              <p className="mt-1 text-xs text-blue-700">
                Vendors must operate exclusively within a {vendor.coverageRadius || 20} km radius without overlap.
              </p>
            </div>
            <StatusBadge tone={hasCoverageConflict ? 'warning' : 'success'}>
              {hasCoverageConflict ? 'Conflict Detected' : 'Compliant'}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/70 bg-white p-4">
              <p className="text-xs text-gray-500">Coverage Radius</p>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {vendor.coverageRadius ? `${vendor.coverageRadius} km` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white p-4">
              <p className="text-xs text-gray-500">Geo Coordinates</p>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {hasLocation ? `${vendor.location.lat.toFixed(4)}, ${vendor.location.lng.toFixed(4)}` : 'Missing'}
              </p>
            </div>
          </div>
          {hasCoverageConflict && firstConflict ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Overlapping Coverage Alert</p>
                  <p className="mt-1">
                    {conflictingVendorName} operates only {firstConflict.distanceKm} km away. Resolve the overlap before
                    approving this application.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-blue-800">
              {hasLocation
                ? 'No overlapping vendors detected for this application.'
                : '⚠️ Location coordinates are missing. Vendor can still be approved, but coverage validation will be limited.'}
            </p>
          )}
        </div>

        {/* Application Details */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-gray-900">Application Details</h4>
          
          {vendor.applicationDate && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Application Date</p>
              <p className="text-sm font-semibold text-gray-900">{vendor.applicationDate}</p>
            </div>
          )}

          {vendor.documents && vendor.documents.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs text-gray-500">Submitted Documents</p>
              <div className="space-y-2">
                {vendor.documents.map((doc, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{doc.name || doc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vendor.businessDetails && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs text-gray-500">Business Details</p>
              <p className="text-sm text-gray-700">{vendor.businessDetails}</p>
            </div>
          )}
        </div>

        {/* Verification Documents */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-gray-900">Verification Documents</h4>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Aadhaar Card */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-700">Aadhaar Card</p>
                </div>
                {vendor.aadhaarCard?.url ? (
                  <CheckCircle className="h-4 w-4 text-[#017827]" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              {vendor.aadhaarCard?.url ? (
                <div className="space-y-2">
                  {vendor.aadhaarCard.format === 'pdf' ? (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="h-4 w-4 text-red-600" />
                      <span>PDF Document</span>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-gray-300 bg-white">
                      <img 
                        src={vendor.aadhaarCard.url} 
                        alt="Aadhaar Card"
                        className="w-full h-auto max-h-32 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <a
                    href={vendor.aadhaarCard.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <Eye className="h-3 w-3" />
                    View Document
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-red-600">Not uploaded</p>
              )}
            </div>

            {/* PAN Card */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-700">PAN Card</p>
                </div>
                {vendor.panCard?.url ? (
                  <CheckCircle className="h-4 w-4 text-[#017827]" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              {vendor.panCard?.url ? (
                <div className="space-y-2">
                  {vendor.panCard.format === 'pdf' ? (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="h-4 w-4 text-red-600" />
                      <span>PDF Document</span>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-gray-300 bg-white">
                      <img 
                        src={vendor.panCard.url} 
                        alt="PAN Card"
                        className="w-full h-auto max-h-32 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <a
                    href={vendor.panCard.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <Eye className="h-3 w-3" />
                    View Document
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-red-600">Not uploaded</p>
              )}
            </div>
          </div>
        </div>

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
              disabled={loading || hasCoverageConflict}
              className={cn(
                'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all',
                loading || hasCoverageConflict
                  ? 'bg-gray-400 shadow-none cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#017827] to-[#0a9937] shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]',
              )}
            >
              <CheckCircle className="h-4 w-4" />
              {hasCoverageConflict
                ? 'Resolve Coverage Conflicts'
                : loading
                  ? 'Processing...'
                  : 'Approve Vendor'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

