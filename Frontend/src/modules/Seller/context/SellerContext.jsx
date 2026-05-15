import { createContext, useContext, useMemo, useReducer, useEffect, useState } from 'react'
import { initializeRealtimeConnection, handleRealtimeNotification, getSellerProfile } from '../services/sellerApi'

const initialState = {
  language: 'en',
  role: null,
  authenticated: false,
  profile: {
    name: 'Guest Seller',
    sellerId: '',
    area: '',
    phone: '',
    email: '',
    commissionRate: '',
    cashbackRate: '',
    assignedVendor: '',
  },
  notifications: [],
  dashboard: {
    overview: null,
    wallet: null,
    referrals: null,
    performance: null,
    loading: false,
    error: null,
  },
  targetIncentives: [],
  realtimeConnected: false,
}

// Use a symbol to detect if context is actually provided
const SELLER_CONTEXT_SYMBOL = Symbol('SellerContextProvided')

const SellerStateContext = createContext(null)
const SellerDispatchContext = createContext(null)

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
        targetIncentives: [],
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
    case 'SET_WALLET_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          wallet: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_REFERRALS_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          referrals: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_PERFORMANCE_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          performance: action.payload,
          loading: false,
          error: null,
        },
      }
    case 'SET_TARGET_INCENTIVES':
      return {
        ...state,
        targetIncentives: action.payload,
      }
    case 'ADD_NOTIFICATION': {
      // Check if notification already exists (prevent duplicates)
      const existingIndex = state.notifications.findIndex(
        (n) => n.id === action.payload.id || (n.type === action.payload.type && n.orderId === action.payload.orderId),
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
    case 'SET_REALTIME_CONNECTED':
      return {
        ...state,
        realtimeConnected: action.payload,
      }
    case 'UPDATE_WALLET_BALANCE': {
      const currentBalance = state.dashboard.wallet?.balance || 0
      const newBalance = action.payload.isIncrement
        ? currentBalance + action.payload.balance
        : action.payload.balance
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          wallet: {
            ...state.dashboard.wallet,
            balance: newBalance,
            pending: action.payload.pending !== undefined ? action.payload.pending : state.dashboard.wallet?.pending,
          },
        },
      }
    }
    case 'UPDATE_TARGET_PROGRESS':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          overview: {
            ...state.dashboard.overview,
            targetProgress: action.payload.progress,
            thisMonthSales: action.payload.thisMonthSales,
            status: action.payload.status,
          },
        },
      }
    default:
      return state
  }
}

