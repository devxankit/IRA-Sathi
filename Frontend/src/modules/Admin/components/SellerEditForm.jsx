import { useState, useEffect } from 'react'
import { ShieldCheck, ArrowLeft, Save, X } from 'lucide-react'
import { cn } from '../../../lib/cn'

export function SellerEditForm({ seller, onSave, onCancel, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (seller) {
      setFormData({
        name: seller.name || '',
        phone: seller.phone || '',
        email: seller.email || '',
      })
    }
    setErrors({})
  }, [seller])

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required'
    } else if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to IRA Partners
        </button>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 4 • IRA Partner Management</p>
          <h2 className="text-2xl font-bold text-gray-900">Edit IRA Partner Information</h2>
          <p className="text-sm text-gray-600">
            Update IRA partner name, contact number, and email address.
          </p>
        </div>
      </div>
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seller Header */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">IRA Partner ID: {seller?.id || seller?._id || seller?.sellerId || 'N/A'}</h3>
                <p className="text-sm text-gray-600">Update basic IRA partner information</p>
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-bold text-gray-900">
              IRA Partner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter IRA partner name"
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
                errors.name
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
              )}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-bold text-gray-900">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => {
                // Allow only digits and format
                const value = e.target.value.replace(/\D/g, '')
                if (value.length <= 10) {
                  handleChange('phone', value)
                }
              }}
              placeholder="Enter 10-digit phone number"
              maxLength={10}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
                errors.phone
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
              )}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-bold text-gray-900">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Enter email address"
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
                errors.email
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
              )}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(234,179,8,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}




















