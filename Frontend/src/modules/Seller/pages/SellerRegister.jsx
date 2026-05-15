import { useState } from 'react'
import { OtpVerification } from '../../../components/auth/OtpVerification'
import * as sellerApi from '../services/sellerApi'
import { useSellerDispatch } from '../context/SellerContext'

export function SellerRegister({ onSuccess, onSubmit, onSwitchToLogin }) {
  const [step, setStep] = useState('register') // 'register' | 'otp' | 'pending'
  const [form, setForm] = useState({
    fullName: '',
    contact: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sellerId, setSellerId] = useState(null)
  const dispatch = useSellerDispatch()

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
      if (!form.fullName.trim()) {
        setError('Full name is required')
        setLoading(false)
        return
      }
      if (!form.contact.trim()) {
        setError('Contact number is required')
        setLoading(false)
        return
      }
      if (form.contact.length < 10) {
        setError('Please enter a valid contact number')
        setLoading(false)
        return
      }
      if (!form.address.trim()) {
        setError('Address is required')
        setLoading(false)
        return
      }
      if (!form.city.trim()) {
        setError('City is required')
        setLoading(false)
        return
      }
      if (!form.state.trim()) {
        setError('State is required')
        setLoading(false)
        return
      }
      if (!form.pincode.trim() || form.pincode.length !== 6) {
        setError('Please enter a valid 6-digit pincode')
        setLoading(false)
        return
      }

      // Call register endpoint which generates sellerId and sends OTP
      const result = await sellerApi.registerSeller({
        fullName: form.fullName,
        phone: form.contact,
        area: form.address || '',
        location: {
          address: form.address || '',
          city: form.city || '',
          state: form.state || '',
          pincode: form.pincode || '',
        },
      })
      
      if (result.success || result.data) {
        setStep('otp')
        // Show sellerId if generated
        if (result.data?.sellerId) {
          console.log('Seller ID generated:', result.data.sellerId)
        }
      } else {
        setError(result.error?.message || 'Failed to register. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Failed to register. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (otpCode) => {
    setError(null)
    setLoading(true)

    try {
      // Call verifyOTP endpoint to complete registration
      const result = await sellerApi.loginSellerWithOtp({
        phone: form.contact,
        otp: otpCode,
      })

      if (result.success || result.data) {
        // Check if seller requires approval
        if (result.data?.requiresApproval || result.data?.seller?.status === 'pending') {
          setSellerId(result.data?.seller?.sellerId || result.data?.sellerId)
          setStep('pending')
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
        onSuccess?.(result.data?.seller || { name: form.fullName, phone: form.contact })
        onSubmit?.(result.data?.seller || { name: form.fullName, phone: form.contact })
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
      // Resend OTP by calling register again (will regenerate OTP for existing seller)
      await sellerApi.registerSeller({
        fullName: form.fullName,
        phone: form.contact,
        area: form.address || '',
        location: {
          address: form.address || '',
          city: form.city || '',
          state: form.state || '',
          pincode: form.pincode || '',
        },
      })
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
            <p className="text-xs uppercase tracking-wide text-yellow-600 font-semibold">Registration Successful</p>
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
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Your Registration is Complete!</h2>
                  {sellerId && (
                    <p className="text-sm text-gray-600 mb-4">
                      Your Seller ID: <span className="font-bold text-[#017827]">{sellerId}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Your account has been created successfully. However, your account is currently pending admin approval.
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-3">
                    You will be able to access your dashboard once the admin approves your request. We'll notify you once your account is activated.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onSwitchToLogin}
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
              phone={form.contact}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => setStep('register')}
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
          <p className="text-xs uppercase tracking-wide text-[#017827] font-semibold">IRA Partner Registration</p>
          <h1 className="text-3xl font-bold text-gray-900">Join as IRA Partner</h1>
          <p className="text-sm text-gray-600">Start earning commissions by referring farmers</p>
        </div>

        <div className="rounded-3xl border border-[rgba(1,120,39,0.15)] bg-white/90 p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleRequestOtp} className="space-y-5">
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="seller-register-fullName" className="text-xs font-semibold text-gray-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="seller-register-fullName"
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
              <label htmlFor="seller-register-contact" className="text-xs font-semibold text-gray-700">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                id="seller-register-contact"
                name="contact"
                type="tel"
                required
                value={form.contact}
                onChange={handleChange}
                placeholder="+91 90000 00000"
                maxLength={15}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seller-register-address" className="text-xs font-semibold text-gray-700">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="seller-register-address"
                name="address"
                required
                value={form.address}
                onChange={handleChange}
                placeholder="Enter your full address"
                rows={3}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="seller-register-city" className="text-xs font-semibold text-gray-700">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  id="seller-register-city"
                  name="city"
                  type="text"
                  required
                  value={form.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="seller-register-state" className="text-xs font-semibold text-gray-700">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  id="seller-register-state"
                  name="state"
                  type="text"
                  required
                  value={form.state}
                  onChange={handleChange}
                  placeholder="State"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seller-register-pincode" className="text-xs font-semibold text-gray-700">
                Pincode <span className="text-red-500">*</span>
              </label>
              <input
                id="seller-register-pincode"
                name="pincode"
                type="text"
                required
                value={form.pincode}
                onChange={handleChange}
                placeholder="Pincode"
                maxLength={6}
                pattern="[0-9]*"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
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
              <span className="text-gray-600">Already have an account? </span>
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-[#017827] font-semibold hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

