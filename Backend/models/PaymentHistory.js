const mongoose = require('mongoose');

/**
 * Payment History Schema
 * 
 * Tracks all payment-related activities for admin audit and history:
 * - User payments (advance, remaining)
 * - Vendor earnings (from orders)
 * - Seller commissions (from orders)
 * - Withdrawal requests (vendor and seller)
 * - Bank account operations
 */
const paymentHistorySchema = new mongoose.Schema({
  historyId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: PH-101, PH-102, etc.
  },
  // Activity type
  activityType: {
    type: String,
    required: [true, 'Activity type is required'],
    enum: [
      'user_payment_advance',      // User paid advance payment
      'user_payment_remaining',     // User paid remaining payment
      'vendor_earning_credited',   // Vendor earning credited from order
      'seller_commission_credited', // Seller commission credited from order
      'vendor_withdrawal_requested',  // Vendor requested withdrawal (alias: vendor_withdrawal_request)
      'vendor_withdrawal_approved', // Vendor withdrawal approved
      'vendor_withdrawal_rejected', // Vendor withdrawal rejected
      'vendor_withdrawal_completed', // Vendor withdrawal completed
      'seller_withdrawal_requested',  // Seller requested withdrawal (alias: seller_withdrawal_request)
      'seller_withdrawal_approved', // Seller withdrawal approved
      'seller_withdrawal_rejected', // Seller withdrawal rejected
      'seller_withdrawal_completed', // Seller withdrawal completed
      'vendor_credit_repayment',    // Vendor credit repayment to admin
      'bank_account_added',         // Bank account added
      'bank_account_updated',       // Bank account updated
      'bank_account_deleted',       // Bank account deleted
    ],
  },
  
  // Related entities
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Optional - only for user payments
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    // Optional - only for vendor-related activities
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    // Optional - only for seller-related activities
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    // Optional - only for order-related activities
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    // Optional - only for payment-related activities
  },
  withdrawalRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalRequest',
    // Optional - only for withdrawal-related activities
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    // Optional - only for bank account operations
  },
  vendorEarningId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorEarning',
    // Optional - only for vendor earnings
  },
  commissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commission',
    // Optional - only for seller commissions
  },
  
  // Amount information
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    default: 'INR',
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'rejected', 'credited', 'requested', 'approved'],
    default: 'completed',
  },
  
  // Payment method (for user payments)
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash', 'bank_transfer', 'upi', 'other'],
    // Optional
  },
  
  // Bank account details (for withdrawals)
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    // Store additional context like order number, vendor name, etc.
  },
  
  // Description/notes
  description: {
    type: String,
    trim: true,
  },
  
  // Admin who processed (for withdrawals)
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    // Optional - only for admin-processed activities
  },
  
  // Timestamps
  processedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
paymentHistorySchema.index({ activityType: 1, createdAt: -1 });
paymentHistorySchema.index({ userId: 1, createdAt: -1 });
paymentHistorySchema.index({ vendorId: 1, createdAt: -1 });
paymentHistorySchema.index({ sellerId: 1, createdAt: -1 });
paymentHistorySchema.index({ orderId: 1 });
paymentHistorySchema.index({ withdrawalRequestId: 1 });
paymentHistorySchema.index({ createdAt: -1 }); // For admin history view
// Note: historyId already has an index from unique: true

// Virtual for formatted activity description
paymentHistorySchema.virtual('formattedDescription').get(function() {
  if (this.description) return this.description;
  
  const typeMap = {
    'user_payment_advance': `User paid advance payment of ₹${this.amount}`,
    'user_payment_remaining': `User paid remaining payment of ₹${this.amount}`,
    'vendor_earning_credited': `Vendor earning of ₹${this.amount} credited`,
    'seller_commission_credited': `Seller commission of ₹${this.amount} credited`,
    'vendor_withdrawal_requested': `Vendor requested withdrawal of ₹${this.amount}`,
    'vendor_withdrawal_approved': `Vendor withdrawal of ₹${this.amount} approved`,
    'vendor_withdrawal_rejected': `Vendor withdrawal of ₹${this.amount} rejected`,
    'vendor_withdrawal_completed': `Vendor withdrawal of ₹${this.amount} completed`,
    'seller_withdrawal_requested': `Seller requested withdrawal of ₹${this.amount}`,
    'seller_withdrawal_approved': `Seller withdrawal of ₹${this.amount} approved`,
    'seller_withdrawal_rejected': `Seller withdrawal of ₹${this.amount} rejected`,
    'seller_withdrawal_completed': `Seller withdrawal of ₹${this.amount} completed`,
    'bank_account_added': 'Bank account added',
    'bank_account_updated': 'Bank account updated',
    'bank_account_deleted': 'Bank account deleted',
  };
  
  return typeMap[this.activityType] || 'Payment activity';
});

const PaymentHistory = mongoose.model('PaymentHistory', paymentHistorySchema);

module.exports = PaymentHistory;

