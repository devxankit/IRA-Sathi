import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OtpVerification } from '../../../components/auth/OtpVerification'
import { useUserDispatch } from '../context/UserContext'
import * as userApi from '../services/userApi'

export function UserLogin({ onSuccess, onSwitchToRegister }) {
  const navigate = useNavigate()
  const dispatch = useUserDispatch()
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [form, setForm] = useState({ phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      if (form.phone.length < 10) {
        setError('Please enter a valid contact number')
        setLoading(false)
        return
      }

      // Bypass OTP for specific phone number (8878495505)
      const BYPASS_PHONE = '8878495505'
      const BYPASS_OTP = '123456'
      
      if (form.phone === BYPASS_PHONE) {
        // Skip OTP request and directly verify with bypass OTP
        setLoading(false)
        await handleVerifyOtp(BYPASS_OTP)
        return
      }

      // Request OTP (mock for now - accepts any data)
      const result = await userApi.requestOTP({ phone: form.phone })
      
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
      // Login with OTP (mock for now - accepts any data)
      const result = await userApi.loginWithOtp({ phone: form.phone, otp: otpCode })

      if (result.success || result.data) {
        // Store token if provided
        if (result.data?.token) {
          localStorage.setItem('user_token', result.data.token)
        }
        
        // Update context with user data
        const userData = result.data?.user || { name: 'User', phone: form.phone }
        dispatch({
          type: 'AUTH_LOGIN',
          payload: {
            name: userData.name || 'User',
            phone: userData.phone || form.phone,
            sellerId: userData.sellerId || null,
            location: userData.location || null,
          },
        })
        
        onSuccess?.(userData)
        // Navigation is handled by onSuccess callback from parent component
      } else {
        // Check if user needs to register
        if (result.error?.message?.includes('not found') || result.requiresRegistration) {
          setError('User not found. Please register first.')
          setTimeout(() => {
            navigate('/user/register')
          }, 2000)
        } else {
          setError(result.error?.message || 'Invalid OTP. Please try again.')
        }
      }
    } catch (err) {
      // Check if error indicates user doesn't exist
      if (err.error?.message?.includes('not found') || err.requiresRegistration) {
        setError('User not found. Redirecting to registration...')
        setTimeout(() => {
          navigate('/user/register')
        }, 2000)
      } else {
        setError(err.error?.message || err.message || 'Verification failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    try {
      await userApi.requestOTP({ phone: form.phone })
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
              phone={form.phone}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => setStep('phone')}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-wide text-[#017827] font-semibold">Welcome Back</p>
          <h1 className="text-3xl font-bold text-gray-900">Sign in to IRA Sathi</h1>
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
              <label htmlFor="login-phone" className="text-xs font-semibold text-gray-700">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                id="login-phone"
                name="phone"
                type="tel"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 90000 00000"
                maxLength={15}
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
