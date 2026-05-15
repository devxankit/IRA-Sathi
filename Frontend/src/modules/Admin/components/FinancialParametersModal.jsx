import { useState, useEffect } from 'react'
import { Settings, Percent, IndianRupee, AlertCircle } from 'lucide-react'
import { Modal } from './Modal'
import { cn } from '../../../lib/cn'

export function FinancialParametersModal({ isOpen, onClose, parameters, onSave, loading }) {
  const [formData, setFormData] = useState({
    userAdvancePaymentPercent: 30,
    minimumUserOrder: 2000,
    minimumVendorPurchase: 50000,
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (parameters) {
      setFormData({
        userAdvancePaymentPercent: parameters.userAdvancePaymentPercent || 30,
        minimumUserOrder: parameters.minimumUserOrder || 2000,
        minimumVendorPurchase: parameters.minimumVendorPurchase || 50000,
      })
    }
  }, [parameters])

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const newErrors = {}
    
    if (formData.userAdvancePaymentPercent < 0 || formData.userAdvancePaymentPercent > 100) {
      newErrors.userAdvancePaymentPercent = 'Advance payment must be between 0% and 100%'
    }
    if (formData.minimumUserOrder < 0) {
      newErrors.minimumUserOrder = 'Minimum order must be a positive value'
    }
    if (formData.minimumVendorPurchase < 0) {
      newErrors.minimumVendorPurchase = 'Minimum vendor purchase must be a positive value'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      onSave(formData)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Global Financial Parameters" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Advance Payment % */}
        <div>
          <label htmlFor="advancePercent" className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            <Percent className="h-4 w-4" />
            User Advance Payment % <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              id="advancePercent"
              min="0"
              max="100"
              step="0.1"
              value={formData.userAdvancePaymentPercent}
              onChange={(e) => handleChange('userAdvancePaymentPercent', parseFloat(e.target.value) || 0)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 pr-12 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
                errors.userAdvancePaymentPercent
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-pink-500 focus:ring-pink-500/50',
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">%</span>
          </div>
          {errors.userAdvancePaymentPercent && (
            <p className="mt-1 text-xs text-red-600">{errors.userAdvancePaymentPercent}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">Default advance payment percentage for all user orders</p>
        </div>

        {/* Minimum User Order */}
        <div>
          <label htmlFor="minUserOrder" className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            <IndianRupee className="h-4 w-4" />
            Minimum Order for User <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">₹</span>
            <input
              type="number"
              id="minUserOrder"
              min="0"
              step="100"
              value={formData.minimumUserOrder}
              onChange={(e) => handleChange('minimumUserOrder', parseFloat(e.target.value) || 0)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 pl-8 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
                errors.minimumUserOrder
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-pink-500 focus:ring-pink-500/50',
              )}
            />
          </div>
          {errors.minimumUserOrder && (
            <p className="mt-1 text-xs text-red-600">{errors.minimumUserOrder}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">Minimum order value required for user purchases</p>
        </div>

        {/* Minimum Vendor Purchase */}
        <div>
          <label htmlFor="minVendorPurchase" className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            <IndianRupee className="h-4 w-4" />
            Minimum Vendor Purchase <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">₹</span>
            <input
              type="number"
              id="minVendorPurchase"
              min="0"
              step="1000"
              value={formData.minimumVendorPurchase}
              onChange={(e) => handleChange('minimumVendorPurchase', parseFloat(e.target.value) || 0)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 pl-8 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
                errors.minimumVendorPurchase
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-pink-500 focus:ring-pink-500/50',
              )}
            />
          </div>
          {errors.minimumVendorPurchase && (
            <p className="mt-1 text-xs text-red-600">{errors.minimumVendorPurchase}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">Minimum purchase value required for vendor orders</p>
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-xs text-blue-900">
              <p className="font-bold">Parameter Guidelines</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Changes will apply to all new orders</li>
                <li>Existing orders will not be affected</li>
                <li>Vendor credit policies may override these defaults</li>
              </ul>
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
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(236,72,153,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(236,72,153,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
          >
            <Settings className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Parameters'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