export function SellerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize seller profile from token on mount
  useEffect(() => {
    const initializeSeller = async () => {
      const token = localStorage.getItem('seller_token')
      if (token && !state.authenticated) {
        try {
          const profileResult = await getSellerProfile()

          if (profileResult.success && profileResult.data?.seller) {
            const seller = profileResult.data.seller
            dispatch({
              type: 'AUTH_LOGIN',
              payload: {
                id: seller.id || seller._id,
                name: seller.name,
                phone: seller.phone,
                email: seller.email,
                sellerId: seller.sellerId,
                area: seller.area,
                status: seller.status,
                isActive: seller.isActive,
              },
            })
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('seller_token')
          }
        } catch (error) {
          console.error('Failed to initialize seller:', error)
          // Token might be invalid, remove it
          localStorage.removeItem('seller_token')
        }
      }
      setIsInitialized(true)
    }

    initializeSeller()
  }, [state.authenticated])

  // Initialize real-time connection when authenticated
  useEffect(() => {
    if (state.authenticated && state.profile.sellerId) {
      const cleanup = initializeRealtimeConnection((notification) => {
        const processedNotification = handleRealtimeNotification(notification)

        // Handle different notification types
        switch (processedNotification.type) {
          case 'cashback_added':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'cashback',
                title: 'Cashback Added',
                message: `You earned ₹${processedNotification.amount} for User Order #${processedNotification.orderId}`,
                amount: processedNotification.amount,
                orderId: processedNotification.orderId,
                read: false,
              },
            })
            // Update wallet balance - will be handled by reducer using current state
            dispatch({
              type: 'UPDATE_WALLET_BALANCE',
              payload: {
                balance: processedNotification.amount, // Amount to add
                isIncrement: true, // Flag to indicate increment
              },
            })
            break

          case 'target_achieved':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'target',
                title: 'Target Achieved!',
                message: 'Congratulations! You reached your monthly goal.',
                read: false,
              },
            })
            break

          case 'announcement':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'announcement',
                title: processedNotification.title,
                message: processedNotification.message,
                read: false,
              },
            })
            break

          case 'withdrawal_approved':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'withdrawal',
                title: 'Withdrawal Approved',
                message: `Your withdrawal request of ₹${processedNotification.amount} has been approved`,
                amount: processedNotification.amount,
                read: false,
              },
            })
            break

          case 'withdrawal_rejected':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'withdrawal',
                title: 'Withdrawal Rejected',
                message: `Your withdrawal request was rejected. Reason: ${processedNotification.reason}`,
                read: false,
              },
            })
            break

          case 'commission_rate_change':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'commission_rate_change',
                title: 'Commission Rate Updated',
                message: `Your commission rate has been updated from ${processedNotification.oldRate}% to ${processedNotification.newRate}%`,
                oldRate: processedNotification.oldRate,
                newRate: processedNotification.newRate,
                read: false,
              },
            })
            break

          case 'policy_update':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'policy_update',
                title: 'Policy Updated',
                message: processedNotification.message || 'Commission policy has been updated. Please review the changes.',
                read: false,
              },
            })
            break

          case 'commission_added':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'commission',
                title: 'Commission Earned',
                message: `You earned ₹${processedNotification.amount} commission from order #${processedNotification.orderId}`,
                amount: processedNotification.amount,
                orderId: processedNotification.orderId,
                read: false,
              },
            })
            break

          default:
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                ...processedNotification,
                read: false,
              },
            })
        }
      })

      dispatch({ type: 'SET_REALTIME_CONNECTED', payload: true })

      return () => {
        cleanup()
        dispatch({ type: 'SET_REALTIME_CONNECTED', payload: false })
      }
    }
  }, [state.authenticated, state.profile.sellerId, dispatch])

  const value = useMemo(() => ({ ...state, [SELLER_CONTEXT_SYMBOL]: true }), [state])
  const dispatchWithSymbol = useMemo(() => {
    const wrappedDispatch = (action) => dispatch(action)
    wrappedDispatch[SELLER_CONTEXT_SYMBOL] = true
    return wrappedDispatch
  }, [dispatch])

  return (
    <SellerStateContext.Provider value={value}>
      <SellerDispatchContext.Provider value={dispatchWithSymbol}>{children}</SellerDispatchContext.Provider>
    </SellerStateContext.Provider>
  )
}

export function useSellerState() {
  const context = useContext(SellerStateContext)
  if (!context || !context[SELLER_CONTEXT_SYMBOL]) {
    if (import.meta.env.DEV) {
      console.error('useSellerState must be used within SellerProvider')
      throw new Error('useSellerState must be used within SellerProvider')
    }
    // In production, return initial state to prevent crashes
    return initialState
  }
  // Remove the symbol before returning
  const { [SELLER_CONTEXT_SYMBOL]: _, ...state } = context
  return state
}

export function useSellerDispatch() {
  const dispatch = useContext(SellerDispatchContext)
  if (!dispatch) {
    if (import.meta.env.DEV) {
      console.error('useSellerDispatch must be used within SellerProvider')
      throw new Error('useSellerDispatch must be used within SellerProvider')
    }
    // In production, return a no-op function to prevent crashes
    return () => {
      if (import.meta.env.DEV) {
        console.warn('SellerDispatch called outside SellerProvider')
      }
    }
  }
  // Check for symbol to ensure it's the wrapped dispatch
  if (!dispatch[SELLER_CONTEXT_SYMBOL]) {
    if (import.meta.env.DEV) {
      console.error('useSellerDispatch must be used within SellerProvider')
      throw new Error('useSellerDispatch must be used within SellerProvider')
    }
    // In production, return a no-op function to prevent crashes
    return () => {
      if (import.meta.env.DEV) {
        console.warn('SellerDispatch called outside SellerProvider')
      }
    }
  }
  // Return the dispatch function directly
  return dispatch
}

