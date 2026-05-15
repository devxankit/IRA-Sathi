import { createContext, useContext, useMemo, useReducer, useEffect, useState } from 'react'
import { getVendorProfile } from '../services/vendorApi'

const initialState = {
  language: 'en',
  role: null,
  authenticated: false,
  profile: {
    name: 'Guest Vendor',
    email: '',
    phone: '',
    location: null,
    coverageRadius: 20,
  },
  notifications: [],
  dashboard: {
    overview: null,
    orders: null,
    inventory: null,
    credit: null,
    reports: null,
    loading: false,
    error: null,
  },
  ordersUpdated: false,
  inventoryUpdated: false,
  realtimeConnected: false,
}

// Use a symbol to detect if context is actually provided
const VENDOR_CONTEXT_SYMBOL = Symbol('VendorContextProvided')

const VendorStateContext = createContext(null)
const VendorDispatchContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }
    case 'SET_ROLE':
      return { ...state, role: action.payload }
    case 'AUTH_LOGIN':
      return {
        ...state,
        authenticated: true,
        profile: {
          ...state.profile,
          ...action.payload,
        },
      }
    case 'AUTH_LOGOUT':
      return {
        ...state,
        authenticated: false,
        profile: initialState.profile,
        notifications: [],
        dashboard: initialState.dashboard,
        ordersUpdated: false,
        inventoryUpdated: false,
      }
    case 'UPDATE_PROFILE':
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.payload,
        },
      }
    case 'SET_DASHBOARD_LOADING':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          loading: action.payload,
        },
      }
    case 'SET_DASHBOARD_ERROR':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          error: action.payload,
          loading: false,
        },
      }
    case 'SET_DASHBOARD_OVERVIEW':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          overview: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_ORDERS_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          orders: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_INVENTORY_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          inventory: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_CREDIT_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          credit: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_REPORTS_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          reports: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'UPDATE_ORDER_STATUS': {
      const targetId = action.payload.orderId?.toString?.() ?? String(action.payload.orderId || '')
      const applyOrderUpdates = (order) => {
        const currentId =
          order.id?.toString?.() ??
          order._id?.toString?.() ??
          order.orderId?.toString?.() ??
          ''
        if (currentId && targetId && currentId === targetId) {
          return {
            ...order,
            status: action.payload.status ?? order.status,
            ...(action.payload.updates || {}),
          }
        }
        return order
      }

      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          orders: state.dashboard.orders
            ? {
              ...state.dashboard.orders,
              orders: state.dashboard.orders.orders?.map(applyOrderUpdates),
            }
            : null,
        },
        ordersUpdated: true,
      }
    }
    case 'UPDATE_INVENTORY_STOCK':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          inventory: state.dashboard.inventory
            ? {
              ...state.dashboard.inventory,
              items: state.dashboard.inventory.items?.map((item) =>
                item.id === action.payload.itemId
                  ? { ...item, stock: action.payload.stock }
                  : item,
              ),
            }
            : null,
        },
        inventoryUpdated: true,
      }
    case 'UPDATE_CREDIT_BALANCE': {
      const currentCredit = state.dashboard.credit || { used: 0, remaining: 0 }
      const newUsed = action.payload.isIncrement
        ? currentCredit.used + action.payload.amount
        : action.payload.amount
      const newRemaining = (state.dashboard.credit?.limit || 0) - newUsed
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          credit: {
            ...state.dashboard.credit,
            used: newUsed,
            remaining: newRemaining,
          },
        },
      }
    }
    case 'ADD_CREDIT_PURCHASE_REQUEST':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          credit: {
            ...state.dashboard.credit,
            purchaseRequests: [
              ...(state.dashboard.credit?.purchaseRequests || []),
              action.payload,
            ],
          },
        },
      }
    case 'SET_ORDERS_UPDATED':
      return {
        ...state,
        ordersUpdated: action.payload,
      }
    case 'SET_INVENTORY_UPDATED':
      return {
        ...state,
        inventoryUpdated: action.payload,
      }
    case 'ADD_NOTIFICATION': {
      // Check if notification already exists (prevent duplicates)
      const existingIndex = state.notifications.findIndex(
        (n) => n.id === action.payload.id || (n.type === action.payload.type && n.data?.orderId === action.payload.data?.orderId),
      )
      if (existingIndex >= 0) {
        return state
      }
      return {
        ...state,
        notifications: [
          {
            id: action.payload.id || Date.now().toString(),
            ...action.payload,
            read: action.payload.read || false,
            timestamp: action.payload.timestamp || new Date().toISOString(),
          },
          ...state.notifications,
        ],
      }
    }
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((notif) =>
          notif.id === action.payload.id ? { ...notif, read: true } : notif,
        ),
      }
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map((notif) => ({ ...notif, read: true })),
      }
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload || [],
      }
    case 'SET_REALTIME_CONNECTED':
      return {
        ...state,
        realtimeConnected: action.payload,
      }
    default:
      return state
  }
}

