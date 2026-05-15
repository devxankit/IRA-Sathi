import { createContext, useContext, useMemo, useReducer, useEffect, useState } from 'react'
import { initializeRealtimeConnection, handleRealtimeNotification, getUserProfile } from '../services/userApi'

const UserStateContext = createContext(null)
const UserDispatchContext = createContext(() => { })

const initialState = {
  authenticated: false,
  profile: {
    name: 'Guest User',
    email: '',
    phone: '',
    sellerId: null, // Seller ID linked to user
    location: {
      address: '',
      city: '',
      state: '',
      pincode: '',
      coordinates: null,
    },
  },
  cart: [],
  orders: [],
  addresses: [],
  paymentMethods: [],
  favourites: [],
  notifications: [],
  assignedVendor: null, // Vendor assigned based on location (20km radius)
  vendorAvailability: {
    vendorAvailable: false,
    canPlaceOrder: false,
    isInBufferZone: false, // Within 300m buffer (20km to 20.3km) - no warning shown
  },
  realtimeConnected: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'AUTH_LOGIN':
      return {
        ...state,
        authenticated: true,
        profile: {
          ...state.profile,
          ...action.payload,
          sellerId: action.payload.sellerId || state.profile.sellerId, // Preserve sellerId if not provided
        },
      }
    case 'UPDATE_SELLER_ID':
      return {
        ...state,
        profile: {
          ...state.profile,
          sellerId: action.payload,
        },
      }
    case 'SET_ASSIGNED_VENDOR':
      return {
        ...state,
        assignedVendor: action.payload,
      }
    case 'SET_VENDOR_AVAILABILITY':
      return {
        ...state,
        vendorAvailability: action.payload,
      }
    case 'SET_REALTIME_CONNECTED':
      return {
        ...state,
        realtimeConnected: action.payload,
      }
    case 'AUTH_LOGOUT':
      return {
        ...state,
        authenticated: false,
        profile: initialState.profile,
        cart: [],
        vendorAvailability: initialState.vendorAvailability,
        assignedVendor: null,
      }
    case 'ADD_TO_CART': {
      const existingItem = state.cart.find((item) => item.productId === action.payload.productId)
      if (existingItem) {
        return {
          ...state,
          cart: state.cart.map((item) =>
            item.productId === action.payload.productId
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item,
          ),
        }
      }
      return {
        ...state,
        cart: [...state.cart, action.payload],
      }
    }
    case 'UPDATE_CART_ITEM':
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.productId === action.payload.productId
            ? { ...item, quantity: action.payload.quantity }
            : item,
        ),
      }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter((item) => item.productId !== action.payload.productId),
      }
    case 'CLEAR_CART':
      return {
        ...state,
        cart: [],
      }
    case 'SET_CART_ITEMS':
      return {
        ...state,
        cart: Array.isArray(action.payload) ? action.payload : [],
      }
    case 'ADD_ORDER':
      // Note: Cart is NOT cleared here. It will be cleared only after successful payment confirmation
      // This ensures cart items remain available if user cancels payment or payment fails
      return {
        ...state,
        orders: [...state.orders, action.payload],
        // cart: [] - Removed: Cart should only be cleared after payment is confirmed
      }
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.payload.id ? { ...order, ...action.payload } : order,
        ),
      }
    case 'ADD_ADDRESS':
      return {
        ...state,
        addresses: [...state.addresses, action.payload],
      }
    case 'UPDATE_ADDRESS':
      return {
        ...state,
        addresses: state.addresses.map((addr) =>
          addr.id === action.payload.id ? { ...addr, ...action.payload } : addr,
        ),
      }
    case 'SET_DEFAULT_ADDRESS':
      return {
        ...state,
        addresses: state.addresses.map((addr) => ({
          ...addr,
          isDefault: addr.id === action.payload.id,
        })),
      }
    case 'DELETE_ADDRESS':
      return {
        ...state,
        addresses: state.addresses.filter((addr) => addr.id !== action.payload.id),
      }
    case 'CLEAR_ADDRESSES':
      return {
        ...state,
        addresses: [],
      }
    case 'ADD_TO_FAVOURITES':
      if (state.favourites.includes(action.payload.productId)) {
        return state
      }
      return {
        ...state,
        favourites: [...state.favourites, action.payload.productId],
      }
    case 'REMOVE_FROM_FAVOURITES':
      return {
        ...state,
        favourites: state.favourites.filter((id) => id !== action.payload.productId),
      }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [
          {
            id: Date.now().toString(),
            ...action.payload,
            read: false,
            timestamp: new Date().toISOString(),
          },
          ...state.notifications,
        ],
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
    default:
      return state
  }
}

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize user session from stored token on mount
  useEffect(() => {
    const initializeUser = async () => {
      const token = localStorage.getItem('user_token')
      if (token && !state.authenticated) {
        try {
          const profileResult = await getUserProfile()

          if (profileResult.success && profileResult.data?.user) {
            const userData = profileResult.data.user
            dispatch({
              type: 'AUTH_LOGIN',
              payload: {
                name: userData.name || 'User',
                phone: userData.phone || '',
                email: userData.email || '',
                sellerId: userData.sellerId || null,
                location: userData.location || null,
              },
            })

            // Set vendor availability status from profile if available
            if (profileResult.data?.vendorAvailability) {
              dispatch({
                type: 'SET_VENDOR_AVAILABILITY',
                payload: profileResult.data.vendorAvailability,
              })

              // Set assigned vendor if available
              if (profileResult.data.vendorAvailability.assignedVendor) {
                dispatch({
                  type: 'SET_ASSIGNED_VENDOR',
                  payload: profileResult.data.vendorAvailability.assignedVendor,
                })
              }
            }
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('user_token')
          }
        } catch (error) {
          console.error('Failed to initialize user session:', error)
          // Token might be invalid or expired, remove it
          localStorage.removeItem('user_token')
        }
      }
      setIsInitialized(true)
    }

    initializeUser()
  }, [state.authenticated]) // Re-run when authenticated state changes

  // Initialize real-time connection when authenticated
  useEffect(() => {
    if (state.authenticated && state.profile.phone) {
      const cleanup = initializeRealtimeConnection((notification) => {
        const processedNotification = handleRealtimeNotification(notification)

        // Handle different notification types
        switch (processedNotification.type) {
          case 'payment_reminder':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'payment',
                title: 'Payment Reminder',
                message: `Please complete the remaining payment of ₹${processedNotification.amount} for Order #${processedNotification.orderId}`,
                orderId: processedNotification.orderId,
                amount: processedNotification.amount,
                read: false,
              },
            })
            break

          case 'delivery_update':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'delivery',
                title: 'Delivery Update',
                message: processedNotification.message || `Your order #${processedNotification.orderId} status has been updated`,
                orderId: processedNotification.orderId,
                status: processedNotification.status,
                read: false,
              },
            })
            // Update order status if order exists
            if (processedNotification.orderId) {
              dispatch({
                type: 'UPDATE_ORDER',
                payload: {
                  id: processedNotification.orderId,
                  status: processedNotification.status,
                },
              })
            }
            break

          case 'order_assigned':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'order',
                title: 'Order Assigned',
                message: `Your order #${processedNotification.orderId} has been assigned to ${processedNotification.vendorName}`,
                orderId: processedNotification.orderId,
                read: false,
              },
            })
            break

          case 'order_delivered':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: 'delivery',
                title: 'Order Delivered',
                message: `Your order #${processedNotification.orderId} has been delivered. Please complete the remaining payment.`,
                orderId: processedNotification.orderId,
                read: false,
              },
            })
            // Update order status
            if (processedNotification.orderId) {
              dispatch({
                type: 'UPDATE_ORDER',
                payload: {
                  id: processedNotification.orderId,
                  status: 'delivered',
                  deliveryDate: processedNotification.deliveryDate || new Date().toISOString(),
                },
              })
            }
            break

          case 'offer':
          case 'announcement':
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: processedNotification.id,
                type: processedNotification.type,
                title: processedNotification.title,
                message: processedNotification.message,
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
  }, [state.authenticated, state.profile.phone])

  // Persist favourites to localStorage
  useEffect(() => {
    // Load favourites from localStorage on mount
    const savedFavourites = localStorage.getItem('user_favourites')
    if (savedFavourites) {
      try {
        const parsed = JSON.parse(savedFavourites)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only load if there are no favourites in state yet (initial load)
          if (state.favourites.length === 0) {
            parsed.forEach(productId => {
              dispatch({ type: 'ADD_TO_FAVOURITES', payload: { productId } })
            })
          }
        }
      } catch (error) {
        console.error('Error loading favourites from localStorage:', error)
      }
    }
  }, []) // Run only on mount

  // Save favourites to localStorage whenever they change
  useEffect(() => {
    if (state.favourites.length >= 0) {
      localStorage.setItem('user_favourites', JSON.stringify(state.favourites))
    }
  }, [state.favourites])

  const value = useMemo(() => state, [state])
  return (
    <UserStateContext.Provider value={value}>
      <UserDispatchContext.Provider value={dispatch}>{children}</UserDispatchContext.Provider>
    </UserStateContext.Provider>
  )
}

export function useUserState() {
  const context = useContext(UserStateContext)
  if (!context) throw new Error('useUserState must be used within UserProvider')
  return context
}

export function useUserDispatch() {
  const dispatch = useContext(UserDispatchContext)
  if (!dispatch) throw new Error('useUserDispatch must be used within UserProvider')
  return dispatch
}

