import { useState, useEffect } from 'react'
import { CreditCard, Calendar, AlertCircle, IndianRupee } from 'lucide-react'
import { cn } from '../../../lib/cn'

export function CreditPolicyForm({ vendor, onSubmit, onCancel, loading = false }) {
  const [formData, setFormData] = useState({
    repaymentDays: '',
    penaltyRate: '',
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (vendor) {
      const repaymentDays = typeof vendor.repaymentDays === 'number'
        ? vendor.repaymentDays
        : vendor.creditPolicy?.repaymentDays || 30

      const penaltyRate = typeof vendor.penaltyRate === 'number'
        ? vendor.penaltyRate
        : vendor.creditPolicy?.penaltyRate || 2

      setFormData({
        repaymentDays: repaymentDays || 30,
        penaltyRate: penaltyRate || 2,
      })
    }
  }, [vendor])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.repaymentDays || parseInt(formData.repaymentDays) <= 0) {
      newErrors.repaymentDays = 'Repayment days must be greater than 0'
    }

    if (formData.penaltyRate === '' || parseFloat(formData.penaltyRate) < 0) {
      newErrors.penaltyRate = 'Penalty rate must be 0 or greater'
    }

    if (parseFloat(formData.penaltyRate) > 10) {
      newErrors.penaltyRate = 'Penalty rate should not exceed 10%'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const submitData = {
      repaymentDays: parseInt(formData.repaymentDays),
      penaltyRate: parseFloat(formData.penaltyRate),
    }

    onSubmit(submitData)
  }

  const formatCurrency = (value) => {
    if (!value) return ''
    const num = parseFloat(value)
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(1)} L`
    }
    return `₹${num.toLocaleString('en-IN')}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Repayment Days */}
      <div>
        <label htmlFor="repaymentDays" className="mb-2 block text-sm font-bold text-gray-900">
          <Calendar className="mr-1 inline h-4 w-4" />
          Repayment Days <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="repaymentDays"
          name="repaymentDays"
          value={formData.repaymentDays}
          onChange={handleChange}
          placeholder="0"
          min="1"
          max="90"
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
            errors.repaymentDays
              ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
              : 'border-gray-300 bg-white focus:border-[#017827] focus:ring-[#017827]/50',
          )}
        />
        {errors.repaymentDays && <p className="mt-1 text-xs text-red-600">{errors.repaymentDays}</p>}
        <p className="mt-1 text-xs text-gray-500">Number of days vendor has to repay after purchase</p>
      </div>

      {/* Penalty Rate */}
      <div>
        <label htmlFor="penaltyRate" className="mb-2 block text-sm font-bold text-gray-900">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          Penalty Rate (%) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            id="penaltyRate"
            name="penaltyRate"
            value={formData.penaltyRate}
            onChange={handleChange}
            placeholder="0.0"
            min="0"
            max="10"
            step="0.1"
            className={cn(
              'w-full rounded-xl border px-4 py-3 pr-12 text-sm transition-all focus:outline-none focus:ring-2',
              errors.penaltyRate
                ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                : 'border-gray-300 bg-white focus:border-[#017827] focus:ring-[#017827]/50',
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</div>
        </div>
        {errors.penaltyRate && <p className="mt-1 text-xs text-red-600">{errors.penaltyRate}</p>}
        <p className="mt-1 text-xs text-gray-500">Daily penalty rate applied after grace period</p>
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <CreditCard className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-xs text-blue-900">
            <p className="font-bold">Credit Policy Guidelines</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>No credit limit - vendors can order within ₹50,000 - ₹100,000 range</li>
              <li>Standard repayment period is 30 days</li>
              <li>Default penalty rate is 2% per day after due date</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Credit Policy'}
        </button>
      </div>
    </form>
  )
}

