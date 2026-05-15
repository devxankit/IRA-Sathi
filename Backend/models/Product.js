const mongoose = require('mongoose');
// const { translateText } = require('../utils/translator'); // Removed: Translator utility deleted
// const { translateText } = require('../utils/translator'); // Removed: Translator utility deleted

/**
 * Product Schema
 * 
 * Products managed by Admin and displayed to Users
 * Products are assigned to Vendors for inventory management
 * Images stored via Cloudinary (URLs stored in database)
 */
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    // Long description for product details page
  },
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    trim: true,
    maxlength: [150, 'Short description cannot exceed 150 characters'],
    // Short description for product cards
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    trim: true,
    lowercase: true,
    // Categories: fertilizer, pesticide, seeds, tools, equipment, etc.
  },
  // Hindi Translations (alphabetical info)
  name_hi: { type: String, trim: true },
  description_hi: { type: String, trim: true },
  shortDescription_hi: { type: String, trim: true },
  category_hi: { type: String, trim: true, lowercase: true },
  brand_hi: { type: String, trim: true },
  tags_hi: [{ type: String, trim: true, lowercase: true }],
  // Pricing
  priceToVendor: {
    type: Number,
    required: [true, 'Price to vendor is required'],
    min: [0, 'Price to vendor cannot be negative'],
  },
  priceToUser: {
    type: Number,
    required: [true, 'Price to user is required'],
    min: [0, 'Price to user cannot be negative'],
  },
  // Stock tracking (global/admin-managed stock)
  // Actual stock quantity (internal/admin use only)
  actualStock: {
    type: Number,
    required: [true, 'Actual stock quantity is required'],
    min: [0, 'Actual stock cannot be negative'],
    default: 0,
  },
  // Display stock quantity (shown to vendors)
  displayStock: {
    type: Number,
    required: [true, 'Display stock quantity is required'],
    min: [0, 'Display stock cannot be negative'],
    default: 0,
  },
  // Legacy field for backward compatibility (maps to displayStock)
  stock: {
    type: Number,
    min: [0, 'Stock cannot be negative'],
    default: 0,
  },
  // Product images (Cloudinary URLs)
  // In future: Images will be uploaded to Cloudinary and URLs stored here
  images: [{
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      // Cloudinary public ID for image management
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  }],
  // Expiry/Validity information
  expiry: {
    type: Date,
    // Optional: Product expiry date if applicable
  },
  // Additional product details
  brand: {
    type: String,
    trim: true,
  },
  weight: {
    value: {
      type: Number,
    },
    unit: {
      type: String,
      enum: ['mg', 'g', 'kg', 'ml', 'L', 'l', 'bag', 'bags', 'unit', 'units', 'packet', 'bottle'],
      default: 'kg',
    },
  },
  // Product visibility and status
  isActive: {
    type: Boolean,
    default: true,
    // Only active products are shown to users
  },
  // SEO and search
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  // Unique product ID
  productId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Format: PRD-101, PRD-102, etc.
  },
  // Additional metadata
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    // Stock Keeping Unit (optional, auto-generated if not provided)
  },
  batchNumber: {
    type: String,
    trim: true,
    // Batch number for product tracking
  },
  // Product specifications
  specifications: {
    type: Map,
    of: String,
    // Flexible key-value pairs for product specs
  },
  // Stock quantities per attribute combination
  attributeStocks: [{
    attributes: {
      type: Map,
      of: String,
      // Attribute key-value pairs (e.g., { npkRatio: '19:19:19', form: 'Granular' })
    },
    actualStock: {
      type: Number,
      required: true,
      min: [0, 'Actual stock cannot be negative'],
      default: 0,
    },
    displayStock: {
      type: Number,
      required: true,
      min: [0, 'Display stock cannot be negative'],
      default: 0,
    },
    stockUnit: {
      type: String,
      enum: ['mg', 'g', 'kg', 'ml', 'L', 'bag', 'bags', 'unit', 'units', 'packet', 'bottle'],
      default: 'kg',
    },
    vendorPrice: {
      type: Number,
      required: true,
      min: [0, 'Vendor price cannot be negative'],
      // Price to vendor for this specific attribute combination
    },
    userPrice: {
      type: Number,
      required: true,
      min: [0, 'User price cannot be negative'],
      // Price to user for this specific attribute combination
    },
    batchNumber: {
      type: String,
      trim: true,
      // Optional batch number for this specific attribute combination
    },
    expiry: {
      type: Date,
      // Optional expiry date for this specific attribute combination
    },
  }],
}, {
  timestamps: true,
});

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', category: 'text', tags: 'text' }); // Text search
productSchema.index({ category: 1, isActive: 1 }); // Category and active status filter
productSchema.index({ isActive: 1 }); // Active products filter
productSchema.index({ createdAt: -1 }); // Recent products first
// Note: productId already has an index from unique: true

// Virtual for primary image URL
productSchema.virtual('primaryImage').get(function () {
  if (this.images && this.images.length > 0) {
    const primaryImage = this.images.find(img => img.isPrimary === true);
    if (primaryImage) return primaryImage.url;
    return this.images[0].url; // Return first image if no primary set
  }
  return null;
});

// Note: Rating and review count are calculated using aggregation in controllers
// (see userController.getProductDetails and userController.getProducts)

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Pre-save hook: Auto-generate SKU if not provided and sync stock fields
productSchema.pre('save', async function (next) {
  if (!this.sku && this.isNew) {
    // Generate SKU: Category prefix + timestamp + random 3 digits
    const categoryPrefix = this.category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.sku = `${categoryPrefix}-${timestamp}-${random}`;
  }

  // Sync legacy stock field with displayStock for backward compatibility
  if (this.isModified('displayStock') || this.isNew) {
    this.stock = this.displayStock;
  }

  /* 
  // Automatic Hindi Translation for alphabetical fields - DISABLED (Translator utility removed)
  const needsTranslation =
    this.isNew ||
    this.isModified('name') ||
    this.isModified('description') ||
    this.isModified('shortDescription') ||
    this.isModified('category') ||
    this.isModified('brand') ||
    this.isModified('tags');

  if (needsTranslation) {
    try {
      // Collect fields to translate
      const fields = [];
      const keys = [];

      if (this.name) { fields.push(this.name); keys.push('name'); }
      if (this.description) { fields.push(this.description); keys.push('description'); }
      if (this.shortDescription) { fields.push(this.shortDescription); keys.push('shortDescription'); }
      if (this.category) { fields.push(this.category); keys.push('category'); }
      if (this.brand) { fields.push(this.brand); keys.push('brand'); }

      // Handle tags (array)
      let tagsStartIndex = -1;
      if (this.tags && this.tags.length > 0) {
        tagsStartIndex = fields.length;
        fields.push(...this.tags);
      }

      if (fields.length > 0) {
        const translations = await translateText(fields, 'hi');

        if (Array.isArray(translations)) {
          let currentIndex = 0;
          keys.forEach((key) => {
            this[`${key}_hi`] = translations[currentIndex++];
          });

          if (tagsStartIndex !== -1) {
            this.tags_hi = translations.slice(tagsStartIndex);
          }
        }
      }
    } catch (error) {
      console.error('[Product Model] Translation hook error:', error);
      // Don't block saving if translation fails
    }
  }
  */

  next();
});

// Instance method: Check if product is in stock (uses displayStock for vendor visibility)
productSchema.methods.isInStock = function () {
  return (this.displayStock || this.stock) > 0;
};

// Instance method: Check if product is expired
productSchema.methods.isExpired = function () {
  if (!this.expiry) return false;
  return new Date() > this.expiry;
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;

