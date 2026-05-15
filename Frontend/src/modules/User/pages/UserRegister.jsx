import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OtpVerification } from '../../../components/auth/OtpVerification'
import { useUserDispatch } from '../context/UserContext'
import { GoogleMapsLocationPicker } from '../../../components/GoogleMapsLocationPicker'
import * as userApi from '../services/userApi'

export function UserRegister({ onSuccess, onSwitchToLogin }) {
  const navigate = useNavigate()
  const dispatch = useUserDispatch()
  const [step, setStep] = useState('register') // 'register' | 'otp'
  const [form, setForm] = useState({
    fullName: '',
    contact: '',
    sellerId: '',
    location: null, // Will contain { address, city, state, pincode, coordinates: { lat, lng } }
  })
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSellerId, setShowSellerId] = useState(false)

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
      // Validate form
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
      // Validate location - coordinates are required (Google Maps provides this)
      if (!form.location || !form.location.coordinates) {
        setError('Please select your location using the map or live location button')
        setLoading(false)
        return
      }
      // Validate coordinates are valid (not 0,0)
      if (!form.location.coordinates.lat || !form.location.coordinates.lng || 
          form.location.coordinates.lat === 0 || form.location.coordinates.lng === 0) {
        setError('Please select a valid location. Coordinates are required.')
        setLoading(false)
        return
      }
      // Address is required (Google Maps provides formatted_address)
      if (!form.location.address || !form.location.address.trim()) {
        setError('Please select a valid address from the location picker')
        setLoading(false)
        return
      }

      // Request OTP
      const result = await userApi.requestOTP({ phone: form.contact })
      
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
      // Prepare location object
      const location = {
        address: form.location.address,
        city: form.location.city,
        state: form.location.state,
        pincode: form.location.pincode,
        coordinates: {
          lat: form.location.coordinates.lat,
          lng: form.location.coordinates.lng,
        },
      }

      // Register user with OTP
      const result = await userApi.register({
        fullName: form.fullName,
        phone: form.contact,
        otp: otpCode,
        sellerId: form.sellerId || undefined,
        location: location,
      })

      if (result.success || result.data) {
        // Store token if provided
        if (result.data?.token) {
          localStorage.setItem('user_token', result.data.token)
        }
        
        // Update context with user data
        const userData = result.data?.user || { name: form.fullName, phone: form.contact }
        dispatch({
          type: 'AUTH_LOGIN',
          payload: {
            name: userData.name || form.fullName,
            phone: userData.phone || form.contact,
            sellerId: userData.sellerId || null,
            location: userData.location || location,
          },
        })
        
        onSuccess?.(userData)
        // Navigation is handled by onSuccess callback from parent component
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
      await userApi.requestOTP({ phone: form.contact })
    } catch (err) {
      setError('Failed to resend OTP. Please try again.')
    } finally {
      setLoading(false)
    }
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
              userType="user"
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-wide text-[#017827] font-semibold">Create Account</p>
          <h1 className="text-3xl font-bold text-gray-900">Join IRA Sathi</h1>
          <p className="text-sm text-gray-600">Start your journey to better farming</p>
        </div>

        <div className="rounded-3xl border border-[rgba(1,120,39,0.15)] bg-white/90 p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleRequestOtp} className="space-y-5">
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="register-fullName" className="text-xs font-semibold text-gray-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="register-fullName"
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
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                id="register-contact"
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
              <div className="flex items-center justify-between">
                <label htmlFor="register-sellerId" className="text-xs font-semibold text-gray-700">
                  IRA Partner ID <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowSellerId(!showSellerId)}
                  className="text-xs text-[#017827] hover:underline font-medium"
                >
                  {showSellerId ? 'Hide' : 'Have one?'}
                </button>
              </div>
              {showSellerId && (
                <input
                  id="register-sellerId"
                  name="sellerId"
                  type="text"
                  value={form.sellerId}
                  onChange={handleChange}
                  placeholder="Enter IRA Partner ID (e.g., SLR-1001)"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
                />
              )}
              {showSellerId && (
                <p className="text-xs text-gray-500">
                  Link your purchases to an IRA Partner for cashback benefits
                </p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-5 mt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Address & Location</h3>
              
              <div className="space-y-4">
                <GoogleMapsLocationPicker
                  onLocationSelect={(location) => {
                    setForm((prev) => ({ ...prev, location }))
                    setError(null)
                  }}
                  initialLocation={form.location}
                  required={true}
                  label="Select Your Location"
                />
              </div>
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

