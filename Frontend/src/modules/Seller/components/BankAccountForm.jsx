import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { useSellerApi } from '../hooks/useSellerApi'
import { ConfirmationModal } from './ConfirmationModal'
import { BankIcon } from './icons'
import { Trans } from '../../../components/Trans'

export function BankAccountForm({ isOpen, onClose, onSuccess }) {
  const { addBankAccount } = useSellerApi()
  const [step, setStep] = useState('form') // 'form' | 'confirm'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    isPrimary: true,
  })

  const [confirmationData, setConfirmationData] = useState(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.accountHolderName.trim()) {
      newErrors.accountHolderName = <Trans>Account holder name is required</Trans>
    }

    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = <Trans>Account number is required</Trans>
    } else if (!/^\d+$/.test(formData.accountNumber.trim())) {
      newErrors.accountNumber = <Trans>Account number must contain only digits</Trans>
    } else if (formData.accountNumber.trim().length < 9 || formData.accountNumber.trim().length > 18) {
      newErrors.accountNumber = <Trans>Account number must be between 9 and 18 digits</Trans>
    }

    if (!formData.ifscCode.trim()) {
      newErrors.ifscCode = <Trans>IFSC code is required</Trans>
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode.trim().toUpperCase())) {
      newErrors.ifscCode = <Trans>Please enter a valid IFSC code (e.g., SBIN0001234)</Trans>
    }

    if (!formData.bankName.trim()) {
      newErrors.bankName = <Trans>Bank name is required</Trans>
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Prepare confirmation data
    const dataToConfirm = {
      [<Trans>Account Holder Name</Trans>]: formData.accountHolderName.trim(),
      [<Trans>Account Number</Trans>]: formData.accountNumber.trim().replace(/(.{4})/g, '$1 ').trim(), // Format with spaces
      [<Trans>IFSC Code</Trans>]: formData.ifscCode.trim().toUpperCase(),
      [<Trans>Bank Name</Trans>]: formData.bankName.trim(),
      [<Trans>Branch Name</Trans>]: formData.branchName.trim() || <Trans>Not provided</Trans>,
      [<Trans>Set as Primary</Trans>]: formData.isPrimary ? <Trans>Yes</Trans> : <Trans>No</Trans>,
    }

    setConfirmationData(dataToConfirm)
    setStep('confirm')
  }

  const handleConfirm = async () => {
    setLoading(true)

    try {
      const result = await addBankAccount({
        accountHolderName: formData.accountHolderName.trim(),
        accountNumber: formData.accountNumber.trim(),
        ifscCode: formData.ifscCode.trim().toUpperCase(),
        bankName: formData.bankName.trim(),
        branchName: formData.branchName.trim() || undefined,
        isPrimary: formData.isPrimary,
      })

      if (result.data) {
        onSuccess?.(result.data.bankAccount)
        handleClose()
      } else if (result.error) {
        setErrors({ submit: result.error.message || <Trans>Failed to add bank account. Please try again.</Trans> })
        setStep('form')
      }
    } catch (error) {
      setErrors({ submit: error.message || <Trans>An unexpected error occurred. Please try again.</Trans> })
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('form')
    setFormData({
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branchName: '',
      isPrimary: true,
    })
    setErrors({})
    setConfirmationData(null)
    onClose()
  }

  if (!isOpen) return null

  // Confirmation step
  if (step === 'confirm') {
    return (
      <ConfirmationModal
        isOpen={isOpen}
        onClose={() => setStep('form')}
        onConfirm={handleConfirm}
        title={<Trans>Confirm Bank Account Details</Trans>}
        message={<Trans>Please verify all details carefully. Bank account information cannot be changed after submission. Make sure all details are correct.</Trans>}
        details={confirmationData}
        loading={loading}
      />
    )
  }

  // Form step - render as panel overlay
  return (
    <div className={cn('seller-panel', isOpen && 'is-open')}>
      <div className={cn('seller-panel__overlay', isOpen && 'is-open')} onClick={handleClose} />
      <div className={cn('seller-panel__content', isOpen && 'is-open')}>
        <div className="seller-panel__header">
          <div className="seller-panel__header-content">
            <div className="seller-panel__icon">
              <BankIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="seller-panel__title"><Trans>Add Bank Account</Trans></h3>
              <p className="seller-panel__subtitle"><Trans>Add your bank account for withdrawals</Trans></p>
            </div>
          </div>
          <button type="button" className="seller-panel__close" onClick={handleClose} disabled={loading} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="seller-panel__body">
          {/* Warning Message */}
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-700 mb-1">
                  <Trans>Important Notice</Trans>
                </p>
                <p className="text-xs text-yellow-700">
                  <Trans>Bank account details cannot be changed after submission. Please double-check all information before confirming.</Trans>
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} style={{ width: '100%' }}>
            <div className="space-y-4" style={{ width: '100%' }}>
              {/* Account Holder Name */}
              <div style={{ width: '100%' }}>
                <label className="seller-panel__label" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}>
                  <Trans>Account Holder Name</Trans> <span className="text-red-500">*</span>
                </label>
                <div className="relative" style={{ width: '100%' }}>
                  <input
                    type="text"
                    name="accountHolderName"
                    value={formData.accountHolderName}
                    onChange={handleChange}
                    className={cn(
                      'seller-panel__input',
                      errors.accountHolderName && 'is-error'
                    )}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Enter account holder name as per bank records"
                    required
                  />
                </div>
                {errors.accountHolderName && (
                  <span className="seller-panel__error" style={{ display: 'block', width: '100%' }}>{errors.accountHolderName}</span>
                )}
              </div>

              {/* Account Number */}
              <div style={{ width: '100%' }}>
                <label className="seller-panel__label" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}>
                  <Trans>Account Number</Trans> <span className="text-red-500">*</span>
                </label>
                <div className="relative" style={{ width: '100%' }}>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    className={cn(
                      'seller-panel__input',
                      errors.accountNumber && 'is-error'
                    )}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Enter account number (9-18 digits)"
                    maxLength={18}
                    required
                  />
                </div>
                {errors.accountNumber && (
                  <span className="seller-panel__error" style={{ display: 'block', width: '100%' }}>{errors.accountNumber}</span>
                )}
                <p className="text-xs text-gray-500 mt-1" style={{ width: '100%', wordWrap: 'break-word' }}><Trans>Account number must be 9-18 digits</Trans></p>
              </div>

              {/* IFSC Code */}
              <div style={{ width: '100%' }}>
                <label className="seller-panel__label" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}>
                  <Trans>IFSC Code</Trans> <span className="text-red-500">*</span>
                </label>
                <div className="relative" style={{ width: '100%' }}>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleChange}
                    className={cn(
                      'seller-panel__input uppercase',
                      errors.ifscCode && 'is-error'
                    )}
                    style={{ width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }}
                    placeholder="SBIN0001234"
                    maxLength={11}
                    required
                  />
                </div>
                {errors.ifscCode && (
                  <span className="seller-panel__error" style={{ display: 'block', width: '100%' }}>{errors.ifscCode}</span>
                )}
                <p className="text-xs text-gray-500 mt-1" style={{ width: '100%', wordWrap: 'break-word' }}><Trans>Format: 4 letters, 0, 6 alphanumeric (e.g., SBIN0001234)</Trans></p>
              </div>

              {/* Bank Name */}
              <div style={{ width: '100%' }}>
                <label className="seller-panel__label" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}>
                  <Trans>Bank Name</Trans> <span className="text-red-500">*</span>
                </label>
                <div className="relative" style={{ width: '100%' }}>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    className={cn(
                      'seller-panel__input',
                      errors.bankName && 'is-error'
                    )}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Enter bank name (e.g., State Bank of India)"
                    required
                  />
                </div>
                {errors.bankName && (
                  <span className="seller-panel__error" style={{ display: 'block', width: '100%' }}>{errors.bankName}</span>
                )}
              </div>

              {/* Branch Name */}
              <div style={{ width: '100%' }}>
                <label className="seller-panel__label" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}>
                  <Trans>Branch Name</Trans> <span className="text-gray-500">(<Trans>Optional</Trans>)</span>
                </label>
                <div className="relative" style={{ width: '100%' }}>
                  <input
                    type="text"
                    name="branchName"
                    value={formData.branchName}
                    onChange={handleChange}
                    className="seller-panel__input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Enter branch name"
                  />
                </div>
              </div>

              {/* Primary Account Checkbox */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50" style={{ width: '100%', boxSizing: 'border-box' }}>
                <input
                  type="checkbox"
                  name="isPrimary"
                  id="isPrimary"
                  checked={formData.isPrimary}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#017827] focus:ring-[#017827]"
                  style={{ flexShrink: 0 }}
                />
                <label htmlFor="isPrimary" className="flex-1 text-sm text-gray-700" style={{ width: '100%', minWidth: 0 }}>
                  <span className="font-semibold" style={{ display: 'block', wordWrap: 'break-word' }}><Trans>Set as primary account</Trans></span>
                  <p className="text-xs text-gray-500 mt-1" style={{ wordWrap: 'break-word' }}>
                    <Trans>This account will be used by default for withdrawal requests. You can change this later if you add more accounts.</Trans>
                  </p>
                </label>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2" style={{ width: '100%', boxSizing: 'border-box' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 seller-panel__button seller-panel__button--secondary"
                  style={{ minWidth: 0, width: '100%' }}
                >
                  <Trans>Cancel</Trans>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 seller-panel__button seller-panel__button--primary"
                  style={{ minWidth: 0, width: '100%' }}
                >
                  {loading ? <Trans>Processing...</Trans> : <Trans>Continue to Confirm</Trans>}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

