const mongoose = require('mongoose');
const { IRA_PARTNER_COMMISSION_THRESHOLD } = require('../utils/constants');

/**
 * Commission Schema
 * 
 * Tracks commission payments to Sellers (IRA Partners)
 * Calculated based on referred users' purchases
 * Tiered commission: 2% up to ₹50,000/user/month, 3% above
 */
const commissionSchema = new mongoose.Schema({
  commissionId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: COM-101, COM-102, etc.
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: [true, 'Seller ID is required'],
  },
  sellerIdCode: {
    type: String,
    required: true,
    // IRA Partner ID (e.g., IRA-1001)
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
  },
  // Commission calculation period
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    // Month (1-12)
  },
  year: {
    type: Number,
    required: true,
    // Year (e.g., 2024)
  },
  // Purchase information
  orderAmount: {
    type: Number,
    required: true,
    min: [0, 'Order amount cannot be negative'],
    // Total order amount
  },
  // User's cumulative purchases for this month (before this order)
  cumulativePurchaseAmount: {
    type: Number,
    required: true,
    min: [0, 'Cumulative purchase amount cannot be negative'],
    // User's total purchases in this month before this order
  },
  // User's cumulative purchases after this order
  newCumulativePurchaseAmount: {
    type: Number,
    required: true,
    min: [0, 'New cumulative purchase amount cannot be negative'],
    // User's total purchases in this month after this order
  },
  // Commission rate applied
  commissionRate: {
    type: Number,
    required: true,
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100%'],
    // 2% or 3%
  },
  // Commission amount
  commissionAmount: {
    type: Number,
    required: true,
    min: [0, 'Commission amount cannot be negative'],
    // Calculated commission for this order
  },
  // Commission status
  status: {
    type: String,
    enum: ['pending', 'credited', 'cancelled'],
    default: 'credited',
    // Usually credited immediately when order is completed
  },
  // Credited to wallet
  creditedAt: {
    type: Date,
    default: Date.now,
  },
  // Notes
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
commissionSchema.index({ sellerId: 1, month: 1, year: 1 }); // Seller's commissions by month
commissionSchema.index({ userId: 1, month: 1, year: 1 }); // User's commissions by month
commissionSchema.index({ orderId: 1 }); // Order's commission
commissionSchema.index({ sellerId: 1, createdAt: -1 }); // Seller's commission history
commissionSchema.index({ sellerId: 1, userId: 1, month: 1, year: 1 }); // Commission per user per month
// Note: commissionId already has an index from unique: true

// Instance method: Check if commission is for threshold month
commissionSchema.methods.isThresholdMonth = function () {
  return this.newCumulativePurchaseAmount > IRA_PARTNER_COMMISSION_THRESHOLD &&
         this.cumulativePurchaseAmount <= IRA_PARTNER_COMMISSION_THRESHOLD;
};

const Commission = mongoose.model('Commission', commissionSchema);

module.exports = Commission;

