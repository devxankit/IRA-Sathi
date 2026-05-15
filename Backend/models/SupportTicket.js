const mongoose = require('mongoose');

/**
 * Support Ticket Schema
 * 
 * Users and Sellers can create support tickets
 * Admin can view, reply, and manage tickets
 * Supports threaded messages for conversation
 */
const supportTicketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true,
        // Format: TKT-101, TKT-102, etc.
    },
    // User type: 'user' or 'seller'
    userType: {
        type: String,
        enum: ['user', 'seller'],
        required: [true, 'User type is required'],
    },
    // User or Seller ID (one must be provided based on userType)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Required if userType is 'user'
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        // Required if userType is 'seller'
    },
    // Ticket details
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true,
        maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
        type: String,
        enum: ['order', 'payment', 'delivery', 'product', 'commission', 'withdrawal', 'account', 'general', 'other'],
        default: 'general',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open',
    },
    // Related order (optional)
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
    },
    orderNumber: {
        type: String,
        trim: true,
        // Store order number for easy reference
    },
    // Conversation thread
    messages: [{
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'messages.senderType',
        },
        senderType: {
            type: String,
            enum: ['User', 'Seller', 'Admin'],
            required: true,
        },
        senderName: {
            type: String,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
        },
        isFromAdmin: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        readAt: {
            type: Date,
            // When the message was read by the recipient
        },
    }],
    // Admin handling
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    assignedToName: {
        type: String,
        trim: true,
    },
    assignedAt: Date,
    // Resolution details
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    resolution: {
        type: String,
        trim: true,
        maxlength: [1000, 'Resolution cannot exceed 1000 characters'],
    },
    closedAt: Date,
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    // Last activity tracking
    lastActivityAt: {
        type: Date,
        default: Date.now,
    },
    lastActivityBy: {
        type: String,
        enum: ['user', 'seller', 'admin'],
    },
    // Read status
    unreadByAdmin: {
        type: Boolean,
        default: true,
    },
    unreadByUser: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Validation: Ensure either userId or sellerId is provided based on userType
supportTicketSchema.pre('validate', function (next) {
    if (this.userType === 'user' && !this.userId) {
        return next(new Error('User ID is required when userType is user'));
    }
    if (this.userType === 'seller' && !this.sellerId) {
        return next(new Error('Seller ID is required when userType is seller'));
    }
    if (this.userType === 'user' && this.sellerId) {
        return next(new Error('Cannot have sellerId when userType is user'));
    }
    if (this.userType === 'seller' && this.userId) {
        return next(new Error('Cannot have userId when userType is seller'));
    }
    next();
});

// Pre-save hook: Auto-generate ticketId
supportTicketSchema.pre('save', async function (next) {
    if (!this.ticketId && this.isNew) {
        try {
            const SupportTicketModel = this.constructor;
            const count = await SupportTicketModel.countDocuments();
            this.ticketId = `TKT-${String(count + 101).padStart(3, '0')}`;
        } catch (error) {
            // Fallback: generate with timestamp
            const timestamp = Date.now().toString().slice(-6);
            this.ticketId = `TKT-${timestamp}`;
        }
    }

    // Update lastActivityAt on any save
    this.lastActivityAt = new Date();

    next();
});

// Indexes
supportTicketSchema.index({ userId: 1, status: 1, createdAt: -1 }); // User's tickets
supportTicketSchema.index({ sellerId: 1, status: 1, createdAt: -1 }); // Seller's tickets
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 }); // Admin queue
supportTicketSchema.index({ assignedTo: 1, status: 1 }); // Admin's assigned tickets
supportTicketSchema.index({ userType: 1, status: 1 }); // Filter by user type
supportTicketSchema.index({ unreadByAdmin: 1, status: 1 }); // Unread tickets for admin
// Note: ticketId already has an index from unique: true

// Static method: Get ticket stats for admin dashboard
supportTicketSchema.statics.getStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ]);

    const result = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        total: 0,
    };

    stats.forEach(s => {
        result[s._id] = s.count;
        result.total += s.count;
    });

    return result;
};

// Instance method: Add message to conversation
supportTicketSchema.methods.addMessage = function (senderId, senderType, senderName, message, isFromAdmin = false) {
    this.messages.push({
        senderId,
        senderType,
        senderName,
        message,
        isFromAdmin,
        createdAt: new Date(),
    });

    // Update read status
    if (isFromAdmin) {
        this.unreadByUser = true;
        this.unreadByAdmin = false;
        this.lastActivityBy = 'admin';
    } else {
        this.unreadByAdmin = true;
        this.unreadByUser = false;
        this.lastActivityBy = this.userType;
    }

    this.lastActivityAt = new Date();

    return this;
};

// Instance method: Mark as read by user/seller
supportTicketSchema.methods.markReadByUser = function () {
    this.unreadByUser = false;
    // Mark all admin messages as read
    this.messages.forEach(msg => {
        if (msg.isFromAdmin && !msg.readAt) {
            msg.readAt = new Date();
        }
    });
    return this;
};

// Instance method: Mark as read by admin
supportTicketSchema.methods.markReadByAdmin = function () {
    this.unreadByAdmin = false;
    // Mark all user messages as read
    this.messages.forEach(msg => {
        if (!msg.isFromAdmin && !msg.readAt) {
            msg.readAt = new Date();
        }
    });
    return this;
};

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
