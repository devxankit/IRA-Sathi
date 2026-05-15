import { useNavigate } from 'react-router-dom'
import { UserDashboard } from '../pages/UserDashboard'
import { UserProvider, useUserDispatch } from '../context/UserContext'

function UserDashboardContent() {
  const navigate = useNavigate()
  const dispatch = useUserDispatch()

  return (
    <UserDashboard
      onLogout={() => {
        dispatch({ type: 'AUTH_LOGOUT' })
        navigate('/user/login')
      }}
    />
  )
}

export function UserDashboardPage() {
  return (
    <UserProvider>
      <UserDashboardContent />
    </UserProvider>
  )
}

