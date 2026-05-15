import { useState } from 'react'
import { SellerLogin } from './SellerLogin'
import { SellerRegister } from './SellerRegister'

export function SellerAuth({ onSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'

  return mode === 'login' ? (
    <SellerLogin
      onSuccess={onSuccess}
      onSwitchToRegister={() => setMode('register')}
    />
  ) : (
    <SellerRegister
      onSuccess={onSuccess}
      onSwitchToLogin={() => setMode('login')}
    />
  )
}

