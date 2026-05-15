const express = require('express');
const router = express.Router();
const fcmController = require('../controllers/fcmController');
const { authorizeUser, authorizeVendor, authorizeSeller, authorizeAdmin } = require('../middleware/auth');
const PushNotificationLog = require('../models/PushNotificationLog');
const {
    sendNotificationToUser,
    sendNotificationToVendor,
    sendNotificationToSeller,
    sendNotificationToAllVendors,
    sendNotificationToAllSellers,
    sendNotificationToMultipleUsers,
} = require('../services/pushNotificationService');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Seller = require('../models/Seller');

/**
 * FCM Token Routes
 * 
 * Routes for managing Firebase Cloud Messaging tokens
 * Supports User, Vendor, and Seller authentication
 */

// Unified authentication middleware that works for all user types
const authenticate = (req, res, next) => {
    // Try to authenticate as User first
    authorizeUser(req, res, (err) => {
        if (!err && req.user) {
            req.user.userType = 'user';
            req.user.userId = req.user.userId || req.user.id;
            return next();
        }

        // Try Vendor
        authorizeVendor(req, res, (err) => {
            if (!err && req.user) {
                req.user.userType = 'vendor';
                req.user.userId = req.user.vendorId || req.user.userId || req.user.id;
                return next();
            }

            // Try Seller
            authorizeSeller(req, res, (err) => {
                if (!err && req.user) {
                    req.user.userType = 'seller';
                    req.user.userId = req.user.sellerId || req.user.userId || req.user.id;
                    return next();
                }

                // All authentication methods failed
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            });
        });
    });
};

/**
 * @route   POST /api/fcm/register
 * @desc    Register FCM token for push notifications
 * @access  Private (User, Vendor, or Seller)
 * @body    { token: string, platform: 'web' | 'app' }
 */
router.post('/register', authenticate, fcmController.registerFCMToken);

/**
 * @route   POST /api/fcm/remove
 * @desc    Remove FCM token
 * @access  Private (User, Vendor, or Seller)
 * @body    { platform: 'web' | 'app' }
 */
router.post('/remove', authenticate, fcmController.removeFCMToken);

/**
 * @route   GET /api/fcm/status
 * @desc    Get FCM token registration status
 * @access  Private (User, Vendor, or Seller)
 */
router.get('/status', authenticate, fcmController.getFCMTokenStatus);

/**
 * @route   POST /api/fcm/broadcast
 * @desc    Admin: Broadcast a push notification to a target audience
 * @access  Private (Admin only)
 * @body    { title, message, targetAudience, priority, imageUrl }
 */
