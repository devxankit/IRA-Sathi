import { useNavigate } from 'react-router-dom'
import { VendorLogin } from '../pages/vendor/VendorLogin'
import { registerFCMTokenWithBackend } from '../../../utils/pushNotificationService'
import '../vendor.css'

export function VendorLoginPage() {
  const navigate = useNavigate()

  return (
    <VendorLogin
      onSwitchToRegister={() => navigate('/vendor/register')}
      onSuccess={() => {
        registerFCMTokenWithBackend('vendor')
        navigate('/vendor/dashboard')
      }}
    />
  )
}

