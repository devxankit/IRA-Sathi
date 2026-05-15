import { messaging, getToken, onMessage } from './firebaseConfig';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BLF3bmNcDzy1MlyRQS30xMiSpDVS33jJE74TP83qFpuQ1rHrHL1fXxHUBsKRyaMfEVHto61CCERq25pu8dEO2rk';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Push Notification Service
 */

/**
 * Request notification permission from the user
 * @returns {Promise<boolean>}
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.error('This browser does not support desktop notification');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Notification permission granted.');
            return true;
        } else {
            console.warn('❌ Notification permission denied.');
            return false;
        }
    } catch (error) {
        console.error('❌ Error requesting notification permission:', error);
        return false;
    }
}

/**
 * Get FCM Token
 * Explicitly registers the service worker first for robustness.
 * @returns {Promise<string|null>}
 */
export async function getFCMToken() {
    try {
        let swRegistration;
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            } catch (swErr) {
                console.warn('Service worker registration failed, proceeding without it:', swErr);
            }
        }

        const tokenOptions = { vapidKey: VAPID_KEY };
        if (swRegistration) {
            tokenOptions.serviceWorkerRegistration = swRegistration;
        }

        const token = await getToken(messaging, tokenOptions);

        if (token) {
            return token;
        } else {
            console.warn('❌ No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (error) {
        console.error('❌ An error occurred while retrieving token:', error);
        return null;
    }
}

/**
 * Register FCM Token with backend
 * @param {string} userType - 'user', 'vendor', or 'seller'
 * @returns {Promise<boolean>}
 */
export async function registerFCMTokenWithBackend(userType) {
    try {
        // 1. Request permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) return false;

        // 2. Get the token
        const token = await getFCMToken();
        if (!token) return false;

        // 3. Get the auth token based on userType
        let authToken;
        switch (userType) {
            case 'user':
                authToken = localStorage.getItem('user_token');
                break;
            case 'vendor':
                authToken = localStorage.getItem('vendor_token');
                break;
            case 'seller':
                authToken = localStorage.getItem('seller_token');
                break;
            default:
                console.error('Invalid user type for FCM registration');
                return false;
        }

        if (!authToken) {
            console.warn(`No auth token found for ${userType}. FCM registration skipped.`);
            return false;
        }

        // 4. Send to backend
        const response = await fetch(`${API_BASE_URL}/fcm/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                token,
                platform: 'web'
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log(`✅ FCM token registered successfully for ${userType}`);
            // Store in localStorage to avoid redundant registrations
            localStorage.setItem(`fcm_token_registered_${userType}`, token);
            return true;
        } else {
            console.error(`❌ FCM registration failed: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error in registerFCMTokenWithBackend:', error);
        return false;
    }
}

/**
 * Setup foreground notification handler
 * @param {function} callback - Function to call when a message is received
 */
export function setupForegroundHandler(callback) {
    onMessage(messaging, (payload) => {
        console.log('📬 Foreground message received: ', payload);
        if (callback) {
            callback(payload);
        }
    });
}

/**
 * Initialize Push Notifications for current session
 * Called on app load if user is logged in
 */
export async function initializePushNotifications() {
    // Check which user Type is logged in
    const userToken = localStorage.getItem('user_token');
    const vendorToken = localStorage.getItem('vendor_token');
    const sellerToken = localStorage.getItem('seller_token');

    if (userToken) {
        await registerFCMTokenWithBackend('user');
    } else if (vendorToken) {
        await registerFCMTokenWithBackend('vendor');
    } else if (sellerToken) {
        await registerFCMTokenWithBackend('seller');
    }
}

/**
 * Remove FCM Token from backend on logout
 * Fire-and-forget — errors are silently swallowed so logout is never blocked.
 * @param {string} userType - 'user', 'vendor', or 'seller'
 */
export async function removeFCMTokenFromBackend(userType) {
    try {
        let authToken;
        switch (userType) {
            case 'user':
                authToken = localStorage.getItem('user_token');
                break;
            case 'vendor':
                authToken = localStorage.getItem('vendor_token');
                break;
            case 'seller':
                authToken = localStorage.getItem('seller_token');
                break;
            default:
                return;
        }

        if (!authToken) return;

        // Also clear the cached registration flag
        localStorage.removeItem(`fcm_token_registered_${userType}`);

        await fetch(`${API_BASE_URL}/fcm/remove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ platform: 'web' }),
        });
    } catch (err) {
        // Silently swallow — logout must never be blocked by FCM cleanup
        console.warn('FCM token removal on logout failed (non-critical):', err.message);
    }
}