router.post('/broadcast', authorizeAdmin, async (req, res) => {
    try {
        const { title, message, targetAudience, priority, imageUrl } = req.body;

        if (!title || !message || !targetAudience) {
            return res.status(400).json({
                success: false,
                message: 'title, message, and targetAudience are required',
            });
        }

        // Create log entry first (status starts as pending)
        const logEntry = await PushNotificationLog.create({
            title,
            message,
            targetAudience,
            priority: priority || 'normal',
            imageUrl: imageUrl || null,
            status: 'pending',
            sentBy: req.admin._id,
        });

        const payload = {
            title,
            body: message,
            icon: imageUrl || null,
            data: {
                logId: logEntry._id.toString(),
                type: 'broadcast',
                priority: priority || 'normal',
            },
        };

        let deliveredCount = 0;
        let failedCount = 0;
        let firebaseResponse = null;

        // Helper to accumulate counts from a Firebase multicast response
        const accumulateCounts = (resp) => {
            if (!resp) return;
            if (Array.isArray(resp)) {
                resp.forEach(accumulateCounts);
            } else if (typeof resp.successCount === 'number') {
                deliveredCount += resp.successCount;
                failedCount += resp.failureCount || 0;
            }
        };

        try {
            if (targetAudience === 'all') {
                // Collect all tokens across all roles and broadcast
                const [allUsers, allVendors, allSellers] = await Promise.all([
                    User.find({ $or: [{ fcmTokenWeb: { $exists: true, $ne: null, $ne: '' } }, { fcmTokenApp: { $exists: true, $ne: null, $ne: '' } }] }).select('fcmTokenWeb fcmTokenApp'),
                    Vendor.find({ $or: [{ fcmTokenWeb: { $exists: true, $ne: null, $ne: '' } }, { fcmTokenApp: { $exists: true, $ne: null, $ne: '' } }] }).select('fcmTokenWeb fcmTokenApp'),
                    Seller.find({ $or: [{ fcmTokenWeb: { $exists: true, $ne: null, $ne: '' } }, { fcmTokenApp: { $exists: true, $ne: null, $ne: '' } }] }).select('fcmTokenWeb fcmTokenApp'),
                ]);
                const tokenSet = new Set();
                [...allUsers, ...allVendors, ...allSellers].forEach(u => {
                    if (u.fcmTokenWeb) tokenSet.add(u.fcmTokenWeb);
                    if (u.fcmTokenApp) tokenSet.add(u.fcmTokenApp);
                });
                const allTokens = Array.from(tokenSet);
                if (allTokens.length > 0) {
                    const { sendPushNotification } = require('../services/firebaseAdmin');
                    // Batch in groups of 500 (Firebase multicast limit)
                    const batches = [];
                    for (let i = 0; i < allTokens.length; i += 500) {
                        batches.push(allTokens.slice(i, i + 500));
                    }
                    const results = await Promise.all(batches.map(batch => sendPushNotification(batch, payload)));
                    firebaseResponse = results;
                    accumulateCounts(results);
                }
            } else if (targetAudience === 'users') {
                const users = await User.find({ $or: [{ fcmTokenWeb: { $exists: true, $ne: null, $ne: '' } }, { fcmTokenApp: { $exists: true, $ne: null, $ne: '' } }] }).select('_id');
                const results = await Promise.all(users.map(u => sendNotificationToUser(u._id, payload)));
                firebaseResponse = results;
            } else if (targetAudience === 'vendors') {
                const vendors = await Vendor.find({ $or: [{ fcmTokenWeb: { $exists: true, $ne: null, $ne: '' } }, { fcmTokenApp: { $exists: true, $ne: null, $ne: '' } }] }).select('_id');
                const results = await Promise.all(vendors.map(v => sendNotificationToVendor(v._id, payload)));
                firebaseResponse = results;
            } else if (targetAudience === 'sellers') {
                const sellers = await Seller.find({ $or: [{ fcmTokenWeb: { $exists: true, $ne: null, $ne: '' } }, { fcmTokenApp: { $exists: true, $ne: null, $ne: '' } }] }).select('_id');
                const results = await Promise.all(sellers.map(s => sendNotificationToSeller(s._id, payload)));
                firebaseResponse = results;
            } else {
                return res.status(400).json({ success: false, message: 'Invalid targetAudience. Use: all, users, vendors, sellers' });
            }
        } catch (sendError) {
            console.error('FCM Broadcast send error:', sendError.message);
            failedCount += 1;
        }

        // Update log entry with results
        await PushNotificationLog.findByIdAndUpdate(logEntry._id, {
            deliveredCount,
            failedCount,
            status: deliveredCount > 0 ? 'delivered' : (failedCount > 0 ? 'failed' : 'pending'),
            firebaseResponse,
        });

        res.status(200).json({
            success: true,
            message: 'Broadcast initiated',
            stats: { deliveredCount, failedCount },
            logId: logEntry._id,
        });
    } catch (error) {
        console.error('FCM Broadcast Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during FCM broadcast',
            error: error.message,
        });
    }
});

/**
 * @route   GET /api/fcm/history
 * @desc    Admin: Get push notification broadcast history
 * @access  Private (Admin only)
 */
router.get('/history', authorizeAdmin, async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [history, total] = await Promise.all([
            PushNotificationLog.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('sentBy', 'name email'),
            PushNotificationLog.countDocuments(),
        ]);

        res.status(200).json({
            success: true,
            data: history,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('FCM History Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching notification history',
        });
    }
});

module.exports = router;
