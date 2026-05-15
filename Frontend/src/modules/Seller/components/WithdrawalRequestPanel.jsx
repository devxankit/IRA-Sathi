import { useState, useEffect } from 'react'
import { useSellerState } from '../context/SellerContext'
import { useSellerApi } from '../hooks/useSellerApi'
import { sellerSnapshot } from '../services/sellerData'
import { cn } from '../../../lib/cn'
import { WalletIcon, CloseIcon } from './icons'
import { useToast } from './ToastNotification'
import { ConfirmationModal } from './ConfirmationModal'
import { Trans } from '../../../components/Trans'

export function WithdrawalRequestPanel({ isOpen, onClose, onSuccess, availableBalance: propBalance, bankAccounts: propBankAccounts = [] }) {
  const { dashboard } = useSellerState()
  const { requestWithdrawal, loading, getBankAccounts } = useSellerApi()
  const { success, error: showError } = useToast()
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState(propBankAccounts)
  const [errors, setErrors] = useState({})
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingWithdrawalData, setPendingWithdrawalData] = useState(null)

  const wallet = dashboard?.wallet || sellerSnapshot.wallet
  const availableBalance = propBalance !== undefined
    ? propBalance
    : (typeof wallet.balance === 'number'
      ? wallet.balance
      : parseFloat(wallet.balance?.replace(/[₹,\s]/g, '') || '0'))
  const minWithdrawal = 500

  // Fetch bank accounts if not provided
  useEffect(() => {
    if (isOpen && bankAccounts.length === 0) {
      getBankAccounts().then((result) => {
        if (result.data?.bankAccounts) {
          setBankAccounts(result.data.bankAccounts)
          // Auto-select primary account
          const primary = result.data.bankAccounts.find(acc => acc.isPrimary)
          if (primary) {
            setBankAccountId(primary._id || primary.id)
          }
        }
      })
    }
  }, [isOpen, getBankAccounts, bankAccounts.length])

  const validateForm = () => {
    const newErrors = {}

    if (!amount || parseFloat(amount) < minWithdrawal) {
      newErrors.amount = <Trans>Minimum withdrawal amount is ₹{minWithdrawal.toLocaleString('en-IN')}</Trans>
    } else if (parseFloat(amount) > availableBalance) {
      newErrors.amount = <Trans>Amount exceeds available balance (₹{Math.round(availableBalance).toLocaleString('en-IN')})</Trans>
    }

    if (!bankAccountId) {
      newErrors.bankAccountId = <Trans>Please select a bank account</Trans>
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    if (bankAccounts.length === 0) {
      showError(<Trans>Please add a bank account first</Trans>)
      return
    }

    const withdrawalData = {
      amount: parseFloat(amount),
      bankAccountId,
    }

    // Get bank account details for confirmation
    const selectedAccount = bankAccounts.find(acc => (acc._id || acc.id) === bankAccountId)
    const bankAccountDetails = selectedAccount ? {
      [<Trans>Account Holder</Trans>]: selectedAccount.accountHolderName || <Trans>N/A</Trans>,
      [<Trans>Account Number</Trans>]: `****${(selectedAccount.accountNumber || '').slice(-4)}`,
      [<Trans>IFSC Code</Trans>]: selectedAccount.ifscCode || <Trans>N/A</Trans>,
      [<Trans>Bank Name</Trans>]: selectedAccount.bankName || <Trans>N/A</Trans>,
    } : null

    // Show confirmation modal
    setPendingWithdrawalData({
      ...withdrawalData,
      bankAccountDetails,
    })
    setShowConfirmation(true)
  }

  const handleConfirmWithdrawal = async () => {
    if (!pendingWithdrawalData) return

    const result = await requestWithdrawal(pendingWithdrawalData)

    if (result.error) {
      showError(result.error.message || <Trans>Failed to submit withdrawal request</Trans>)
      setShowConfirmation(false)
      setPendingWithdrawalData(null)
      return
    }

    success(<Trans>Withdrawal request of ₹{pendingWithdrawalData.amount.toLocaleString('en-IN')} submitted successfully!</Trans>)
    onSuccess?.(pendingWithdrawalData)

    // Reset form
    setAmount('')
    setBankAccountId('')
    setErrors({})
    setShowConfirmation(false)
    setPendingWithdrawalData(null)
    onClose()
  }

  const handleAmountChange = (value) => {
    const numValue = value.replace(/[^0-9.]/g, '')
    setAmount(numValue)
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: null }))
    }
  }

  if (!isOpen) return null

  return (
    <div className={cn('seller-panel', isOpen && 'is-open')}>
      <div className={cn('seller-panel__overlay', isOpen && 'is-open')} onClick={onClose} />
      <div className={cn('seller-panel__content', isOpen && 'is-open')}>
        <div className="seller-panel__header">
          <div className="seller-panel__header-content">
            <div className="seller-panel__icon">
              <WalletIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="seller-panel__title"><Trans>Request Withdrawal</Trans></h3>
              <p className="seller-panel__subtitle"><Trans>Transfer funds to your bank account</Trans></p>
            </div>
          </div>
          <button type="button" className="seller-panel__close" onClick={onClose} aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="seller-panel__body">
          <div className="seller-panel__balance-info">
            <div className="seller-panel__balance-item">
              <span className="seller-panel__balance-label"><Trans>Available Balance</Trans></span>
              <span className="seller-panel__balance-value">
                {typeof wallet.balance === 'number'
                  ? `₹${wallet.balance.toLocaleString('en-IN')}`
                  : wallet.balance}
              </span>
            </div>
            <div className="seller-panel__balance-item">
              <span className="seller-panel__balance-label"><Trans>Minimum Withdrawal</Trans></span>
              <span className="seller-panel__balance-value">₹{minWithdrawal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="seller-panel__field">
            <label className="seller-panel__label">
              <Trans>Withdrawal Amount</Trans> <span className="seller-panel__required">*</span>
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="Enter amount"
              className={cn('seller-panel__input', errors.amount && 'is-error')}
            />
            {errors.amount && <span className="seller-panel__error">{errors.amount}</span>}
            {amount && !errors.amount && (
              <span className="seller-panel__hint">
                <Trans>You will receive ₹{parseFloat(amount || 0).toLocaleString('en-IN')} in your bank account</Trans>
              </span>
            )}
          </div>

          <div className="seller-panel__field">
            <label className="seller-panel__label">
              <Trans>Bank Account</Trans> <span className="seller-panel__required">*</span>
            </label>
            {bankAccounts.length === 0 ? (
              <>
                <div className="seller-panel__info-box" style={{ marginBottom: '0.5rem' }}>
                  <p className="seller-panel__info-text">
                    <Trans>No bank accounts added. Please add a bank account first.</Trans>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    // Trigger add bank account panel (will be handled by parent)
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('seller-open-panel', { detail: { panel: 'add-bank-account' } }))
                    }, 300)
                  }}
                  className="seller-panel__button seller-panel__button--secondary"
                  style={{ width: '100%' }}
                >
                  <Trans>Add Bank Account</Trans>
                </button>
              </>
            ) : (
              <select
                value={bankAccountId}
                onChange={(e) => {
                  setBankAccountId(e.target.value)
                  if (errors.bankAccountId) {
                    setErrors((prev) => ({ ...prev, bankAccountId: null }))
                  }
                }}
                className={cn('seller-panel__input', errors.bankAccountId && 'is-error')}
              >
                <option value=""><Trans>Select bank account</Trans></option>
                {bankAccounts.map((account) => (
                  <option key={account._id || account.id} value={account._id || account.id}>
                    {account.accountHolderName} - {account.bankName} (****{account.accountNumber?.slice(-4) || <Trans>N/A</Trans>})
                    {account.isPrimary ? <Trans> (Primary)</Trans> : ''}
                  </option>
                ))}
              </select>
            )}
            {errors.bankAccountId && <span className="seller-panel__error">{errors.bankAccountId}</span>}
          </div>

          <div className="seller-panel__info-box">
            <p className="seller-panel__info-text">
              <strong><Trans>Note:</Trans></strong> <Trans>Withdrawal requests are processed within 24-48 hours. You will receive a confirmation once the transfer is initiated.</Trans>
            </p>
          </div>

          <div className="seller-panel__actions">
            <button type="button" onClick={onClose} className="seller-panel__button seller-panel__button--secondary">
              <Trans>Cancel</Trans>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="seller-panel__button seller-panel__button--primary"
            >
              {loading ? <Trans>Processing...</Trans> : <Trans>Submit Request</Trans>}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => {
          setShowConfirmation(false)
          setPendingWithdrawalData(null)
        }}
        onConfirm={handleConfirmWithdrawal}
        title={<Trans>Confirm Withdrawal Request</Trans>}
        message={<Trans>Please verify all bank account details and withdrawal amount before proceeding. Once submitted, this request will be sent to admin for approval.</Trans>}
        details={pendingWithdrawalData ? {
          [<Trans>Withdrawal Amount</Trans>]: `₹${pendingWithdrawalData.amount.toLocaleString('en-IN')}`,
          [<Trans>Available Balance</Trans>]: `₹${Math.round(availableBalance).toLocaleString('en-IN')}`,
          ...(pendingWithdrawalData.bankAccountDetails || {}),
        } : null}
        loading={loading}
      />
    </div>
  )
}

