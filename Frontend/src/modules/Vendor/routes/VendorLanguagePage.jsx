import { useNavigate } from 'react-router-dom'
import { LanguageSelect } from '../pages/common/LanguageSelect'
import '../vendor.css'

export function VendorLanguagePage() {
  const navigate = useNavigate()
  return (
    <div className="vendor-app">
      <LanguageSelect onContinue={() => navigate('/vendor/role')} />
    </div>
  )
}

