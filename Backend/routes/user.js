const express = require('express');
const router = express.Router();

// Import controllers
const userController = require('../controllers/userController');

// Import middleware
const { authorizeUser } = require('../middleware/auth');

// ============================================================================
// AUTHENTICATION & ONBOARDING ROUTES
// ============================================================================

/**
 * @route   POST /api/users/auth/request-otp
 * @desc    Request OTP for user registration/login
 * @access  Public
 */
router.post('/auth/request-otp', userController.requestOTP);

/**
 * @route   POST /api/users/auth/register
 * @desc    Register user with OTP
 * @access  Public
 */
router.post('/auth/register', userController.register);

/**
 * @route   POST /api/users/auth/login
 * @desc    Login with OTP
 * @access  Public
 */
router.post('/auth/login', userController.loginWithOtp);

/**
 * @route   POST /api/users/auth/verify-otp
 * @desc    Verify OTP (legacy - use login)
 * @access  Public
 */
router.post('/auth/verify-otp', userController.verifyOTP);

/**
 * @route   POST /api/users/auth/logout
 * @desc    User logout
 * @access  Private (User)
 */
router.post('/auth/logout', authorizeUser, userController.logout);

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private (User)
 */
router.get('/profile', authorizeUser, userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private (User)
 */
router.put('/profile', authorizeUser, userController.updateProfile);

/**
 * @route   GET /api/users/profile/seller-id
 * @desc    Get Seller ID (IRA Partner ID) - Read-only after registration
 * @access  Private (User)
 * @note    Seller ID can only be set during first-time registration and is locked for lifetime.
 */
router.get('/profile/seller-id', authorizeUser, userController.getSellerID);

/**
 * @route   POST /api/users/profile/phone/request-otp-current
 * @desc    Request OTP for current phone verification (for phone update)
 * @access  Private (User)
 */
router.post('/profile/phone/request-otp-current', authorizeUser, userController.requestOTPForCurrentPhone);

/**
 * @route   POST /api/users/profile/phone/verify-otp-current
 * @desc    Verify OTP for current phone (for phone update)
 * @access  Private (User)
 */
router.post('/profile/phone/verify-otp-current', authorizeUser, userController.verifyOTPForCurrentPhone);

/**
 * @route   POST /api/users/profile/phone/request-otp-new
 * @desc    Request OTP for new phone number (for phone update)
 * @access  Private (User)
 */
router.post('/profile/phone/request-otp-new', authorizeUser, userController.requestOTPForNewPhone);

/**
 * @route   POST /api/users/profile/phone/verify-otp-new
 * @desc    Verify OTP for new phone and update phone number
 * @access  Private (User)
 */
router.post('/profile/phone/verify-otp-new', authorizeUser, userController.verifyOTPForNewPhone);

// ============================================================================
// PRODUCT & CATALOG ROUTES
// ============================================================================

/**
 * @route   GET /api/users/products/categories
 * @desc    Get categories
 * @access  Public
 */
router.get('/products/categories', userController.getCategories);

/**
 * @route   GET /api/users/products
 * @desc    Get products with filtering
 * @access  Public
 */
router.get('/products', userController.getProducts);

/**
 * IMPORTANT: Specific routes with sub-paths must come BEFORE generic :productId routes
 * Otherwise Express will match the generic route first
 */

/**
 * @route   GET /api/users/products/popular
 * @desc    Get popular products
 * @access  Public
 */
router.get('/products/popular', userController.getPopularProducts);

/**
 * @route   GET /api/users/products/search
 * @desc    Search products
 * @access  Public
 */
router.get('/products/search', userController.searchProducts);

/**
 * IMPORTANT: Review routes must come BEFORE the generic :productId route
 * Otherwise Express will match the generic route first
 */

/**
 * @route   GET /api/users/products/:productId/reviews
 * @desc    Get product reviews
 * @access  Public
 */
router.get('/products/:productId/reviews', userController.getProductReviews);

/**
 * @route   GET /api/users/products/:productId/reviews/my-review
 * @desc    Get user's review for a product
 * @access  Private (User)
 */
router.get('/products/:productId/reviews/my-review', authorizeUser, userController.getMyReview);

/**
 * @route   POST /api/users/products/:productId/reviews
 * @desc    Create or update product review
 * @access  Private (User)
 */
router.post('/products/:productId/reviews', authorizeUser, userController.createReview);

/**
 * @route   PUT /api/users/products/:productId/reviews/:reviewId
 * @desc    Update user's review
 * @access  Private (User)
 */
router.put('/products/:productId/reviews/:reviewId', authorizeUser, userController.updateReview);

/**
 * @route   DELETE /api/users/products/:productId/reviews/:reviewId
 * @desc    Delete user's review
 * @access  Private (User)
 */
router.delete('/products/:productId/reviews/:reviewId', authorizeUser, userController.deleteReview);

/**
 * @route   GET /api/users/products/:productId
 * @desc    Get product details
 * @access  Public
 */
router.get('/products/:productId', userController.getProductDetails);

/**
 * @route   GET /api/users/offers
 * @desc    Get offers/banners
 * @access  Public
 */
router.get('/offers', userController.getOffers);

// ============================================================================
// CART ROUTES
// ============================================================================

/**
 * @route   GET /api/users/cart
 * @desc    Get cart
 * @access  Private (User)
 */
router.get('/cart', authorizeUser, userController.getCart);

/**
 * @route   POST /api/users/cart
 * @desc    Add to cart
 * @access  Private (User)
 */
router.post('/cart', authorizeUser, userController.addToCart);

/**
 * @route   PUT /api/users/cart/:itemId
 * @desc    Update cart item
 * @access  Private (User)
 */
router.put('/cart/:itemId', authorizeUser, userController.updateCartItem);

/**
 * @route   DELETE /api/users/cart/:itemId
 * @desc    Remove from cart
 * @access  Private (User)
 */
router.delete('/cart/:itemId', authorizeUser, userController.removeFromCart);

/**
 * @route   DELETE /api/users/cart
 * @desc    Clear cart
 * @access  Private (User)
 */
router.delete('/cart', authorizeUser, userController.clearCart);

/**
 * @route   POST /api/users/cart/validate
 * @desc    Validate cart (check minimum order value)
 * @access  Private (User)
 */
router.post('/cart/validate', authorizeUser, userController.validateCart);

// ============================================================================
// VENDOR ASSIGNMENT ROUTES
// ============================================================================

/**
 * @route   POST /api/users/vendors/assign
 * @desc    Get assigned vendor based on location (20km radius)
 * @access  Private (User)
 */
router.post('/vendors/assign', authorizeUser, userController.getAssignedVendor);

/**
 * @route   POST /api/users/vendors/check-stock
 * @desc    Check vendor stock availability
 * @access  Private (User)
 */
router.post('/vendors/check-stock', authorizeUser, userController.checkVendorStock);

// ============================================================================
// CHECKOUT & ORDER ROUTES
// ============================================================================

/**
 * IMPORTANT: Specific routes with sub-paths must come BEFORE generic :orderId routes
 */

/**
 * @route   GET /api/users/orders/:orderId/track
 * @desc    Track order
 * @access  Private (User)
 */
router.get('/orders/:orderId/track', authorizeUser, userController.trackOrder);

/**
 * @route   PUT /api/users/orders/:orderId/cancel
 * @desc    Cancel order
 * @access  Private (User)
 */
router.put('/orders/:orderId/cancel', authorizeUser, userController.cancelOrder);

/**
 * @route   POST /api/users/orders
 * @desc    Create order
 * @access  Private (User)
 */
router.post('/orders', authorizeUser, userController.createOrder);

/**
 * @route   GET /api/users/orders
 * @desc    Get orders
 * @access  Private (User)
 */
router.get('/orders', authorizeUser, userController.getOrders);

/**
 * @route   GET /api/users/orders/:orderId
 * @desc    Get order details
 * @access  Private (User)
 */
router.get('/orders/:orderId', authorizeUser, userController.getOrderDetails);

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

/**
 * @route   POST /api/users/payments/create-intent
 * @desc    Create payment intent (advance payment)
 * @access  Private (User)
 */
router.post('/payments/create-intent', authorizeUser, userController.createPaymentIntent);

/**
 * @route   POST /api/users/payments/confirm
 * @desc    Confirm payment (advance payment)
 * @access  Private (User)
 */
router.post('/payments/confirm', authorizeUser, userController.confirmPayment);

/**
 * @route   POST /api/users/payments/create-remaining
 * @desc    Create remaining payment intent (70%)
 * @access  Private (User)
 */
router.post('/payments/create-remaining', authorizeUser, userController.createRemainingPaymentIntent);

/**
 * @route   POST /api/users/payments/confirm-remaining
 * @desc    Confirm remaining payment (70%)
 * @access  Private (User)
 */
router.post('/payments/confirm-remaining', authorizeUser, userController.confirmRemainingPayment);

/**
 * @route   GET /api/users/payments/:paymentId
 * @desc    Get payment status
 * @access  Private (User)
 */
router.get('/payments/:paymentId', authorizeUser, userController.getPaymentStatus);

/**
 * @route   GET /api/users/orders/:orderId/payments
 * @desc    Get order payments
 * @access  Private (User)
 */
router.get('/orders/:orderId/payments', authorizeUser, userController.getOrderPayments);

// ============================================================================
// ADDRESS ROUTES
// ============================================================================

/**
 * @route   GET /api/users/addresses
 * @desc    Get addresses
 * @access  Private (User)
 */
router.get('/addresses', authorizeUser, userController.getAddresses);

/**
 * @route   POST /api/users/addresses
 * @desc    Add address
 * @access  Private (User)
 */
router.post('/addresses', authorizeUser, userController.addAddress);

/**
 * IMPORTANT: Specific routes with sub-paths must come BEFORE generic :addressId routes
 */

/**
 * @route   PUT /api/users/addresses/:addressId/default
 * @desc    Set default address
 * @access  Private (User)
 */
router.put('/addresses/:addressId/default', authorizeUser, userController.setDefaultAddress);

/**
 * @route   PUT /api/users/addresses/:addressId
 * @desc    Update address
 * @access  Private (User)
 */
router.put('/addresses/:addressId', authorizeUser, userController.updateAddress);

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Delete address
 * @access  Private (User)
 */
router.delete('/addresses/:addressId', authorizeUser, userController.deleteAddress);

// ============================================================================
// FAVOURITES/WISHLIST ROUTES
// ============================================================================

/**
 * @route   GET /api/users/favourites
 * @desc    Get favourites
 * @access  Private (User)
 */
router.get('/favourites', authorizeUser, userController.getFavourites);

/**
 * @route   POST /api/users/favourites
 * @desc    Add to favourites
 * @access  Private (User)
 */
router.post('/favourites', authorizeUser, userController.addToFavourites);

/**
 * @route   DELETE /api/users/favourites/:productId
 * @desc    Remove from favourites
 * @access  Private (User)
 */
router.delete('/favourites/:productId', authorizeUser, userController.removeFromFavourites);

// ============================================================================
// NOTIFICATIONS ROUTES
// ============================================================================

/**
 * @route   GET /api/users/notifications
 * @desc    Get notifications
 * @access  Private (User)
 */
router.get('/notifications', authorizeUser, userController.getNotifications);

/**
 * @route   PUT /api/users/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private (User)
 */
router.put('/notifications/:notificationId/read', authorizeUser, userController.markNotificationRead);

/**
 * @route   PUT /api/users/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (User)
 */
router.put('/notifications/read-all', authorizeUser, userController.markAllNotificationsRead);

// ============================================================================
// SUPPORT ROUTES
// ============================================================================

/**
 * @route   POST /api/users/support/tickets
 * @desc    Create support ticket
 * @access  Private (User)
 */
router.post('/support/tickets', authorizeUser, userController.createSupportTicket);

/**
 * @route   GET /api/users/support/tickets
 * @desc    Get support tickets
 * @access  Private (User)
 */
router.get('/support/tickets', authorizeUser, userController.getSupportTickets);

/**
 * @route   GET /api/users/support/tickets/:ticketId
 * @desc    Get support ticket details
 * @access  Private (User)
 */
router.get('/support/tickets/:ticketId', authorizeUser, userController.getSupportTicketDetails);

/**
 * @route   POST /api/users/support/tickets/:ticketId/messages
 * @desc    Send support message
 * @access  Private (User)
 */
router.post('/support/tickets/:ticketId/messages', authorizeUser, userController.sendSupportMessage);

/**
 * @route   POST /api/users/support/call
 * @desc    Initiate support call
 * @access  Private (User)
 */
router.post('/support/call', authorizeUser, userController.initiateSupportCall);

module.exports = router;

