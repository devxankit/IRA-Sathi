const express = require('express');
const router = express.Router();

// Import controllers and middleware
const sellerController = require('../controllers/sellerController');
const { authorizeSeller } = require('../middleware/auth');

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * @route   POST /api/sellers/auth/register
 * @desc    Seller (IRA Partner) registration
 * @access  Public
 */
router.post('/auth/register', sellerController.register);

/**
 * @route   POST /api/sellers/auth/request-otp
 * @desc    Request OTP for seller login/registration
 * @access  Public
 */
router.post('/auth/request-otp', sellerController.requestOTP);

/**
 * @route   POST /api/sellers/auth/verify-otp
 * @desc    Verify OTP and complete login/registration
 * @access  Public
 */
router.post('/auth/verify-otp', sellerController.verifyOTP);

/**
 * @route   POST /api/sellers/auth/login
 * @desc    Seller login (alias for verify-otp)
 * @access  Public
 */
router.post('/auth/login', sellerController.verifyOTP);

/**
 * @route   POST /api/sellers/auth/logout
 * @desc    Seller logout
 * @access  Private (Seller)
 */
router.post('/auth/logout', authorizeSeller, sellerController.logout);

/**
 * @route   POST /api/sellers/logout
 * @desc    Seller logout (alias)
 * @access  Private (Seller)
 */
router.post('/logout', authorizeSeller, sellerController.logout);

/**
 * @route   GET /api/sellers/auth/profile
 * @desc    Get seller profile
 * @access  Private (Seller)
 */
router.get('/auth/profile', authorizeSeller, sellerController.getProfile);

/**
 * @route   GET /api/sellers/profile
 * @desc    Get seller profile (alias)
 * @access  Private (Seller)
 */
router.get('/profile', authorizeSeller, sellerController.getProfile);

/**
 * @route   PUT /api/sellers/profile
 * @desc    Update seller profile
 * @access  Private (Seller)
 */
router.put('/profile', authorizeSeller, sellerController.updateProfile);

/**
 * @route   PUT /api/sellers/password
 * @desc    Change seller password
 * @access  Private (Seller)
 */
router.put('/password', authorizeSeller, sellerController.changePassword);

/**
 * @route   POST /api/sellers/profile/request-name-change
 * @desc    Request name change
 * @access  Private (Seller)
 */
router.post('/profile/request-name-change', authorizeSeller, sellerController.requestNameChange);

/**
 * @route   POST /api/sellers/profile/request-phone-change
 * @desc    Request phone change
 * @access  Private (Seller)
 */
router.post('/profile/request-phone-change', authorizeSeller, sellerController.requestPhoneChange);

/**
 * @route   GET /api/sellers/profile/change-requests
 * @desc    Get change requests
 * @access  Private (Seller)
 */
router.get('/profile/change-requests', authorizeSeller, sellerController.getChangeRequests);

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

/**
 * @route   GET /api/sellers/dashboard
 * @desc    Get dashboard overview data
 * @access  Private (Seller)
 */
router.get('/dashboard', authorizeSeller, sellerController.getDashboard);

/**
 * @route   GET /api/sellers/dashboard/overview
 * @desc    Get overview data (referrals, sales, target progress)
 * @access  Private (Seller)
 */
router.get('/dashboard/overview', authorizeSeller, sellerController.getOverview);

/**
 * @route   GET /api/sellers/dashboard/wallet
 * @desc    Get wallet data (balance, transactions)
 * @access  Private (Seller)
 */
router.get('/dashboard/wallet', authorizeSeller, sellerController.getWallet);

/**
 * @route   GET /api/sellers/dashboard/referrals
 * @desc    Get referrals data (users, purchases, commissions) - Dashboard version
 * @access  Private (Seller)
 */
router.get('/dashboard/referrals', authorizeSeller, sellerController.getReferrals);

/**
 * @route   GET /api/sellers/dashboard/performance
 * @desc    Get performance data (target progress, analytics)
 * @access  Private (Seller)
 */
router.get('/dashboard/performance', authorizeSeller, sellerController.getPerformance);

