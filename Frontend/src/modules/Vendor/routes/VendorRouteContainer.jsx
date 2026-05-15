import { Outlet } from 'react-router-dom'
import { VendorProvider } from '..'
import { ToastProvider } from '../../Admin/components/ToastNotification'

export function VendorRouteContainer() {
  return (
    <ToastProvider>
      <VendorProvider>
        <Outlet />
      </VendorProvider>
    </ToastProvider>
  )
}

