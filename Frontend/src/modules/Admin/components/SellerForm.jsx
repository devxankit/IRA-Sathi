import { useState, useEffect } from 'react'
import { User, Percent, Target, IndianRupee, Hash } from 'lucide-react'
import { cn } from '../../../lib/cn'

export function SellerForm({ seller, onSubmit, onCancel, loading = false }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    area: '',
    sellerId: '',
    cashbackRate: '',
    commissionRate: '',
    monthlyTarget: '',
  })

  const [errors, setErrors] = useState({})
  const [autoGenerateId, setAutoGenerateId] = useState(true)

  useEffect(() => {
    if (seller) {
      // Parse existing seller data
      const cashbackRate = typeof seller.cashbackRate === 'number'
        ? seller.cashbackRate
        : parseFloat(seller.cashback?.replace(/[%\s]/g, '') || '0')

      const commissionRate = typeof seller.commissionRate === 'number'
        ? seller.commissionRate
        : parseFloat(seller.commission?.replace(/[%\s]/g, '') || '0')

      const monthlyTarget = typeof seller.monthlyTarget === 'number'
        ? seller.monthlyTarget
        : parseFloat(seller.target?.replace(/[₹,\sL]/g, '') || '0') * 100000

      setFormData({
        name: seller.name || '',
        email: seller.email || '',
        phone: seller.phone || '',
        area: seller.area || '',
        sellerId: seller.sellerId || seller.id || '',
        cashbackRate: cashbackRate || '',
        commissionRate: commissionRate || '',
        monthlyTarget: monthlyTarget || '',
      })
      setAutoGenerateId(false)
    } else {
      // Generate unique seller ID for new sellers
      const newId = `SLR-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
      setFormData((prev) => ({ ...prev, sellerId: newId }))
    }
  }, [seller])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleGenerateId = () => {
    const newId = `SLR-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    setFormData((prev) => ({ ...prev, sellerId: newId }))
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'IRA Partner name is required'
    }

    if (!seller && !formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!/^[+]?[\d\s-()]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid phone number'
    }

    if (!formData.area.trim()) {
      newErrors.area = 'Area is required'
    }

    if (!formData.sellerId.trim()) {
      newErrors.sellerId = 'IRA Partner ID is required'
    } else if (!/^SLR-\d{3}$/.test(formData.sellerId)) {
      newErrors.sellerId = 'IRA Partner ID must be in format SLR-XXX'
    }

    if (formData.cashbackRate === '' || parseFloat(formData.cashbackRate) < 0 || parseFloat(formData.cashbackRate) > 10) {
      newErrors.cashbackRate = 'Cashback rate must be between 0% and 10%'
    }

    if (formData.commissionRate === '' || parseFloat(formData.commissionRate) < 0 || parseFloat(formData.commissionRate) > 20) {
      newErrors.commissionRate = 'Commission rate must be between 0% and 20%'
    }

    if (!formData.monthlyTarget || parseFloat(formData.monthlyTarget) <= 0) {
      newErrors.monthlyTarget = 'Monthly target must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const submitData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      area: formData.area.trim(),
      sellerId: formData.sellerId.trim(),
      cashbackRate: parseFloat(formData.cashbackRate),
      commissionRate: parseFloat(formData.commissionRate),
      monthlyTarget: parseFloat(formData.monthlyTarget),
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
      {/* Personal Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-900">Personal Information</h4>
        
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-bold text-gray-900">
            <User className="mr-1 inline h-4 w-4" />
            IRA Partner Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Priya Nair"
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
              errors.name
                ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
            )}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-bold text-gray-900">
              Email {!seller && <span className="text-red-500">*</span>}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seller@example.com"
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
                errors.email
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
              )}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-bold text-gray-900">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 9876543210"
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
                errors.phone
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
              )}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="area" className="mb-2 block text-sm font-bold text-gray-900">
            Area / Region <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="area"
            name="area"
            value={formData.area}
            onChange={handleChange}
            placeholder="e.g., Surat, Gujarat"
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
              errors.area
                ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
            )}
          />
          {errors.area && <p className="mt-1 text-xs text-red-600">{errors.area}</p>}
        </div>
      </div>

      {/* Seller ID */}
      <div>
        <label htmlFor="sellerId" className="mb-2 block text-sm font-bold text-gray-900">
          <Hash className="mr-1 inline h-4 w-4" />
          Unique IRA Partner ID <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="sellerId"
            name="sellerId"
            value={formData.sellerId}
            onChange={handleChange}
            placeholder="SLR-001"
            pattern="SLR-\d{3}"
            className={cn(
              'flex-1 rounded-xl border px-4 py-3 text-sm font-mono transition-all focus:outline-none focus:ring-2',
              errors.sellerId
                ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
            )}
          />
          {!seller && (
            <button
              type="button"
              onClick={handleGenerateId}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-xs font-bold text-gray-700 transition-all hover:bg-gray-50"
            >
              Generate
            </button>
          )}
        </div>
        {errors.sellerId && <p className="mt-1 text-xs text-red-600">{errors.sellerId}</p>}
        <p className="mt-1 text-xs text-gray-500">Format: SLR-XXX (e.g., SLR-883)</p>
      </div>

      {/* Incentive Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-900">Incentive Settings</h4>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cashbackRate" className="mb-2 block text-sm font-bold text-gray-900">
              <Percent className="mr-1 inline h-4 w-4" />
              Cashback Rate (%) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="cashbackRate"
                name="cashbackRate"
                value={formData.cashbackRate}
                onChange={handleChange}
                placeholder="0.0"
                min="0"
                max="10"
                step="0.1"
                className={cn(
                  'w-full rounded-xl border px-4 py-3 pr-12 text-sm transition-all focus:outline-none focus:ring-2',
                  errors.cashbackRate
                    ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                    : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</div>
            </div>
            {errors.cashbackRate && <p className="mt-1 text-xs text-red-600">{errors.cashbackRate}</p>}
          </div>

          <div>
            <label htmlFor="commissionRate" className="mb-2 block text-sm font-bold text-gray-900">
              <Percent className="mr-1 inline h-4 w-4" />
              Commission Rate (%) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="commissionRate"
                name="commissionRate"
                value={formData.commissionRate}
                onChange={handleChange}
                placeholder="0.0"
                min="0"
                max="20"
                step="0.1"
                className={cn(
                  'w-full rounded-xl border px-4 py-3 pr-12 text-sm transition-all focus:outline-none focus:ring-2',
                  errors.commissionRate
                    ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                    : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</div>
            </div>
            {errors.commissionRate && <p className="mt-1 text-xs text-red-600">{errors.commissionRate}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="monthlyTarget" className="mb-2 block text-sm font-bold text-gray-900">
            <Target className="mr-1 inline h-4 w-4" />
            <IndianRupee className="mr-1 inline h-4 w-4" />
            Monthly Sales Target <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              id="monthlyTarget"
              name="monthlyTarget"
              value={formData.monthlyTarget}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="1000"
              className={cn(
                'w-full rounded-xl border px-4 py-3 pr-24 text-sm transition-all focus:outline-none focus:ring-2',
                errors.monthlyTarget
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-yellow-500 focus:ring-yellow-500/50',
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              {formData.monthlyTarget ? formatCurrency(formData.monthlyTarget) : '₹0'}
            </div>
          </div>
          {errors.monthlyTarget && <p className="mt-1 text-xs text-red-600">{errors.monthlyTarget}</p>}
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
          className="rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(234,179,8,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
        >
          {loading ? 'Saving...' : seller ? 'Update IRA Partner' : 'Create IRA Partner'}
        </button>
      </div>
    </form>
  )
}

