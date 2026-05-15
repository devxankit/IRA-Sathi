const mongoose = require('mongoose');

/**
 * Credit Purchase Request Schema
 * 
 * Vendors can request credit purchases (minimum ₹50,000)
 * Admin approves/rejects these requests
 * When approved, vendor credit is updated and inventory is added
 */
const creditPurchaseSchema = new mongoose.Schema({
  creditPurchaseId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: CRP-101, CRP-102, etc.
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
    unit: {
      type: String,
      trim: true,
    },
    attributeCombination: {
      type: Map,
      of: String,
      default: undefined,
    },
  }],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [50000, 'Minimum purchase amount is ₹50,000'], // MIN_VENDOR_PURCHASE
    max: [100000, 'Maximum purchase amount is ₹100,000'], // MAX_VENDOR_PURCHASE
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  // Admin actions
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  reviewedAt: Date,
  rejectionReason: {
    type: String,
    trim: true,
  },
  // Notes
  notes: {
    type: String,
    trim: true,
  },
  reason: {
    type: String,
    trim: true,
  },
  bankDetails: {
    accountName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
    },
    branch: {
      type: String,
      trim: true,
    },
  },
  confirmationText: {
    type: String,
    trim: true,
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'scheduled', 'in_transit', 'delivered'],
    default: 'pending',
  },
  expectedDeliveryAt: Date,
  deliveredAt: Date,
  deliveryNotes: {
    type: String,
    trim: true,
  },
  hasOutstandingDues: {
    type: Boolean,
    default: false,
  },
  outstandingDuesAmount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
creditPurchaseSchema.index({ vendorId: 1, status: 1 }); // Vendor's purchases by status
creditPurchaseSchema.index({ status: 1, createdAt: -1 }); // Pending purchases for admin
// Note: creditPurchaseId already has an index from unique: true

// Virtual: Calculate total amount from items
creditPurchaseSchema.virtual('calculatedTotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
});

// Pre-save: Validate total amount matches items
creditPurchaseSchema.pre('save', function (next) {
  const calculatedTotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (Math.abs(this.totalAmount - calculatedTotal) > 0.01) {
    return next(new Error('Total amount does not match sum of items'));
  }
  next();
});

const CreditPurchase = mongoose.model('CreditPurchase', creditPurchaseSchema);

module.exports = CreditPurchase;