/**
 * @route   GET /api/sellers/dashboard/highlights
 * @desc    Get dashboard highlights/metrics
 * @access  Private (Seller)
 */
router.get('/dashboard/highlights', authorizeSeller, sellerController.getDashboardHighlights);

/**
 * @route   GET /api/sellers/dashboard/activity
 * @desc    Get recent activity feed
 * @access  Private (Seller)
 */
router.get('/dashboard/activity', authorizeSeller, sellerController.getRecentActivity);

// ============================================================================
// WALLET & COMMISSION ROUTES
// ============================================================================

/**
 * @route   GET /api/sellers/wallet
 * @desc    Get wallet balance and transaction history
 * @access  Private (Seller)
 */
router.get('/wallet', authorizeSeller, sellerController.getWalletDetails);

/**
 * @route   GET /api/sellers/wallet/transactions
 * @desc    Get wallet transactions
 * @access  Private (Seller)
 */
router.get('/wallet/transactions', authorizeSeller, sellerController.getWalletTransactions);

/**
 * @route   POST /api/sellers/wallet/withdrawals/request
 * @desc    Request wallet withdrawal
 * @access  Private (Seller)
 */
router.post('/wallet/withdrawals/request', authorizeSeller, sellerController.requestWithdrawal);

/**
 * @route   GET /api/sellers/wallet/withdrawals
 * @desc    Get withdrawal requests
 * @access  Private (Seller)
 */
router.get('/wallet/withdrawals', authorizeSeller, sellerController.getWithdrawals);

/**
 * @route   GET /api/sellers/wallet/withdrawals/:requestId
 * @desc    Get withdrawal request details
 * @access  Private (Seller)
 */
router.get('/wallet/withdrawals/:requestId', authorizeSeller, sellerController.getWithdrawalDetails);

// ============================================================================
// REFERRALS & COMMISSIONS ROUTES
// ============================================================================

/**
 * IMPORTANT: Specific routes with sub-paths must come BEFORE generic :referralId routes
 */

/**
 * @route   GET /api/sellers/referrals/stats
 * @desc    Get referral statistics
 * @access  Private (Seller)
 */
router.get('/referrals/stats', authorizeSeller, sellerController.getReferralStats);

/**
 * @route   GET /api/sellers/referrals
 * @desc    Get all referrals (users linked to seller ID)
 * @access  Private (Seller)
 */
router.get('/referrals', authorizeSeller, sellerController.getReferrals);

/**
 * @route   GET /api/sellers/referrals/:referralId
 * @desc    Get referral details (specific user)
 * @access  Private (Seller)
 */
router.get('/referrals/:referralId', authorizeSeller, sellerController.getReferralDetails);

// ============================================================================
// TARGET & PERFORMANCE ROUTES
// ============================================================================

/**
 * @route   GET /api/sellers/target
 * @desc    Get monthly target and progress
 * @access  Private (Seller)
 */
router.get('/target', authorizeSeller, sellerController.getTarget);

/**
 * @route   GET /api/sellers/targets/current
 * @desc    Get monthly target and progress (alias)
 * @access  Private (Seller)
 */
router.get('/targets/current', authorizeSeller, sellerController.getTarget);

/**
 * @route   GET /api/sellers/targets/history
 * @desc    Get target history
 * @access  Private (Seller)
 */
router.get('/targets/history', authorizeSeller, sellerController.getTargetHistory);

/**
 * @route   GET /api/sellers/targets/incentives
 * @desc    Get target achievement incentives
 * @access  Private (Seller)
 */
router.get('/targets/incentives', authorizeSeller, sellerController.getTargetIncentives);

/**
 * @route   GET /api/sellers/performance
 * @desc    Get performance analytics
 * @access  Private (Seller)
 */
router.get('/performance', authorizeSeller, sellerController.getPerformanceAnalytics);

// ============================================================================
// ANNOUNCEMENTS & NOTIFICATIONS ROUTES
// ============================================================================

/**
 * @route   GET /api/sellers/announcements
 * @desc    Get announcements
 * @access  Private (Seller)
 */
