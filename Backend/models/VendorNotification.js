const mongoose = require('mongoose');

/**
 * Vendor Notification Schema
 * 
 * Vendor-specific notifications for orders, stock, repayments, etc.
 * Auto-deletes after 24 hours
 */
const vendorNotificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: VNOT-101, VNOT-102, etc.
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
  },
  type: {
    type: String,
    enum: [
      'order_assigned',
      'order_status_changed',
      'stock_arrival',
      'stock_low_alert',
      'credit_purchase_approved',
      'credit_purchase_rejected',
      'repayment_due_reminder',
      'repayment_overdue_alert',
      'repayment_success',
      'withdrawal_approved',
      'withdrawal_rejected',
      'admin_announcement',
      'system_alert',
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
  // Reference to related entity (order, purchase, repayment, etc.)
  relatedEntityType: {
    type: String,
    enum: ['order', 'credit_purchase', 'repayment', 'withdrawal', 'stock', 'none'],
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    // Polymorphic reference - can reference Order, CreditPurchase, etc.
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
    // Store additional data like customer name, amount, etc.
  },
  // Auto-delete after 24 hours
  expiresAt: {
    type: Date,
    required: true,
    // Default to 24 hours from creation
    default: function () {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    },
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
vendorNotificationSchema.index({ vendorId: 1, read: 1, createdAt: -1 }); // Get unread notifications
vendorNotificationSchema.index({ vendorId: 1, createdAt: -1 }); // Get all notifications by vendor
vendorNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired notifications
vendorNotificationSchema.index({ type: 1, createdAt: -1 }); // Get notifications by type
// Note: notificationId already has an index from unique: true

// Pre-save hook: Set expiresAt to 24 hours from now if not set
vendorNotificationSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  next();
});

// Static method: Clean up expired notifications (older than 24 hours)
vendorNotificationSchema.statics.cleanupExpired = async function () {
  const now = new Date();
  const result = await this.deleteMany({ expiresAt: { $lt: now } });
  return result;
};

// Static method: Create notification for vendor
vendorNotificationSchema.statics.createNotification = async function (data) {
  const {
    vendorId,
    type,
    title,
    message,
    relatedEntityType = 'none',
    relatedEntityId = null,
    priority = 'normal',
    metadata = {},
  } = data;

  const notification = await this.create({
    vendorId,
    type,
    title,
    message,
    relatedEntityType,
    relatedEntityId,
    priority,
    metadata,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  });

  // Send push notification (non-blocking)
  try {
    const { sendNotificationToVendor } = require('../services/pushNotificationService');

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
    sendNotificationToVendor(vendorId, pushPayload).catch(err => {
      console.error('Push notification failed (non-critical):', err.message);
    });
  } catch (error) {
    // Log but don't throw - push notifications are non-critical
    console.error('Error triggering push notification:', error.message);
  }

  return notification;
};

// Instance method: Mark as read
vendorNotificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

const VendorNotification = mongoose.model('VendorNotification', vendorNotificationSchema);

module.exports = VendorNotification;



