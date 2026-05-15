/**
 * Custom hook for User API integration
 * Provides easy access to API functions with loading states and error handling
 */

import { useState, useCallback } from 'react'
import { useUserDispatch } from '../context/UserContext'
import * as userApi from '../services/userApi'

export function useUserApi() {
  const dispatch = useUserDispatch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleApiCall = useCallback(
    async (apiFunction, successAction, errorMessage, ...args) => {
      setLoading(true)
      setError(null)
      try {
        const result = await apiFunction(...args)
        if (result.success) {
          if (successAction) {
            // Extract the actual data object from result.data before dispatching
            dispatch(successAction(result.data))
          }
          return { data: result.data, error: null }
        } else {
          setError(result.error?.message || errorMessage || 'An error occurred')
          return { data: null, error: result.error }
        }
      } catch (err) {
        const errorMsg = err.error?.message || err.message || errorMessage || 'An unexpected error occurred'
        setError(errorMsg)
        return { data: null, error: { message: errorMsg } }
      } finally {
        setLoading(false)
      }
    },
    [dispatch],
  )

  // Authentication APIs
  const requestOTP = useCallback(
    async (phone, language = 'en') => {
      return handleApiCall(
        () => userApi.requestOTP({ phone, language }),
        null,
        'Failed to send OTP',
      )
    },
    [handleApiCall],
  )

  const verifyOTP = useCallback(
    async (phone, otp, sellerId = null) => {
      return handleApiCall(
        () => userApi.verifyOTP({ phone, otp, sellerId }),
        (data) => ({
          type: 'AUTH_LOGIN',
          payload: {
            ...data.user,
            sellerId: data.user?.sellerId || sellerId,
          },
        }),
        'Failed to verify OTP',
      )
    },
    [handleApiCall],
  )

  const getSellerID = useCallback(
    async () => {
      return handleApiCall(
        () => userApi.getSellerID(),
        (data) => ({
          type: 'UPDATE_SELLER_ID',
          payload: data.sellerId,
        }),
        'Failed to get Seller ID',
      )
    },
    [handleApiCall],
  )

  // Product APIs
  const fetchProducts = useCallback(
    async (params = {}) => {
      return handleApiCall(
        () => userApi.getProducts(params),
        null,
        'Failed to load products',
      )
    },
    [handleApiCall],
  )

  const fetchProductDetails = useCallback(
    async (productId) => {
      return handleApiCall(
        () => userApi.getProductDetails(productId),
        null,
        'Failed to load product details',
      )
    },
    [handleApiCall],
  )

  const fetchCategories = useCallback(async () => {
    return handleApiCall(
      userApi.getCategories,
      null,
      'Failed to load categories',
    )
  }, [handleApiCall])

  // Cart APIs
  const addToCart = useCallback(
    async (productId, quantity, variantAttributes = null) => {
      const payload = { productId, quantity }
      if (variantAttributes && Object.keys(variantAttributes).length > 0) {
        payload.variantAttributes = variantAttributes
      }
      return handleApiCall(
        () => userApi.addToCart(payload),
        () => ({
          type: 'ADD_TO_CART',
          payload: { productId, quantity, variantAttributes },
        }),
        'Failed to add to cart',
      )
    },
    [handleApiCall],
  )

  const updateCartItem = useCallback(
    async (itemId, quantity) => {
      return handleApiCall(
        () => userApi.updateCartItem(itemId, { quantity }),
        () => ({
          type: 'UPDATE_CART_ITEM',
          payload: { productId: itemId, quantity },
        }),
        'Failed to update cart',
      )
    },
    [handleApiCall],
  )

  const removeFromCart = useCallback(
    async (itemId) => {
      return handleApiCall(
        () => userApi.removeFromCart(itemId),
        () => ({
          type: 'REMOVE_FROM_CART',
          payload: { productId: itemId },
        }),
        'Failed to remove from cart',
      )
    },
    [handleApiCall],
  )

  const fetchCart = useCallback(async () => {
    return handleApiCall(
      userApi.getCart,
      null, // Don't auto-dispatch, handle manually
      'Failed to load cart',
    )
  }, [handleApiCall])

  const validateCart = useCallback(async () => {
    return handleApiCall(
      userApi.validateCart,
      null,
      'Failed to validate cart',
    )
  }, [handleApiCall])

  // Vendor Assignment APIs
  const assignVendor = useCallback(
    async (location) => {
      return handleApiCall(
        () => userApi.getAssignedVendor({ location }),
        (data) => ({
          type: 'SET_ASSIGNED_VENDOR',
          payload: data.vendor,
        }),
        'Failed to assign vendor',
      )
    },
    [handleApiCall],
  )

  const checkVendorStock = useCallback(
    async (vendorId, productIds) => {
      return handleApiCall(
        () => userApi.checkVendorStock({ vendorId, productIds }),
        null,
        'Failed to check vendor stock',
      )
    },
    [handleApiCall],
  )

  // Order APIs
  const createOrder = useCallback(
    async (orderData) => {
      return handleApiCall(
        () => userApi.createOrder(orderData),
        (data) => ({
          type: 'ADD_ORDER',
          payload: data.order || data,
        }),
        'Failed to create order',
      )
    },
    [handleApiCall],
  )

  const fetchOrders = useCallback(
    async (params = {}) => {
      return handleApiCall(
        () => userApi.getOrders(params),
        null,
        'Failed to load orders',
      )
    },
    [handleApiCall],
  )

  const fetchOrderDetails = useCallback(
    async (orderId) => {
      return handleApiCall(
        () => userApi.getOrderDetails(orderId),
        null,
        'Failed to load order details',
      )
    },
    [handleApiCall],
  )

  // Payment APIs
  const createPaymentIntent = useCallback(
    async (data) => {
      // Accept object parameter: { orderId, amount?, paymentMethod? }
      return handleApiCall(
        () => userApi.createPaymentIntent(data),
        null,
        'Failed to create payment intent',
      )
    },
    [handleApiCall],
  )

  const confirmPayment = useCallback(
    async (paymentData) => {
      return handleApiCall(
        () => userApi.confirmPayment(paymentData),
        null,
        'Failed to confirm payment',
      )
    },
    [handleApiCall],
  )

  const createRemainingPaymentIntent = useCallback(
    async (orderId, paymentMethod) => {
      return handleApiCall(
        () => userApi.createRemainingPaymentIntent({ orderId, paymentMethod }),
        null,
        'Failed to create remaining payment intent',
      )
    },
    [handleApiCall],
  )

  const confirmRemainingPayment = useCallback(
    async (paymentData) => {
      return handleApiCall(
        () => userApi.confirmRemainingPayment(paymentData),
        (data) => ({
          type: 'UPDATE_ORDER',
          payload: {
            id: paymentData.orderId,
            paymentStatus: 'fully_paid',
          },
        }),
        'Failed to confirm remaining payment',
      )
    },
    [handleApiCall],
  )

  // Address APIs
  const addAddress = useCallback(
    async (addressData) => {
      return handleApiCall(
        () => userApi.addAddress(addressData),
        (data) => ({
          type: 'ADD_ADDRESS',
          payload: data.address || data,
        }),
        'Failed to add address',
      )
    },
    [handleApiCall],
  )

  const updateAddress = useCallback(
    async (addressId, addressData) => {
      return handleApiCall(
        () => userApi.updateAddress(addressId, addressData),
        (data) => ({
          type: 'UPDATE_ADDRESS',
          payload: { id: addressId, ...data },
        }),
        'Failed to update address',
      )
    },
    [handleApiCall],
  )

  const deleteAddress = useCallback(
    async (addressId) => {
      return handleApiCall(
        () => userApi.deleteAddress(addressId),
        (data) => ({
          type: 'DELETE_ADDRESS',
          payload: { id: addressId },
        }),
        'Failed to delete address',
      )
    },
    [handleApiCall],
  )

  // Favourites APIs
  const addToFavourites = useCallback(
    async (productId) => {
      return handleApiCall(
        () => userApi.addToFavourites({ productId }),
        () => ({
          type: 'ADD_TO_FAVOURITES',
          payload: { productId },
        }),
        'Failed to add to favourites',
      )
    },
    [handleApiCall],
  )

  const removeFromFavourites = useCallback(
    async (productId) => {
      return handleApiCall(
        () => userApi.removeFromFavourites(productId),
        () => ({
          type: 'REMOVE_FROM_FAVOURITES',
          payload: { productId },
        }),
        'Failed to remove from favourites',
      )
    },
    [handleApiCall],
  )

  // Profile APIs
  const updateUserProfile = useCallback(
    async (profileData) => {
      return handleApiCall(
        () => userApi.updateUserProfile(profileData),
        (data) => ({
          type: 'AUTH_LOGIN',
          payload: data.user || data,
        }),
        'Failed to update profile',
      )
    },
    [handleApiCall],
  )

  // Support APIs
  const createSupportTicket = useCallback(
    async (ticketData) => {
      return handleApiCall(
        () => userApi.createSupportTicket(ticketData),
        null,
        'Failed to create support ticket',
      )
    },
    [handleApiCall],
  )

  const initiateSupportCall = useCallback(
    async (orderId, issue) => {
      return handleApiCall(
        () => userApi.initiateSupportCall({ orderId, issue }),
        null,
        'Failed to initiate support call',
      )
    },
    [handleApiCall],
  )

  return {
    loading,
    error,
    requestOTP,
    verifyOTP,
    getSellerID,
    fetchProducts,
    fetchProductDetails,
    fetchCategories,
    fetchCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    validateCart,
    assignVendor,
    checkVendorStock,
    createOrder,
    fetchOrders,
    fetchOrderDetails,
    createPaymentIntent,
    confirmPayment,
    createRemainingPaymentIntent,
    confirmRemainingPayment,
    addAddress,
    updateAddress,
    deleteAddress,
    addToFavourites,
    removeFromFavourites,
    updateUserProfile,
    createSupportTicket,
    initiateSupportCall,
  }
}

