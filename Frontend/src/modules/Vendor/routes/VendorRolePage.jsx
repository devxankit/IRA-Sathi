import { useNavigate } from 'react-router-dom'
import { RoleSelect } from '../pages/common/RoleSelect'
import '../vendor.css'

export function VendorRolePage() {
  const navigate = useNavigate()

  return (
    <div className="vendor-app">
      <RoleSelect
        onBack={() => navigate('/vendor/language')}
        onSelect={(role) => {
          if (role === 'vendor') {
            navigate('/vendor/login')
          } else {
            navigate('/seller/login')
          }
        }}
      />
    </div>
  )
}

