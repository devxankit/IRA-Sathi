import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle, AlertCircle, IndianRupee, ShieldCheck, CreditCard, Shield, Calendar } from 'lucide-react'
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

export function SellerWithdrawalApprovalScreen({ request, onBack, onSuccess }) {
  const { approveSellerWithdrawal, createSellerWithdrawalPaymentIntent } = useAdminApi()
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
      const result = await createSellerWithdrawalPaymentIntent(request.requestId || request.id, {
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
        console.log('⚠️ [SellerWithdrawalApprovalScreen] Test mode detected, simulating payment...')
        
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
        const approveResult = await approveSellerWithdrawal(request.requestId || request.id, {
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
        description: `Seller Withdrawal Payment - ${request.sellerName || request.sellerId || 'IRA Partner'}`,
        prefill: {
          name: request.sellerName || '',
          email: '',
          contact: '',
        },
      })

      // Payment successful, proceed to approval
      setPaymentCompleted(true)
      setCurrentStep(3)

      // Approve withdrawal with payment details
      const approveResult = await approveSellerWithdrawal(request.requestId || request.id, {
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
          <h2 className="text-2xl font-bold text-gray-900">Approve IRA Partner Withdrawal</h2>
          <p className="text-sm text-gray-600">Process IRA Partner (Seller) withdrawal request and payment</p>
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
                        : 'border-gray-300 bg-white text-gray-400',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-xs font-medium',
                      isActive || isCompleted ? 'text-gray-900' : 'text-gray-400',
                    )}
                  >
                    {step.label}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-4 h-0.5 flex-1',
                      isCompleted ? 'bg-[#017827]' : 'bg-gray-300',
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
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Withdrawal Request Details</h3>
              <p className="text-sm text-gray-600">Review the withdrawal request before proceeding</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-600 mb-1">IRA Partner</p>
                <p className="text-lg font-bold text-gray-900">{request.sellerName || request.sellerId || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-600 mb-1">Withdrawal Amount</p>
                <p className="text-lg font-bold text-[#017827]">{formatCurrency(request.amount || 0)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-600 mb-1">Request Date</p>
                <p className="text-lg font-bold text-gray-900">
                  {request.date || request.createdAt
                    ? new Date(request.date || request.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                  Pending
                </span>
              </div>
            </div>

            {bankDetails && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-600 mb-3">Bank Account Details</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Account Holder</p>
                    <p className="text-sm font-medium text-gray-900">{bankDetails.accountHolderName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Account Number</p>
                    <p className="text-sm font-medium text-gray-900">{bankDetails.accountNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">IFSC Code</p>
                    <p className="text-sm font-medium text-gray-900">{bankDetails.ifscCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Bank Name</p>
                    <p className="text-sm font-medium text-gray-900">{bankDetails.bankName || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-[#017827] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#015c1f]"
              >
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {currentStep === 2 && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Payment Processing</h3>
              <p className="text-sm text-gray-600">Initialize payment for this withdrawal</p>
            </div>

            {!paymentIntent ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
                  <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600">Click below to create payment intent</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-[#017827] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#015c1f] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Payment Intent...' : 'Create Payment Intent'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#017827] text-white">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#014a19]">Payment Intent Created</p>
                      <p className="text-xs text-[#017827]">
                        Order ID: {paymentIntent.razorpayOrderId || 'N/A'}
                      </p>
                      {paymentIntent.isTestMode && (
                        <p className="text-xs text-yellow-700 mt-1">⚠️ Test Mode - Payment will be simulated</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Payment Amount</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(paymentIntent.amount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Currency</p>
                      <p className="text-lg font-bold text-gray-900">{paymentIntent.currency || 'INR'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentIntent(null)
                      setCurrentStep(1)
                    }}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-[#017827] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#015c1f] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing Payment...' : 'Process Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Approval */}
      {currentStep === 3 && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
          <div className="space-y-6">
            <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#017827] text-white mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-[#014a19] mb-2">Withdrawal Approved!</h3>
              <p className="text-sm text-[#017827]">
                Payment has been processed and withdrawal request has been approved successfully.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Payment Reference</p>
                  <p className="text-sm font-medium text-gray-900">
                    {paymentIntent?.razorpayOrderId || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Amount Transferred</p>
                  <p className="text-sm font-bold text-[#017827]">
                    {formatCurrency(request.amount || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onSuccess?.()
                }}
                className="flex-1 rounded-xl bg-[#017827] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#015c1f]"
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




