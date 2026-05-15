import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle, AlertCircle, IndianRupee, Factory, CreditCard, Shield, Calendar } from 'lucide-react'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { openRazorpayCheckout } from '../../../utils/razorpay'
import { getMaskedBankDetails } from '../../../utils/maskSensitiveData'
import { cn } from '../../../lib/cn'

const STEPS = [
  { id: 1, label: 'Confirmation', icon: AlertCircle },
  { id: 2, label: 'Payment', icon: CreditCard },
  { id: 3, label: 'Approval', icon: CheckCircle },
]

export function VendorWithdrawalApprovalScreen({ request, onBack, onSuccess }) {
  const { approveVendorWithdrawal, createVendorWithdrawalPaymentIntent } = useAdminApi()
  const { success, error: showError } = useToast()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [paymentIntent, setPaymentIntent] = useState(null)
  const [paymentCompleted, setPaymentCompleted] = useState(false)

  const formatCurrency = (value) => {
    if (typeof value === 'string') return value
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
    return `₹${value.toLocaleString('en-IN')}`
  }

  const handleConfirm = () => {
    setCurrentStep(2)
  }

  const handleProceedToPayment = async () => {
    try {
      setLoading(true)
      // Create payment intent
      const result = await createVendorWithdrawalPaymentIntent(request.requestId || request.id, {
        amount: request.amount,
      })

      if (result?.error) {
        showError(result.error.message || 'Failed to create payment intent')
        return
      }

      if (result?.data?.paymentIntent) {
        setPaymentIntent(result.data.paymentIntent)
      } else {
        showError('Invalid payment intent response')
        return
      }
    } catch (err) {
      showError(err.message || 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!paymentIntent) {
      showError('Payment intent not initialized')
      return
    }

    try {
      setLoading(true)
      const { razorpayOrderId, keyId, amount, isTestMode } = paymentIntent

      // If in test mode (simulated order), skip Razorpay checkout and simulate payment
      if (isTestMode || razorpayOrderId?.startsWith('order_test_')) {
        console.log('⚠️ [VendorWithdrawalApprovalScreen] Test mode detected, simulating payment...')
        
        // Simulate payment success
        const simulatedPaymentResponse = {
          paymentId: `pay_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          orderId: razorpayOrderId,
          signature: `sig_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }

        // Payment successful, proceed to approval
        setPaymentCompleted(true)
        setCurrentStep(3)

        // Approve withdrawal with simulated payment details
        const approveResult = await approveVendorWithdrawal(request.requestId || request.id, {
          paymentReference: simulatedPaymentResponse.paymentId,
          paymentMethod: 'razorpay',
          paymentDate: new Date().toISOString(),
          gatewayPaymentId: simulatedPaymentResponse.paymentId,
          gatewayOrderId: simulatedPaymentResponse.orderId,
          gatewaySignature: simulatedPaymentResponse.signature,
        })

        if (approveResult?.error) {
          showError(approveResult.error.message || 'Failed to approve withdrawal')
          setCurrentStep(2)
          setPaymentCompleted(false)
          return
        }

        success('Withdrawal approved and payment processed successfully! (Test Mode)')
        setTimeout(() => {
          onSuccess?.()
        }, 1500)
        return
      }

      if (!razorpayOrderId || !keyId) {
        showError('Payment gateway configuration error')
        return
      }

      // Open Razorpay Checkout (only for real orders)
      const razorpayResponse = await openRazorpayCheckout({
        key: keyId,
        amount: amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'IRA SATHI',
        description: `Vendor Withdrawal Payment - ${request.vendorName || 'Vendor'}`,
        prefill: {
          name: request.vendorName || '',
          email: '',
          contact: '',
        },
      })

      // Payment successful, proceed to approval
      setPaymentCompleted(true)
      setCurrentStep(3)

      // Approve withdrawal with payment details
      const approveResult = await approveVendorWithdrawal(request.requestId || request.id, {
        paymentReference: razorpayResponse.paymentId,
        paymentMethod: 'razorpay',
        paymentDate: new Date().toISOString(),
        gatewayPaymentId: razorpayResponse.paymentId,
        gatewayOrderId: razorpayResponse.orderId,
        gatewaySignature: razorpayResponse.signature,
      })

      if (approveResult?.error) {
        showError(approveResult.error.message || 'Failed to approve withdrawal')
        setCurrentStep(2)
        setPaymentCompleted(false)
        return
      }

      success('Withdrawal approved and payment processed successfully!')
      setTimeout(() => {
        onSuccess?.()
      }, 1500)
    } catch (razorpayError) {
      if (razorpayError.error) {
        showError(razorpayError.error || 'Payment was cancelled or failed')
      } else {
        showError(razorpayError.message || 'Payment processing failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const bankDetails = request.bankDetails ? getMaskedBankDetails(request.bankDetails) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition-all hover:border-[#017827] hover:bg-[rgba(1,120,39,0.05)] hover:text-[#017827]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Finance • Withdrawals</p>
          <h2 className="text-2xl font-bold text-gray-900">Approve Vendor Withdrawal</h2>
          <p className="text-sm text-gray-600">Process vendor withdrawal request and payment</p>
        </div>
      </header>

      {/* Steps Indicator */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id
            const Icon = step.icon

            return (
              <div key={step.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all',
                      isCompleted
                        ? 'border-[#017827] bg-[#017827] text-white'
                        : isActive
                        ? 'border-[#017827] bg-[rgba(1,120,39,0.04)] text-[#017827]'
                        : 'border-gray-300 bg-white text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium',
                      isActive ? 'text-[#017827]' : isCompleted ? 'text-[#0a9937]' : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-4 h-0.5 flex-1',
                      isCompleted ? 'bg-[#017827]' : 'bg-gray-300'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: Confirmation */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                <Factory className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Request #{request.requestId || request.id || 'N/A'}</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                  <span>{request.vendorName || 'Unknown Vendor'}</span>
                </div>
                {request.date && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(request.date).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-5">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <IndianRupee className="h-4 w-4" />
                  <span>Withdrawal Amount</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(request.amount || 0)}</p>
              </div>

              {bankDetails && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-bold text-gray-500">Bank Account Details</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    {bankDetails.accountHolderName && (
                      <p>Account Holder: {bankDetails.accountHolderName}</p>
                    )}
                    {bankDetails.accountNumber && (
                      <p>Account: {bankDetails.accountNumber}</p>
                    )}
                    {bankDetails.ifscCode && <p>IFSC: {bankDetails.ifscCode}</p>}
                    {bankDetails.bankName && <p>Bank: {bankDetails.bankName}</p>}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Confirmation Required</p>
                    <p className="mt-1 text-xs text-blue-700">
                      Please verify all details before proceeding. Once approved, the payment will be processed via Razorpay and the amount will be credited to the vendor's account.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4)]"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">Payment Processing</h3>
              <p className="mt-1 text-sm text-gray-600">Process payment via Razorpay</p>
            </div>

            {!paymentIntent ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Razorpay Payment Gateway</p>
                      <p className="text-xs text-gray-600">Secure payment processing</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Amount to Pay</span>
                      <span className="text-xl font-bold text-gray-900">{formatCurrency(request.amount || 0)}</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                      <Shield className="h-4 w-4" />
                      <span>Your payment is secured by Razorpay</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] disabled:opacity-50"
                  >
                    {loading ? 'Initializing...' : 'Proceed to Payment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#017827] to-[#0a9937] text-white">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Payment Ready</p>
                      <p className="text-xs text-gray-600">Click below to complete payment</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Amount</span>
                      <span className="text-xl font-bold text-gray-900">{formatCurrency(request.amount || 0)}</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Payment Gateway: Razorpay
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentIntent(null)
                      setCurrentStep(1)
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4)] disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Pay Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Approval Complete */}
      {currentStep === 3 && paymentCompleted && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-[rgba(1,120,39,0.25)] bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
            <div className="text-center py-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(1,120,39,0.1)]">
                <CheckCircle className="h-10 w-10 text-[#017827]" />
              </div>
              <h3 className="mt-4 text-2xl font-bold text-gray-900">Withdrawal Approved!</h3>
              <p className="mt-2 text-sm text-gray-600">
                Payment processed successfully and amount has been credited to vendor.
              </p>
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vendor:</span>
                    <span className="font-semibold text-gray-900">{request.vendorName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(request.amount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-semibold text-[#017827]">Approved & Paid</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onSuccess}
                className="mt-6 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

