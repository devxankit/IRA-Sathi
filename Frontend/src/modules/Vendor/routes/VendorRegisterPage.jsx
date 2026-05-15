import { useNavigate } from 'react-router-dom'
import { VendorRegister } from '../pages/VendorRegister'
import { registerFCMTokenWithBackend } from '../../../utils/pushNotificationService'

export function VendorRegisterPage() {
  const navigate = useNavigate()

  return (
    <VendorRegister
      onSwitchToLogin={() => navigate('/vendor/login')}
      onSuccess={() => {
        registerFCMTokenWithBackend('vendor')
        navigate('/vendor/dashboard')
      }}
    />
  )
}

