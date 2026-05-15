/**
 * Vendor API Service
 * 
 * This file contains all API endpoints for the Vendor dashboard.
 * All endpoints are backend-ready and will work once the backend is implemented.
 * 
 * Base URL should be configured in environment variables:
 * - Development: http://localhost:3000/api
 * - Production: https://api.irasathi.com/api
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

/**
 * API Response Handler
 */
async function handleResponse(response) {
  const data = await response.json().catch(() => ({ 
    success: false,
    error: { message: 'An error occurred' }
  }))
  
  if (!response.ok) {
    // Return error in same format as success response for consistent error handling
    const errorResponse = {
      success: false,
      error: {
        message: data.message || data.error?.message || `HTTP error! status: ${response.status}`,
        status: response.status,
      },
    }
    
    // If 401, also clear token
    if (response.status === 401) {
      localStorage.removeItem('vendor_token')
    }
    
    return errorResponse
  }
  
  return data
}

/**
 * API Request Helper
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('vendor_token') // Vendor authentication token
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
  return handleResponse(response)
}

// ============================================================================
// AUTHENTICATION APIs
// ============================================================================

/**
 * Request OTP for Vendor
 * POST /vendors/auth/request-otp
 * 
 * @param {Object} data - { phone }
 * @returns {Promise<Object>} - { message: 'OTP sent successfully', expiresIn: 300 }
 */
export async function requestVendorOTP(data) {
  return apiRequest('/vendors/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Register Vendor with OTP
 * POST /vendors/auth/register
 * 
 * @param {Object} data - { name, email, phone, location, aadhaarCard, panCard }
 * @returns {Promise<Object>} - { message, vendorId, requiresApproval, expiresIn }
 */
export async function registerVendor(data) {
  return apiRequest('/vendors/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: data.fullName || data.name,
      email: data.email,
      phone: data.phone,
      location: data.location || {
        address: data.address || '',
        city: data.location?.city || '',
        state: data.location?.state || '',
        pincode: data.location?.pincode || '',
        coordinates: data.location?.coordinates || data.coordinates || { lat: data.lat, lng: data.lng },
      },
      aadhaarCard: data.aadhaarCard ? {
        url: data.aadhaarCard.url,
        publicId: data.aadhaarCard.publicId,
        format: data.aadhaarCard.format,
      } : undefined,
      panCard: data.panCard ? {
        url: data.panCard.url,
        publicId: data.panCard.publicId,
        format: data.panCard.format,
      } : undefined,
    }),
  })
}

/**
 * Login Vendor with OTP
 * POST /vendors/auth/verify-otp
 * 
 * @param {Object} data - { phone, otp }
 * @returns {Promise<Object>} - { token, vendor: { id, name, phone, location, coverageRadius } }
 */
