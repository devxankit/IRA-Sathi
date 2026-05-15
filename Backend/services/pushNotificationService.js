const { sendPushNotification } = require('./firebaseAdmin');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Seller = require('../models/Seller');

/**
 * Push Notification Service
 * 
 * Helper functions to send push notifications to users, vendors, and sellers
 * Automatically retrieves FCM tokens from database and sends notifications
 */

/**
 * Send push notification to a User
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {Object} payload - Notification payload
 * @param {string} payload.title - Notification title
 * @param {string} payload.body - Notification body
 * @param {Object} payload.data - Additional data (optional)
 * @param {boolean} includeMobile - Include mobile app tokens (default: true)
 * @returns {Promise<void>}
 */
async function sendNotificationToUser(userId, payload, includeMobile = true) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.warn(`⚠️ User ${userId} not found. Skipping push notification.`);
            return;
        }

        // Collect tokens
        const tokens = [];
        if (user.fcmTokenWeb) tokens.push(user.fcmTokenWeb);
        if (includeMobile && user.fcmTokenApp) tokens.push(user.fcmTokenApp);

        if (tokens.length === 0) {
            console.log(`ℹ️ No FCM tokens for user ${userId}. Skipping push notification.`);
            return;
        }

        // Send notification (non-blocking)
        await sendPushNotification(tokens, payload);
    } catch (error) {
        console.error('❌ Error sending notification to user:', error.message);
        // Don't throw - notifications are non-critical
    }
}

/**
 * Send push notification to a Vendor
 * 
 * @param {string|ObjectId} vendorId - Vendor ID
 * @param {Object} payload - Notification payload
 * @param {boolean} includeMobile - Include mobile app tokens (default: true)
 * @returns {Promise<void>}
 */
async function sendNotificationToVendor(vendorId, payload, includeMobile = true) {
    try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            console.warn(`⚠️ Vendor ${vendorId} not found. Skipping push notification.`);
            return;
        }

        // Collect tokens
        const tokens = [];
        if (vendor.fcmTokenWeb) tokens.push(vendor.fcmTokenWeb);
        if (includeMobile && vendor.fcmTokenApp) tokens.push(vendor.fcmTokenApp);

        if (tokens.length === 0) {
            console.log(`ℹ️ No FCM tokens for vendor ${vendorId}. Skipping push notification.`);
            return;
        }

        // Send notification (non-blocking)
        await sendPushNotification(tokens, payload);
    } catch (error) {
        console.error('❌ Error sending notification to vendor:', error.message);
        // Don't throw - notifications are non-critical
    }
}

/**
 * Send push notification to a Seller
 * 
 * @param {string|ObjectId} sellerId - Seller ID
 * @param {Object} payload - Notification payload
 * @param {boolean} includeMobile - Include mobile app tokens (default: true)
 * @returns {Promise<void>}
 */
async function sendNotificationToSeller(sellerId, payload, includeMobile = true) {
    try {
        const seller = await Seller.findById(sellerId);
        if (!seller) {
            console.warn(`⚠️ Seller ${sellerId} not found. Skipping push notification.`);
            return;
        }

        // Collect tokens
        const tokens = [];
        if (seller.fcmTokenWeb) tokens.push(seller.fcmTokenWeb);
        if (includeMobile && seller.fcmTokenApp) tokens.push(seller.fcmTokenApp);

        if (tokens.length === 0) {
            console.log(`ℹ️ No FCM tokens for seller ${sellerId}. Skipping push notification.`);
            return;
        }

        // Send notification (non-blocking)
        await sendPushNotification(tokens, payload);
    } catch (error) {
        console.error('❌ Error sending notification to seller:', error.message);
        // Don't throw - notifications are non-critical
    }
}

/**
 * Send push notification to multiple users
 * 
 * @param {Array<string|ObjectId>} userIds - Array of user IDs
 * @param {Object} payload - Notification payload
 * @returns {Promise<void>}
 */
async function sendNotificationToMultipleUsers(userIds, payload) {
    try {
        const users = await User.find({ _id: { $in: userIds } });
        const tokens = [];

        users.forEach(user => {
            if (user.fcmTokenWeb) tokens.push(user.fcmTokenWeb);
            if (user.fcmTokenApp) tokens.push(user.fcmTokenApp);
        });

        if (tokens.length === 0) {
            console.log('ℹ️ No FCM tokens found for users. Skipping push notification.');
            return;
        }

        await sendPushNotification(tokens, payload);
    } catch (error) {
        console.error('❌ Error sending notification to multiple users:', error.message);
    }
}

/**
 * Send push notification to all vendors
 * 
 * @param {Object} payload - Notification payload
 * @returns {Promise<void>}
 */
async function sendNotificationToAllVendors(payload) {
    try {
        const vendors = await Vendor.find({ isActive: true, status: 'approved' });
        const tokens = [];

        vendors.forEach(vendor => {
            if (vendor.fcmTokenWeb) tokens.push(vendor.fcmTokenWeb);
            if (vendor.fcmTokenApp) tokens.push(vendor.fcmTokenApp);
        });

        if (tokens.length === 0) {
            console.log('ℹ️ No FCM tokens found for vendors. Skipping push notification.');
            return;
        }

        await sendPushNotification(tokens, payload);
    } catch (error) {
        console.error('❌ Error sending notification to all vendors:', error.message);
    }
}

/**
 * Send push notification to all sellers
 * 
 * @param {Object} payload - Notification payload
 * @returns {Promise<void>}
 */
async function sendNotificationToAllSellers(payload) {
    try {
        const sellers = await Seller.find({ isActive: true, status: 'approved' });
        const tokens = [];

        sellers.forEach(seller => {
            if (seller.fcmTokenWeb) tokens.push(seller.fcmTokenWeb);
            if (seller.fcmTokenApp) tokens.push(seller.fcmTokenApp);
        });

        if (tokens.length === 0) {
            console.log('ℹ️ No FCM tokens found for sellers. Skipping push notification.');
            return;
        }

        await sendPushNotification(tokens, payload);
    } catch (error) {
        console.error('❌ Error sending notification to all sellers:', error.message);
    }
}

module.exports = {
    sendNotificationToUser,
    sendNotificationToVendor,
    sendNotificationToSeller,
    sendNotificationToMultipleUsers,
    sendNotificationToAllVendors,
    sendNotificationToAllSellers,
};
