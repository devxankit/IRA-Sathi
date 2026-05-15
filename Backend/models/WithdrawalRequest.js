const mongoose = require('mongoose');

/**
 * Withdrawal Request Schema
 * 
 * Vendors and Sellers can request withdrawals from their earnings/wallet balance
 * Admin approves/rejects these requests
 * When approved, vendor/seller balance is decreased
 */
const withdrawalRequestSchema = new mongoose.Schema({
  withdrawalId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: WDR-101, WDR-102, etc.
  },
  // User type: 'vendor' or 'seller'
  userType: {
    type: String,
    enum: ['vendor', 'seller'],
    required: [true, 'User type is required'],
  },
  // Vendor or Seller ID (one must be provided based on userType)
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    // Required if userType is 'vendor'
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    // Required if userType is 'seller'
  },
  amount: {
    type: Number,
    required: [true, 'Withdrawal amount is required'],
    min: [100, 'Minimum withdrawal amount is ₹100'],
  },
  availableBalance: {
    type: Number,
    required: true,
    min: [0, 'Available balance cannot be negative'],
    // Balance at time of request
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    // Reference to bank account used for withdrawal
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  // Admin actions
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  reviewedAt: Date,
  adminRemarks: {
    type: String,
    trim: true,
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  // Payment processing details
  paymentReference: {
    type: String,
    trim: true,
    // Payment reference number after processing
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'cash', 'razorpay', 'other'],
    default: 'bank_transfer',
  },
  paymentDate: Date,
  processedAt: Date,
  // Razorpay payment gateway details
  gatewayPaymentId: {
    type: String,
    trim: true,
  },
  gatewayOrderId: {
    type: String,
    trim: true,
  },
  gatewaySignature: {
    type: String,
    trim: true,
  },
  // Notes
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Validation: Ensure either vendorId or sellerId is provided based on userType
withdrawalRequestSchema.pre('validate', function (next) {
  if (this.userType === 'vendor' && !this.vendorId) {
    return next(new Error('Vendor ID is required when userType is vendor'));
  }
  if (this.userType === 'seller' && !this.sellerId) {
    return next(new Error('Seller ID is required when userType is seller'));
  }
  if (this.userType === 'vendor' && this.sellerId) {
    return next(new Error('Cannot have sellerId when userType is vendor'));
  }
  if (this.userType === 'seller' && this.vendorId) {
    return next(new Error('Cannot have vendorId when userType is seller'));
  }
  next();
});

// Indexes
withdrawalRequestSchema.index({ vendorId: 1, status: 1 }); // Vendor's withdrawals by status
withdrawalRequestSchema.index({ sellerId: 1, status: 1 }); // Seller's withdrawals by status
withdrawalRequestSchema.index({ userType: 1, status: 1, createdAt: -1 }); // Withdrawals by type and status
withdrawalRequestSchema.index({ status: 1, createdAt: -1 }); // Pending withdrawals for admin
// Note: withdrawalId already has an index from unique: true

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

module.exports = WithdrawalRequest;

