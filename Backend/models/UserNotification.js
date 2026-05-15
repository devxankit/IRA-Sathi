const mongoose = require('mongoose');

/**
 * User Notification Schema
 * 
 * User-specific notifications for orders, platform updates, etc.
 * Auto-deletes after 7 days (users may check less frequently than vendors)
 */
const userNotificationSchema = new mongoose.Schema({
    notificationId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true,
        // Format: UNOT-101, UNOT-102, etc.
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    type: {
        type: String,
        enum: [
            'order_placed',
            'order_accepted',
            'order_dispatched',
            'order_delivered',
            'order_cancelled',
            'payment_received',
            'payment_reminder',
            'refund_processed',
            'admin_announcement',
            'system_alert',
            'promotional',
        ],
        required: [true, 'Notification type is required'],
    },
    title: {
        type: String,
        required: [true, 'Notification title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
        type: String,
        required: [true, 'Notification message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    // Reference to related entity (order, payment, etc.)
    relatedEntityType: {
        type: String,
        enum: ['order', 'payment', 'refund', 'none'],
    },
    relatedEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        // Polymorphic reference - can reference Order, Payment, etc.
    },
    // Read status
    read: {
        type: Boolean,
        default: false,
    },
    readAt: {
        type: Date,
    },
    // Priority level
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
    },
    // Additional data/metadata
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        // Store additional data like order number, amount, etc.
    },
    // Auto-delete after 7 days (users check less frequently)
    expiresAt: {
        type: Date,
        required: true,
        default: function () {
            return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        },
    },
}, {
    timestamps: true,
});

// Indexes for efficient queries
userNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 }); // Get unread notifications
userNotificationSchema.index({ userId: 1, createdAt: -1 }); // Get all notifications by user
userNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired notifications
userNotificationSchema.index({ type: 1, createdAt: -1 }); // Get notifications by type

// Pre-save hook: Set expiresAt to 7 days from now if not set
userNotificationSchema.pre('save', function (next) {
    if (!this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
    next();
});

// Static method: Clean up expired notifications
userNotificationSchema.statics.cleanupExpired = async function () {
    const now = new Date();
    const result = await this.deleteMany({ expiresAt: { $lt: now } });
    return result;
};

// Static method: Create notification for user
userNotificationSchema.statics.createNotification = async function (data) {
    const {
        userId,
        type,
        title,
        message,
        relatedEntityType = 'none',
        relatedEntityId = null,
        priority = 'normal',
        metadata = {},
    } = data;

    const notification = await this.create({
        userId,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId,
        priority,
        metadata,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    // Send push notification (non-blocking)
    try {
        const { sendNotificationToUser } = require('../services/pushNotificationService');

        // Prepare push notification payload
        const pushPayload = {
            title,
            body: message,
            data: {
                type,
                notificationId: notification._id.toString(),
                priority,
                ...(relatedEntityId && { relatedEntityId: relatedEntityId.toString() }),
                ...(relatedEntityType && { relatedEntityType }),
                ...(metadata && Object.keys(metadata).length > 0 && { metadata: JSON.stringify(metadata) }),
            },
        };

        // Send push notification asynchronously (don't await to avoid blocking)
        sendNotificationToUser(userId, pushPayload).catch(err => {
            console.error('Push notification failed (non-critical):', err.message);
        });
    } catch (error) {
        // Log but don't throw - push notifications are non-critical
        console.error('Error triggering push notification:', error.message);
    }

    return notification;
};

// Static method: Create order status notification
userNotificationSchema.statics.createOrderStatusNotification = async function (userId, order, newStatus) {
    const statusMessages = {
        accepted: {
            title: 'Order Accepted! 🎉',
            message: `Your order #${order.orderNumber} has been accepted by the vendor and is being prepared.`,
        },
        dispatched: {
            title: 'Order Dispatched! 🚚',
            message: `Your order #${order.orderNumber} is on its way! Track your delivery.`,
        },
        delivered: {
            title: 'Order Delivered! ✅',
            message: `Your order #${order.orderNumber} has been delivered. Thank you for your purchase!`,
        },
        cancelled: {
            title: 'Order Cancelled',
            message: `Your order #${order.orderNumber} has been cancelled. Refund will be processed if applicable.`,
        },
        fully_paid: {
            title: 'Payment Completed! 💰',
            message: `Full payment received for order #${order.orderNumber}. Thank you!`,
        },
    };

    const normalizedStatus = newStatus.toLowerCase().replace(' ', '_');
    const statusInfo = statusMessages[normalizedStatus];

    if (!statusInfo) {
        return null; // Don't create notification for unknown status
    }

    return this.createNotification({
        userId,
        type: `order_${normalizedStatus}`,
        title: statusInfo.title,
        message: statusInfo.message,
        relatedEntityType: 'order',
        relatedEntityId: order._id,
        priority: normalizedStatus === 'cancelled' ? 'high' : 'normal',
        metadata: {
            orderNumber: order.orderNumber,
            orderStatus: newStatus,
            totalAmount: order.totalAmount,
        },
    });
};

// Instance method: Mark as read
userNotificationSchema.methods.markAsRead = async function () {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

const UserNotification = mongoose.model('UserNotification', userNotificationSchema);

module.exports = UserNotification;
