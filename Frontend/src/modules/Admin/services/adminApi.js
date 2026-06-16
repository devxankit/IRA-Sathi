/**
 * Admin API Service
 * 
 * This file contains all API endpoints for the Admin dashboard.
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
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      success: false,
      message: `HTTP error! status: ${response.status}`
    }))
    const errorObj = {
      success: false,
      error: {
        message: error.message || error.error?.message || `HTTP error! status: ${response.status}`,
        status: response.status,
        ...error
      }
    }
    return errorObj
  }
  return response.json()
}

/**
 * API Request Helper
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('admin_token') // Admin authentication token

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    return handleResponse(response)
  } catch (error) {
    // If handleResponse throws, catch it and return error format
    return {
      success: false,
      error: {
        message: error.message || 'An error occurred',
        status: 500,
      }
    }
  }
}

// ============================================================================
// AUTHENTICATION APIs
// ============================================================================

/**
 * Admin Login (Step 1: Phone only)
 * POST /admin/auth/login
 * 
 * @param {Object} credentials - { phone }
 * @returns {Promise<Object>} - { requiresOtp: true, message: 'OTP sent to phone' }
 */
export async function loginAdmin(credentials) {
  return apiRequest('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

/**
 * Request OTP for Admin
 * POST /admin/auth/request-otp
 * 
 * @param {Object} data - { phone }
 * @returns {Promise<Object>} - { message: 'OTP sent successfully', expiresIn: 300 }
 */
export async function requestAdminOTP(data) {
  return apiRequest('/admin/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Verify Admin OTP and Complete Login
 * POST /admin/auth/verify-otp
 * 
 * @param {Object} data - { phone, otp }
 * @returns {Promise<Object>} - { token, admin: { id, name, phone, role } }
 */
export async function verifyAdminOTP(data) {
  return apiRequest('/admin/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Admin Logout
 * POST /admin/auth/logout
 * 
 * @returns {Promise<Object>} - { message: 'Logged out successfully' }
 */
export async function logoutAdmin() {
  return apiRequest('/admin/auth/logout', {
    method: 'POST',
  })
}

/**
 * Get Admin Profile
 * GET /admin/auth/profile
 * 
 * @returns {Promise<Object>} - Admin profile data
 */
export async function getAdminProfile() {
  return apiRequest('/admin/auth/profile')
}

// ============================================================================
// DASHBOARD APIs
// ============================================================================

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Format currency (INR)
 */
function formatCurrency(amount) {
  if (amount >= 10000000) {
    // Crores
    return `₹${(amount / 10000000).toFixed(1)} Cr`
  } else if (amount >= 100000) {
    // Lakhs
    return `₹${(amount / 100000).toFixed(1)} L`
  } else if (amount >= 1000) {
    // Thousands
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${formatNumber(Math.round(amount))}`
}

/**
 * Transform backend dashboard data to frontend format
 */
function transformDashboardData(backendData) {
  const { overview, summary } = backendData

  // Calculate trends (simplified - using placeholder for now since backend doesn't provide historical data)
  const headline = [
    {
      id: 'users',
      title: 'Total Users',
      value: formatNumber(overview.users.total),
      subtitle: `${formatNumber(overview.users.active)} active`,
      trend: {
        direction: 'up',
        value: '+0',
        message: 'No historical data available',
      },
    },
    {
      id: 'vendors',
      title: 'Verified Vendors',
      value: formatNumber(overview.vendors.approved),
      subtitle: `${formatNumber(overview.vendors.pending)} pending approvals`,
      trend: {
        direction: overview.vendors.pending > 0 ? 'warning' : 'up',
        value: overview.vendors.pending > 0 ? `${overview.vendors.pending} pending` : 'All approved',
        message: 'vendor approval status',
      },
    },
    {
      id: 'orders',
      title: 'Orders (User + Vendor)',
      value: formatNumber(overview.orders.total),
      subtitle: `${formatNumber(overview.orders.pending)} pending`,
      trend: {
        direction: overview.orders.pending > 0 ? 'warning' : 'success',
        value: `${formatNumber(overview.orders.delivered)} delivered`,
        message: 'order status overview',
      },
    },
    {
      id: 'revenue',
      title: 'Gross Revenue',
      value: formatCurrency(overview.revenue.total),
      subtitle: `Avg order: ${formatCurrency(overview.revenue.averageOrderValue || 0)}`,
      trend: {
        direction: 'up',
        value: formatCurrency(overview.revenue.last7Days || 0),
        message: 'last 7 days revenue',
      },
    },
  ]

  // Calculate payables
  // Note: Backend provides pendingPaymentAmount (which may include remaining 70% payments)
  // For advance (30%), we estimate based on total revenue pattern
  // TODO: Enhance backend to provide actual advance vs remaining breakdown from orders
  const pendingPaymentsAmount = overview.payments.pendingAmount || 0
  const totalRevenue = overview.revenue.total || 0

  // Estimate: Assuming orders with partial payment, calculate 30% advance from revenue
  // This is an approximation - backend should ideally aggregate from Order.upfrontAmount and Order.remainingAmount
  const estimatedAdvanceAmount = Math.round(totalRevenue * 0.3) // Estimate: 30% of revenue as advance
  const remainingPaymentAmount = pendingPaymentsAmount || 0 // Backend provides this as pending payments (70% remaining)
  const outstandingCredits = overview.credits.outstanding || 0

  const payables = {
    advance: formatCurrency(estimatedAdvanceAmount),
    pending: formatCurrency(remainingPaymentAmount),
    outstanding: formatCurrency(outstandingCredits),
  }

  return {
    headline,
    payables,
  }
}

/**
 * Get Dashboard Overview
 * GET /admin/dashboard
 * 
 * @param {Object} params - { period: 'day' | 'week' | 'month', region?: string }
 * @returns {Promise<Object>} - {
 *   headline: Array<{ id, title, value, subtitle, trend }>,
 *   payables: { advance, pending, outstanding },
 *   recentActivity: Array
 * }
 */
export async function getDashboardData(params = {}) {
  try {
    const queryParams = new URLSearchParams(params).toString()
    const response = await apiRequest(`/admin/dashboard?${queryParams}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: transformDashboardData(response.data),
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

// ============================================================================
// CATEGORY MANAGEMENT APIs
// ============================================================================

/**
 * Get All Categories
 * GET /categories
 * 
 * @returns {Promise<Object>}
 */
export async function getCategories() {
  return apiRequest('/categories')
}

/**
 * Create Category
 * POST /categories
 * 
 * @param {Object} categoryData - { label: string, description?: string }
 * @returns {Promise<Object>}
 */
export async function createCategory(categoryData) {
  return apiRequest('/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData),
  })
}

// ============================================================================
// PRODUCT MANAGEMENT APIs
// ============================================================================

/**
 * Transform backend product to frontend format
 */
function transformProduct(backendProduct) {
  return {
    id: backendProduct._id?.toString() || backendProduct.id,
    name: backendProduct.name,
    description: backendProduct.description,
    category: backendProduct.category,
    stock: backendProduct.stock || 0,
    actualStock: backendProduct.actualStock !== undefined ? backendProduct.actualStock : (backendProduct.stock || 0),
    displayStock: backendProduct.displayStock !== undefined ? backendProduct.displayStock : (backendProduct.stock || 0),
    stockUnit: backendProduct.weight?.unit || backendProduct.stockUnit || 'kg',
    vendorPrice: backendProduct.priceToVendor || 0,
    userPrice: backendProduct.priceToUser || 0,
    expiry: backendProduct.expiry ? new Date(backendProduct.expiry).toISOString().split('T')[0] : null,
    visibility: backendProduct.isActive !== false ? 'active' : 'inactive', // Default to active
    batchNumber: backendProduct.batchNumber || '',
    images: backendProduct.images || [],
    sku: backendProduct.sku,
    brand: backendProduct.brand,
    tags: backendProduct.tags || [],
    specifications: backendProduct.specifications,
    // Keep all original fields for reference
    ...backendProduct,
  }
}

/**
 * Get All Products
 * GET /admin/products
 * 
 * @param {Object} params - { page, limit, category, isActive, search, sortBy, sortOrder, region, status }
 * @returns {Promise<Object>} - { products: Array, total: number, pagination?: Object }
 */
export async function getProducts(params = {}) {
  try {
    // Convert frontend params to backend query params
    const queryParams = new URLSearchParams()

    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.category) queryParams.append('category', params.category)
    if (params.status || params.isActive !== undefined) {
      // Frontend uses 'status' (active/inactive), backend uses 'isActive' (true/false)
      const isActive = params.isActive !== undefined
        ? params.isActive
        : (params.status === 'active' ? true : params.status === 'inactive' ? false : undefined)
      if (isActive !== undefined) queryParams.append('isActive', isActive.toString())
    }
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.offset) {
      // Convert offset to page
      const page = Math.floor((params.offset / (params.limit || 20)) + 1)
      queryParams.append('page', page.toString())
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/products${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const transformedProducts = response.data.products.map(transformProduct)
      return {
        success: true,
        data: {
          products: transformedProducts,
          total: response.data.pagination?.totalItems || response.data.products.length,
          pagination: response.data.pagination, // Keep pagination object for future use
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Product Details
 * GET /admin/products/:productId
 * 
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} - { product: Object, assignments: Array }
 */
export async function getProductDetails(productId) {
  const response = await apiRequest(`/admin/products/${productId}`)

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        product: transformProduct(response.data.product),
        assignments: response.data.assignments || [],
      },
    }
  }

  return response
}

/**
 * Transform frontend product data to backend format
 */
function transformProductForBackend(frontendData) {
  // Handle both naming conventions: vendorPrice/userPrice or priceToVendor/priceToUser
  const vendorPrice = frontendData.priceToVendor ?? frontendData.vendorPrice
  const userPrice = frontendData.priceToUser ?? frontendData.userPrice

  // Parse prices - ensure they are valid numbers
  const parsedVendorPrice = vendorPrice != null && vendorPrice !== '' ? parseFloat(vendorPrice) : null
  const parsedUserPrice = userPrice != null && userPrice !== '' ? parseFloat(userPrice) : null

  const backendData = {
    name: frontendData.name,
    description: frontendData.description || frontendData.longDescription || frontendData.name, // Use name as description if not provided
    shortDescription: frontendData.shortDescription || frontendData.description?.substring(0, 150) || frontendData.name.substring(0, 150),
    category: frontendData.category || 'fertilizer', // Default category
    // Only set isActive if visibility is explicitly provided, otherwise default to true (active)
    isActive: frontendData.visibility !== undefined
      ? (frontendData.visibility === 'active' || frontendData.visibility === 'Active')
      : true, // Default to active
  }

  // Handle stock fields - prioritize actualStock/displayStock over legacy stock
  // Always include actualStock and displayStock if they exist (even if 0)
  if (frontendData.actualStock !== undefined && frontendData.actualStock !== null) {
    const actualStockValue = frontendData.actualStock === '' ? 0 : parseFloat(frontendData.actualStock)
    if (!isNaN(actualStockValue)) {
      backendData.actualStock = actualStockValue
    }
  }
  if (frontendData.displayStock !== undefined && frontendData.displayStock !== null) {
    const displayStockValue = frontendData.displayStock === '' ? 0 : parseFloat(frontendData.displayStock)
    if (!isNaN(displayStockValue)) {
      backendData.displayStock = displayStockValue
      // Also set legacy stock field for backward compatibility
      backendData.stock = displayStockValue
    }
  } else if (frontendData.stock !== undefined && frontendData.stock !== null) {
    // Fallback to legacy stock field
    const stockValue = frontendData.stock === '' ? 0 : parseFloat(frontendData.stock)
    if (!isNaN(stockValue)) {
      backendData.stock = stockValue
      if (backendData.displayStock === undefined) {
        backendData.displayStock = stockValue
      }
      if (backendData.actualStock === undefined) {
        backendData.actualStock = stockValue
      }
    }
  }

  // Only add prices if they are valid positive numbers
  if (parsedVendorPrice != null && !isNaN(parsedVendorPrice) && parsedVendorPrice > 0) {
    backendData.priceToVendor = parsedVendorPrice
  }
  if (parsedUserPrice != null && !isNaN(parsedUserPrice) && parsedUserPrice > 0) {
    backendData.priceToUser = parsedUserPrice
  }

  // Add weight if stockUnit provided
  if (frontendData.stockUnit) {
    backendData.stockUnit = frontendData.stockUnit
    backendData.weight = {
      value: backendData.actualStock || backendData.displayStock || 0,
      unit: frontendData.stockUnit,
    }
  }

  // Add expiry date if provided
  if (frontendData.expiry) {
    backendData.expiry = frontendData.expiry
  }

  // Add batchNumber if provided
  if (frontendData.batchNumber !== undefined && frontendData.batchNumber !== null && frontendData.batchNumber !== '') {
    backendData.batchNumber = frontendData.batchNumber.trim()
  }

  // Add expiry if provided
  if (frontendData.expiry) {
    backendData.expiry = frontendData.expiry
  }

  // Add other optional fields
  if (frontendData.brand) backendData.brand = frontendData.brand
  if (frontendData.sku) backendData.sku = frontendData.sku.toUpperCase()
  // Always include tags array (even if empty) - tags are used for product searchability
  if (frontendData.tags !== undefined) {
    backendData.tags = Array.isArray(frontendData.tags) ? frontendData.tags : []
  }
  if (frontendData.specifications) backendData.specifications = frontendData.specifications
  if (frontendData.images && Array.isArray(frontendData.images)) backendData.images = frontendData.images

  // Add attributeStocks if provided
  if (frontendData.attributeStocks && Array.isArray(frontendData.attributeStocks) && frontendData.attributeStocks.length > 0) {
    backendData.attributeStocks = frontendData.attributeStocks
  }

  return backendData
}

/**
 * Create Product
 * POST /admin/products
 * 
 * @param {Object} productData - {
 *   name: string,
 *   vendorPrice: number,
 *   userPrice: number,
 *   stock: number,
 *   stockUnit: string,
 *   expiry: string,
 *   visibility: 'active' | 'inactive'
 * }
 * @returns {Promise<Object>} - { product: Object, message: string }
 */
export async function createProduct(productData) {
  const backendData = transformProductForBackend(productData)
  const response = await apiRequest('/admin/products', {
    method: 'POST',
    body: JSON.stringify(backendData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.product) {
    return {
      success: true,
      data: {
        product: transformProduct(response.data.product),
        message: response.data.message || 'Product created successfully',
      },
    }
  }

  return response
}

/**
 * Update Product
 * PUT /admin/products/:productId
 * 
 * @param {string} productId - Product ID
 * @param {Object} productData - Product data to update
 * @returns {Promise<Object>} - { product: Object, message: string }
 */
export async function updateProduct(productId, productData) {
  const backendData = transformProductForBackend(productData)
  const response = await apiRequest(`/admin/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(backendData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.product) {
    return {
      success: true,
      data: {
        product: transformProduct(response.data.product),
        message: response.data.message || 'Product updated successfully',
      },
    }
  }

  return response
}

/**
 * Delete Product
 * DELETE /admin/products/:productId
 * 
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteProduct(productId) {
  return apiRequest(`/admin/products/${productId}`, {
    method: 'DELETE',
  })
}

/**
 * Assign Product to Vendor
 * POST /admin/products/:productId/assign
 * 
 * @param {string} productId - Product ID
 * @param {Object} assignmentData - { vendorId: string, region: string, quantity?: number, notes?: string }
 * @returns {Promise<Object>} - { message: string, assignment: Object }
 */
export async function assignProductToVendor(productId, assignmentData) {
  // Backend expects: vendorId, region, notes (quantity is not used yet in backend)
  const backendData = {
    vendorId: assignmentData.vendorId,
    region: assignmentData.region,
    notes: assignmentData.notes || assignmentData.quantity ? `Quantity: ${assignmentData.quantity}` : undefined,
  }

  return apiRequest(`/admin/products/${productId}/assign`, {
    method: 'POST',
    body: JSON.stringify(backendData),
  })
}

/**
 * Toggle Product Visibility
 * PUT /admin/products/:productId/visibility
 * 
 * Note: Backend automatically toggles isActive regardless of request body
 * Frontend sends visibility for reference, but backend will toggle current state
 * 
 * @param {string} productId - Product ID
 * @param {Object} visibilityData - { visibility: 'active' | 'inactive' } (for reference, backend toggles)
 * @returns {Promise<Object>} - { product: Object, message: string }
 */
export async function toggleProductVisibility(productId, visibilityData) {
  // Backend toggles isActive automatically, but we send empty body or visibility for consistency
  const response = await apiRequest(`/admin/products/${productId}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({}), // Backend doesn't use body, but sending empty object for consistency
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.product) {
    return {
      success: true,
      data: {
        product: transformProduct(response.data.product),
        message: response.data.message || 'Product visibility updated successfully',
      },
    }
  }

  return response
}

// ============================================================================
// VENDOR MANAGEMENT APIs
// ============================================================================

/**
 * Transform backend vendor to frontend format
 */
function transformVendor(backendVendor) {
  return {
    id: backendVendor._id?.toString() || backendVendor.id,
    name: backendVendor.name,
    phone: backendVendor.phone,
    email: backendVendor.email,
    region: backendVendor.location?.state || backendVendor.location?.city || 'Unknown',
    location: {
      lat: backendVendor.location?.coordinates?.lat,
      lng: backendVendor.location?.coordinates?.lng,
      address: backendVendor.location?.address,
      city: backendVendor.location?.city,
      state: backendVendor.location?.state,
      pincode: backendVendor.location?.pincode,
    },
    coverageRadius: backendVendor.location?.coverageRadius || 20,
    status: backendVendor.status || 'pending',
    isActive: backendVendor.isActive || false,
    creditLimit: backendVendor.creditPolicy?.limit || backendVendor.creditLimit || 0,
    repaymentDays: backendVendor.creditPolicy?.repaymentDays || 30,
    penaltyRate: backendVendor.creditPolicy?.penaltyRate || 0,
    dues: backendVendor.creditUsed || 0, // Outstanding credit used
    creditUsed: backendVendor.creditUsed || 0,
    approvedAt: backendVendor.approvedAt,
    approvedBy: backendVendor.approvedBy,
    // Keep all original fields for reference
    ...backendVendor,
  }
}

/**
 * Get All Vendors
 * GET /admin/vendors
 * 
 * @param {Object} params - { page, limit, status, isActive, search, sortBy, sortOrder, region, offset }
 * @returns {Promise<Object>} - { vendors: Array, total: number, pagination?: Object }
 */
export async function getVendors(params = {}) {
  try {
    // Convert frontend params to backend query params
    const queryParams = new URLSearchParams()

    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.offset) {
      // Convert offset to page
      const page = Math.floor((params.offset / (params.limit || 20)) + 1)
      queryParams.append('page', page.toString())
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/vendors${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const transformedVendors = response.data.vendors.map(transformVendor)
      return {
        success: true,
        data: {
          vendors: transformedVendors,
          total: response.data.pagination?.totalItems || response.data.vendors.length,
          pagination: response.data.pagination, // Keep pagination object for future use
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Vendor Details
 * GET /admin/vendors/:vendorId
 * 
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<Object>} - { vendor: Object, creditInfo: Object, purchases: Array, assignments: Array }
 */
export async function getVendorDetails(vendorId) {
  const response = await apiRequest(`/admin/vendors/${vendorId}`)

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        vendor: transformVendor(response.data.vendor),
        creditInfo: response.data.creditInfo || {},
        purchases: response.data.purchases || [],
        assignments: response.data.assignments || [],
      },
    }
  }

  return response
}

/**
 * Approve Vendor Application
 * POST /admin/vendors/:vendorId/approve
 * 
 * Note: Backend automatically approves vendor and performs 20km radius check
 * If credit policy needs to be set, use updateVendorCreditPolicy after approval
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} approvalData - { creditLimit, repaymentDays, penaltyRate } (optional, can set via credit-policy endpoint)
 * @returns {Promise<Object>} - { vendor: Object, message: string }
 */
export async function approveVendor(vendorId, approvalData) {
  const response = await apiRequest(`/admin/vendors/${vendorId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}), // Backend doesn't use body for approval
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.vendor) {
    // If credit policy data is provided, update it after approval
    if (approvalData && (approvalData.creditLimit || approvalData.repaymentDays || approvalData.penaltyRate)) {
      try {
        await updateVendorCreditPolicy(vendorId, {
          limit: approvalData.creditLimit,
          repaymentDays: approvalData.repaymentDays,
          penaltyRate: approvalData.penaltyRate,
        })
      } catch (error) {
        console.warn('Failed to set credit policy after approval:', error)
        // Continue with approval response even if credit policy update fails
      }
    }

    return {
      success: true,
      data: {
        vendor: transformVendor(response.data.vendor),
        message: response.data.message || 'Vendor approved successfully',
      },
    }
  }

  return response
}

/**
 * Reject Vendor Application
 * POST /admin/vendors/:vendorId/reject
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} rejectionData - { reason?: string }
 * @returns {Promise<Object>} - { vendor: Object, message: string }
 */
export async function rejectVendor(vendorId, rejectionData) {
  const response = await apiRequest(`/admin/vendors/${vendorId}/reject`, {
    method: 'POST',
    body: JSON.stringify(rejectionData || {}),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.vendor) {
    return {
      success: true,
      data: {
        vendor: transformVendor(response.data.vendor),
        message: response.data.message || 'Vendor application rejected',
      },
    }
  }

  return response
}

/**
 * Update Vendor Credit Policy
 * PUT /admin/vendors/:vendorId/credit-policy
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} policyData - { limit: number, repaymentDays: number, penaltyRate: number }
 * @returns {Promise<Object>} - { vendor: Object, message: string }
 */
export async function updateVendorCreditPolicy(vendorId, policyData) {
  // Backend expects: limit, repaymentDays, penaltyRate
  const backendData = {
    limit: policyData.limit || policyData.creditLimit,
    repaymentDays: policyData.repaymentDays,
    penaltyRate: policyData.penaltyRate,
  }

  const response = await apiRequest(`/admin/vendors/${vendorId}/credit-policy`, {
    method: 'PUT',
    body: JSON.stringify(backendData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.vendor) {
    return {
      success: true,
      data: {
        vendor: transformVendor(response.data.vendor),
        message: response.data.message || 'Credit policy updated successfully',
      },
    }
  }

  return response
}

/**
 * Update Vendor Basic Information
 * PUT /admin/vendors/:vendorId
 * 
 * This endpoint updates vendor information in the database.
 * Backend should persist: name, phone, email, and location (address, city, state, pincode, coordinates).
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} vendorData - { name?: string, phone?: string, email?: string, location?: Object }
 * @param {Object} vendorData.location - { address: string, city: string, state: string, pincode: string, lat?: number, lng?: number }
 * @returns {Promise<Object>} - { vendor: Object, message: string }
 * @note This function sends a PUT request that updates the vendor record in the database
 */
export async function updateVendor(vendorId, vendorData) {
  // Allow updating name, phone, email, and location
  const backendData = {}
  if (vendorData.name) backendData.name = vendorData.name
  if (vendorData.phone) backendData.phone = vendorData.phone
  if (vendorData.email) backendData.email = vendorData.email

  // Handle location update
  if (vendorData.location) {
    backendData.location = {
      address: vendorData.location.address,
      city: vendorData.location.city,
      state: vendorData.location.state,
      pincode: vendorData.location.pincode,
    }

    // Add coordinates if provided
    if (vendorData.location.lat && vendorData.location.lng) {
      backendData.location.coordinates = {
        lat: parseFloat(vendorData.location.lat),
        lng: parseFloat(vendorData.location.lng),
      }
    }
  }

  const response = await apiRequest(`/admin/vendors/${vendorId}`, {
    method: 'PUT',
    body: JSON.stringify(backendData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.vendor) {
    return {
      success: true,
      data: {
        vendor: transformVendor(response.data.vendor),
        message: response.data.message || 'Vendor updated successfully',
      },
    }
  }

  return response
}

/**
 * Ban Vendor (temporary or permanent)
 * PUT /admin/vendors/:vendorId/ban
 * 
 * Note: Requires vendor to have >3 escalations
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} banData - { banType: 'temporary' | 'permanent', reason?: string, banDurationDays?: number }
 * @returns {Promise<Object>} - { vendor: Object, message: string, escalationCount: number }
 */
export async function banVendor(vendorId, banData) {
  const response = await apiRequest(`/admin/vendors/${vendorId}/ban`, {
    method: 'PUT',
    body: JSON.stringify({
      banType: banData.banType || 'temporary',
      reason: banData.reason,
      banDurationDays: banData.banDurationDays,
    }),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        vendor: response.data.vendor ? transformVendor(response.data.vendor) : undefined,
        escalationCount: response.data.escalationCount || 0,
        message: response.data.message || 'Vendor banned successfully',
      },
    }
  }

  return response
}

/**
 * Unban Vendor (revoke temporary ban)
 * PUT /admin/vendors/:vendorId/unban
 * 
 * Note: Only works for temporary bans. Permanent bans require delete operation.
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} unbanData - { reason?: string }
 * @returns {Promise<Object>} - { vendor: Object, message: string }
 */
export async function unbanVendor(vendorId, unbanData = {}) {
  const response = await apiRequest(`/admin/vendors/${vendorId}/unban`, {
    method: 'PUT',
    body: JSON.stringify({
      reason: unbanData.reason,
    }),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        vendor: response.data.vendor ? transformVendor(response.data.vendor) : undefined,
        message: response.data.message || 'Temporary ban revoked successfully',
      },
    }
  }

  return response
}

/**
 * Delete Vendor (permanent ban with soft delete)
 * DELETE /admin/vendors/:vendorId
 * 
 * Note: Requires vendor to have >3 escalations. Soft delete - activities persist for viewing.
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} deleteData - { reason?: string }
 * @returns {Promise<Object>} - { vendor: Object, message: string, escalationCount: number }
 */
export async function deleteVendor(vendorId, deleteData = {}) {
  const response = await apiRequest(`/admin/vendors/${vendorId}`, {
    method: 'DELETE',
    body: JSON.stringify({
      reason: deleteData.reason,
    }),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        vendor: response.data.vendor ? transformVendor(response.data.vendor) : undefined,
        escalationCount: response.data.escalationCount || 0,
        message: response.data.message || 'Vendor permanently deleted. Activities preserved for historical viewing.',
      },
    }
  }

  return response
}

/**
 * Transform backend purchase request to frontend format
 */
function transformPurchaseRequest(backendPurchase) {
  // Handle populated vendorId (object) or vendorId (string)
  const vendorName = typeof backendPurchase.vendorId === 'object'
    ? backendPurchase.vendorId?.name
    : backendPurchase.vendor?.name || backendPurchase.vendorName || ''

  const vendorId = typeof backendPurchase.vendorId === 'object'
    ? backendPurchase.vendorId?._id?.toString() || backendPurchase.vendorId?.id
    : backendPurchase.vendorId?.toString() || backendPurchase.vendorId

  return {
    id: backendPurchase._id?.toString() || backendPurchase.id,
    requestId: backendPurchase._id?.toString() || backendPurchase.id,
    vendorId: vendorId,
    vendor: vendorName,
    vendorName: vendorName,
    amount: backendPurchase.totalAmount || 0,
    value: backendPurchase.totalAmount || 0,
    date: backendPurchase.createdAt ? new Date(backendPurchase.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: backendPurchase.status || 'pending',
    description: backendPurchase.notes || '',
    products: backendPurchase.items?.map(item => {
      // Handle populated productId (object) or productId (string)
      const productName = typeof item.productId === 'object'
        ? item.productId?.name
        : item.productName || 'Unknown Product'

      // Handle attributeCombination (variants)
      let attributeCombination = null
      if (item.attributeCombination) {
        // Convert Map to object if needed
        if (item.attributeCombination instanceof Map) {
          attributeCombination = Object.fromEntries(item.attributeCombination)
        } else if (typeof item.attributeCombination === 'object') {
          attributeCombination = item.attributeCombination
        }
      }

      return {
        name: productName,
        quantity: item.quantity || 0,
        price: item.unitPrice || item.pricePerUnit || 0,
        unit: item.unit || 'kg',
        attributeCombination: attributeCombination,
      }
    }) || [],
    documents: [], // Backend doesn't store documents yet
    vendorPerformance: {
      creditUsed: typeof backendPurchase.vendorId === 'object' ? backendPurchase.vendorId?.creditUsed || 0 : 0,
      creditLimit: typeof backendPurchase.vendorId === 'object' ? backendPurchase.vendorId?.creditLimit || 0 : 0,
      creditUtilization: (typeof backendPurchase.vendorId === 'object' && backendPurchase.vendorId?.creditLimit > 0)
        ? (backendPurchase.vendorId.creditUsed / backendPurchase.vendorId.creditLimit) * 100
        : 0,
      hasOutstandingDues: backendPurchase.hasOutstandingDues || false,
      outstandingAmount: backendPurchase.outstandingDuesAmount || 0,
    },
    // Keep all original fields for reference
    ...backendPurchase,
  }
}

/**
 * Approve Vendor Purchase Request
 * POST /admin/vendors/purchases/:requestId/approve
 * 
 * @param {string} requestId - Purchase request ID
 * @param {string} shortDescription - Short description for approval (optional)
 * @returns {Promise<Object>} - { message: string, purchase: Object, vendor: Object }
 */
export async function approveVendorPurchase(requestId, shortDescription = '') {
  const trimmedDesc = shortDescription ? shortDescription.trim() : ''
  if (!trimmedDesc) {
    return {
      success: false,
      error: {
        message: 'Short description is required',
        status: 400,
      }
    }
  }

  const requestBody = { shortDescription: trimmedDesc }
  const bodyString = JSON.stringify(requestBody)
  console.log('Sending approve request:', {
    requestId,
    shortDescription: trimmedDesc,
    body: requestBody,
    stringified: bodyString,
    bodyLength: bodyString.length
  })

  const response = await apiRequest(`/admin/vendors/purchases/${requestId}/approve`, {
    method: 'POST',
    body: bodyString,
  })

  console.log('Approve response received:', response)
  console.log('Response success:', response.success)
  console.log('Response error:', response.error)
  console.log('Response message:', response.message)

  // Check for error response
  if (!response.success) {
    return {
      success: false,
      error: {
        message: response.error?.message || response.message || 'Failed to approve purchase request',
        status: response.error?.status || 400,
      }
    }
  }

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        purchase: transformPurchaseRequest(response.data.purchase),
        vendor: response.data.vendor ? transformVendor(response.data.vendor) : undefined,
        message: response.data.message || 'Purchase request approved successfully',
      },
    }
  }

  return response
}

/**
 * Reject Vendor Purchase Request
 * POST /admin/vendors/purchases/:requestId/reject
 * 
 * @param {string} requestId - Purchase request ID
 * @param {Object} rejectionData - { reason?: string }
 * @returns {Promise<Object>} - { message: string, purchase: Object }
 */
export async function rejectVendorPurchase(requestId, rejectionData) {
  const response = await apiRequest(`/admin/vendors/purchases/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(rejectionData || {}),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        purchase: response.data.purchase ? transformPurchaseRequest(response.data.purchase) : undefined,
        message: response.data.message || 'Purchase request rejected',
      },
    }
  }

  return response
}

/**
 * Send Stock for Vendor Purchase
 * POST /admin/vendors/purchases/:requestId/send
 * 
 * @param {string} requestId - Purchase request ID
 * @param {Object} deliveryData - { deliveryNotes?: string }
 * @returns {Promise<Object>} - { message: string, purchase: Object }
 */
export async function sendVendorPurchaseStock(requestId, deliveryData) {
  const response = await apiRequest(`/admin/vendors/purchases/${requestId}/send`, {
    method: 'POST',
    body: JSON.stringify(deliveryData || {}),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        purchase: response.data.purchase ? transformPurchaseRequest(response.data.purchase) : undefined,
        message: response.data.message || 'Stock marked as sent',
      },
    }
  }

  return response
}

/**
 * Confirm Delivery for Vendor Purchase
 * POST /admin/vendors/purchases/:requestId/confirm-delivery
 * 
 * @param {string} requestId - Purchase request ID
 * @param {Object} deliveryData - { deliveryNotes?: string }
 * @returns {Promise<Object>} - { message: string, purchase: Object }
 */
export async function confirmVendorPurchaseDelivery(requestId, deliveryData) {
  const response = await apiRequest(`/admin/vendors/purchases/${requestId}/confirm-delivery`, {
    method: 'POST',
    body: JSON.stringify(deliveryData || {}),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        purchase: response.data.purchase ? transformPurchaseRequest(response.data.purchase) : undefined,
        message: response.data.message || 'Delivery confirmed and inventory updated',
      },
    }
  }

  return response
}

/**
 * Get Vendor Purchase Requests
 * GET /admin/vendors/purchases (global) or GET /admin/vendors/:vendorId/purchases (vendor-specific)
 * 
 * @param {Object} params - { 
 *   status?: 'pending' | 'approved' | 'rejected', 
 *   vendorId?: string, 
 *   page?: number, 
 *   limit?: number,
 *   search?: string,
 *   sortBy?: string,
 *   sortOrder?: 'asc' | 'desc'
 * }
 * @returns {Promise<Object>} - { purchases: Array, total: number, pagination?: Object }
 */
export async function getVendorPurchaseRequests(params = {}) {
  try {
    const queryParams = new URLSearchParams()

    if (params.status) queryParams.append('status', params.status)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.vendorId) queryParams.append('vendorId', params.vendorId)

    const queryString = queryParams.toString()

    // Use global endpoint (supports vendorId as query param for filtering)
    // Backend endpoint: GET /admin/vendors/purchases
    const endpoint = `/admin/vendors/purchases${queryString ? `?${queryString}` : ''}`
    const response = await apiRequest(endpoint)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          purchases: response.data.purchases.map(transformPurchaseRequest),
          total: response.data.pagination?.totalItems || response.data.purchases.length,
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

// ============================================================================
// SELLER MANAGEMENT APIs
// ============================================================================

/**
 * Transform backend seller to frontend format
 */
function transformSeller(backendSeller) {
  // Calculate progress (this would ideally come from backend based on actual sales)
  const monthlyTarget = backendSeller.monthlyTarget || 0
  // Note: Backend doesn't currently provide achieved/progress - would need to calculate from orders
  // For now, we'll use wallet balance as a proxy or calculate from commissions
  const achieved = 0 // TODO: Calculate from actual sales/commissions
  const progress = monthlyTarget > 0 ? (achieved / monthlyTarget) * 100 : 0

  return {
    id: backendSeller._id?.toString() || backendSeller.id,
    sellerId: backendSeller.sellerId || backendSeller.id,
    name: backendSeller.name,
    phone: backendSeller.phone,
    email: backendSeller.email,
    area: backendSeller.area,
    monthlyTarget: monthlyTarget,
    achieved: achieved,
    progress: Math.round(progress * 100) / 100,
    referrals: 0, // TODO: Count from User.sellerId references
    totalSales: achieved, // Same as achieved for now
    status: backendSeller.status || 'pending',
    isActive: backendSeller.isActive || false,
    cashbackRate: 0, // Backend doesn't have this - might need commissionRates.low as proxy
    commissionRate: backendSeller.commissionRates?.low || 2, // Default 2%
    walletBalance: backendSeller.wallet?.balance || 0,
    walletPending: backendSeller.wallet?.pending || 0,
    // Keep all original fields for reference
    ...backendSeller,
  }
}

/**
 * Transform backend withdrawal request to frontend format
 */
function transformWithdrawalRequest(backendWithdrawal) {
  // Extract bank details from bankAccountId if populated, otherwise use paymentDetails
  const bankDetails = backendWithdrawal.bankAccountId
    ? {
      accountHolderName: backendWithdrawal.bankAccountId.accountHolderName || '',
      accountNumber: backendWithdrawal.bankAccountId.accountNumber || '',
      ifscCode: backendWithdrawal.bankAccountId.ifscCode || '',
      bankName: backendWithdrawal.bankAccountId.bankName || '',
    }
    : backendWithdrawal.paymentDetails || {}

  // Extract seller name from populated sellerId or direct field
  const sellerName = backendWithdrawal.sellerId?.name ||
    backendWithdrawal.sellerId?.sellerId ||
    backendWithdrawal.seller?.name ||
    backendWithdrawal.sellerName ||
    ''

  return {
    id: backendWithdrawal._id?.toString() || backendWithdrawal.id,
    requestId: backendWithdrawal._id?.toString() || backendWithdrawal.id,
    sellerId: backendWithdrawal.sellerId?._id?.toString() || backendWithdrawal.sellerId?.toString() || backendWithdrawal.sellerId,
    seller: sellerName,
    sellerName: sellerName,
    amount: backendWithdrawal.amount || 0,
    date: backendWithdrawal.createdAt ? new Date(backendWithdrawal.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    createdAt: backendWithdrawal.createdAt,
    status: backendWithdrawal.status || 'pending',
    reason: backendWithdrawal.reason || backendWithdrawal.rejectionReason || '',
    bankDetails: bankDetails,
    sellerPerformance: {
      totalSales: 0, // TODO: Calculate from commissions
      pendingEarnings: backendWithdrawal.sellerId?.wallet?.balance || 0,
      targetAchievement: 0, // TODO: Calculate
    },
    // Keep all original fields for reference
    ...backendWithdrawal,
  }
}

/**
 * Get All Sellers
 * GET /admin/sellers
 * 
 * @param {Object} params - { page, limit, status, isActive, search, sortBy, sortOrder, offset }
 * @returns {Promise<Object>} - { sellers: Array, total: number, pagination?: Object }
 */
export async function getSellers(params = {}) {
  try {
    // Convert frontend params to backend query params
    const queryParams = new URLSearchParams()

    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.offset) {
      // Convert offset to page
      const page = Math.floor((params.offset / (params.limit || 20)) + 1)
      queryParams.append('page', page.toString())
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/sellers${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const transformedSellers = response.data.sellers.map(transformSeller)
      return {
        success: true,
        data: {
          sellers: transformedSellers,
          total: response.data.pagination?.totalItems || response.data.sellers.length,
          pagination: response.data.pagination, // Keep pagination object for future use
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Seller Details
 * GET /admin/sellers/:sellerId
 * 
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Object>} - { seller: Object, wallet: Object, withdrawals: Array }
 */
export async function getSellerDetails(sellerId) {
  const response = await apiRequest(`/admin/sellers/${sellerId}`)

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        seller: transformSeller(response.data.seller),
        wallet: response.data.wallet || {},
        withdrawals: response.data.withdrawals || [],
      },
    }
  }

  return response
}

/**
 * Transform frontend seller data to backend format
 */
function transformSellerForBackend(frontendData) {
  const backendData = {
    name: frontendData.name,
    phone: frontendData.phone,
    email: frontendData.email,
  }

  // Optional fields - only include if provided
  if (frontendData.area !== undefined) backendData.area = frontendData.area
  if (frontendData.monthlyTarget !== undefined) {
    backendData.monthlyTarget = parseFloat(frontendData.monthlyTarget) || 0
  }
  if (frontendData.location) backendData.location = frontendData.location
  if (frontendData.assignedVendor) backendData.assignedVendor = frontendData.assignedVendor
  if (frontendData.sellerId) backendData.sellerId = frontendData.sellerId.toUpperCase()

  // Note: Backend doesn't support cashbackRate/commissionRate directly
  // These are managed via commissionRates (low/high/threshold) in Seller model
  // Frontend might send these but they won't be set unless we add them to backend

  return backendData
}

/**
 * Create Seller
 * POST /admin/sellers
 * 
 * @param {Object} sellerData - {
 *   name: string,
 *   phone: string,
 *   email?: string,
 *   area?: string,
 *   monthlyTarget?: number,
 *   sellerId?: string,
 *   location?: Object,
 *   assignedVendor?: string
 * }
 * @returns {Promise<Object>} - { seller: Object, message: string }
 */
export async function createSeller(sellerData) {
  const backendData = transformSellerForBackend(sellerData)
  const response = await apiRequest('/admin/sellers', {
    method: 'POST',
    body: JSON.stringify(backendData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.seller) {
    return {
      success: true,
      data: {
        seller: transformSeller(response.data.seller),
        message: response.data.message || 'Seller created successfully',
      },
    }
  }

  return response
}

/**
 * Update Seller
 * PUT /admin/sellers/:sellerId
 * 
 * This endpoint updates seller information in the database.
 * Backend should persist: name, phone, email, and other seller fields.
 * 
 * @param {string} sellerId - Seller ID
 * @param {Object} sellerData - Seller data to update (name, phone, email, etc.)
 * @returns {Promise<Object>} - { seller: Object, message: string }
 * @note This function sends a PUT request that updates the seller record in the database
 */
export async function updateSeller(sellerId, sellerData) {
  const backendData = transformSellerForBackend(sellerData)
  const response = await apiRequest(`/admin/sellers/${sellerId}`, {
    method: 'PUT',
    body: JSON.stringify(backendData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.seller) {
    return {
      success: true,
      data: {
        seller: transformSeller(response.data.seller),
        message: response.data.message || 'Seller updated successfully',
      },
    }
  }

  return response
}

/**
 * Approve Seller Registration
 * POST /admin/sellers/:sellerId/approve
 * 
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Object>} - { seller: Object, message: string }
 */
export async function approveSeller(sellerId) {
  const response = await apiRequest(`/admin/sellers/${sellerId}/approve`, {
    method: 'POST',
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.seller) {
    return {
      success: true,
      data: {
        seller: transformSeller(response.data.seller),
        message: response.data.message || 'Seller approved successfully',
      },
    }
  }

  return response
}

/**
 * Reject Seller Registration
 * POST /admin/sellers/:sellerId/reject
 * 
 * @param {string} sellerId - Seller ID
 * @param {Object} rejectionData - { reason?: string }
 * @returns {Promise<Object>} - { seller: Object, message: string }
 */
export async function rejectSeller(sellerId, rejectionData = {}) {
  const response = await apiRequest(`/admin/sellers/${sellerId}/reject`, {
    method: 'POST',
    body: JSON.stringify(rejectionData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data?.seller) {
    return {
      success: true,
      data: {
        seller: transformSeller(response.data.seller),
        message: response.data.message || 'Seller rejected successfully',
      },
    }
  }

  return response
}

/**
 * Delete Seller
 * DELETE /admin/sellers/:sellerId
 * 
 * Note: Backend doesn't have a delete endpoint currently
 * This would need to be implemented or we can deactivate the seller instead
 * 
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteSeller(sellerId) {
  // For now, deactivate instead of delete (if backend supports it)
  // Or return an error if deletion is not supported
  return {
    success: false,
    message: 'Delete seller endpoint not yet implemented. Please deactivate the seller instead.',
  }
}

/**
 * Create Payment Intent for Seller Withdrawal
 * POST /admin/sellers/withdrawals/:requestId/payment-intent
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} data - { amount?: number }
 * @returns {Promise<Object>} - { paymentIntent: Object }
 */
export async function createSellerWithdrawalPaymentIntent(requestId, data = {}) {
  const response = await apiRequest(`/admin/sellers/withdrawals/${requestId}/payment-intent`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  return response
}

/**
 * Approve Seller Withdrawal
 * POST /admin/sellers/withdrawals/:requestId/approve
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} data - { paymentReference?, paymentMethod?, paymentDate?, adminRemarks?, gatewayPaymentId?, gatewayOrderId?, gatewaySignature? }
 * @returns {Promise<Object>} - { message: string, withdrawal: Object, seller: Object }
 */
export async function approveSellerWithdrawal(requestId, data = {}) {
  const response = await apiRequest(`/admin/sellers/withdrawals/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        withdrawal: response.data.withdrawal ? transformWithdrawalRequest(response.data.withdrawal) : undefined,
        seller: response.data.seller ? transformSeller(response.data.seller) : undefined,
        message: response.data.message || 'Withdrawal approved successfully',
      },
    }
  }

  return response
}

/**
 * Reject Seller Withdrawal
 * POST /admin/sellers/withdrawals/:requestId/reject
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} rejectionData - { reason?: string }
 * @returns {Promise<Object>} - { message: string, withdrawal: Object }
 */
export async function rejectSellerWithdrawal(requestId, rejectionData) {
  const response = await apiRequest(`/admin/sellers/withdrawals/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(rejectionData || {}),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        withdrawal: response.data.withdrawal ? transformWithdrawalRequest(response.data.withdrawal) : undefined,
        message: response.data.message || 'Withdrawal request rejected',
      },
    }
  }

  return response
}

/**
 * Transform backend vendor withdrawal request to frontend format
 */
function transformVendorWithdrawalRequest(backendWithdrawal) {
  return {
    id: backendWithdrawal._id?.toString() || backendWithdrawal.id,
    requestId: backendWithdrawal._id?.toString() || backendWithdrawal.id,
    vendorId: backendWithdrawal.vendorId?.toString() || backendWithdrawal.vendorId,
    vendor: backendWithdrawal.vendorId?.name || backendWithdrawal.vendor?.name || backendWithdrawal.vendorName || '',
    vendorName: backendWithdrawal.vendorId?.name || backendWithdrawal.vendor?.name || backendWithdrawal.vendorName || '',
    amount: backendWithdrawal.amount || 0,
    date: backendWithdrawal.createdAt ? new Date(backendWithdrawal.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: backendWithdrawal.status || 'pending',
    reason: backendWithdrawal.rejectionReason || backendWithdrawal.reason || '',
    bankDetails: backendWithdrawal.paymentDetails || backendWithdrawal.bankAccountId || {},
    userType: 'vendor',
    ...backendWithdrawal,
  }
}

/**
 * Get Vendor Withdrawal Requests
 * GET /admin/vendors/withdrawals
 * 
 * @param {Object} params - { 
 *   status?: 'pending' | 'approved' | 'rejected' | 'completed', 
 *   vendorId?: string, 
 *   page?: number, 
 *   limit?: number,
 *   search?: string,
 *   sortBy?: string,
 *   sortOrder?: 'asc' | 'desc'
 * }
 * @returns {Promise<Object>} - { withdrawals: Array, total: number, pagination?: Object }
 */
export async function getVendorWithdrawalRequests(params = {}) {
  try {
    const queryParams = new URLSearchParams()

    if (params.status) queryParams.append('status', params.status)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.vendorId) queryParams.append('vendorId', params.vendorId)

    const queryString = queryParams.toString()
    const endpoint = `/admin/vendors/withdrawals${queryString ? `?${queryString}` : ''}`
    const response = await apiRequest(endpoint)

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          withdrawals: response.data.withdrawals?.map(transformVendorWithdrawalRequest) || [],
          total: response.data.pagination?.totalItems || response.data.withdrawals?.length || 0,
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Approve Vendor Withdrawal
 * POST /admin/vendors/withdrawals/:requestId/approve
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} data - Optional approval data (notes, etc.)
 * @returns {Promise<Object>} - { message: string, withdrawal: Object, vendor: Object }
 */
export async function approveVendorWithdrawal(requestId, data = {}) {
  const response = await apiRequest(`/admin/vendors/withdrawals/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (response.success && response.data) {
    return {
      success: true,
      data: {
        withdrawal: response.data.withdrawal ? transformVendorWithdrawalRequest(response.data.withdrawal) : undefined,
        vendor: response.data.vendor,
        message: response.data.message || 'Withdrawal approved successfully',
      },
    }
  }

  return response
}

/**
 * Create Payment Intent for Vendor Withdrawal
 * POST /admin/vendors/withdrawals/:requestId/payment-intent
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} data - { amount: number }
 * @returns {Promise<Object>} - { paymentIntent: Object }
 */
export async function createVendorWithdrawalPaymentIntent(requestId, data = {}) {
  const response = await apiRequest(`/admin/vendors/withdrawals/${requestId}/payment-intent`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (response.success && response.data) {
    return {
      success: true,
      data: {
        paymentIntent: response.data.paymentIntent,
      },
    }
  }

  return response
}

/**
 * Reject Vendor Withdrawal
 * POST /admin/vendors/withdrawals/:requestId/reject
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} rejectionData - { reason: string, notes?: string }
 * @returns {Promise<Object>} - { message: string, withdrawal: Object }
 */
export async function rejectVendorWithdrawal(requestId, rejectionData) {
  const response = await apiRequest(`/admin/vendors/withdrawals/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(rejectionData),
  })

  if (response.success && response.data) {
    return {
      success: true,
      data: {
        withdrawal: response.data.withdrawal ? transformVendorWithdrawalRequest(response.data.withdrawal) : undefined,
        message: response.data.message || 'Withdrawal request rejected',
      },
    }
  }

  return response
}

/**
 * Complete Vendor Withdrawal
 * PUT /admin/vendors/withdrawals/:requestId/complete
 * 
 * @param {string} requestId - Withdrawal request ID
 * @param {Object} completionData - { paymentReference: string, paymentDate: Date, notes?: string }
 * @returns {Promise<Object>} - { message: string, withdrawal: Object }
 */
export async function completeVendorWithdrawal(requestId, completionData) {
  const response = await apiRequest(`/admin/vendors/withdrawals/${requestId}/complete`, {
    method: 'PUT',
    body: JSON.stringify(completionData),
  })

  if (response.success && response.data) {
    return {
      success: true,
      data: {
        withdrawal: response.data.withdrawal ? transformVendorWithdrawalRequest(response.data.withdrawal) : undefined,
        message: response.data.message || 'Withdrawal marked as completed',
      },
    }
  }

  return response
}

/**
 * Get Seller Withdrawal Requests
 * GET /admin/sellers/withdrawals (global) or GET /admin/sellers/:sellerId/withdrawals (seller-specific)
 * 
 * @param {Object} params - { 
 *   status?: 'pending' | 'approved' | 'rejected', 
 *   sellerId?: string, 
 *   page?: number, 
 *   limit?: number,
 *   search?: string,
 *   sortBy?: string,
 *   sortOrder?: 'asc' | 'desc'
 * }
 * @returns {Promise<Object>} - { withdrawals: Array, total: number, pagination?: Object }
 */
export async function getSellerWithdrawalRequests(params = {}) {
  try {
    const queryParams = new URLSearchParams()

    if (params.status) queryParams.append('status', params.status)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.sellerId) queryParams.append('sellerId', params.sellerId)

    const queryString = queryParams.toString()

    // Use global endpoint (supports sellerId as query param for filtering)
    // Backend endpoint: GET /admin/sellers/withdrawals
    const endpoint = `/admin/sellers/withdrawals${queryString ? `?${queryString}` : ''}`
    const response = await apiRequest(endpoint)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          withdrawals: response.data.withdrawals.map(transformWithdrawalRequest),
          total: response.data.pagination?.totalItems || response.data.withdrawals.length,
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Seller Change Requests
 * GET /admin/sellers/change-requests
 * 
 * @param {Object} params - { status, changeType, page, limit }
 * @returns {Promise<Object>} - { changeRequests: Array, pagination: Object }
 */
export async function getSellerChangeRequests(params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append('status', params.status)
    if (params.changeType) queryParams.append('changeType', params.changeType)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/sellers/change-requests${queryString ? `?${queryString}` : ''}`)

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Seller Change Request Details
 * GET /admin/sellers/change-requests/:requestId
 * 
 * @param {string} requestId - Change request ID
 * @returns {Promise<Object>} - { changeRequest: Object }
 */
export async function getSellerChangeRequestDetails(requestId) {
  return apiRequest(`/admin/sellers/change-requests/${requestId}`)
}

/**
 * Approve Seller Change Request
 * POST /admin/sellers/change-requests/:requestId/approve
 * 
 * @param {string} requestId - Change request ID
 * @returns {Promise<Object>} - { changeRequest: Object, seller: Object, message: string }
 */
export async function approveSellerChangeRequest(requestId) {
  const response = await apiRequest(`/admin/sellers/change-requests/${requestId}/approve`, {
    method: 'POST',
  })

  return response
}

/**
 * Reject Seller Change Request
 * POST /admin/sellers/change-requests/:requestId/reject
 * 
 * @param {string} requestId - Change request ID
 * @param {Object} rejectionData - { reason?: string }
 * @returns {Promise<Object>} - { changeRequest: Object, message: string }
 */
export async function rejectSellerChangeRequest(requestId, rejectionData = {}) {
  const response = await apiRequest(`/admin/sellers/change-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(rejectionData || {}),
  })

  return response
}

// ============================================================================
// PAYMENT HISTORY APIs
// ============================================================================

/**
 * Get Payment History
 * GET /admin/payment-history
 * 
 * @param {Object} params - {
 *   activityType?: string,
 *   userId?: string,
 *   vendorId?: string,
 *   sellerId?: string,
 *   orderId?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   status?: string,
 *   page?: number,
 *   limit?: number,
 *   search?: string
 * }
 * @returns {Promise<Object>} - { history: Array, pagination: Object, summary: Array }
 */
export async function getPaymentHistory(params = {}) {
  try {
    const queryParams = new URLSearchParams()

    if (params.activityType) queryParams.append('activityType', params.activityType)
    if (params.userId) queryParams.append('userId', params.userId)
    if (params.vendorId) queryParams.append('vendorId', params.vendorId)
    if (params.sellerId) queryParams.append('sellerId', params.sellerId)
    if (params.orderId) queryParams.append('orderId', params.orderId)
    if (params.startDate) queryParams.append('startDate', params.startDate)
    if (params.endDate) queryParams.append('endDate', params.endDate)
    if (params.status) queryParams.append('status', params.status)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.search) queryParams.append('search', params.search)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/payment-history${queryString ? `?${queryString}` : ''}`)

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Payment History Statistics
 * GET /admin/payment-history/stats
 * 
 * @param {Object} params - { startDate?: string, endDate?: string }
 * @returns {Promise<Object>} - {
 *   totalUserPayments: number,
 *   totalVendorEarnings: number,
 *   totalSellerCommissions: number,
 *   totalVendorWithdrawals: number,
 *   totalSellerWithdrawals: number,
 *   totalActivities: number
 * }
 */
export async function getPaymentHistoryStats(params = {}) {
  try {
    const queryParams = new URLSearchParams()

    if (params.startDate) queryParams.append('startDate', params.startDate)
    if (params.endDate) queryParams.append('endDate', params.endDate)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/payment-history/stats${queryString ? `?${queryString}` : ''}`)

    return response
  } catch (error) {
    throw error
  }
}

// ============================================================================
// USER MANAGEMENT APIs
// ============================================================================

/**
 * Transform backend user to frontend format
 */
function transformUser(backendUser) {
  const isBlocked = backendUser.isBlocked || false
  const isActive = backendUser.isActive && !isBlocked

  return {
    id: backendUser._id?.toString() || backendUser.id,
    name: backendUser.name,
    phone: backendUser.phone,
    email: backendUser.email,
    region: backendUser.location?.city || backendUser.location?.state || 'Unknown',
    sellerId: backendUser.seller?.sellerId || backendUser.sellerId || '',
    orders: backendUser.totalOrders || backendUser.orders || 0,
    lastOrderDate: backendUser.lastOrderDate,
    payments: 'on_time', // TODO: Calculate from payment history
    supportTickets: 0, // TODO: Count from support tickets
    status: isBlocked ? 'blocked' : (isActive ? 'active' : 'inactive'),
    isBlocked,
    isActive,
    location: backendUser.location || {},
    assignedVendor: backendUser.assignedVendor || null,
    // Keep all original fields for reference
    ...backendUser,
  }
}

/**
 * Get All Users
 * GET /admin/users
 * 
 * @param {Object} params - { page, limit, isActive, isBlocked, sellerId, search, sortBy, sortOrder, offset }
 * @returns {Promise<Object>} - { users: Array, total: number, pagination?: Object }
 */
export async function getUsers(params = {}) {
  try {
    // Convert frontend params to backend query params
    const queryParams = new URLSearchParams()

    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
    if (params.isBlocked !== undefined) queryParams.append('isBlocked', params.isBlocked.toString())
    if (params.sellerId) queryParams.append('sellerId', params.sellerId)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.offset) {
      // Convert offset to page
      const page = Math.floor((params.offset / (params.limit || 20)) + 1)
      queryParams.append('page', page.toString())
    }

    // Map frontend status to backend params
    if (params.status) {
      if (params.status === 'blocked') {
        queryParams.append('isBlocked', 'true')
      } else if (params.status === 'active') {
        queryParams.append('isActive', 'true')
        queryParams.append('isBlocked', 'false')
      } else if (params.status === 'inactive') {
        queryParams.append('isActive', 'false')
      }
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/users${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const transformedUsers = response.data.users.map(transformUser)
      return {
        success: true,
        data: {
          users: transformedUsers,
          total: response.data.pagination?.totalItems || response.data.users.length,
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get User Details
 * GET /admin/users/:userId
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { user: Object, stats: Object }
 */
export async function getUserDetails(userId) {
  const response = await apiRequest(`/admin/users/${userId}`)

  // Transform backend response to frontend format
  if (response.success && response.data) {
    const user = transformUser(response.data.user)
    return {
      success: true,
      data: {
        ...user,
        stats: response.data.stats || {},
        // TODO: Add ordersHistory, paymentHistory, supportTickets when backend provides them
      },
    }
  }

  return response
}

/**
 * Block User
 * PUT /admin/users/:userId/block
 * 
 * @param {string} userId - User ID
 * @param {Object} blockData - { reason?: string, block?: boolean } (block: true to block, false to unblock)
 * @returns {Promise<Object>} - { user: Object, message: string }
 */
export async function blockUser(userId, blockData = {}) {
  const response = await apiRequest(`/admin/users/${userId}/block`, {
    method: 'PUT',
    body: JSON.stringify({
      block: blockData.block !== undefined ? blockData.block : true,
      reason: blockData.reason,
    }),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        user: response.data.user ? transformUser(response.data.user) : undefined,
        message: response.data.message || 'User blocked successfully',
      },
    }
  }

  return response
}

/**
 * Deactivate User
 * PUT /admin/users/:userId/block (with block: true)
 * 
 * @param {string} userId - User ID
 * @param {Object} deactivateData - { reason?: string }
 * @returns {Promise<Object>} - { message: string }
 */
export async function deactivateUser(userId, deactivateData = {}) {
  // Use blockUser with block: true (which also deactivates)
  return blockUser(userId, {
    block: true,
    reason: deactivateData.reason || 'User deactivated by admin',
  })
}

/**
 * Activate User (Unblock)
 * PUT /admin/users/:userId/block (with block: false)
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function activateUser(userId) {
  // Use blockUser with block: false (unblocks and activates)
  return blockUser(userId, {
    block: false,
    reason: 'User activated by admin',
  })
}

// ============================================================================
// ORDER MANAGEMENT APIs
// ============================================================================

/**
 * Transform backend order to frontend format
 */
function transformOrder(backendOrder) {
  const isEscalated = backendOrder.assignedTo === 'admin'
  const region = backendOrder.vendorId?.location?.state ||
    backendOrder.vendorId?.location?.city ||
    backendOrder.userId?.location?.state ||
    'Unknown'

  // User location details
  const userLocation = backendOrder.userId?.location || {}
  const userLocationDisplay = userLocation.city && userLocation.state
    ? `${userLocation.city}, ${userLocation.state}`
    : userLocation.city || userLocation.state || 'Not provided'

  // Vendor location details
  const vendorLocation = backendOrder.vendorId?.location || {}
  const vendorLocationDisplay = vendorLocation.city && vendorLocation.state
    ? `${vendorLocation.city}, ${vendorLocation.state}`
    : vendorLocation.city || vendorLocation.state || 'N/A'

  return {
    id: backendOrder._id?.toString() || backendOrder.id,
    orderNumber: backendOrder.orderNumber || backendOrder.id,
    type: backendOrder.assignedTo || 'vendor',
    vendorId: backendOrder.vendorId?._id?.toString() || backendOrder.vendorId?.toString() || null,
    vendor: backendOrder.vendorId?.name || 'Admin',
    vendorLocation: vendorLocationDisplay,
    vendorPhone: backendOrder.vendorId?.phone || 'N/A',
    region,
    value: backendOrder.totalAmount || 0,
    advance: backendOrder.upfrontAmount || 0,
    advanceStatus: backendOrder.paymentStatus === 'fully_paid' ? 'paid' :
      backendOrder.paymentStatus === 'partial_paid' ? 'partial' : 'pending',
    pending: backendOrder.remainingAmount || (backendOrder.totalAmount - (backendOrder.upfrontAmount || 0)),
    status: backendOrder.status || 'pending',
    paymentStatus: backendOrder.paymentStatus || 'pending',
    userId: backendOrder.userId?._id?.toString() || backendOrder.userId?.toString(),
    userName: backendOrder.userId?.name || 'Unknown',
    userPhone: backendOrder.userId?.phone || 'N/A',
    userLocation: userLocationDisplay,
    userLocationDetails: userLocation,
    assignedTo: backendOrder.assignedTo || 'vendor',
    escalated: isEscalated,
    createdAt: backendOrder.createdAt,
    // Keep all original fields for reference
    ...backendOrder,
  }
}

/**
 * Get All Orders
 * GET /admin/orders
 * 
 * @param {Object} params - { page, limit, status, paymentStatus, vendorId, userId, assignedTo, dateFrom, dateTo, search, sortBy, sortOrder, offset }
 * @returns {Promise<Object>} - { orders: Array, total: number, pagination?: Object }
 */
export async function getOrders(params = {}) {
  try {
    // Convert frontend params to backend query params
    const queryParams = new URLSearchParams()

    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)
    if (params.paymentStatus) queryParams.append('paymentStatus', params.paymentStatus)
    if (params.vendorId) queryParams.append('vendorId', params.vendorId)
    if (params.userId) queryParams.append('userId', params.userId)
    if (params.assignedTo) queryParams.append('assignedTo', params.assignedTo)
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom)
    if (params.dateTo) queryParams.append('dateTo', params.dateTo)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
    if (params.offset) {
      // Convert offset to page
      const page = Math.floor((params.offset / (params.limit || 20)) + 1)
      queryParams.append('page', page.toString())
    }

    // Map frontend type to backend assignedTo
    if (params.type) {
      if (params.type === 'vendor') queryParams.append('assignedTo', 'vendor')
      else if (params.type === 'admin') queryParams.append('assignedTo', 'admin')
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/orders${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const transformedOrders = response.data.orders.map(transformOrder)
      return {
        success: true,
        data: {
          orders: transformedOrders,
          total: response.data.pagination?.totalItems || response.data.orders.length,
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Order Details
 * GET /admin/orders/:orderId
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} - { order: Object, payments: Array, paymentSummary: Object }
 */
export async function getOrderDetails(orderId) {
  const response = await apiRequest(`/admin/orders/${orderId}`)

  // Transform backend response to frontend format
  if (response.success && response.data) {
    const order = response.data.order
    const isEscalated = order.assignedTo === 'admin'
    const region = order.vendorId?.location?.state ||
      order.vendorId?.location?.city ||
      order.userId?.location?.state ||
      'Unknown'

    return {
      success: true,
      data: {
        id: order._id?.toString() || order.id,
        orderNumber: order.orderNumber,
        type: order.assignedTo === 'admin' ? 'Admin' : 'Vendor',
        vendorId: order.vendorId?._id?.toString() || order.vendorId?.toString() || null,
        vendor: order.vendorId?.name || 'Admin',
        region,
        date: order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        value: order.totalAmount || 0,
        advance: order.upfrontAmount || 0,
        advanceStatus: order.paymentStatus === 'fully_paid' ? 'paid' :
          order.paymentStatus === 'partial_paid' ? 'partial' : 'pending',
        pending: response.data.paymentSummary?.remaining || order.remainingAmount || 0,
        status: order.status || 'pending',
        items: order.items?.map(item => ({
          id: item._id?.toString() || item.id,
          name: item.productId?.name || item.productName,
          quantity: item.quantity,
          unit: 'bags', // TODO: Get from product weight unit
          price: item.unitPrice * item.quantity,
        })) || [],
        paymentHistory: response.data.payments?.map(payment => ({
          id: payment._id?.toString() || payment.id,
          paymentId: payment.paymentId,
          type: payment.paymentType === 'advance' ? 'Advance Payment' :
            payment.paymentType === 'remaining' ? 'Remaining Payment' : 'Full Payment',
          amount: payment.amount,
          date: payment.createdAt ? new Date(payment.createdAt).toISOString().split('T')[0] : null,
          status: payment.status === 'fully_paid' ? 'completed' : payment.status,
        })) || [],
        paymentSummary: response.data.paymentSummary || {},
        escalated: isEscalated,
        escalationReason: isEscalated ? (order.notes || 'Order escalated to admin') : null,
        userId: order.userId?._id?.toString() || order.userId?.toString(),
        userName: order.userId?.name,
        // Keep all original fields for reference
        ...order,
      },
    }
  }

  return response
}

/**
 * Reassign Order
 * PUT /admin/orders/:orderId/reassign
 * 
 * @param {string} orderId - Order ID
 * @param {Object} reassignData - { vendorId: string, reason?: string }
 * @returns {Promise<Object>} - { message: string, order: Object, oldVendorId: string, newVendor: Object }
 */
export async function reassignOrder(orderId, reassignData) {
  const response = await apiRequest(`/admin/orders/${orderId}/reassign`, {
    method: 'PUT',
    body: JSON.stringify({
      vendorId: reassignData.vendorId,
      reason: reassignData.reason,
    }),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        order: response.data.order ? transformOrder(response.data.order) : undefined,
        oldVendorId: response.data.oldVendorId,
        newVendor: response.data.newVendor,
        message: response.data.message || 'Order reassigned successfully',
      },
    }
  }

  return response
}

/**
 * Generate Invoice
 * POST /admin/orders/:orderId/invoice
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} - { invoiceUrl: string, invoiceId: string }
 */
/**
 * Generate Invoice for Order
 * GET /admin/orders/:orderId/invoice
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} - Downloads invoice as HTML (can be printed to PDF)
 */
export async function generateInvoice(orderId) {
  try {
    // Use the same token key as other API calls
    const token = localStorage.getItem('admin_token')
    if (!token) {
      return {
        success: false,
        error: { message: 'Authentication required. Please log in again.' },
      }
    }

    // Use the same API base URL as other API calls
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/invoice`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      // Try to parse as JSON first (for API errors), otherwise use status text
      let errorData
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json().catch(() => null)
      }

      if (!errorData) {
        // If not JSON, create error object from status
        if (response.status === 401) {
          errorData = { message: 'Authentication required. Please log in again.' }
        } else if (response.status === 404) {
          errorData = { message: 'Order not found.' }
        } else {
          errorData = { message: `Failed to generate invoice: ${response.statusText || 'Unknown error'}` }
        }
      }

      return {
        success: false,
        error: errorData,
      }
    }

    // Get the HTML content
    const htmlContent = await response.text()

    // Create a blob from the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)

    // Open in new tab for viewing and printing to PDF
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      // If pop-up blocked, trigger download instead
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${orderId}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      return {
        success: true,
        data: {
          invoiceUrl: url,
          invoiceId: `INV-${orderId}`,
          message: 'Invoice downloaded! Please open it and use Print (Ctrl+P) to save as PDF.',
        },
      }
    }

    // Write HTML content to new window
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load, then trigger print dialog (with slight delay to ensure content is rendered)
    setTimeout(() => {
      try {
        printWindow.focus()
        printWindow.print()
      } catch (err) {
        // Print dialog blocked or failed - user can still print manually
        console.log('Print dialog could not be opened automatically. Please use Ctrl+P to print.')
      }
    }, 500)

    return {
      success: true,
      data: {
        invoiceUrl: url,
        invoiceId: `INV-${orderId}`,
        message: 'Invoice opened in new tab. Use browser print (Ctrl+P) to save as PDF.',
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Failed to generate invoice',
      },
    }
  }
}

// ============================================================================
// FINANCE & CREDIT MANAGEMENT APIs
// ============================================================================

/**
 * Get Finance Overview
 * GET /admin/finance/parameters + /admin/finance/credits + /admin/finance/recovery
 * 
 * Composite function that combines multiple finance endpoints
 * 
 * @returns {Promise<Object>} - {
 *   creditPolicies: Array,
 *   outstandingCredits: Array,
 *   totalOutstanding: number,
 *   recoveryStatus: Object
 * }
 */
export async function getFinanceData() {
  try {
    // Fetch all finance data in parallel
    const [paramsResponse, creditsResponse, recoveryResponse] = await Promise.all([
      getFinancialParameters(),
      apiRequest('/admin/finance/credits'),
      getRecoveryStatus(),
    ])

    // Combine responses
    const params = paramsResponse.success ? paramsResponse.data : {}
    const credits = creditsResponse.success ? creditsResponse.data : {}
    const recovery = recoveryResponse.success ? recoveryResponse.data : {}

    // Build credit policies from parameters
    const creditPolicies = [
      {
        id: 'advance',
        label: 'Advance %',
        value: `${params.userAdvancePaymentPercent || 30}%`,
        meta: 'Default advance for all vendors',
      },
      {
        id: 'user-min',
        label: 'Minimum User Order',
        value: `₹${(params.minimumUserOrder || 2000).toLocaleString('en-IN')}`,
        meta: 'Effective since Apr 2024',
      },
      {
        id: 'vendor-min',
        label: 'Minimum Vendor Purchase',
        value: `₹${((params.minimumVendorPurchase || 50000) / 1000).toFixed(0)}K`,
        meta: 'Applies to all vendor types',
      },
    ]

    // Build outstanding credits from credits summary
    const summary = credits.summary || {}
    const totalOutstanding = summary.totalOutstanding || 0
    const totalLimit = summary.totalLimit || 0
    const overdueCount = summary.overdueCount || 0
    const dueSoonCount = summary.dueSoonCount || 0

    const outstandingCredits = [
      {
        label: 'Total Outstanding',
        progress: totalLimit > 0 ? Math.round((totalOutstanding / totalLimit) * 100) : 0,
        tone: 'warning',
        meta: `₹${(totalOutstanding / 10000000).toFixed(2)} Cr in recovery process`,
      },
      {
        label: 'Current Cycle Recovery',
        progress: recovery.recovery?.recoveryRate || 54,
        tone: 'success',
        meta: `₹${((recovery.recovery?.recoveredAmount || 0) / 100000).toFixed(0)} L collected`,
      },
      {
        label: 'Delayed Accounts',
        progress: overdueCount > 0 ? Math.round((overdueCount / (credits.totalVendors || 1)) * 100) : 0,
        meta: `${overdueCount + dueSoonCount} vendors flagged for follow-up`,
      },
    ]

    // Build recovery status
    const recoveryStatus = recovery.recovery || {
      total: totalOutstanding,
      collected: recovery.recovery?.recoveredAmount || 0,
      pending: recovery.recovery?.pendingAmount || totalOutstanding,
    }

    return {
      success: true,
      data: {
        creditPolicies,
        outstandingCredits,
        totalOutstanding,
        recoveryStatus,
      },
    }
  } catch (error) {
    throw error
  }
}

/**
 * Get Financial Parameters
 * GET /admin/finance/parameters
 * 
 * @returns {Promise<Object>} - { userAdvancePaymentPercent, minimumUserOrder, minimumVendorPurchase }
 */
export async function getFinancialParameters() {
  const response = await apiRequest('/admin/finance/parameters')

  // Backend returns: { userAdvancePaymentPercent, minimumUserOrder, minimumVendorPurchase }
  return response
}

/**
 * Update Financial Parameters
 * PUT /admin/finance/parameters
 * 
 * Note: Backend currently returns 501 (read-only). Parameters are stored in constants.js
 * This endpoint can be used to update a Settings collection in the future
 * 
 * @param {Object} parameters - {
 *   userAdvancePaymentPercent: number,
 *   minimumUserOrder: number,
 *   minimumVendorPurchase: number
 * }
 * @returns {Promise<Object>} - { parameters: Object, message: string }
 */
export async function updateFinancialParameters(parameters) {
  const response = await apiRequest('/admin/finance/parameters', {
    method: 'PUT',
    body: JSON.stringify(parameters),
  })

  // Backend may return 501 with message about read-only status
  return response
}

/**
 * Get Vendor Credit Balances
 * GET /admin/finance/credits (all vendors) or GET /admin/finance/vendors/:vendorId/history (specific vendor)
 * 
 * @param {Object} params - { vendorId?, page?, limit? }
 * @returns {Promise<Object>} - { credits: Array, creditData?: Object }
 */
export async function getVendorCreditBalances(params = {}) {
  if (params.vendorId) {
    // Get detailed credit history for a specific vendor
    return getVendorCreditHistory(params.vendorId, {
      page: params.page,
      limit: params.limit,
      startDate: params.startDate,
      endDate: params.endDate,
    })
  }

  // Get all vendor credits
  try {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/finance/credits${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const credits = response.data.credits?.map(credit => ({
        id: credit.vendorId?.toString() || credit.vendorId,
        vendorId: credit.vendorId?.toString() || credit.vendorId,
        name: credit.vendorName || '',
        creditLimit: credit.creditLimit || 0,
        usedCredit: credit.creditUsed || 0,
        overdue: credit.isOverdue ? credit.creditUsed : 0,
        penalty: credit.penalty || 0,
        status: credit.status === 'overdue' ? 'warning' :
          credit.status === 'dueSoon' ? 'warning' : 'success',
        // Keep all original fields for reference
        ...credit,
      })) || []

      return {
        success: true,
        data: {
          credits,
          summary: response.data.summary || {},
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Apply Penalty
 * POST /admin/finance/vendors/:vendorId/penalty
 * 
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function applyPenalty(vendorId) {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: { message: 'Penalty applied successfully' },
      })
    }, 1000)
  })
}

/**
 * Get Outstanding Credits
 * GET /admin/finance/credits (uses same endpoint as getVendorCreditBalances, but transforms to outstanding credits format)
 * 
 * @returns {Promise<Object>} - { credits: Array }
 */
export async function getOutstandingCredits() {
  // Use getCredits endpoint and transform to outstanding credits format
  try {
    const response = await apiRequest('/admin/finance/credits')

    // Transform backend response to frontend format
    if (response.success && response.data?.summary) {
      const summary = response.data.summary
      const totalOutstanding = summary.totalOutstanding || 0
      const totalLimit = summary.totalLimit || 0
      const overdueCount = summary.overdueCount || 0
      const dueSoonCount = summary.dueSoonCount || 0

      // Calculate progress percentages (mock calculation for now)
      const totalOutstandingProgress = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0
      const recoveryProgress = 54 // TODO: Calculate from actual recovery data
      const delayedProgress = totalLimit > 0 ? ((overdueCount * 1000000) / totalLimit) * 100 : 0 // Rough estimate

      return {
        success: true,
        data: {
          credits: [
            {
              label: 'Total Outstanding',
              progress: Math.round(totalOutstandingProgress),
              tone: 'warning',
              meta: `₹${(totalOutstanding / 10000000).toFixed(2)} Cr in recovery process`,
            },
            {
              label: 'Current Cycle Recovery',
              progress: Math.round(recoveryProgress),
              tone: 'success',
              meta: 'Recovery in progress',
            },
            {
              label: 'Delayed Accounts',
              progress: Math.round(delayedProgress),
              meta: `${overdueCount + dueSoonCount} vendors flagged for follow-up`,
            },
          ],
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Recovery Status
 * GET /admin/finance/recovery
 * 
 * @param {Object} params - { period?: number } (days, default 30)
 * @returns {Promise<Object>} - { recovery: Object, statistics: Object }
 */
export async function getRecoveryStatus(params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.period) queryParams.append('period', params.period.toString())

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/finance/recovery${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      const recovery = response.data.recovery || {}
      const stats = response.data.statistics || {}

      // Calculate progress from recovery data
      const total = recovery.totalOutstanding || 0
      const collected = recovery.recoveredAmount || 0
      const progress = total > 0 ? (collected / total) * 100 : 0

      return {
        success: true,
        data: {
          recoveries: [
            {
              id: 'REC-001',
              title: 'Total Outstanding Recovery',
              description: `₹${((recovery.totalOutstanding || 0) / 10000000).toFixed(2)} Cr in recovery process`,
              amount: recovery.totalOutstanding || 0,
              progress: Math.round(progress),
              status: recovery.pendingAmount > 0 ? 'in_progress' : 'completed',
              vendorCount: stats.totalVendorsWithCredit || 0,
            },
            {
              id: 'REC-002',
              title: 'Current Cycle Recovery',
              description: `₹${((recovery.recoveredAmount || 0) / 100000).toFixed(0)} L collected`,
              amount: recovery.recoveredAmount || 0,
              progress: Math.round(progress),
              status: 'in_progress',
              vendorCount: stats.completedPurchases || 0,
            },
            {
              id: 'REC-003',
              title: 'Delayed Accounts',
              description: `${stats.overdueVendors || 0} vendors flagged for follow-up`,
              amount: recovery.overdueAmount || 0,
              progress: total > 0 ? Math.round(((recovery.overdueAmount || 0) / total) * 100) : 0,
              status: 'overdue',
              vendorCount: stats.overdueVendors || 0,
            },
          ],
          recovery,
          statistics: stats,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Apply Penalty to Vendor
 * POST /admin/finance/vendors/:vendorId/penalty
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} penaltyData - { amount: number, reason: string }
 * @returns {Promise<Object>} - { message: string }
 */
export async function applyVendorPenalty(vendorId, penaltyData) {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: { message: 'Penalty applied successfully' },
      })
    }, 1000)
  })
}

// ============================================================================
// OPERATIONAL CONTROLS APIs
// ============================================================================

/**
 * Get Logistics Settings
 * GET /admin/operations/logistics-settings
 * 
 * @returns {Promise<Object>} - { defaultDeliveryTime, availableDeliveryOptions, ... }
 */
/**
 * Get Logistics Settings
 * GET /admin/operations/logistics-settings
 * 
 * @returns {Promise<Object>} - { settings: Object }
 */
export async function getLogisticsSettings() {
  const response = await apiRequest('/admin/operations/logistics-settings')

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: response.data,
    }
  }

  return response
}

/**
 * Update Logistics Settings
 * PUT /admin/operations/logistics-settings
 * 
 * @param {Object} settings - Logistics settings object
 * @returns {Promise<Object>} - { settings: Object, message: string }
 */
export async function updateLogisticsSettings(settings) {
  const response = await apiRequest('/admin/operations/logistics-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        ...response.data,
        message: response.message || 'Logistics settings updated successfully',
      },
    }
  }

  return response
}

/**
 * Get Escalated Orders
 * GET /admin/orders/escalated
 * 
 * @param {Object} params - { page?, limit?, status?, dateFrom?, dateTo?, search?, sortBy?, sortOrder? }
 * @returns {Promise<Object>} - { orders: Array, pagination?: Object }
 */
export async function getEscalatedOrders(params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom)
    if (params.dateTo) queryParams.append('dateTo', params.dateTo)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/orders/escalated${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          orders: response.data.orders.map(order => ({
            id: order.id,
            orderNumber: order.orderNumber,
            vendor: order.vendor || 'N/A',
            vendorId: order.vendorId,
            value: order.value || order.orderValue || 0,
            orderValue: order.orderValue || order.value || 0,
            escalatedAt: order.escalatedAt ? new Date(order.escalatedAt).toISOString() : new Date().toISOString(),
            status: order.status || 'escalated',
            items: order.items || [],
            userId: order.userId,
            userName: order.userName,
            deliveryAddress: order.deliveryAddress,
            notes: order.notes,
          })),
          total: response.data.pagination?.totalItems || response.data.orders.length,
          pagination: response.data.pagination,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Fulfill Order from Warehouse
 * POST /admin/orders/:orderId/fulfill
 * 
 * @param {string} orderId - Order ID
 * @param {Object} fulfillmentData - { note?: string, deliveryDate?: string (ISO), trackingNumber?: string }
 * @returns {Promise<Object>} - { message: string, order: Object }
 */
export async function fulfillOrderFromWarehouse(orderId, fulfillmentData = {}) {
  try {
    const response = await apiRequest(`/admin/orders/${orderId}/fulfill`, {
      method: 'POST',
      body: JSON.stringify({
        note: fulfillmentData.note,
        deliveryDate: fulfillmentData.deliveryDate,
        trackingNumber: fulfillmentData.trackingNumber,
      }),
    })

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          order: response.data.order ? transformOrder(response.data.order) : undefined,
          message: response.data.message || 'Order fulfilled from warehouse successfully',
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Revert Escalation
 * POST /admin/orders/:orderId/revert-escalation
 * 
 * @param {string} orderId - Order ID
 * @param {Object} revertData - { reason: string }
 * @returns {Promise<Object>} - { order: Object, message: string }
 */
export async function revertEscalation(orderId, revertData = {}) {
  try {
    const response = await apiRequest(`/admin/orders/${orderId}/revert-escalation`, {
      method: 'POST',
      body: JSON.stringify({
        reason: revertData.reason,
      }),
    })

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          order: response.data.order ? transformOrder(response.data.order) : undefined,
          message: response.data.message || 'Escalation reverted successfully',
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Update Order Status (for admin-fulfilled orders)
 * PUT /admin/orders/:orderId/status
 * 
 * @param {string} orderId - Order ID
 * @param {Object} statusData - { status: string, notes?: string }
 * @returns {Promise<Object>} - { order: Object, message: string }
 */
export async function updateOrderStatus(orderId, statusData = {}) {
  try {
    const requestBody = {}
    if (statusData.status) requestBody.status = statusData.status
    if (statusData.paymentStatus) requestBody.paymentStatus = statusData.paymentStatus
    if (statusData.notes) requestBody.notes = statusData.notes
    if (statusData.isRevert !== undefined) requestBody.isRevert = statusData.isRevert

    const response = await apiRequest(`/admin/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    })

    // Transform backend response to frontend format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          order: response.data.order ? transformOrder(response.data.order) : undefined,
          message: response.data.message || 'Order status updated successfully',
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Notifications
 * GET /admin/operations/notifications
 * 
 * @returns {Promise<Object>} - { notifications: Array }
 */
export async function getNotifications() {
  const response = await apiRequest('/admin/operations/notifications')

  // Transform backend response to frontend format
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        notifications: response.data.notifications.map(notif => ({
          id: notif._id || notif.id,
          title: notif.title,
          message: notif.message,
          targetAudience: notif.targetAudience,
          priority: notif.priority,
          isActive: notif.isActive,
          createdAt: notif.createdAt ? new Date(notif.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          actionUrl: notif.actionUrl,
          actionText: notif.actionText,
        })),
        pagination: response.data.pagination,
      },
    }
  }

  return response
}

/**
 * Create Notification
 * POST /admin/operations/notifications
 * 
 * @param {Object} notificationData - Notification object
 * @returns {Promise<Object>} - { notification: Object, message: string }
 */
export async function createNotification(notificationData) {
  const response = await apiRequest('/admin/operations/notifications', {
    method: 'POST',
    body: JSON.stringify(notificationData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    const notif = response.data.notification
    return {
      success: true,
      data: {
        notification: {
          id: notif._id || notif.id,
          title: notif.title,
          message: notif.message,
          targetAudience: notif.targetAudience,
          priority: notif.priority,
          isActive: notif.isActive,
          createdAt: notif.createdAt ? new Date(notif.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        },
        message: response.message || 'Notification created successfully',
      },
    }
  }

  return response
}

/**
 * Update Notification
 * PUT /admin/operations/notifications/:notificationId
 * 
 * @param {string} notificationId - Notification ID
 * @param {Object} notificationData - Updated notification object
 * @returns {Promise<Object>} - { notification: Object, message: string }
 */
export async function updateNotification(notificationId, notificationData) {
  const response = await apiRequest(`/admin/operations/notifications/${notificationId}`, {
    method: 'PUT',
    body: JSON.stringify(notificationData),
  })

  // Transform backend response to frontend format
  if (response.success && response.data) {
    const notif = response.data.notification
    return {
      success: true,
      data: {
        notification: {
          id: notif._id || notif.id,
          title: notif.title,
          message: notif.message,
          targetAudience: notif.targetAudience,
          priority: notif.priority,
          isActive: notif.isActive,
          createdAt: notif.createdAt ? new Date(notif.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        },
        message: response.message || 'Notification updated successfully',
      },
    }
  }

  return response
}

/**
 * Delete Notification
 * DELETE /admin/operations/notifications/:notificationId
 * 
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteNotification(notificationId) {
  const response = await apiRequest(`/admin/operations/notifications/${notificationId}`, {
    method: 'DELETE',
  })

  // Transform backend response to frontend format
  if (response.success) {
    return {
      success: true,
      data: {
        message: response.message || 'Notification deleted successfully',
      },
    }
  }

  return response
}

/**
 * Get Vendor Credit History
 * GET /admin/finance/vendors/:vendorId/history
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} params - { page?, limit?, startDate?, endDate? }
 * @returns {Promise<Object>} - { vendor: Object, history: Array, pagination?: Object }
 */
export async function getVendorCreditHistory(vendorId, params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.startDate) queryParams.append('startDate', params.startDate)
    if (params.endDate) queryParams.append('endDate', params.endDate)
    if (params.offset) {
      // Convert offset to page
      const page = Math.floor((params.offset / (params.limit || 20)) + 1)
      queryParams.append('page', page.toString())
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/finance/vendors/${vendorId}/history${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      // Transform history items
      const history = response.data.history?.map(item => ({
        id: item.id?.toString() || item._id?.toString(),
        type: item.type, // 'credit_purchase' or 'repayment'
        amount: item.amount || 0,
        date: item.date || item.createdAt ? new Date(item.date || item.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: item.description || '',
        status: item.status || 'pending',
        products: item.products || [],
        orderNumber: item.orderNumber,
      })) || []

      return {
        success: true,
        data: {
          vendor: response.data.vendor || {},
          creditData: {
            creditLimit: response.data.vendor?.creditLimit || 0,
            usedCredit: response.data.vendor?.creditUsed || 0,
            availableCredit: response.data.vendor?.creditRemaining || 0,
            overdueAmount: 0, // TODO: Calculate from history
            penaltyAmount: 0, // TODO: Calculate from history
            repaymentHistory: history.filter(item => item.type === 'repayment'),
            overduePayments: [], // TODO: Calculate from history
          },
          history,
          transactions: history, // Alias for compatibility
          pagination: response.data.pagination,
          total: response.data.pagination?.totalItems || history.length,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get All Vendor Credit Repayments
 * GET /admin/finance/repayments
 * 
 * @param {Object} params - { 
 *   page?: number, 
 *   limit?: number,
 *   status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
 *   vendorId?: string,
 *   startDate?: string,
 *   endDate?: string
 * }
 * @returns {Promise<Object>} - { repayments: Array, summary: Object, pagination: Object }
 */
export async function getRepayments(params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)
    if (params.vendorId) queryParams.append('vendorId', params.vendorId)
    if (params.startDate) queryParams.append('startDate', params.startDate)
    if (params.endDate) queryParams.append('endDate', params.endDate)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/finance/repayments${queryString ? `?${queryString}` : ''}`)

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          repayments: response.data.repayments || [],
          summary: response.data.summary || {},
          statusBreakdown: response.data.statusBreakdown || [],
          pagination: response.data.pagination || {},
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Repayment Details
 * GET /admin/finance/repayments/:repaymentId
 * 
 * @param {string} repaymentId - Repayment ID
 * @returns {Promise<Object>} - { repayment: Object }
 */
export async function getRepaymentDetails(repaymentId) {
  try {
    const response = await apiRequest(`/admin/finance/repayments/${repaymentId}`)

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          repayment: response.data.repayment || {},
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Get Vendor Repayments
 * GET /admin/finance/vendors/:vendorId/repayments
 * 
 * @param {string} vendorId - Vendor ID
 * @param {Object} params - { page?: number, limit?: number, status?: string }
 * @returns {Promise<Object>} - { vendor: Object, repayments: Array, summary: Object, pagination: Object }
 */
export async function getVendorRepayments(vendorId, params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.status) queryParams.append('status', params.status)

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/finance/vendors/${vendorId}/repayments${queryString ? `?${queryString}` : ''}`)

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          vendor: response.data.vendor || {},
          repayments: response.data.repayments || [],
          summary: response.data.summary || {},
          pagination: response.data.pagination || {},
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

// ============================================================================
// ANALYTICS & REPORTS APIs
// ============================================================================

/**
 * Get Analytics Data
 * GET /admin/analytics
 * 
 * @param {Object} params - { period?: number (days, default 30), region?: string }
 * @returns {Promise<Object>} - {
 *   highlights: Array,
 *   timeline: Array,
 *   regionWise: Array,
 *   topVendors: Array,
 *   topSellers: Array,
 *   revenueTrends: Array,
 *   orderTrends: Array
 * }
 */
export async function getAnalyticsData(params = {}) {
  try {
    const queryParams = new URLSearchParams()
    if (params.period) {
      // Convert period string to days if needed
      const periodDays = typeof params.period === 'number'
        ? params.period
        : params.period === 'day' ? 1
          : params.period === 'week' ? 7
            : params.period === 'month' ? 30
              : params.period === 'year' ? 365
                : 30
      queryParams.append('period', periodDays.toString())
    } else {
      queryParams.append('period', '30') // Default 30 days
    }

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/analytics${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data?.analytics) {
      const analytics = response.data.analytics

      // Calculate highlights from analytics data
      const totalOrders = analytics.orderTrends?.reduce((sum, day) => sum + (day.count || 0), 0) || 0
      const totalRevenue = analytics.revenueTrends?.reduce((sum, day) => sum + (day.revenue || 0), 0) || 0
      const topVendor = analytics.topVendors?.[0]
      const topSeller = analytics.topSellers?.[0]

      // Calculate region-wise data (simplified - would need region aggregation in backend)
      // For now, using mock data structure but placeholder for future enhancement
      const regionWise = [] // TODO: Backend needs to provide region-wise aggregation

      // Build highlights
      const highlights = [
        {
          label: 'Total Orders',
          value: totalOrders.toLocaleString('en-IN'),
          change: '+12%', // TODO: Calculate change from previous period
        },
        {
          label: 'Total Revenue',
          value: `₹${(totalRevenue / 10000000).toFixed(1)} Cr`,
          change: '+9.6%', // TODO: Calculate change from previous period
        },
        {
          label: 'Top Region',
          value: 'N/A', // TODO: Calculate from region-wise data
          change: 'N/A',
        },
        {
          label: 'Top Vendor',
          value: topVendor?.vendorName || 'N/A',
          change: `₹${((topVendor?.revenue || 0) / 10000000).toFixed(1)} Cr`,
        },
      ]

      // Build timeline (simplified - would need actual event tracking)
      const timeline = [
        // TODO: Add actual timeline events when backend provides them
        {
          id: 'event-1',
          title: 'Analytics updated',
          timestamp: 'Just now',
          description: 'Analytics data refreshed for the selected period.',
          status: 'completed',
        },
      ]

      // Transform top vendors
      const topVendors = analytics.topVendors?.map(vendor => ({
        name: vendor.vendorName || vendor.name,
        revenue: vendor.revenue || 0,
        change: '+0%', // TODO: Calculate change from previous period
        orderCount: vendor.orderCount || 0,
      })) || []

      // Transform top sellers
      const topSellers = analytics.topSellers?.map(seller => ({
        name: seller.sellerId || 'Unknown Seller',
        sales: seller.revenue || 0,
        referrals: seller.referralCount || 0,
        orderCount: seller.orderCount || 0,
      })) || []

      return {
        success: true,
        data: {
          highlights,
          timeline,
          regionWise,
          topVendors,
          topSellers,
          revenueTrends: analytics.revenueTrends || [],
          orderTrends: analytics.orderTrends || [],
          topProducts: analytics.topProducts || [],
          period: response.data.period || 30,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

/**
 * Export Reports
 * GET /admin/reports
 * 
 * Note: Backend endpoint is GET (not POST) and returns JSON format for now
 * CSV/PDF export returns 501 (not yet implemented)
 * 
 * @param {Object} exportData - {
 *   format?: 'json' | 'csv' | 'pdf' (default: 'json'),
 *   period?: 'daily' | 'weekly' | 'monthly' | 'yearly' (default: 'monthly'),
 *   type?: 'summary' | 'full' (default: 'summary')
 * }
 * @returns {Promise<Object>} - { report: Object, generatedAt: Date, format: string }
 */
export async function exportReports(exportData = {}) {
  try {
    const queryParams = new URLSearchParams()

    queryParams.append('format', exportData.format || 'json')
    queryParams.append('period', exportData.period || 'monthly')
    queryParams.append('type', exportData.type || 'summary')

    const queryString = queryParams.toString()
    const response = await apiRequest(`/admin/reports${queryString ? `?${queryString}` : ''}`)

    // Transform backend response to frontend format
    if (response.success && response.data) {
      // If CSV/PDF, backend returns 501 - handle gracefully
      if (response.status === 501 || !response.success) {
        return {
          success: false,
          message: response.message || 'CSV/PDF export functionality will be implemented later',
          data: {
            downloadUrl: null,
            reportId: null,
          },
        }
      }

      // For JSON format, return report data
      // For CSV/PDF (when implemented), return download URL
      return {
        success: true,
        data: {
          report: response.data.report || {},
          generatedAt: response.data.generatedAt || new Date(),
          format: response.data.format || 'json',
          downloadUrl: response.data.format !== 'json' ? response.data.downloadUrl : null,
          reportId: `RPT-${Date.now()}`,
        },
      }
    }

    return response
  } catch (error) {
    throw error
  }
}

// ============================================================================
// REAL-TIME NOTIFICATIONS
// ============================================================================

/**
 * Initialize Real-time Connection
 * Sets up WebSocket or polling connection for real-time updates
 * 
 * @param {Function} onNotification - Callback function for notifications
 * @returns {Function} - Cleanup function
 */
export function initializeRealtimeConnection(onNotification) {
  // Simulate real-time connection
  const interval = setInterval(() => {
    // Simulate various notification types
    const notifications = [
      {
        type: 'vendor_application',
        title: 'New Vendor Application',
        message: 'New vendor application received from Green Valley Hub',
        timestamp: new Date().toISOString(),
        data: { vendorId: 'VND-500', vendorName: 'Green Valley Hub' },
      },
      {
        type: 'vendor_purchase_request',
        title: 'Vendor Purchase Request',
        message: 'HarvestLink Pvt Ltd requested credit purchase of ₹50,000',
        timestamp: new Date().toISOString(),
        data: { requestId: 'CR-123', vendorId: 'VND-131', amount: 50000 },
      },
      {
        type: 'seller_withdrawal_request',
        title: 'Seller Withdrawal Request',
        message: 'Priya Nair requested withdrawal of ₹25,000',
        timestamp: new Date().toISOString(),
        data: { requestId: 'WD-456', sellerId: 'SLR-883', amount: 25000 },
      },
      {
        type: 'order_escalated',
        title: 'Order Escalated',
        message: 'Order #ORD-78289 escalated to Admin for fulfillment',
        timestamp: new Date().toISOString(),
        data: { orderId: 'ORD-78289', reason: 'Vendor unavailable' },
      },
      {
        type: 'payment_delayed',
        title: 'Payment Delayed',
        message: '14 vendors have delayed payments requiring attention',
        timestamp: new Date().toISOString(),
        data: { count: 14 },
      },
      {
        type: 'low_stock_alert',
        title: 'Low Stock Alert',
        message: 'Micro Nutrient Mix stock is running low (2,900 kg)',
        timestamp: new Date().toISOString(),
        data: { productId: 'MICRO-12', productName: 'Micro Nutrient Mix', stock: 2900 },
      },
    ]

    // Randomly send notifications (simulate real-time behavior)
    if (Math.random() < 0.1) {
      const notification = notifications[Math.floor(Math.random() * notifications.length)]
      onNotification(notification)
    }
  }, 10000) // Check every 10 seconds

  return () => clearInterval(interval)
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
    case 'vendor_application':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_VENDORS_UPDATED', payload: true })
      showToast(notification.message, 'info')
      break

    case 'vendor_purchase_request':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_FINANCE_UPDATED', payload: true })
      showToast(notification.message, 'info')
      break

    case 'seller_withdrawal_request':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_SELLERS_UPDATED', payload: true })
      showToast(notification.message, 'info')
      break

    case 'order_escalated':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_ORDERS_UPDATED', payload: true })
      showToast(notification.message, 'warning')
      break

    case 'payment_delayed':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_FINANCE_UPDATED', payload: true })
      showToast(notification.message, 'warning')
      break

    case 'low_stock_alert':
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      dispatch({ type: 'SET_PRODUCTS_UPDATED', payload: true })
      showToast(notification.message, 'warning')
      break

    default:
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      break
  }
}

// ============================================================================
// OFFERS MANAGEMENT APIs
// ============================================================================

/**
 * Get All Offers
 * GET /admin/offers
 * 
 * @param {Object} params - { type, isActive }
 * @returns {Promise<Object>} - { offers: Array, carouselCount: number, maxCarousels: number }
 */
export async function getOffers(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/admin/offers?${queryParams}`)
}

/**
 * Get Single Offer
 * GET /admin/offers/:id
 * 
 * @param {string} id - Offer ID
 * @returns {Promise<Object>} - { offer: Object }
 */
export async function getOffer(id) {
  return apiRequest(`/admin/offers/${id}`)
}

/**
 * Create Offer
 * POST /admin/offers
 * 
 * @param {Object} data - Offer data (type, title, description, etc.)
 * @returns {Promise<Object>} - { offer: Object }
 */
export async function createOffer(data) {
  return apiRequest('/admin/offers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update Offer
 * PUT /admin/offers/:id
 * 
 * @param {string} id - Offer ID
 * @param {Object} data - Updated offer data
 * @returns {Promise<Object>} - { offer: Object }
 */
export async function updateOffer(id, data) {
  return apiRequest(`/admin/offers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Delete Offer
 * DELETE /admin/offers/:id
 * 
 * @param {string} id - Offer ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteOffer(id) {
  return apiRequest(`/admin/offers/${id}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// REVIEW MANAGEMENT APIs
// ============================================================================

/**
 * Get All Reviews
 * GET /admin/reviews
 * 
 * @param {Object} params - { productId, userId, rating, hasResponse, isApproved, isVisible, page, limit, sort }
 * @returns {Promise<Object>} - { reviews: Array, pagination: Object }
 */
export async function getReviews(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/admin/reviews?${queryParams}`)
}

/**
 * Get Review Details
 * GET /admin/reviews/:reviewId
 * 
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} - { review: Object }
 */
export async function getReviewDetails(reviewId) {
  return apiRequest(`/admin/reviews/${reviewId}`)
}

/**
 * Respond to Review
 * POST /admin/reviews/:reviewId/respond
 * 
 * @param {string} reviewId - Review ID
 * @param {Object} data - { response: string }
 * @returns {Promise<Object>} - { review: Object, message: string }
 */
export async function respondToReview(reviewId, data) {
  return apiRequest(`/admin/reviews/${reviewId}/respond`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update Review Response
 * PUT /admin/reviews/:reviewId/respond
 * 
 * @param {string} reviewId - Review ID
 * @param {Object} data - { response: string }
 * @returns {Promise<Object>} - { review: Object, message: string }
 */
export async function updateReviewResponse(reviewId, data) {
  return apiRequest(`/admin/reviews/${reviewId}/respond`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Delete Review Response
 * DELETE /admin/reviews/:reviewId/respond
 * 
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} - { review: Object, message: string }
 */
export async function deleteReviewResponse(reviewId) {
  return apiRequest(`/admin/reviews/${reviewId}/respond`, {
    method: 'DELETE',
  })
}

/**
 * Moderate Review
 * PUT /admin/reviews/:reviewId/moderate
 * 
 * @param {string} reviewId - Review ID
 * @param {Object} data - { isApproved: boolean, isVisible: boolean }
 * @returns {Promise<Object>} - { review: Object, message: string }
 */
export async function moderateReview(reviewId, data) {
  return apiRequest(`/admin/reviews/${reviewId}/moderate`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Delete Review
 * DELETE /admin/reviews/:reviewId
 * 
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} - { message: string }
 */
export async function deleteReview(reviewId) {
  return apiRequest(`/admin/reviews/${reviewId}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// TASK (TODO) MANAGEMENT APIs
// ============================================================================

/**
 * Get All Admin Tasks
 * GET /admin/tasks
 * 
 * @param {Object} params - { status, category, priority, limit }
 * @returns {Promise<Object>} - { tasks: Array, totalPending: number }
 */
export async function getAdminTasks(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/admin/tasks?${queryParams}`)
}

/**
 * Mark Task as Viewed
 * PUT /admin/tasks/:taskId/view
 * 
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} - { success: true, data: Object }
 */
export async function markTaskAsViewed(taskId) {
  return apiRequest(`/admin/tasks/${taskId}/view`, {
    method: 'PUT',
  })
}

/**
 * Mark Task as Completed
 * PUT /admin/tasks/:taskId/complete
 * 
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} - { success: true, data: Object }
 */
export async function markTaskAsCompleted(taskId) {
  return apiRequest(`/admin/tasks/${taskId}/complete`, {
    method: 'PUT',
  })
}

// ============================================================================
// SUPPORT TICKET MANAGEMENT APIs
// ============================================================================

/**
 * Get All Support Tickets
 * GET /admin/support/tickets
 * 
 * @param {Object} params - { status, userType, priority, unread, search, page, limit }
 * @returns {Promise<Object>} - { tickets: Array, stats: Object, pagination: Object }
 */
export async function getSupportTickets(params = {}) {
  const queryParams = new URLSearchParams(params).toString()
  return apiRequest(`/admin/support/tickets${queryParams ? `?${queryParams}` : ''}`)
}

/**
 * Get Support Ticket Details
 * GET /admin/support/tickets/:ticketId
 * 
 * @param {string} ticketId - Ticket ID or ticket code
 * @returns {Promise<Object>} - { ticket: Object, messages: Array }
 */
export async function getSupportTicketDetails(ticketId) {
  return apiRequest(`/admin/support/tickets/${ticketId}`)
}

/**
 * Reply to Support Ticket
 * POST /admin/support/tickets/:ticketId/reply
 * 
 * @param {string} ticketId - Ticket ID
 * @param {Object} data - { message }
 * @returns {Promise<Object>} - { message: Object, ticketStatus: string }
 */
export async function replyToSupportTicket(ticketId, data) {
  return apiRequest(`/admin/support/tickets/${ticketId}/reply`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update Support Ticket Status
 * PUT /admin/support/tickets/:ticketId/status
 * 
 * @param {string} ticketId - Ticket ID
 * @param {Object} data - { status, resolution?, priority? }
 * @returns {Promise<Object>} - { ticket: Object, message: string }
 */
export async function updateSupportTicketStatus(ticketId, data) {
  return apiRequest(`/admin/support/tickets/${ticketId}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Assign Support Ticket
 * PUT /admin/support/tickets/:ticketId/assign
 * 
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} - { ticket: Object, message: string }
 */
export async function assignSupportTicket(ticketId) {
  return apiRequest(`/admin/support/tickets/${ticketId}/assign`, {
    method: 'PUT',
  })
}