export function VendorProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isInitialized, setIsInitialized] = useState(false)

  // Get toast functions from context (if available)
  let showToast = (message, type) => {
    // Fallback if toast is not available
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  // Initialize vendor profile from token on mount
  useEffect(() => {
    const initializeVendor = async () => {
      const token = localStorage.getItem('vendor_token')
      if (token && !state.authenticated) {
        try {
          const profileResult = await getVendorProfile()

          if (profileResult.success && profileResult.data?.vendor) {
            const vendor = profileResult.data.vendor
            dispatch({
              type: 'AUTH_LOGIN',
              payload: {
                id: vendor.id || vendor._id,
                name: vendor.name,
                phone: vendor.phone,
                email: vendor.email,
                location: vendor.location,
                status: vendor.status,
                isActive: vendor.isActive,
              },
            })
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('vendor_token')
          }
        } catch (error) {
          console.error('Failed to initialize vendor:', error)
          // Token might be invalid, remove it
          localStorage.removeItem('vendor_token')
        }
      }
      setIsInitialized(true)
    }

    initializeVendor()
  }, [state.authenticated]) // Run when authenticated state changes

  const value = useMemo(() => ({ ...state, [VENDOR_CONTEXT_SYMBOL]: true }), [state])
  const dispatchWithSymbol = useMemo(() => {
    const wrappedDispatch = (action) => dispatch(action)
    wrappedDispatch[VENDOR_CONTEXT_SYMBOL] = true
    return wrappedDispatch
  }, [dispatch])
  return (
    <VendorStateContext.Provider value={value}>
      <VendorDispatchContext.Provider value={dispatchWithSymbol}>{children}</VendorDispatchContext.Provider>
    </VendorStateContext.Provider>
  )
}

export function useVendorState() {
  const context = useContext(VendorStateContext)
  if (!context || !context[VENDOR_CONTEXT_SYMBOL]) {
    if (import.meta.env.DEV) {
      console.error('useVendorState must be used within VendorProvider')
      throw new Error('useVendorState must be used within VendorProvider')
    }
    // In production, return initial state to prevent crashes
    return initialState
  }
  // Remove the symbol before returning
  const { [VENDOR_CONTEXT_SYMBOL]: _, ...state } = context
  return state
}

export function useVendorDispatch() {
  const dispatch = useContext(VendorDispatchContext)
  if (!dispatch || !dispatch[VENDOR_CONTEXT_SYMBOL]) {
    if (import.meta.env.DEV) {
      console.error('useVendorDispatch must be used within VendorProvider')
      throw new Error('useVendorDispatch must be used within VendorProvider')
    }
    // In production, return a no-op function to prevent crashes
    return () => {
      if (import.meta.env.DEV) {
        console.warn('VendorDispatch called outside VendorProvider')
      }
    }
  }
  // Return the dispatch function directly
  return dispatch
}

