const admin = require('firebase-admin');
const path = require('path');

/**
 * Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin for sending push notifications via FCM
 * Uses service account credentials from config directory
 */

let firebaseInitialized = false;

function initializeFirebaseAdmin() {
    if (firebaseInitialized) {
        return admin;
    }

    try {
        // Path to service account JSON file
        const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
        const serviceAccount = require(serviceAccountPath);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error.message);
        // Don't throw - allow app to continue without push notifications
    }

    return admin;
}

/**
 * Send push notification to multiple FCM tokens
 * 
 * @param {Array<string>} tokens - Array of FCM tokens
 * @param {Object} payload - Notification payload
 * @param {string} payload.title - Notification title
 * @param {string} payload.body - Notification body
 * @param {Object} payload.data - Additional data (optional)
 * @returns {Promise<Object>} - Response with success/failure counts
 */
async function sendPushNotification(tokens, payload) {
    if (!firebaseInitialized) {
        console.warn('⚠️ Firebase Admin not initialized. Skipping push notification.');
        return { successCount: 0, failureCount: 0 };
    }

    if (!tokens || tokens.length === 0) {
        console.log('ℹ️ No FCM tokens provided. Skipping push notification.');
        return { successCount: 0, failureCount: 0 };
    }

    // Filter out null/undefined tokens
    const validTokens = tokens.filter(token => token && typeof token === 'string' && token.trim().length > 0);

    if (validTokens.length === 0) {
        console.log('ℹ️ No valid FCM tokens. Skipping push notification.');
        return { successCount: 0, failureCount: 0 };
    }

    try {
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: validTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`✅ Push notification sent: ${response.successCount} success, ${response.failureCount} failed`);

        // Log failures for debugging
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`❌ Failed to send to token ${idx}:`, resp.error?.message);
                }
            });
        }

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses,
        };
    } catch (error) {
        console.error('❌ Error sending push notification:', error.message);
        return { successCount: 0, failureCount: validTokens.length, error: error.message };
    }
}

/**
 * Send push notification to a single token
 * 
 * @param {string} token - FCM token
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - Response
 */
async function sendPushNotificationToToken(token, payload) {
    return sendPushNotification([token], payload);
}

module.exports = {
    initializeFirebaseAdmin,
    sendPushNotification,
    sendPushNotificationToToken,
};