router.get('/announcements', authorizeSeller, sellerController.getAnnouncements);

/**
 * @route   PUT /api/sellers/announcements/:id/read
 * @desc    Mark announcement as read
 * @access  Private (Seller)
 */
router.put('/announcements/:id/read', authorizeSeller, sellerController.markAnnouncementRead);

/**
 * @route   PUT /api/sellers/announcements/read-all
 * @desc    Mark all announcements as read
 * @access  Private (Seller)
 */
router.put('/announcements/read-all', authorizeSeller, sellerController.markAllAnnouncementsRead);

/**
 * @route   GET /api/sellers/notifications
 * @desc    Get notifications
 * @access  Private (Seller)
 */
router.get('/notifications', authorizeSeller, sellerController.getNotifications);

/**
 * @route   PUT /api/sellers/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (Seller)
 */
router.put('/notifications/:id/read', authorizeSeller, sellerController.markNotificationRead);

/**
 * @route   PUT /api/sellers/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Seller)
 */
router.put('/notifications/read-all', authorizeSeller, sellerController.markAllNotificationsRead);

/**
 * @route   GET /api/sellers/notifications/preferences
 * @desc    Get notification preferences
 * @access  Private (Seller)
 */
router.get('/notifications/preferences', authorizeSeller, sellerController.getNotificationPreferences);

/**
 * @route   PUT /api/sellers/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private (Seller)
 */
router.put('/notifications/preferences', authorizeSeller, sellerController.updateNotificationPreferences);

// ============================================================================
// SHARING ROUTES
// ============================================================================

/**
 * @route   GET /api/sellers/share-link
 * @desc    Get seller ID share link
 * @access  Private (Seller)
 */
router.get('/share-link', authorizeSeller, sellerController.getShareLink);

/**
 * @route   POST /api/sellers/share/track
 * @desc    Track share action
 * @access  Private (Seller)
 */
router.post('/share/track', authorizeSeller, sellerController.trackShareAction);

// ============================================================================
// SUPPORT ROUTES
// ============================================================================

/**
 * @route   POST /api/sellers/support/report
 * @desc    Report issue/create support ticket
 * @access  Private (Seller)
 */
router.post('/support/report', authorizeSeller, sellerController.reportIssue);

/**
 * @route   GET /api/sellers/support/tickets
 * @desc    Get support tickets
 * @access  Private (Seller)
 */
router.get('/support/tickets', authorizeSeller, sellerController.getSupportTickets);

/**
 * @route   GET /api/sellers/support/tickets/:ticketId
 * @desc    Get support ticket details
 * @access  Private (Seller)
 */
router.get('/support/tickets/:ticketId', authorizeSeller, sellerController.getSupportTicketDetails);

/**
 * @route   POST /api/sellers/support/tickets/:ticketId/messages
 * @desc    Send message on support ticket
 * @access  Private (Seller)
 */
router.post('/support/tickets/:ticketId/messages', authorizeSeller, sellerController.sendSupportMessage);

// ============================================================================
// BANK ACCOUNT ROUTES
// ============================================================================

/**
 * @route   POST /api/sellers/bank-accounts
 * @desc    Add bank account
 * @access  Private (Seller)
 */
router.post('/bank-accounts', authorizeSeller, sellerController.addBankAccount);

/**
 * @route   GET /api/sellers/bank-accounts
 * @desc    Get seller bank accounts
 * @access  Private (Seller)
 */
router.get('/bank-accounts', authorizeSeller, sellerController.getBankAccounts);

/**
 * @route   PUT /api/sellers/bank-accounts/:accountId
 * @desc    Update bank account
 * @access  Private (Seller)
 */
router.put('/bank-accounts/:accountId', authorizeSeller, sellerController.updateBankAccount);

/**
 * @route   DELETE /api/sellers/bank-accounts/:accountId
 * @desc    Delete bank account
 * @access  Private (Seller)
 */
router.delete('/bank-accounts/:accountId', authorizeSeller, sellerController.deleteBankAccount);

module.exports = router;

