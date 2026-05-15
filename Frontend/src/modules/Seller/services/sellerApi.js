/**
 * Seller API Service
 * 
 * This file contains all API endpoints for the Seller dashboard.
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
  let data;
  try {
    const text = await response.text()
    data = text ? JSON.parse(text) : {}
  } catch (err) {
    data = {
      success: false,
      error: { message: 'An error occurred while parsing response' }
    }
  }

  if (!response.ok) {
    // Return error in same format as success response for consistent error handling
    return {
      success: false,
      error: {
        message: data.message || data.error?.message || `HTTP error! status: ${response.status}`,
        status: response.status,
      },
    }
  }

  return data
}

/**
 * API Request Helper
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('seller_token') // Seller authentication token

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
 * Request OTP for Seller (IRA Partner)
 * POST /sellers/auth/request-otp
 * 
 * @param {Object} data - { phone }
 * @returns {Promise<Object>} - { message: 'OTP sent successfully', expiresIn: 300 }
 */
export async function requestSellerOTP(data) {
  return apiRequest('/sellers/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Register Seller (IRA Partner)
 * POST /sellers/auth/register
 * Note: This sends OTP. Use verifyOTP to complete registration.
 * 
 * @param {Object} data - { name, phone, area }
 * @returns {Promise<Object>} - { message, sellerId, requiresApproval, expiresIn }
 */
export async function registerSeller(data) {
  return apiRequest('/sellers/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: data.fullName || data.name,
      phone: data.phone,
      area: data.area || '',
      location: data.location || null,
    }),
  })
}

/**
 * Login Seller (IRA Partner) with OTP
 * POST /sellers/auth/verify-otp
 * 
 * @param {Object} data - { phone, otp }
 * @returns {Promise<Object>} - { token, seller: { id, sellerId, name, phone, area, status, isActive } }
 */