export async function loginVendorWithOtp(data) {
  return apiRequest('/vendors/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Vendor Login (Legacy - email/password)
 * POST /vendors/login
 * 
 * @param {Object} credentials - { email, password }
 * @returns {Promise<Object>} - { token, vendor: { id, name, email, phone, location, coverageRadius } }
 */
export async function loginVendor(credentials) {
  // Simulate API call - replace with actual API call when backend is ready
  return new Promise((resolve) => {
    setTimeout(() => {
      if (credentials.email === 'vendor@example.com' && credentials.password === 'password') {
        resolve({
          success: true,
          data: {
            token: 'fake-vendor-token',
            vendor: {
              id: 'vendor-001',
              name: 'Suresh Patel',
              email: credentials.email,
              phone: '+91 9876543210',
              location: { lat: 19.2183, lng: 73.0822, address: 'Kolhapur, Maharashtra' },
              coverageRadius: 20,
            },
          },
        })
      } else {
        resolve({ success: false, error: { message: 'Invalid credentials' } })
      }
    }, 1000)
  })
}

/**
 * Vendor Logout
 * POST /vendors/auth/logout
 * 
 * @returns {Promise<Object>} - { message: 'Logged out successfully' }
 */
export async function logoutVendor() {
  return apiRequest('/vendors/auth/logout', {
    method: 'POST',
  })
}

/**
 * Get Vendor Profile
 * GET /vendors/auth/profile
 * 
 * @returns {Promise<Object>} - Vendor profile data
 */
export async function getVendorProfile() {
  return apiRequest('/vendors/auth/profile')
}

// ============================================================================
// DASHBOARD & OVERVIEW APIs
// ============================================================================

/**
 * Get Vendor Dashboard Overview
 * GET /vendors/dashboard
 * 
 * @returns {Promise<Object>} - {
 *   ordersToday: number,
 *   urgentStock: number,
 *   creditBalance: number,
 *   creditDue: string,
 *   recentActivity: Array,
 *   highlights: Array
 * }
 */
export async function fetchDashboardData() {
  return apiRequest('/vendors/dashboard')
}

// ============================================================================
// ORDERS APIs
// ============================================================================

/**
 * Get All Orders
 * GET /vendors/orders
 * 
 * @param {Object} params - { status, limit, offset, startDate, endDate }
 * @returns {Promise<Object>} - { orders: Array, total: number, stats: Object }
 */
export async function getOrders(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/orders?${queryParams}`)
}

/**
 * Get Order Details
 * GET /vendors/orders/:orderId
 * 
 * IMPORTANT: The response should include item-level stock availability:
 * - Each order item should have: { itemId, productId, name, quantity, availableStock, status: 'in_stock' | 'out_of_stock' | 'insufficient' }
 * - This allows vendor to see which items they can fulfill and which need to be escalated
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} - { 
 *   order: {
 *     id: string,
 *     items: Array<{ itemId, productId, name, quantity, availableStock, status }>,
 *     farmer: string,
 *     value: string,
 *     payment: string,
 *     status: string
 *   }
 * }
 */
export async function getOrderDetails(orderId) {
  return apiRequest(`/vendors/orders/${orderId}`)
}

/**
 * Accept Order (Mark as Available)
 * POST /vendors/orders/:orderId/accept
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} - { message: 'Order accepted', order: Object }
 */
export async function acceptOrder(orderId, notes) {
  return apiRequest(`/vendors/orders/${orderId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  })
}

/**
 * Confirm Order Acceptance (finalize after grace period)
 * POST /vendors/orders/:orderId/confirm-acceptance
 * 
 * @param {string} orderId - Order ID
 * @param {Object} data - { notes?: string }
 * @returns {Promise<Object>} - { message: 'Order acceptance confirmed', order: Object }
 */
export async function confirmOrderAcceptance(orderId, data = {}) {
  return apiRequest(`/vendors/orders/${orderId}/confirm-acceptance`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Cancel Order Acceptance (during grace period)
 * POST /vendors/orders/:orderId/cancel-acceptance
 * 
 * @param {string} orderId - Order ID
 * @param {Object} data - { reason?: string }
 * @returns {Promise<Object>} - { message: 'Order acceptance cancelled', order: Object }
 */
export async function cancelOrderAcceptance(orderId, data = {}) {
  return apiRequest(`/vendors/orders/${orderId}/cancel-acceptance`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Accept Order Partially (Accept some items, reject others)
 * POST /vendors/orders/:orderId/accept-partial
 * 
 * IMPORTANT: This API handles partial order fulfillment where:
 * - Items that vendor has in stock → Vendor fulfills those items
 * - Items that vendor doesn't have (or insufficient quantity) → Escalated to Admin
 * 
 * @param {string} orderId - Order ID
 * @param {Object} partialData - {
 *   acceptedItems: Array<{ itemId: string, quantity: number }>, // Items vendor can fulfill
 *   rejectedItems: Array<{ itemId: string, quantity: number, reason?: string }>, // Items to escalate to Admin
 *   notes?: string
 * }
 * @returns {Promise<Object>} - { 
 *   message: 'Order partially accepted',
 *   vendorOrder: Object, // Order for vendor to fulfill
 *   adminOrder: Object, // Order escalated to admin
 *   order: Object // Original order with split status
 * }
 */
export async function acceptOrderPartially(orderId, partialData) {
  return apiRequest(`/vendors/orders/${orderId}/accept-partial`, {
    method: 'POST',
    body: JSON.stringify(partialData),
  })
}

/**
 * Reject Order (Mark as Not Available)
 * POST /vendors/orders/:orderId/reject
 * 
 * @param {string} orderId - Order ID
 * @param {Object} reasonData - { reason: string, notes?: string }
 * @returns {Promise<Object>} - { message: 'Order rejected', order: Object }
 */
export async function rejectOrder(orderId, reasonData) {
  return apiRequest(`/vendors/orders/${orderId}/reject`, {
    method: 'POST',
    body: JSON.stringify(reasonData),
  })
}

/**
 * Escalate Order with Partial Quantities (Scenario 3)
 * POST /vendors/orders/:orderId/escalate-partial
 * 
 * IMPORTANT: This API handles partial quantity escalation where:
 * - Vendor has some quantity of an item but not enough
 * - Vendor can accept partial quantity and escalate the rest
 * 
 * @param {string} orderId - Order ID
 * @param {Object} escalationData - {
 *   escalatedItems: Array<{ itemId: string, escalatedQuantity: number, reason?: string }>,
 *   reason: string,
 *   notes?: string
 * }
 * @returns {Promise<Object>} - { 
 *   message: 'Order partially escalated',
 *   vendorOrder: Object, // Order for vendor to fulfill
 *   escalatedOrder: Object, // Order escalated to admin
 * }
 */
export async function escalateOrderPartial(orderId, escalationData) {
  return apiRequest(`/vendors/orders/${orderId}/escalate-partial`, {
    method: 'POST',
    body: JSON.stringify(escalationData),
  })
}

/**
 * Update Order Status
 * PUT /vendors/orders/:orderId/status
 * 
 * IMPORTANT: This status update must be persisted and immediately reflected in the User Dashboard.
 * 
 * @param {string} orderId - Order ID
 * @param {Object} statusData - { status: 'awaiting' | 'dispatched' | 'delivered', notes?: string }
 * @returns {Promise<Object>} - { message: 'Status updated', order: Object with statusTimeline }
 */
export async function updateOrderStatus(orderId, statusData) {
  return apiRequest(`/vendors/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify(statusData),
  })
}

/**
 * Get Order Statistics
 * GET /vendors/orders/stats
 * 
 * @param {Object} params - { period: 'day' | 'week' | 'month' }
 * @returns {Promise<Object>} - { total, awaiting, processing, delivered, revenue }
 */
export async function getOrderStats(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/orders/stats?${queryParams}`)
}

// ============================================================================
// PRODUCT APIs (For vendors to view and order products)

/**
 * Get All Products Available for Ordering
 * GET /vendors/products
 * 
 * @param {Object} params - Query parameters { page, limit, category, search, sortBy, sortOrder }
 * @returns {Promise<Object>} - { products: Array, pagination: Object }
 */
export async function getProducts(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/products?${queryParams}`)
}

/**
 * Get Product Details
 * GET /vendors/products/:productId
 * 
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} - Detailed product information
 */
export async function getProductDetails(productId) {
  return apiRequest(`/vendors/products/${productId}`)
}

// INVENTORY APIs
// ============================================================================

/**
 * Get All Inventory Items
 * GET /vendors/inventory
 * 
 * @param {Object} params - { status, search, limit, offset }
 * @returns {Promise<Object>} - { items: Array, total: number, stats: Object }
 */
export async function getInventory(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/inventory?${queryParams}`)
}

/**
 * Get Inventory Item Details
 * GET /vendors/inventory/:itemId
 * 
 * @param {string} itemId - Inventory item ID
 * @returns {Promise<Object>} - Detailed inventory item information
 */
export async function getInventoryItemDetails(itemId) {
  return apiRequest(`/vendors/inventory/${itemId}`)
}

/**
 * Update Inventory Stock
 * PUT /vendors/inventory/:itemId/stock
 * 
 * @param {string} itemId - Inventory item ID
 * @param {Object} stockData - { quantity: number, notes?: string }
 * @returns {Promise<Object>} - { message: 'Stock updated', item: Object }
 */
export async function updateInventoryStock(itemId, stockData) {
  return apiRequest(`/vendors/inventory/${itemId}/stock`, {
    method: 'PUT',
    body: JSON.stringify(stockData),
  })
}

/**
 * Get Inventory Statistics
 * GET /vendors/inventory/stats
 * 
 * @returns {Promise<Object>} - { totalItems, lowStock, criticalStock, healthyStock, totalValue }
 */
export async function getInventoryStats() {
  return apiRequest('/vendors/inventory/stats')
}

// ============================================================================
// CREDIT MANAGEMENT APIs
// ============================================================================

/**
 * Get Credit Information
 * GET /vendors/credit
 * 
 * @returns {Promise<Object>} - {
 *   limit: number,
 *   used: number,
 *   remaining: number,
 *   penalty: number,
 *   dueDate: string,
 *   repaymentDays: number,
 *   penaltyRate: number
 * }
 */
export async function getCreditInfo() {
  return apiRequest('/vendors/credit')
}

/**
 * Request Credit Purchase (Purchase from Admin)
 * POST /vendors/credit/purchase
 * 
 * @param {Object} purchaseData - {
 *   items: Array<{ productId: string, quantity: number, price: number }>,
 *   totalAmount: number,
 *   notes?: string
 * }
 * @returns {Promise<Object>} - { requestId, message, status }
 */
export async function requestCreditPurchase(purchaseData) {
  return apiRequest('/vendors/credit/purchase', {
    method: 'POST',
    body: JSON.stringify(purchaseData),
  })
}

/**
 * Get Credit Purchase Requests
 * GET /vendors/credit/purchases
 * 
 * @param {Object} params - { status, limit, offset }
 * @returns {Promise<Object>} - { purchases: Array, total: number }
 */
export async function getCreditPurchases(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/credit/purchases?${queryParams}`)
}

/**
 * Get Credit Purchase Details
 * GET /vendors/credit/purchases/:requestId
 * 
 * @param {string} requestId - Purchase request ID
 * @returns {Promise<Object>} - Purchase request details
 */
export async function getCreditPurchaseDetails(requestId) {
  return apiRequest(`/vendors/credit/purchases/${requestId}`)
}

/**
 * Get Credit History
 * GET /vendors/credit/history
 * 
 * @param {Object} params - { limit, offset, startDate, endDate }
 * @returns {Promise<Object>} - { transactions: Array, total: number }
 */
export async function getCreditHistory(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/credit/history?${queryParams}`)
}

/**
 * Create Repayment Payment Intent
 * POST /vendors/credit/repayment/create-intent
 */
export async function createRepaymentIntent(repaymentData) {
  return apiRequest('/vendors/credit/repayment/create-intent', {
    method: 'POST',
    body: JSON.stringify(repaymentData),
  })
}

/**
 * Confirm Repayment
 * POST /vendors/credit/repayment/confirm
 */
export async function confirmRepayment(confirmationData) {
  return apiRequest('/vendors/credit/repayment/confirm', {
    method: 'POST',
    body: JSON.stringify(confirmationData),
  })
}

/**
 * Get Repayment History
 * GET /vendors/credit/repayment/history
 */
export async function getRepaymentHistory(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/credit/repayment/history?${queryParams}`)
}

// ============================================================================
// REPORTS & ANALYTICS APIs
// ============================================================================

/**
 * Get Reports Data
 * GET /vendors/reports
 * 
 * @param {Object} params - { period: 'day' | 'week' | 'month' | 'year', type: 'revenue' | 'performance' | 'trends' }
 * @returns {Promise<Object>} - Reports data based on type
 */
export async function getReports(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/reports?${queryParams}`)
}

/**
 * Get Performance Analytics
 * GET /vendors/reports/analytics
 * 
 * @param {Object} params - { period: 'week' | 'month' | 'year' }
 * @returns {Promise<Object>} - Performance metrics and charts data
 */
export async function getPerformanceAnalytics(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/reports/analytics?${queryParams}`)
}

/**
 * Get Region Analytics (20km coverage)
 * Note: This endpoint may not exist in backend. Check getPerformanceAnalytics or getReports instead.
 * GET /vendors/reports/region
 * 
 * @returns {Promise<Object>} - Region-wise order and revenue analytics
 */
export async function getRegionAnalytics() {
  // Try reports endpoint which might include region data
  return apiRequest('/vendors/reports?type=region').catch(() => {
    // Fallback to performance analytics if region endpoint doesn't exist
    return apiRequest('/vendors/reports/analytics?period=month')
  })
}

// ============================================================================
// EARNINGS APIs
// ============================================================================

/**
 * Get Vendor Earnings Summary
 * GET /vendors/earnings
 * 
 * @returns {Promise<Object>} - { totalEarnings, availableBalance, pendingWithdrawal, thisMonthEarnings, lastWithdrawalDate }
 */
export async function getEarningsSummary() {
  return apiRequest('/vendors/earnings')
}

/**
 * Get Vendor Earnings History
 * GET /vendors/earnings/history
 * 
 * @param {Object} params - { page, limit, startDate, endDate, status }
 * @returns {Promise<Object>} - { earnings: Array, pagination: Object }
 */
export async function getEarningsHistory(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/earnings/history?${queryParams}`)
}

/**
 * Get Vendor Earnings by Orders
 * GET /vendors/earnings/orders
 * 
 * @param {Object} params - { page, limit }
 * @returns {Promise<Object>} - { earningsByOrder: Array, pagination: Object }
 */
export async function getEarningsByOrders(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/earnings/orders?${queryParams}`)
}

/**
 * Get Vendor Available Balance
 * GET /vendors/balance
 * 
 * @returns {Promise<Object>} - { totalEarnings, availableBalance, pendingWithdrawal }
 */
export async function getBalance() {
  return apiRequest('/vendors/balance')
}

// ============================================================================
// WITHDRAWAL REQUEST APIs
// ============================================================================

/**
 * Request Withdrawal from Earnings
 * POST /vendors/withdrawals/request
 * 
 * @param {Object} data - { amount, bankAccountId }
 * @returns {Promise<Object>} - { withdrawal: Object, message: string }
 */
export async function requestWithdrawal(data) {
  return apiRequest('/vendors/withdrawals/request', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Get Vendor Withdrawal Requests
 * GET /vendors/withdrawals
 * 
 * @param {Object} params - { page, limit, status }
 * @returns {Promise<Object>} - { withdrawals: Array, pagination: Object }
 */
export async function getWithdrawals(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/vendors/withdrawals?${queryParams}`)
}

