import { useNavigate } from 'react-router-dom'
import { VendorDashboard } from '../pages/vendor/VendorDashboard'

export function VendorDashboardPage() {
  const navigate = useNavigate()

  return (
    <VendorDashboard
      onLogout={() => {
        localStorage.removeItem('vendor_token')
        navigate('/vendor/login')
      }}
    />
  )
}