export async function loginSellerWithOtp(data) {
  return apiRequest('/sellers/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Seller Login (Legacy - email/password)
 * POST /sellers/login
 * 
 * @param {Object} credentials - { email, password }
 * @returns {Promise<Object>} - { token, seller: { id, name, sellerId, email, phone, area, commissionRate, cashbackRate, assignedVendor } }
 */
export async function sellerLogin(credentials) {
  return apiRequest('/sellers/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

/**
 * Seller Logout
 * POST /sellers/auth/logout
 * 
 * @returns {Promise<Object>} - { message: 'Logged out successfully' }
 */
export async function sellerLogout() {
  return apiRequest('/sellers/auth/logout', {
    method: 'POST',
  })
}

/**
 * Get Seller Profile
 * GET /sellers/auth/profile
 * 
 * @returns {Promise<Object>} - Seller profile data
 */
export async function getSellerProfile() {
  return apiRequest('/sellers/auth/profile')
}

/**
 * Update Seller Profile
 * PUT /sellers/profile
 * 
 * @param {Object} profileData - { name, phone, email }
 * @returns {Promise<Object>} - Updated seller profile
 */
export async function updateSellerProfile(profileData) {
  return apiRequest('/sellers/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  })
}

/**
 * Change Password
 * PUT /sellers/password
 * 
 * @param {Object} passwordData - { currentPassword, newPassword }
 * @returns {Promise<Object>} - { message: 'Password changed successfully' }
 */
export async function changePassword(passwordData) {
  return apiRequest('/sellers/password', {
    method: 'PUT',
    body: JSON.stringify(passwordData),
  })
}

/**
 * Request Name Change
 * POST /sellers/profile/request-name-change
 * 
 * @param {Object} changeData - { requestedName, description }
 * @returns {Promise<Object>} - { changeRequest, message }
 */
export async function requestNameChange(changeData) {
  return apiRequest('/sellers/profile/request-name-change', {
    method: 'POST',
    body: JSON.stringify(changeData),
  })
}

/**
 * Request Phone Change
 * POST /sellers/profile/request-phone-change
 * 
 * @param {Object} changeData - { requestedPhone, description }
 * @returns {Promise<Object>} - { changeRequest, message }
 */
export async function requestPhoneChange(changeData) {
  return apiRequest('/sellers/profile/request-phone-change', {
    method: 'POST',
    body: JSON.stringify(changeData),
  })
}

/**
 * Get Change Requests
 * GET /sellers/profile/change-requests
 * 
 * @param {Object} params - { status, limit, offset }
 * @returns {Promise<Object>} - { changeRequests: Array, total: number }
 */
export async function getChangeRequests(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/profile/change-requests?${queryParams}`)
}

// ============================================================================
// DASHBOARD & OVERVIEW APIs
// ============================================================================

/**
 * Get Seller Dashboard Overview
 * GET /sellers/dashboard/overview
 * 
 * @returns {Promise<Object>} - {
 *   walletBalance: number,
 *   monthlyTarget: number,
 *   targetProgress: number,
 *   totalReferrals: number,
 *   totalSales: number,
 *   thisMonthSales: number,
 *   thisMonthReferrals: number,
 *   status: string,
 *   recentActivity: Array
 * }
 */
export async function getDashboardOverview() {
  return apiRequest('/sellers/dashboard/overview')
}

/**
 * Get Seller Highlights/Metrics
 * GET /sellers/dashboard/highlights
 * 
 * @returns {Promise<Array>} - Array of highlight metrics
 */
export async function getDashboardHighlights() {
  return apiRequest('/sellers/dashboard/highlights')
}

/**
 * Get Recent Activity
 * GET /sellers/dashboard/activity
 * 
 * @param {Object} params - { limit, offset }
 * @returns {Promise<Object>} - { activities: Array, total: number }
 */
export async function getRecentActivity(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/dashboard/activity?${queryParams}`)
}

// ============================================================================
// REFERRALS APIs
// ============================================================================

/**
 * Get All Referrals
 * GET /sellers/referrals
 * 
 * @param {Object} params - { status, search, limit, offset }
 * @returns {Promise<Object>} - { referrals: Array, total: number, stats: Object }
 */
export async function getReferrals(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/referrals?${queryParams}`)
}

/**
 * Get Referral Details
 * GET /sellers/referrals/:referralId
 * 
 * @param {string} referralId - Referral user ID
 * @returns {Promise<Object>} - Detailed referral information
 */
export async function getReferralDetails(referralId) {
  return apiRequest(`/sellers/referrals/${referralId}`)
}

/**
 * Get Referral Statistics
 * GET /sellers/referrals/stats
 * 
 * @returns {Promise<Object>} - { total, active, totalCommission, totalSales }
 */
export async function getReferralStats() {
  return apiRequest('/sellers/referrals/stats')
}

// ============================================================================
// WALLET APIs
// ============================================================================

/**
 * Get Wallet Balance
 * GET /sellers/wallet
 * 
 * @returns {Promise<Object>} - {
 *   balance: number,
 *   pending: number,
 *   totalEarned: number,
 *   transactions: Array
 * }
 */
export async function getWalletBalance() {
  return apiRequest('/sellers/wallet')
}

/**
 * Get Wallet Transactions
 * GET /sellers/wallet/transactions
 * 
 * @param {Object} params - { type, limit, offset, startDate, endDate }
 * @returns {Promise<Object>} - { transactions: Array, total: number }
 */
export async function getWalletTransactions(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/wallet/transactions?${queryParams}`)
}

/**
 * Request Withdrawal
 * POST /sellers/wallet/withdrawals/request
 * 
 * @param {Object} withdrawalData - {
 *   amount: number,
 *   bankAccountId: string
 * }
 * @returns {Promise<Object>} - { withdrawal, message }
 */
export async function requestWithdrawal(withdrawalData) {
  return apiRequest('/sellers/wallet/withdrawals/request', {
    method: 'POST',
    body: JSON.stringify(withdrawalData),
  })
}

/**
 * Get Withdrawal Requests
 * GET /sellers/wallet/withdrawals
 * 
 * @param {Object} params - { status, limit, offset }
 * @returns {Promise<Object>} - { withdrawals: Array, total: number }
 */
export async function getWithdrawalRequests(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/wallet/withdrawals?${queryParams}`)
}

/**
 * Get Withdrawal Request Details
 * GET /sellers/wallet/withdrawals/:requestId
 * 
 * @param {string} requestId - Withdrawal request ID
 * @returns {Promise<Object>} - Withdrawal request details
 */
export async function getWithdrawalRequestDetails(requestId) {
  return apiRequest(`/sellers/wallet/withdrawals/${requestId}`)
}

/**
 * Get Commission Summary
 * GET /sellers/wallet/commissions/summary
 * 
 * @returns {Promise<Object>} - {
 *   totalCommission: number,
 *   thisMonthCommission: number,
 *   availableBalance: number,
 *   pendingWithdrawal: number,
 *   commissionByRate: { low: number, high: number },
 *   lastCommissionDate: Date
 * }
 */
export async function getCommissionSummary() {
  return apiRequest('/sellers/wallet/commissions/summary')
}

/**
 * Get Commission History
 * GET /sellers/wallet/commissions/history
 * 
 * @param {Object} params - { limit, offset, startDate, endDate, userId }
 * @returns {Promise<Object>} - { commissions: Array, total: number }
 */
export async function getCommissionHistory(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/wallet/commissions/history?${queryParams}`)
}

// ============================================================================
// BANK ACCOUNT APIs
// ============================================================================

/**
 * Add Bank Account
 * POST /sellers/bank-accounts
 * 
 * @param {Object} accountData - {
 *   accountHolderName: string,
 *   accountNumber: string,
 *   ifscCode: string,
 *   bankName: string,
 *   branchName?: string,
 *   isPrimary?: boolean
 * }
 * @returns {Promise<Object>} - { bankAccount: Object }
 */
export async function addBankAccount(accountData) {
  return apiRequest('/sellers/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(accountData),
  })
}

/**
 * Get Bank Accounts
 * GET /sellers/bank-accounts
 * 
 * @returns {Promise<Object>} - { bankAccounts: Array }
 */
export async function getBankAccounts() {
  return apiRequest('/sellers/bank-accounts')
}

/**
 * Update Bank Account
 * PUT /sellers/bank-accounts/:accountId
 * 
 * @param {string} accountId - Bank account ID
 * @param {Object} accountData - Update data
 * @returns {Promise<Object>} - { bankAccount: Object }
 */
export async function updateBankAccount(accountId, accountData) {
  return apiRequest(`/sellers/bank-accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(accountData),
  })
}

/**
 * Delete Bank Account
 * DELETE /sellers/bank-accounts/:accountId
 * 
 * @param {string} accountId - Bank account ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteBankAccount(accountId) {
  return apiRequest(`/sellers/bank-accounts/${accountId}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// TARGET & PERFORMANCE APIs
// ============================================================================

/**
 * Get Monthly Target
 * GET /sellers/targets/current
 * 
 * @returns {Promise<Object>} - {
 *   monthlyTarget: number,
 *   achieved: number,
 *   progress: number,
 *   status: string,
 *   daysRemaining: number
 * }
 */
export async function getMonthlyTarget() {
  return apiRequest('/sellers/targets/current')
}

/**
 * Get Target History
 * GET /sellers/targets/history
 * 
 * @param {Object} params - { year, month, limit, offset }
 * @returns {Promise<Object>} - { targets: Array, total: number }
 */
export async function getTargetHistory(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/targets/history?${queryParams}`)
}

/**
 * Get Performance Analytics
 * GET /sellers/performance
 * 
 * @param {Object} params - { period: 'daily'|'weekly'|'monthly', startDate, endDate }
 * @returns {Promise<Object>} - Performance metrics and analytics
 */
export async function getPerformanceAnalytics(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/performance?${queryParams}`)
}

/**
 * Get Target Achievement Incentives
 * GET /sellers/targets/incentives
 * 
 * @returns {Promise<Object>} - { incentives: Array, totalEarned: number }
 */
export async function getTargetIncentives() {
  return apiRequest('/sellers/targets/incentives')
}

// ============================================================================
// ANNOUNCEMENTS & NOTIFICATIONS APIs
// ============================================================================

/**
 * Get Announcements
 * GET /sellers/announcements
 * 
 * @param {Object} params - { type, read, limit, offset }
 * @returns {Promise<Object>} - { announcements: Array, total: number }
 */
export async function getAnnouncements(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/announcements?${queryParams}`)
}

/**
 * Mark Announcement as Read
 * PUT /sellers/announcements/:announcementId/read
 * 
 * @param {string} announcementId - Announcement ID
 * @returns {Promise<Object>} - { message: 'Marked as read' }
 */
export async function markAnnouncementRead(announcementId) {
  return apiRequest(`/sellers/announcements/${announcementId}/read`, {
    method: 'PUT',
  })
}

/**
 * Mark All Announcements as Read
 * PUT /sellers/announcements/read-all
 * 
 * @returns {Promise<Object>} - { message: 'All announcements marked as read' }
 */
export async function markAllAnnouncementsRead() {
  return apiRequest('/sellers/announcements/read-all', {
    method: 'PUT',
  })
}

/**
 * Get Notifications
 * GET /sellers/notifications
 * 
 * @param {Object} params - { type, read, limit, offset }
 * @returns {Promise<Object>} - { notifications: Array, unreadCount: number }
 */
export async function getNotifications(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/notifications?${queryParams}`)
}

/**
 * Mark Notification as Read
 * PUT /sellers/notifications/:notificationId/read
 * 
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} - { message: 'Marked as read' }
 */
export async function markNotificationRead(notificationId) {
  return apiRequest(`/sellers/notifications/${notificationId}/read`, {
    method: 'PUT',
  })
}

/**
 * Mark All Notifications as Read
 * PUT /sellers/notifications/read-all
 * 
 * @returns {Promise<Object>} - { message: 'All notifications marked as read' }
 */
export async function markAllNotificationsRead() {
  return apiRequest('/sellers/notifications/read-all', {
    method: 'PUT',
  })
}

// ============================================================================
// SELLER ID SHARING APIs
// ============================================================================

/**
 * Get Seller ID Share Link
 * GET /sellers/share-link
 * 
 * @returns {Promise<Object>} - { sellerId, shareText, shareUrl, qrCode }
 */
export async function getSellerShareLink() {
  return apiRequest('/sellers/share-link')
}

/**
 * Track Share Action
 * POST /sellers/share/track
 * 
 * @param {Object} shareData - { platform: 'whatsapp'|'sms'|'link', recipient }
 * @returns {Promise<Object>} - { message: 'Share tracked' }
 */
export async function trackShareAction(shareData) {
  return apiRequest('/sellers/share/track', {
    method: 'POST',
    body: JSON.stringify(shareData),
  })
}

// ============================================================================
// SUPPORT & HELP APIs
// ============================================================================

/**
 * Report Issue
 * POST /sellers/support/report
 * 
 * @param {Object} reportData - { category, subject, description }
 * @returns {Promise<Object>} - { ticketId, message: 'Issue reported successfully' }
 */
export async function reportIssue(reportData) {
  return apiRequest('/sellers/support/report', {
    method: 'POST',
    body: JSON.stringify(reportData),
  })
}

/**
 * Get Support Tickets
 * GET /sellers/support/tickets
 * 
 * @param {Object} params - { status, limit, offset }
 * @returns {Promise<Object>} - { tickets: Array, total: number }
 */
export async function getSupportTickets(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/sellers/support/tickets?${queryParams}`)
}

/**
 * Get Support Ticket Details
 * GET /sellers/support/tickets/:ticketId
 * 
 * @param {string} ticketId - Support ticket ID
 * @returns {Promise<Object>} - Ticket details with messages
 */
export async function getSupportTicketDetails(ticketId) {
  return apiRequest(`/sellers/support/tickets/${ticketId}`)
}

/**
 * Send Support Message
 * POST /sellers/support/tickets/:ticketId/messages
 * 
 * @param {string} ticketId - Support ticket ID
 * @param {Object} data - { message }
 * @returns {Promise<Object>} - Created message data
 */
export async function sendSupportMessage(ticketId, data) {
  return apiRequest(`/sellers/support/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ============================================================================
// NOTIFICATION PREFERENCES APIs
// ============================================================================

/**
 * Get Notification Preferences
 * GET /sellers/notifications/preferences
 * 
 * @returns {Promise<Object>} - Notification preference settings
 */
export async function getNotificationPreferences() {
  return apiRequest('/sellers/notifications/preferences')
}

/**
 * Update Notification Preferences
 * PUT /sellers/notifications/preferences
 * 
 * @param {Object} preferences - { sms, email, push, announcements, commission, target }
 * @returns {Promise<Object>} - Updated preferences
 */
export async function updateNotificationPreferences(preferences) {
  return apiRequest('/sellers/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  })
}

// ============================================================================
// REAL-TIME UPDATES (WebSocket/SSE)
// ============================================================================

/**
 * Initialize Real-time Connection
 * This would typically use WebSocket or Server-Sent Events
 * For now, this is a placeholder for the implementation
 * 
 * @param {Function} onMessage - Callback for receiving messages
 * @returns {Function} - Cleanup function to close connection
 */
export function initializeRealtimeConnection(onMessage) {
  // This would be implemented with WebSocket or SSE
  // Example:
  // const ws = new WebSocket(`${WS_BASE_URL}/sellers/realtime`)
  // ws.onmessage = (event) => {
  //   const data = JSON.parse(event.data)
  //   onMessage(data)
  // }
  // return () => ws.close()

  // For now, return a no-op cleanup function
  return () => { }
}

/**
 * Handle Real-time Notification
 * Processes incoming real-time notifications (cashback, target achievement, etc.)
 * 
 * @param {Object} notification - Notification data from real-time connection
 */
export function handleRealtimeNotification(notification) {
  // This would process different types of notifications:
  // - 'cashback_added': When cashback is credited
  // - 'target_achieved': When monthly target is reached
  // - 'announcement': When admin posts new announcement
  // - 'withdrawal_approved': When withdrawal request is approved
  // - 'withdrawal_rejected': When withdrawal request is rejected

  return notification
}

