const mongoose = require('mongoose');

/**
 * Product Assignment Schema
 * 
 * Links Products to Vendors
 * When Admin assigns a product to a vendor, it creates an inventory entry for that vendor
 */
const productAssignmentSchema = new mongoose.Schema({
  assignmentId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: PAS-101, PAS-102, etc.
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
  },
  // Regional assignment (optional)
  region: {
    type: String,
    trim: true,
    // Region/area where this product-vendor assignment is valid
  },
  // Assignment status
  isActive: {
    type: Boolean,
    default: true,
  },
  // Assignment metadata
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  // Notes about the assignment
  notes: {
    type: String,
    trim: true,
  },
  // Vendor stock for this product
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative'],
  },
  // Track when vendor manually updated stock (not when admin creates/updates assignment)
  lastManualStockUpdate: {
    type: Date,
    default: null,
  },
  // Variant-specific stock tracking
  attributeStocks: [{
    _id: false, // Don't need separate ID for this subdoc in assignment
    attributes: {
      type: Map,
      of: String,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Attribute stock cannot be negative'],
    },
    // Optional: track if this variant is active for this vendor
    isActive: {
      type: Boolean,
      default: true,
    }
  }],
}, {
  timestamps: true,
});

// Compound index: One product can be assigned to one vendor once
productAssignmentSchema.index({ productId: 1, vendorId: 1 }, { unique: true });

// Indexes for queries
productAssignmentSchema.index({ vendorId: 1, isActive: 1 }); // Vendor's active assignments
productAssignmentSchema.index({ productId: 1, isActive: 1 }); // Product's active assignments
// Note: assignmentId already has an index from unique: true

const ProductAssignment = mongoose.model('ProductAssignment', productAssignmentSchema);

module.exports = ProductAssignment;

