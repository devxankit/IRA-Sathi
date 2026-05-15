const mongoose = require('mongoose');

/**
 * Credit Repayment Schema
 * 
 * Tracks vendor credit repayments
 * Used to record payments made by vendors to repay their credit balance
 */
const creditRepaymentSchema = new mongoose.Schema({
  repaymentId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    // Format: REP-YYYYMMDD-XXXX
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
  },
  // Repayment amount
  amount: {
    type: Number,
    required: [true, 'Repayment amount is required'],
    min: [1, 'Amount must be greater than 0'],
  },
  // Amount paid (including penalty if any)
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [1, 'Total amount must be greater than 0'],
  },
  // Penalty amount included in this repayment
  penaltyAmount: {
    type: Number,
    default: 0,
    min: [0, 'Penalty amount cannot be negative'],
  },
  // Credit balance before repayment
  creditUsedBefore: {
    type: Number,
    required: true,
    min: [0, 'Credit used before cannot be negative'],
  },
  // Credit balance after repayment
  creditUsedAfter: {
    type: Number,
    required: true,
    min: [0, 'Credit used after cannot be negative'],
  },
  // Payment status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'bank_transfer', 'other'],
    default: 'razorpay',
  },
  // Razorpay payment information
  razorpayOrderId: {
    type: String,
    // Razorpay order ID for payment intent
  },
  razorpayPaymentId: {
    type: String,
    // Razorpay payment ID after payment confirmation
  },
  razorpaySignature: {
    type: String,
    // Razorpay signature for verification
  },
  // Bank account used for repayment
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    // Vendor's bank account used for repayment
  },
  // Payment gateway response
  gatewayResponse: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    // Store full gateway response for reference
  },
  // Payment metadata
  paidAt: Date,
  failedAt: Date,
  failureReason: String,
  // Notes
  notes: {
    type: String,
    trim: true,
  },
  // Admin review (if manual processing needed)
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  reviewedAt: Date,
  reviewNotes: String,
}, {
  timestamps: true,
});

// Indexes
creditRepaymentSchema.index({ vendorId: 1, createdAt: -1 }); // Vendor's repayments
creditRepaymentSchema.index({ status: 1, createdAt: -1 }); // Repayments by status
// Note: repaymentId already has an index from unique: true
creditRepaymentSchema.index({ razorpayOrderId: 1 }); // Razorpay order lookup
creditRepaymentSchema.index({ razorpayPaymentId: 1 }); // Razorpay payment lookup

// Pre-save hook: Generate repayment ID
creditRepaymentSchema.pre('save', async function (next) {
  if (!this.repaymentId && this.isNew) {
    try {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      
      // Find count of repayments created today
      const todayStart = new Date(date);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(date);
      todayEnd.setHours(23, 59, 59, 999);
      
      const RepaymentModel = this.constructor;
      const todayCount = await RepaymentModel.countDocuments({
        createdAt: { $gte: todayStart, $lte: todayEnd },
      });
      
      const sequence = String(todayCount + 1).padStart(4, '0');
      this.repaymentId = `REP-${dateStr}-${sequence}`;
    } catch (error) {
      // Fallback: generate repayment ID without counting
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const timestamp = Date.now().toString().slice(-6);
      this.repaymentId = `REP-${dateStr}-${timestamp}`;
    }
  }

  // Update timestamps based on status
  if (this.isModified('status')) {
    if (this.status === 'completed') {
      this.paidAt = new Date();
    } else if (this.status === 'failed') {
      this.failedAt = new Date();
    }
  }

  next();
});

// Instance method: Check if repayment is successful
creditRepaymentSchema.methods.isSuccessful = function () {
  return this.status === 'completed';
};

// Instance method: Check if repayment is failed
creditRepaymentSchema.methods.isFailed = function () {
  return this.status === 'failed';
};

const CreditRepayment = mongoose.model('CreditRepayment', creditRepaymentSchema);

module.exports = CreditRepayment;

