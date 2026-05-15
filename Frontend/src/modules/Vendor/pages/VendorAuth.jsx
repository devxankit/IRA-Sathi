import { useState } from 'react'
import { VendorLogin } from './VendorLogin'
import { VendorRegister } from './VendorRegister'

export function VendorAuth({ onSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'

  return mode === 'login' ? (
    <VendorLogin
      onSuccess={onSuccess}
      onSwitchToRegister={() => setMode('register')}
    />
  ) : (
    <VendorRegister
      onSuccess={onSuccess}
      onSwitchToLogin={() => setMode('login')}
    />
  )
}

