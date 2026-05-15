import { useState } from 'react'
import { OtpVerification } from '../../../components/auth/OtpVerification'
import * as sellerApi from '../services/sellerApi'
import { useSellerDispatch } from '../context/SellerContext'
import { validatePhoneNumber, extractPhoneDigits } from '../../../utils/phoneValidation'
import { PhoneInput } from '../../../components/PhoneInput'

export function SellerLogin({ onSuccess, onSubmit, onSwitchToRegister }) {
  const [step, setStep] = useState('phone') // 'phone' | 'otp' | 'pending'
  const [form, setForm] = useState({ phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sellerId, setSellerId] = useState(null)
  const dispatch = useSellerDispatch()

  // OTP bypass configuration for specific test seller
  const BYPASS_PHONE = '9981331318'
  const BYPASS_OTP = '123456'

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!form.phone.trim()) {
        setError('Contact number is required')
        setLoading(false)
        return
      }

      // Validate phone number
      const validation = validatePhoneNumber(form.phone)
      if (!validation.isValid) {
        setError(validation.error)
        setLoading(false)
        return
      }

      // Bypass OTP screen for the configured seller phone (compare digits only)
      const phoneDigits = extractPhoneDigits(form.phone)
      if (phoneDigits === BYPASS_PHONE) {
        try {
          const result = await sellerApi.loginSellerWithOtp({ phone: form.phone, otp: BYPASS_OTP })

          if (result.success || result.data) {
            // Check if seller requires approval (pending status)
            if (result.data?.requiresApproval || result.data?.seller?.status === 'pending') {
              setSellerId(result.data?.seller?.sellerId || result.data?.sellerId)
              setStep('pending')
              return
            }

            // Check if seller is rejected
            if (result.data?.seller?.status === 'rejected') {
              setError('Your account has been rejected by the admin. Please contact support.')
              return
            }

            // If approved, proceed with login
            if (result.data?.token) {
              localStorage.setItem('seller_token', result.data.token)
            }

            // Update context with seller data
            if (result.data?.seller) {
              dispatch({
                type: 'AUTH_LOGIN',
                payload: {
                  id: result.data.seller.id || result.data.seller._id,
                  name: result.data.seller.name,
                  phone: result.data.seller.phone,
                  sellerId: result.data.seller.sellerId,
                  area: result.data.seller.area,
                  status: result.data.seller.status,
                  isActive: result.data.seller.isActive,
                },
              })
            }

            // Call both onSuccess and onSubmit for backward compatibility
            onSuccess?.(result.data?.seller || { phone: form.phone })
            onSubmit?.(result.data?.seller || { phone: form.phone })
          } else {
            setError(result.error?.message || 'Failed to login with bypass OTP. Please try again.')
          }
        } catch (err) {
          setError(err.message || 'Failed to login with bypass OTP. Please try again.')
        } finally {
          setLoading(false)
        }

        // Stop normal OTP flow for this phone
        return
      }

      const result = await sellerApi.requestSellerOTP({ phone: validation.normalized })

      if (result.success || result.data) {
        setForm(prev => ({ ...prev, phone: validation.normalized }))
        setStep('otp')
      } else {
        setError(result.error?.message || 'Failed to send OTP. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (otpCode) => {
    setError(null)
    setLoading(true)

    try {
      const result = await sellerApi.loginSellerWithOtp({ phone: form.phone, otp: otpCode })

      if (result.success || result.data) {
        // Check if seller requires approval (pending status)
        if (result.data?.requiresApproval || result.data?.seller?.status === 'pending') {
          setSellerId(result.data?.seller?.sellerId || result.data?.sellerId)
          setStep('pending')
          setLoading(false)
          return
        }

        // Check if seller is rejected
        if (result.data?.seller?.status === 'rejected') {
          setError('Your account has been rejected by the admin. Please contact support.')
          setLoading(false)
          return
        }

        // If approved, proceed with login
        if (result.data?.token) {
          localStorage.setItem('seller_token', result.data.token)
        }

        // Update context with seller data
        if (result.data?.seller) {
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              id: result.data.seller.id || result.data.seller._id,
              name: result.data.seller.name,
              phone: result.data.seller.phone,
              sellerId: result.data.seller.sellerId,
              area: result.data.seller.area,
              status: result.data.seller.status,
              isActive: result.data.seller.isActive,
            },
          })
        }

        // Call both onSuccess and onSubmit for backward compatibility
        onSuccess?.(result.data?.seller || { phone: form.phone })
        onSubmit?.(result.data?.seller || { phone: form.phone })
      } else {
        setError(result.error?.message || 'Invalid OTP. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    try {
      await sellerApi.requestSellerOTP({ phone: form.phone })
    } catch (err) {
      setError('Failed to resend OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[rgba(1,120,39,0.04)] via-white to-[rgba(1,120,39,0.04)] px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-wide text-yellow-600 font-semibold">Account Pending</p>
            <h1 className="text-3xl font-bold text-gray-900">Awaiting Admin Approval</h1>
          </div>

          <div className="rounded-3xl border border-yellow-200/60 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
            <div className="space-y-6 text-center">
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-50">
                  <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Your Account is Pending Approval</h2>
                  {sellerId && (
                    <p className="text-sm text-gray-600 mb-4">
                      Your Seller ID: <span className="font-bold text-[#017827]">{sellerId}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Your account is currently pending admin approval. You will be able to access your dashboard once the admin approves your request.
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-3">
                    We'll notify you once your account is activated.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="w-full rounded-full bg-gradient-to-r from-[#017827] to-[#015c1f] px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                >
                  Go Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'otp') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[rgba(1,120,39,0.04)] via-white to-[rgba(1,120,39,0.04)] px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="rounded-3xl border border-[rgba(1,120,39,0.15)] bg-white/90 p-8 shadow-xl backdrop-blur-sm">
            <OtpVerification
              phone={form.phone}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => setStep('phone')}
              loading={loading}
              error={error}
              userType="seller"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[rgba(1,120,39,0.04)] via-white to-[rgba(1,120,39,0.04)] px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(1,120,39,0.1)] mb-4">
            <svg className="w-8 h-8 text-[#017827]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-wide text-[#017827] font-semibold">IRA Partner Access</p>
          <h1 className="text-3xl font-bold text-gray-900">Sign in to IRA Partner Dashboard</h1>
          <p className="text-sm text-gray-600">Enter your contact number to continue</p>
        </div>

        <div className="rounded-3xl border border-[rgba(1,120,39,0.15)] bg-white/90 p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleRequestOtp} className="space-y-5">
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="seller-login-phone" className="text-xs font-semibold text-gray-700">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                id="seller-login-phone"
                name="phone"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="Mobile"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-[#017827] to-[#015c1f] px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending OTP...' : 'Continue'}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-[#017827] font-semibold hover:underline"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
