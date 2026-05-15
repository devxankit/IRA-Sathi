import { useEffect, useState } from 'react'
import { createContext, useContext } from 'react'
import { cn } from '../../../lib/cn'
import { CheckCircleIcon, XIcon, BellIcon } from './icons'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    const toast = { id, message, type }
    setToasts((prev) => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, duration)
    }

    return id
  }

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  const success = (message, duration) => addToast(message, 'success', duration)
  const error = (message, duration) => addToast(message, 'error', duration)
  const warning = (message, duration) => addToast(message, 'warning', duration)
  const info = (message, duration) => addToast(message, 'info', duration)

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    return {
      toasts: [],
      addToast: () => {},
      dismissToast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
  }
  return context
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="seller-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'seller-toast',
            `is-${toast.type}`,
            'flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer'
          )}
          onClick={() => onDismiss(toast.id)}
        >
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 text-[1.1rem] font-bold',
            toast.type === 'success' && 'bg-gradient-to-br from-[rgba(1, 120, 39,0.18)] to-[rgba(1, 120, 39,0.08)] text-[#017827]',
            toast.type === 'error' && 'bg-gradient-to-br from-[rgba(220,38,38,0.18)] to-[rgba(220,38,38,0.08)] text-[#dc2626]',
            toast.type === 'warning' && 'bg-gradient-to-br from-[rgba(224,160,73,0.18)] to-[rgba(224,160,73,0.08)] text-[#9b6532]',
            toast.type === 'info' && 'bg-gradient-to-br from-[rgba(33,150,173,0.18)] to-[rgba(33,150,173,0.08)] text-[rgba(16,102,112,0.9)]'
          )}>
            {toast.type === 'success' && <CheckCircleIcon className="h-4 w-4" />}
            {toast.type === 'error' && <XIcon className="h-4 w-4" />}
            {toast.type === 'warning' && <BellIcon className="h-4 w-4" />}
            {toast.type === 'info' && <span>ℹ</span>}
          </div>
          <div className="flex-1">
            <p className="text-[0.85rem] font-semibold leading-relaxed text-[#172022] m-0">{toast.message}</p>
          </div>
          <button
            type="button"
            className="flex items-center justify-center w-6 h-6 rounded-lg border-none bg-transparent text-[rgba(26,42,34,0.5)] text-[0.9rem] cursor-pointer transition-colors hover:bg-[rgba(26,42,34,0.08)] hover:text-[rgba(26,42,34,0.75)] flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss(toast.id)
            }}
            aria-label="Dismiss"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

