import { useNavigate } from 'react-router-dom'
import { SellerDashboard } from '../pages/SellerDashboard'
import { SellerProvider, useSellerDispatch } from '../context/SellerContext'
import { ToastProvider } from '../components/ToastNotification'

// This component must be rendered inside SellerProvider
function SellerDashboardContent() {
  const navigate = useNavigate()
  const dispatch = useSellerDispatch()

  const handleLogout = () => {
    dispatch({ type: 'AUTH_LOGOUT' })
    navigate('/seller/login')
  }

  return <SellerDashboard onLogout={handleLogout} />
}

export function SellerDashboardPage() {
  return (
    <SellerProvider>
      <ToastProvider>
        <SellerDashboardContent />
      </ToastProvider>
    </SellerProvider>
  )
}

