import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useUserState } from '../context/UserContext'
import { cn } from '../../../lib/cn'
import { CloseIcon } from './icons'

const DISMISSED_KEY = 'vendor_availability_warning_dismissed'

/**
 * Persistent warning component that shows when no vendor is available
 * Does NOT show if user is within 300m buffer zone (20km to 20.3km)
 */
export function VendorAvailabilityWarning() {
  const { vendorAvailability } = useUserState()
  const [isDismissed, setIsDismissed] = useState(false)

  // Check if warning was previously dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true'
    setIsDismissed(dismissed)
  }, [])

  // Handle dismiss button click
  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  // Don't show warning if:
  // 1. Vendor is available
  // 2. User is in buffer zone (20km to 20.3km) - they can still place orders
  // 3. Warning has been dismissed by user
  if (vendorAvailability?.vendorAvailable || vendorAvailability?.isInBufferZone || isDismissed) {
    return null
  }

  // Only show if vendor is not available and user cannot place orders
  if (!vendorAvailability?.canPlaceOrder) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg",
        "px-4 py-3 flex items-center justify-between gap-4"
      )}>
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">No Vendor Available in Your Region</p>
            <p className="text-xs opacity-90">
              You won't be able to place orders. Please update your location or contact support.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg",
            "hover:bg-white/20 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-white/50"
          )}
          aria-label="Dismiss warning"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    )
  }

  return null
}

