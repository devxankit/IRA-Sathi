/**
 * Phone Validation Utilities for Backend
 * Handles cross-role phone number validation and special bypass numbers
 */

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Seller = require('../models/Seller');

// Special bypass phone number for testing
const SPECIAL_BYPASS_NUMBER = '+919999999999';
const SPECIAL_BYPASS_OTP = '123456';

/**
 * Check if a phone number is a special bypass number
 * @param {string} phone - Phone number to check
 * @returns {boolean}
 */
function isSpecialBypassNumber(phone) {
    if (!phone) return false;

    // Normalize phone number for comparison
    const normalized = phone.replace(/\s/g, '');
    return normalized === SPECIAL_BYPASS_NUMBER ||
        normalized === '9999999999' ||
        normalized === '919999999999';
}

/**
 * Check if a phone number exists in any role
 * @param {string} phone - Phone number to check
 * @param {string} excludeRole - Role to exclude from check ('user', 'vendor', 'seller')
 * @returns {Promise<{exists: boolean, role: string|null, message: string}>}
 */
async function checkPhoneExists(phone, excludeRole = null) {
    try {
        // Check in User collection
        if (excludeRole !== 'user') {
            const user = await User.findOne({ phone });
            if (user) {
                return {
                    exists: true,
                    role: 'user',
                    message: 'This phone number is already registered as a user. Please use a different number or login as a user.',
                };
            }
        }

        // Check in Vendor collection
        if (excludeRole !== 'vendor') {
            const vendor = await Vendor.findOne({ phone });
            if (vendor) {
                return {
                    exists: true,
                    role: 'vendor',
                    message: 'This phone number is already registered as a vendor. Please use a different number or login as a vendor.',
                };
            }
        }

        // Check in Seller collection
        if (excludeRole !== 'seller') {
            const seller = await Seller.findOne({ phone });
            if (seller) {
                return {
                    exists: true,
                    role: 'seller',
                    message: 'This phone number is already registered as a seller. Please use a different number or login as a seller.',
                };
            }
        }

        return {
            exists: false,
            role: null,
            message: '',
        };
    } catch (error) {
        console.error('Error checking phone existence:', error);
        throw error;
    }
}

/**
 * Check if a phone number exists in a specific role
 * @param {string} phone - Phone number to check
 * @param {string} role - Role to check ('user', 'vendor', 'seller')
 * @returns {Promise<{exists: boolean, data: any}>}
 */
async function checkPhoneInRole(phone, role) {
    try {
        let data = null;

        switch (role) {
            case 'user':
                data = await User.findOne({ phone });
                break;
            case 'vendor':
                data = await Vendor.findOne({ phone });
                break;
            case 'seller':
                data = await Seller.findOne({ phone });
                break;
            default:
                throw new Error(`Invalid role: ${role}`);
        }

        return {
            exists: !!data,
            data: data,
        };
    } catch (error) {
        console.error('Error checking phone in role:', error);
        throw error;
    }
}

module.exports = {
    checkPhoneExists,
    checkPhoneInRole,
    isSpecialBypassNumber,
    SPECIAL_BYPASS_OTP,
    SPECIAL_BYPASS_NUMBER,
};
