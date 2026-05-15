import { useState } from 'react'
import { OtpVerification } from '../../../../components/auth/OtpVerification'
import { useVendorDispatch } from '../../context/VendorContext'
import * as vendorApi from '../../services/vendorApi'
import { validatePhoneNumber } from '../../../../utils/phoneValidation'
import { PhoneInput } from '../../../../components/PhoneInput'
import { useToast } from '../../../../modules/Admin/components/ToastNotification'

export function VendorLogin({ onSuccess, onSwitchToRegister }) {
  const dispatch = useVendorDispatch()
  const { warning: showWarning } = useToast()
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

      // Validate phone number
      const validation = validatePhoneNumber(form.phone)
      if (!validation.isValid) {
        setError(validation.error)
        setLoading(false)
        return
      }

      const result = await vendorApi.requestVendorOTP({ phone: validation.normalized })

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
      const result = await vendorApi.loginVendorWithOtp({ phone: form.phone, otp: otpCode })

      if (result.success || result.data) {
        const vendorData = result.data?.vendor || result.data?.data?.vendor || result.data // handle different structures

        // Check if vendor status is pending
        if (vendorData?.status === 'pending') {
          showWarning('Your account is currently under review. Please wait for admin approval.', 5000)
          setLoading(false)
          return
        }

        if (result.data?.token || result.data?.data?.token) {
          localStorage.setItem('vendor_token', result.data?.token || result.data?.data?.token)
        }

        // Update vendor context with profile
        if (vendorData) {
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              id: vendorData.id || vendorData._id,
              name: vendorData.name,
              phone: vendorData.phone || form.phone,
              email: vendorData.email,
              location: vendorData.location,
              status: vendorData.status,
              isActive: vendorData.isActive,
            },
          })
        }

        onSuccess?.(vendorData || { phone: form.phone })
      } else {
        // Check if vendor needs to register
        if (result.error?.message?.includes('not found') || result.error?.message?.includes('Vendor not found')) {
          setError('Vendor not found. Please register first.')
          setTimeout(() => {
            if (onSwitchToRegister) {
              onSwitchToRegister()
            }
          }, 2000)
        } else if (result.error?.message?.includes('banned')) {
          setError(result.error?.message || 'Your account has been banned. Please contact admin.')
        } else if (result.error?.message?.includes('inactive')) {
          setError('Your account is inactive. Please contact admin.')
        } else if (result.status === 'rejected' || result.data?.status === 'rejected') { // Handle rejected status from API response
          setError(result.message || result.data?.message || 'Your application was rejected.')
        } else {
          setError(result.error?.message || 'Invalid OTP. Please try again.')
        }
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
      await vendorApi.requestVendorOTP({ phone: form.phone })
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
          <h1 className="text-3xl font-bold text-gray-900">Sign in as Vendor</h1>
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
