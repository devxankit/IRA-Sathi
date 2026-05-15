import { useState } from 'react'
import { OtpVerification } from '../../../../components/auth/OtpVerification'
import { useUserDispatch } from '../../context/UserContext'
import { GoogleMapsLocationPicker } from '../../../../components/GoogleMapsLocationPicker'
import * as userApi from '../../services/userApi'
import { Trans } from '../../../../components/Trans'
import { validatePhoneNumber } from '../../../../utils/phoneValidation'
import { PhoneInput } from '../../../../components/PhoneInput'

export function SignupPageView({ onSuccess, onSwitchToLogin }) {
  const dispatch = useUserDispatch()
  const [step, setStep] = useState('register') // 'register' | 'otp'
  const [form, setForm] = useState({
    fullName: '',
    contact: '',
    sellerId: '',
    location: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSellerId, setShowSellerId] = useState(false)

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

      // Validate phone number
      const validation = validatePhoneNumber(form.contact)
      if (!validation.isValid) {
        setError(validation.error)
        setLoading(false)
        return
      }

      if (!form.location) {
        setError('Location is required')
        setLoading(false)
        return
      }

      // Use normalized phone number
      const result = await userApi.requestOTP({ phone: validation.normalized })

      if (result.success || result.data) {
        // Update form with normalized phone
        setForm(prev => ({ ...prev, contact: validation.normalized }))
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
      const registerData = {
        phone: form.contact,
        name: form.fullName,
        sellerId: form.sellerId || undefined,
        location: form.location,
      }

      const result = await userApi.register(registerData)

      if (result.success && result.data?.token) {
        localStorage.setItem('user_token', result.data.token)

        // Fetch user profile
        const profileResult = await userApi.getUserProfile()
        if (profileResult.success && profileResult.data?.user) {
          const userData = profileResult.data.user
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              name: userData.name || form.fullName,
              phone: userData.phone || form.contact,
              email: userData.email || '',
              sellerId: userData.sellerId || form.sellerId || null,
              location: userData.location || form.location,
            },
          })
        }

        if (onSuccess) {
          onSuccess()
        }
      } else {
        setError(result.error?.message || 'Registration failed. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
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

  // OTP Step
  if (step === 'otp') {
    return (
      <div className="user-auth-page-view">
        <div className="user-auth-page-view__container">
          <div className="user-auth-page-view__content">
            <div className="user-auth-page-view__form-section">
              <div className="user-auth-page-view__form-wrapper">
                <h1 className="user-auth-page-view__title"><Trans>Verify OTP</Trans></h1>
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
            <div className="user-auth-page-view__illustration-section">
              <div className="user-auth-page-view__illustration">
                <div className="user-auth-page-view__illustration-content">
                  <h2 className="user-auth-page-view__illustration-title"><Trans>Join IRA Sathi</Trans></h2>
                  <p className="user-auth-page-view__illustration-text"><Trans>Start your journey towards better farming</Trans></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Register Step
  return (
    <div className="user-auth-page-view">
      <div className="user-auth-page-view__container">
        <div className="user-auth-page-view__content">
          <div className="user-auth-page-view__form-section">
            <div className="user-auth-page-view__form-wrapper">
              <h1 className="user-auth-page-view__title"><Trans>Create Account</Trans></h1>
              <p className="user-auth-page-view__subtitle"><Trans>Sign up to get started with IRA Sathi</Trans></p>

              <form onSubmit={handleRequestOtp} className="user-auth-page-view__form">
                {error && (
                  <div className="user-auth-page-view__error">
                    <p>{error}</p>
                  </div>
                )}

                <div className="user-auth-page-view__field">
                  <label htmlFor="register-name" className="user-auth-page-view__label">
                    <Trans>Full Name</Trans> <span className="user-auth-page-view__required">*</span>
                  </label>
                  <input
                    id="register-name"
                    name="fullName"
                    type="text"
                    required
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className="user-auth-page-view__input"
                  />
                </div>

                <div className="user-auth-page-view__field">
                  <label htmlFor="register-contact" className="user-auth-page-view__label">
                    <Trans>Contact Number</Trans> <span className="user-auth-page-view__required">*</span>
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

                <div className="user-auth-page-view__field">
                  <button
                    type="button"
                    onClick={() => setShowSellerId(!showSellerId)}
                    className="user-auth-page-view__toggle-link"
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
                      className="user-auth-page-view__input"
                    />
                  )}
                </div>

                <div className="user-auth-page-view__field">
                  <label className="user-auth-page-view__label">
                    <Trans>Location</Trans> <span className="user-auth-page-view__required">*</span>
                  </label>
                  <GoogleMapsLocationPicker
                    value={form.location}
                    onChange={(location) => setForm((prev) => ({ ...prev, location }))}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !form.fullName || !form.contact || !form.location}
                  className="user-auth-page-view__submit-btn"
                >
                  {loading ? <Trans>Sending OTP...</Trans> : <Trans>Continue</Trans>}
                </button>

                <div className="user-auth-page-view__switch">
                  <span className="user-auth-page-view__switch-text"><Trans>Already have an account?</Trans> </span>
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="user-auth-page-view__switch-link"
                  >
                    <Trans>Sign in</Trans>
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="user-auth-page-view__illustration-section">
            <div className="user-auth-page-view__illustration">
              <div className="user-auth-page-view__illustration-content">
                <h2 className="user-auth-page-view__illustration-title"><Trans>Start Your Journey</Trans></h2>
                <p className="user-auth-page-view__illustration-text"><Trans>Join thousands of farmers who trust IRA Sathi for quality agricultural products and expert guidance</Trans></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

