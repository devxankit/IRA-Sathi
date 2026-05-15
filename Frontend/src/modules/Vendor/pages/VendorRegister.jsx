import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OtpVerification } from '../../../components/auth/OtpVerification'
import { useVendorDispatch } from '../context/VendorContext'
import { VendorStatusMessage } from '../components/VendorStatusMessage'
import { DocumentUpload } from '../components/DocumentUpload'
import { GoogleMapsLocationPicker } from '../../../components/GoogleMapsLocationPicker'
import * as vendorApi from '../services/vendorApi'
import { PhoneInput } from '../../../components/PhoneInput'

export function VendorRegister({ onSuccess, onSwitchToLogin }) {
  const navigate = useNavigate()
  const dispatch = useVendorDispatch()
  const [step, setStep] = useState('register') // 'register' | 'otp' | 'pending' | 'rejected'
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    contact: '',
    location: null, // Will contain { address, city, state, pincode, coordinates: { lat, lng } }
    aadhaarCard: null,
    panCard: null,
  })
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleDocumentChange = (documentType) => (documentData) => {
    setForm((prev) => ({
      ...prev,
      [documentType]: documentData,
    }))
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
      // Validate documents - must be uploaded
      if (!form.aadhaarCard?.url) {
        setError('Please upload Aadhaar card image. Image is required and must be less than 2MB.')
        setLoading(false)
        return
      }
      if (!form.panCard?.url) {
        setError('Please upload PAN card image. Image is required and must be less than 2MB.')
        setLoading(false)
        return
      }

      // Validate document formats - must be images
      const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
      const aadhaarFormat = form.aadhaarCard.format?.toLowerCase()
      const panFormat = form.panCard.format?.toLowerCase()

      if (!aadhaarFormat || !imageFormats.includes(aadhaarFormat)) {
        setError('Aadhaar card must be an image file (JPG, PNG, GIF, etc.). PDF files are not accepted.')
        setLoading(false)
        return
      }
      if (!panFormat || !imageFormats.includes(panFormat)) {
        setError('PAN card must be an image file (JPG, PNG, GIF, etc.). PDF files are not accepted.')
        setLoading(false)
        return
      }

      // Validate document sizes - must be less than 2MB
      const maxSize = 2000000 // 2MB in bytes
      if (form.aadhaarCard.size && form.aadhaarCard.size > maxSize) {
        setError(`Aadhaar card image size (${(form.aadhaarCard.size / 1024 / 1024).toFixed(2)}MB) exceeds 2MB limit. Please upload a smaller image.`)
        setLoading(false)
        return
      }
      if (form.panCard.size && form.panCard.size > maxSize) {
        setError(`PAN card image size (${(form.panCard.size / 1024 / 1024).toFixed(2)}MB) exceeds 2MB limit. Please upload a smaller image.`)
        setLoading(false)
        return
      }

      // Register vendor (creates vendor and sends OTP)
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

      const result = await vendorApi.registerVendor({
        name: form.fullName,
        email: form.email || undefined,
        phone: form.contact,
        location: location,
        aadhaarCard: form.aadhaarCard,
        panCard: form.panCard,
      })

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
      // Verify OTP to complete registration
      const result = await vendorApi.loginVendorWithOtp({ phone: form.contact, otp: otpCode })

      if (result.success || result.data) {
        const responseData = result.data?.data || result.data
        const vendorData = responseData?.vendor || result.data?.vendor
        const status = responseData?.status || vendorData?.status

        // Check status
        if (status === 'pending') {
          // Show pending message
          setStep('pending')
          // Update vendor context with profile (but no token)
          if (vendorData) {
            dispatch({
              type: 'AUTH_LOGIN',
              payload: {
                id: vendorData.id || vendorData._id,
                name: vendorData.name || form.fullName,
                phone: vendorData.phone || form.contact,
                email: vendorData.email,
                location: vendorData.location,
                status: vendorData.status,
                isActive: vendorData.isActive,
              },
            })
          }
          return
        }

        if (status === 'rejected') {
          // Show rejected message
          setStep('rejected')
          return
        }

        // Vendor is approved - proceed to dashboard
        if (responseData?.token || result.data?.token) {
          localStorage.setItem('vendor_token', responseData?.token || result.data?.token)
        }

        // Update vendor context with profile
        if (vendorData) {
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              id: vendorData.id || vendorData._id,
              name: vendorData.name || form.fullName,
              phone: vendorData.phone || form.contact,
              email: vendorData.email,
              location: vendorData.location,
              status: vendorData.status,
              isActive: vendorData.isActive,
            },
          })
        }

        onSuccess?.(vendorData || { name: form.fullName, phone: form.contact })
        navigate('/vendor/dashboard')
      } else {
        // Check for rejected status in error response
        if (result.error?.status === 'rejected' || result.error?.message?.includes('rejected')) {
          setStep('rejected')
        } else {
          setError(result.error?.message || 'Invalid OTP. Please try again.')
        }
      }
    } catch (err) {
      // Check for rejected status in error response
      if (err.error?.status === 'rejected' || err.message?.includes('rejected')) {
        setStep('rejected')
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
      await vendorApi.requestVendorOTP({ phone: form.contact })
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
              userType="vendor"
            />
          </div>
        </div>
      </div>
    )
  }

  if (step === 'pending' || step === 'rejected') {
    return <VendorStatusMessage status={step} onBack={() => navigate('/vendor/login')} />
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
          <h1 className="text-3xl font-bold text-gray-900">Register as Vendor</h1>
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
              <PhoneInput
                id="register-contact"
                name="contact"
                value={form.contact}
                onChange={handleChange}
                required
                placeholder="90000 00000"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-email" className="text-xs font-semibold text-gray-700">
                Email <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="vendor@email.com"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/20 transition-all"
              />
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
                  label="Select Your Business Location"
                />
              </div>
            </div>

            {/* Document Uploads */}
            <div className="border-t border-gray-200 pt-5 mt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Verification Documents</h3>
              <p className="text-xs text-gray-600 mb-4">
                Please upload clear images or PDFs of your Aadhaar Card and PAN Card for verification.
              </p>

              <div className="space-y-4">
                <DocumentUpload
                  label="Aadhaar Card"
                  value={form.aadhaarCard}
                  onChange={handleDocumentChange('aadhaarCard')}
                  required
                  disabled={loading}
                />

                <DocumentUpload
                  label="PAN Card"
                  value={form.panCard}
                  onChange={handleDocumentChange('panCard')}
                  required
                  disabled={loading}
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
