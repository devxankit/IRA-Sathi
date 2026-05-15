import { useState, useEffect } from 'react'
import { OtpVerification } from '../../../components/auth/OtpVerification'
import { useUserDispatch } from '../context/UserContext'
import { GoogleMapsLocationPicker } from '../../../components/GoogleMapsLocationPicker'
import * as userApi from '../services/userApi'
import { Trans } from '../../../components/Trans'
import { PhoneInput } from '../../../components/PhoneInput'

export function AuthPromptModal({ isOpen, onClose, actionType, onSuccess }) {
  const dispatch = useUserDispatch()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [step, setStep] = useState('phone') // 'phone' | 'otp' | 'register'
  const [form, setForm] = useState({
    phone: '',
    fullName: '',
    contact: '',
    sellerId: '',
    location: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSellerId, setShowSellerId] = useState(false)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(mode === 'login' ? 'phone' : 'register')
      setForm({
        phone: '',
        fullName: '',
        contact: '',
        sellerId: '',
        location: null,
      })
      setError(null)
    }
  }, [isOpen, mode])

  if (!isOpen) return null

  // Get message based on action type
  const getMessage = () => {
    switch (actionType) {
      case 'favourites':
        return "You can't add to favourites now. First login or create your account."
      case 'cart':
        return "You can't add to cart now. First login or create your account."
      case 'orders':
        return "You can't view your orders now. First login or create your account."
      case 'profile':
        return "You can't update your profile now. First login or create your account."
      default:
        return 'Please login or create your account to continue.'
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleRequestOtp = async (e) => {
    e?.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const phone = mode === 'login' ? form.phone : form.contact
      if (!phone.trim()) {
        setError('Contact number is required')
        setLoading(false)
        return
      }
      if (phone.length < 10) {
        setError('Please enter a valid contact number')
        setLoading(false)
        return
      }

      const result = await userApi.requestOTP({ phone })

      if (result.success || result.data) {
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
      const phone = mode === 'login' ? form.phone : form.contact
      const result = await userApi.verifyOTP({ phone, otp: otpCode })

      if (result.success && result.data?.token) {
        localStorage.setItem('user_token', result.data.token)

        // Fetch user profile
        const profileResult = await userApi.getUserProfile()
        if (profileResult.success && profileResult.data?.user) {
          const userData = profileResult.data.user
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              name: userData.name || 'User',
              phone: userData.phone || phone,
              email: userData.email || '',
              sellerId: userData.sellerId || null,
              location: userData.location || null,
            },
          })
        } else {
          // New user - use basic info
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              name: form.fullName || 'User',
              phone: phone,
              email: '',
              sellerId: form.sellerId || null,
              location: form.location || null,
            },
          })
        }

        if (onSuccess) {
          onSuccess()
        }
        onClose()
      } else {
        setError(result.error?.message || 'Invalid OTP. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    try {
      const phone = mode === 'login' ? form.phone : form.contact
      await userApi.requestOTP({ phone })
    } catch (err) {
      setError('Failed to resend OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // OTP Step
  if (step === 'otp') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
            <h2 className="text-lg font-bold text-gray-900"><Trans>Verify OTP</Trans></h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <OtpVerification
              phone={mode === 'login' ? form.phone : form.contact}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => setStep(mode === 'login' ? 'phone' : 'register')}
              loading={loading}
              error={error}
              userType="user"
            />
          </div>
        </div>
      </div>
    )
  }

  // Register Step
  if (mode === 'register' && step === 'register') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
            <h2 className="text-lg font-bold text-gray-900"><Trans>Create Account</Trans></h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {actionType && (
            <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
              <p className="text-sm text-yellow-800">
                <Trans>{getMessage()}</Trans>
              </p>
            </div>
          )}
          <div className="p-6">
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="register-name" className="text-xs font-semibold text-gray-700">
                  <Trans>Full Name</Trans> <span className="text-red-500">*</span>
                </label>
                <input
                  id="register-name"
                  name="fullName"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="register-contact" className="text-xs font-semibold text-gray-700">
                  <Trans>Contact Number</Trans> <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  id="register-contact"
                  name="contact"
                  required
                  value={form.contact}
                  onChange={handleChange}
                  placeholder="Mobile"
                />
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowSellerId(!showSellerId)}
                  className="text-xs text-[#017827] hover:underline"
                >
                  {showSellerId ? <Trans>Hide Seller ID</Trans> : <Trans>Have a Seller ID?</Trans>}
                </button>
                {showSellerId && (
                  <input
                    id="register-sellerId"
                    name="sellerId"
                    type="text"
                    value={form.sellerId}
                    onChange={handleChange}
                    placeholder="Enter Seller ID (optional)"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  <Trans>Location</Trans> <span className="text-red-500">*</span>
                </label>
                <GoogleMapsLocationPicker
                  value={form.location}
                  onChange={(location) => setForm((prev) => ({ ...prev, location }))}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !form.fullName || !form.contact || !form.location}
                className="w-full rounded-full bg-gradient-to-r from-[#017827] to-[#015c1f] px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Trans>Sending OTP...</Trans> : <Trans>Continue</Trans>}
              </button>

              <div className="text-center text-sm">
                <span className="text-gray-600"><Trans>Already have an account?</Trans> </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setStep('phone')
                  }}
                  className="text-[#017827] font-semibold hover:underline"
                >
                  <Trans>Sign in</Trans>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Login Step
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-lg font-bold text-gray-900">
            {actionType ? <Trans>Login Required</Trans> : <Trans>Welcome</Trans>}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {actionType && (
          <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
            <p className="text-sm text-yellow-800">
              <Trans>{getMessage()}</Trans>
            </p>
          </div>
        )}

        <div className="p-6">
          <form onSubmit={handleRequestOtp} className="space-y-5">
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-phone" className="text-xs font-semibold text-gray-700">
                <Trans>Contact Number</Trans> <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                id="login-phone"
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
              {loading ? <Trans>Sending OTP...</Trans> : <Trans>Continue</Trans>}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-600"><Trans>Don't have an account?</Trans> </span>
              <button
                type="button"
                onClick={() => {
                  setMode('register')
                  setStep('register')
                }}
                className="text-[#017827] font-semibold hover:underline"
              >
                <Trans>Sign up</Trans>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

