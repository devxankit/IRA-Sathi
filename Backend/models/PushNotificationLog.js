const mongoose = require('mongoose');

/**
 * PushNotificationLog
 *
 * Tracks every admin-initiated broadcast push notification.
 * Additive model — does not affect any existing models or logic.
 */
const pushNotificationLogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    targetAudience: {
        type: String,
        required: true,
        // 'all' | 'users' | 'vendors' | 'sellers'
    },
    priority: {
        type: String,
        default: 'normal',
    },
    imageUrl: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ['pending', 'delivered', 'failed'],
        default: 'pending',
    },
    sentAt: {
        type: Date,
        default: Date.now,
    },
    deliveredCount: {
        type: Number,
        default: 0,
    },
    failedCount: {
        type: Number,
        default: 0,
    },
    openedCount: {
        type: Number,
        default: 0,
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
    },
    // Raw Firebase response stored for debugging
    firebaseResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('PushNotificationLog', pushNotificationLogSchema);
