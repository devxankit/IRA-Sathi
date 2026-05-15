const mongoose = require('mongoose');

/**
 * Vendor Earning Schema
 * 
 * Tracks vendor earnings from price differences (User Price - Vendor Price)
 * Earnings accumulate per order item
 */
const vendorEarningSchema = new mongoose.Schema({
  earningId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: VNE-101, VNE-102, etc.
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
  },
  productName: {
    type: String,
    required: true,
    // Store product name for historical records
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  userPrice: {
    type: Number,
    required: true,
    min: [0, 'User price cannot be negative'],
    // Price paid by user (per unit)
  },
  vendorPrice: {
    type: Number,
    required: true,
    min: [0, 'Vendor price cannot be negative'],
    // Price vendor paid to admin (per unit)
  },
  earnings: {
    type: Number,
    required: true,
    min: [0, 'Earnings cannot be negative'],
    // (userPrice - vendorPrice) * quantity
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'withdrawn'],
    default: 'processed',
    // Usually processed immediately when order is completed
  },
  processedAt: {
    type: Date,
    default: Date.now,
  },
  withdrawnAt: {
    type: Date,
    // When this earning was withdrawn
  },
  withdrawalRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalRequest',
    // Reference to withdrawal request that used this earning
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
vendorEarningSchema.index({ vendorId: 1, createdAt: -1 }); // Vendor's earnings history
vendorEarningSchema.index({ orderId: 1 }); // Order's earnings
vendorEarningSchema.index({ vendorId: 1, status: 1 }); // Vendor's earnings by status
vendorEarningSchema.index({ vendorId: 1, processedAt: -1 }); // Vendor's earnings by processing date
// Note: earningId already has an index from unique: true

const VendorEarning = mongoose.model('VendorEarning', vendorEarningSchema);

module.exports = VendorEarning;

