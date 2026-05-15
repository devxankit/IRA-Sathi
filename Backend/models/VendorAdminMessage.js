const mongoose = require('mongoose');

/**
 * Vendor Admin Message Schema
 * 
 * Text-based communication between Vendors and Admin
 * Used for requests, queries, and other non-standard workflow communications
 */
const vendorAdminMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    // Format: MSG-YYYYMMDD-XXXX (e.g., MSG-20240115-0001)
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
  },
  // Message direction
  direction: {
    type: String,
    enum: ['vendor_to_admin', 'admin_to_vendor'],
    required: true,
  },
  // Message subject/title
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters'],
  },
  // Message content
  message: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters'],
  },
  // Message category/type
  category: {
    type: String,
    enum: ['general', 'inventory', 'credit', 'order', 'payment', 'other'],
    default: 'general',
    // Categorize messages for better organization
  },
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  // Message status
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
  },
  // Read status
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
    // When the recipient read the message
  },
  readBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    // Admin who read the message (if direction is vendor_to_admin)
  },
  // Response/reply information
  repliedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorAdminMessage',
    // If this is a reply to another message
  },
  replyCount: {
    type: Number,
    default: 0,
    // Number of replies to this message
  },
  // Admin information (if admin sent the message)
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    // Admin who sent the message (if direction is admin_to_vendor)
  },
  // Resolution information
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  resolutionNote: {
    type: String,
    trim: true,
  },
  // Related references (optional)
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  relatedCreditPurchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreditPurchase',
  },
  // Attachments (for future use)
  attachments: [{
    url: String,
    fileName: String,
    fileType: String,
    fileSize: Number, // in bytes
  }],
  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
  }],
  // Notes
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
vendorAdminMessageSchema.index({ vendorId: 1, createdAt: -1 }); // Vendor's messages
vendorAdminMessageSchema.index({ direction: 1, status: 1, createdAt: -1 }); // Messages by direction and status
vendorAdminMessageSchema.index({ status: 1, isRead: 1, createdAt: -1 }); // Unread messages for admin
// Note: messageId already has an index from unique: true
vendorAdminMessageSchema.index({ category: 1, createdAt: -1 }); // Messages by category
vendorAdminMessageSchema.index({ priority: 1, status: 1 }); // High priority open messages

// Pre-save hook: Generate message ID
vendorAdminMessageSchema.pre('save', async function (next) {
  if (!this.messageId && this.isNew) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    
    // Find count of messages created today
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);
    
    const MessageModel = mongoose.models.VendorAdminMessage || mongoose.model('VendorAdminMessage', vendorAdminMessageSchema);
    const todayCount = await MessageModel.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    
    const sequence = String(todayCount + 1).padStart(4, '0');
    this.messageId = `MSG-${dateStr}-${sequence}`;
  }
  next();
});

// Instance method: Check if message is open
vendorAdminMessageSchema.methods.isOpen = function () {
  return this.status === 'open' || this.status === 'in_progress';
};

// Instance method: Check if message is resolved
vendorAdminMessageSchema.methods.isResolved = function () {
  return this.status === 'resolved' || this.status === 'closed';
};

// Instance method: Mark as read
vendorAdminMessageSchema.methods.markAsRead = function (readBy = null) {
  this.isRead = true;
  this.readAt = new Date();
  if (readBy) {
    this.readBy = readBy;
  }
};

// Instance method: Mark as resolved
vendorAdminMessageSchema.methods.markAsResolved = function (resolvedBy, resolutionNote = '') {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  if (resolutionNote) {
    this.resolutionNote = resolutionNote;
  }
};

const VendorAdminMessage = mongoose.model('VendorAdminMessage', vendorAdminMessageSchema);

module.exports = VendorAdminMessage;

