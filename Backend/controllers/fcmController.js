const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Seller = require('../models/Seller');

/**
 * FCM Token Controller
 * 
 * Handles registration and removal of FCM tokens for push notifications
 */

/**
 * Register FCM Token
 * 
 * @route POST /api/fcm/register
 * @access Private (requires authentication)
 */
exports.registerFCMToken = async (req, res) => {
    try {
        const { token, platform = 'web' } = req.body;
        const { userType, userId } = req.user; // From auth middleware

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid FCM token is required',
            });
        }

        if (!['web', 'app'].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: 'Platform must be either "web" or "app"',
            });
        }

        // Determine which model to use based on userType
        let Model;
        switch (userType) {
            case 'user':
                Model = User;
                break;
            case 'vendor':
                Model = Vendor;
                break;
            case 'seller':
                Model = Seller;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user type',
                });
        }

        // Find and update user
        const user = await Model.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Update token based on platform
        if (platform === 'web') {
            user.fcmTokenWeb = token;
        } else {
            user.fcmTokenApp = token;
        }

        await user.save();

        console.log(`✅ FCM token registered for ${userType} ${userId} (${platform})`);

        res.json({
            success: true,
            message: 'FCM token registered successfully',
            platform,
        });
    } catch (error) {
        console.error('❌ Error registering FCM token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register FCM token',
            error: error.message,
        });
    }
};

/**
 * Remove FCM Token
 * 
 * @route POST /api/fcm/remove
 * @access Private (requires authentication)
 */
exports.removeFCMToken = async (req, res) => {
    try {
        const { platform = 'web' } = req.body;
        const { userType, userId } = req.user; // From auth middleware

        if (!['web', 'app'].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: 'Platform must be either "web" or "app"',
            });
        }

        // Determine which model to use based on userType
        let Model;
        switch (userType) {
            case 'user':
                Model = User;
                break;
            case 'vendor':
                Model = Vendor;
                break;
            case 'seller':
                Model = Seller;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user type',
                });
        }

        // Find and update user
        const user = await Model.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Remove token based on platform
        if (platform === 'web') {
            user.fcmTokenWeb = null;
        } else {
            user.fcmTokenApp = null;
        }

        await user.save();

        console.log(`✅ FCM token removed for ${userType} ${userId} (${platform})`);

        res.json({
            success: true,
            message: 'FCM token removed successfully',
            platform,
        });
    } catch (error) {
        console.error('❌ Error removing FCM token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove FCM token',
            error: error.message,
        });
    }
};

/**
 * Get FCM Token Status
 * 
 * @route GET /api/fcm/status
 * @access Private (requires authentication)
 */
exports.getFCMTokenStatus = async (req, res) => {
    try {
        const { userType, userId } = req.user; // From auth middleware

        // Determine which model to use based on userType
        let Model;
        switch (userType) {
            case 'user':
                Model = User;
                break;
            case 'vendor':
                Model = Vendor;
                break;
            case 'seller':
                Model = Seller;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user type',
                });
        }

        // Find user
        const user = await Model.findById(userId).select('fcmTokenWeb fcmTokenApp');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.json({
            success: true,
            hasWebToken: !!user.fcmTokenWeb,
            hasAppToken: !!user.fcmTokenApp,
        });
    } catch (error) {
        console.error('❌ Error getting FCM token status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get FCM token status',
            error: error.message,
        });
    }
};