// ============================================================================
// BANK ACCOUNT APIs
// ============================================================================

/**
 * Add Bank Account
 * POST /vendors/bank-accounts
 * 
 * @param {Object} data - { accountHolderName, accountNumber, ifscCode, bankName, branchName, isPrimary }
 * @returns {Promise<Object>} - { bankAccount: Object, message: string }
 */
export async function addBankAccount(data) {
  return apiRequest('/vendors/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Get Vendor Bank Accounts
 * GET /vendors/bank-accounts
 * 
 * @returns {Promise<Object>} - { bankAccounts: Array }
 */
export async function getBankAccounts() {
  return apiRequest('/vendors/bank-accounts')
}

/**
 * Update Bank Account
 * PUT /vendors/bank-accounts/:accountId
 * 
 * @param {string} accountId - Bank account ID
 * @param {Object} data - { accountHolderName, accountNumber, ifscCode, bankName, branchName, isPrimary }
 * @returns {Promise<Object>} - { bankAccount: Object, message: string }
 */
export async function updateBankAccount(accountId, data) {
  return apiRequest(`/vendors/bank-accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Delete Bank Account
 * DELETE /vendors/bank-accounts/:accountId
 * 
 * @param {string} accountId - Bank account ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteBankAccount(accountId) {
  return apiRequest(`/vendors/bank-accounts/${accountId}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Get Vendor Notifications
 * GET /vendors/notifications
 * 
 * @param {Object} params - { page, limit, read, type }
 * @returns {Promise<Object>} - { notifications: Array, pagination: Object, unreadCount: number }
 */
export async function getNotifications(params = {}) {
  const queryParams = new URLSearchParams()
  if (params.page) queryParams.append('page', params.page)
  if (params.limit) queryParams.append('limit', params.limit)
  if (params.read !== undefined) queryParams.append('read', params.read)
  if (params.type) queryParams.append('type', params.type)

  return apiRequest(`/vendors/notifications${queryParams.toString() ? `?${queryParams.toString()}` : ''}`, {
    method: 'GET',
  })
}

/**
 * Mark Notification as Read
 * PATCH /vendors/notifications/:notificationId/read
 * 
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} - { notification: Object }
 */
export async function markNotificationAsRead(notificationId) {
  return apiRequest(`/vendors/notifications/${notificationId}/read`, {
    method: 'PATCH',
  })
}

/**
 * Mark All Notifications as Read
 * PATCH /vendors/notifications/read-all
 * 
 * @returns {Promise<Object>} - { updatedCount: number }
 */
export async function markAllNotificationsAsRead() {
  return apiRequest('/vendors/notifications/read-all', {
    method: 'PATCH',
  })
}

/**
 * Delete Notification
 * DELETE /vendors/notifications/:notificationId
 * 
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteNotification(notificationId) {
  return apiRequest(`/vendors/notifications/${notificationId}`, {
    method: 'DELETE',
  })
}

/**
 * Handle Real-time Notification
 * Processes incoming notifications and dispatches appropriate actions
 * 
 * @param {Object} notification - Notification object
 * @param {Function} dispatch - Context dispatch function
 * @param {Function} showToast - Toast notification function
 */
export function handleRealtimeNotification(notification, dispatch, showToast) {
  switch (notification.type) {
    case 'order_assigned':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_ORDERS_UPDATED', payload: true })
      showToast(notification.message, 'info')
      break

    case 'order_status_changed':
      dispatch({ type: 'UPDATE_ORDER_STATUS', payload: notification.data })
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      showToast(notification.message, 'info')
      break

    case 'credit_purchase_approved':
      dispatch({ type: 'UPDATE_CREDIT_BALANCE', payload: { isIncrement: true, amount: notification.data.amount } })
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      showToast(notification.message, 'success')
      break

    case 'credit_purchase_rejected':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      showToast(notification.message, 'error')
      break

    case 'credit_due_reminder':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      showToast(notification.message, 'warning')
      break

    case 'inventory_low_alert':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_INVENTORY_UPDATED', payload: true })
      showToast(notification.message, 'warning')
      break

    case 'admin_announcement':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      showToast(notification.message, 'info')
      break

    default:
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      break
  }
}

