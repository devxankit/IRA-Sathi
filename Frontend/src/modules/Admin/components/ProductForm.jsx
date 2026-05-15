import { useState, useEffect } from 'react'
import { Calendar, Package, IndianRupee, Eye, EyeOff, Tag, X, Layers } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { ImageUpload } from './ImageUpload'
import { AttributeStockForm } from './AttributeStockForm'

const STOCK_UNITS = ['mg', 'g', 'kg', 'ml', 'L', 'bag', 'unit', 'packet', 'bottle']

// Fertilizer Categories (This platform is for fertilizers only)
const FERTILIZER_CATEGORIES = [
  { value: 'npk', label: 'NPK Fertilizers', description: 'Balanced NPK fertilizers' },
  { value: 'nitrogen', label: 'Nitrogen Fertilizers', description: 'High nitrogen content' },
  { value: 'phosphorus', label: 'Phosphorus Fertilizers', description: 'Phosphorus-rich fertilizers' },
  { value: 'potassium', label: 'Potassium Fertilizers', description: 'Potassium fertilizers' },
  { value: 'organic', label: 'Organic Fertilizers', description: 'Natural and organic fertilizers' },
  { value: 'biofertilizer', label: 'Biofertilizers', description: 'Microbial fertilizers' },
  { value: 'micronutrient', label: 'Micronutrient Fertilizers', description: 'Essential trace elements' },
  { value: 'liquid', label: 'Liquid Fertilizers', description: 'Water-soluble fertilizers' },
  { value: 'granular', label: 'Granular Fertilizers', description: 'Solid granular fertilizers' },
  { value: 'foliar', label: 'Foliar Fertilizers', description: 'Applied to plant leaves' },
  { value: 'soil-conditioner', label: 'Soil Conditioners', description: 'Improve soil structure' },
  { value: 'specialty', label: 'Specialty Fertilizers', description: 'Specialized fertilizers' },
]

// Category-specific attributes configuration
const CATEGORY_ATTRIBUTES = {
  npk: [
    { key: 'npkRatio', label: 'NPK Ratio (N-P-K)', type: 'text', placeholder: 'e.g., 19:19:19', required: false },
    { key: 'form', label: 'Form', type: 'select', options: ['Granular', 'Liquid', 'Powder'], required: false },
    { key: 'grade', label: 'Grade', type: 'text', placeholder: 'e.g., Premium, Standard', required: false },
  ],
  nitrogen: [
    { key: 'nitrogenContent', label: 'Nitrogen Content (%)', type: 'number', placeholder: 'e.g., 46', required: false },
    { key: 'form', label: 'Form', type: 'select', options: ['Urea', 'Ammonium', 'Nitrate', 'Liquid'], required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Soil', 'Foliar', 'Drip'], required: false },
  ],
  phosphorus: [
    { key: 'phosphorusContent', label: 'Phosphorus Content (%)', type: 'number', placeholder: 'e.g., 20', required: false },
    { key: 'form', label: 'Form', type: 'select', options: ['Granular', 'Liquid', 'Powder'], required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Soil', 'Foliar', 'Drip'], required: false },
  ],
  potassium: [
    { key: 'potassiumContent', label: 'Potassium Content (%)', type: 'number', placeholder: 'e.g., 60', required: false },
    { key: 'form', label: 'Form', type: 'select', options: ['Granular', 'Liquid', 'Powder'], required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Soil', 'Foliar', 'Drip'], required: false },
  ],
  organic: [
    { key: 'organicCertified', label: 'Organic Certified', type: 'select', options: ['Yes', 'No'], required: false },
    { key: 'source', label: 'Source', type: 'select', options: ['Plant-based', 'Animal-based', 'Mixed'], required: false },
    { key: 'form', label: 'Form', type: 'select', options: ['Compost', 'Manure', 'Liquid', 'Granular'], required: false },
  ],
  biofertilizer: [
    { key: 'microorganismType', label: 'Microorganism Type', type: 'text', placeholder: 'e.g., Rhizobium, Azotobacter', required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Seed Treatment', 'Soil Application', 'Foliar'], required: false },
    { key: 'shelfLife', label: 'Shelf Life (months)', type: 'number', placeholder: 'e.g., 12', required: false },
  ],
  micronutrient: [
    { key: 'micronutrientType', label: 'Micronutrient Type', type: 'select', options: ['Zinc', 'Iron', 'Boron', 'Manganese', 'Copper', 'Molybdenum'], required: false },
    { key: 'concentration', label: 'Concentration (%)', type: 'number', placeholder: 'e.g., 12', required: false },
    { key: 'form', label: 'Form', type: 'select', options: ['Chelated', 'Sulfate', 'Liquid'], required: false },
  ],
  liquid: [
    { key: 'concentration', label: 'Concentration (%)', type: 'number', placeholder: 'e.g., 20', required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Foliar', 'Drip', 'Soil Drench'], required: false },
    { key: 'dilutionRatio', label: 'Dilution Ratio', type: 'text', placeholder: 'e.g., 1:100', required: false },
  ],
  granular: [
    { key: 'granuleSize', label: 'Granule Size', type: 'select', options: ['Fine', 'Medium', 'Coarse'], required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Broadcast', 'Band Placement', 'Side Dressing'], required: false },
    { key: 'releaseType', label: 'Release Type', type: 'select', options: ['Immediate', 'Slow Release', 'Controlled Release'], required: false },
  ],
  foliar: [
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Spray', 'Mist', 'Drip'], required: false },
    { key: 'dilutionRatio', label: 'Dilution Ratio', type: 'text', placeholder: 'e.g., 1:200', required: false },
    { key: 'cropCompatibility', label: 'Crop Compatibility', type: 'text', placeholder: 'e.g., All crops, Vegetables', required: false },
  ],
  'soil-conditioner': [
    { key: 'phAdjustment', label: 'pH Adjustment', type: 'select', options: ['Acidic', 'Alkaline', 'Neutral'], required: false },
    { key: 'organicMatter', label: 'Organic Matter (%)', type: 'number', placeholder: 'e.g., 30', required: false },
    { key: 'applicationRate', label: 'Application Rate (kg/acre)', type: 'number', placeholder: 'e.g., 100', required: false },
  ],
  specialty: [
    { key: 'specialProperties', label: 'Special Properties', type: 'text', placeholder: 'e.g., Water-soluble, Slow-release', required: false },
    { key: 'applicationMethod', label: 'Application Method', type: 'select', options: ['Foliar', 'Soil', 'Drip', 'Hydroponic'], required: false },
    { key: 'targetCrops', label: 'Target Crops', type: 'text', placeholder: 'e.g., Fruits, Vegetables, Flowers', required: false },
  ],
}

export function ProductForm({ product, onSubmit, onCancel, loading = false }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'npk', // Default to NPK
    shortDescription: '', // Short description for product cards
    description: '', // Long description for product details page
    actualStock: '',
    displayStock: '',
    stockUnit: 'kg',
    vendorPrice: '',
    userPrice: '',
    expiry: '',
    visibility: 'active',
    batchNumber: '',
    tags: [],
    attributes: {},
    images: [], // Array of image objects {url, publicId, isPrimary, order}
    attributeStocks: [], // Array of stock entries per attribute combination
  })

  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState({})
  const [showAttributeStockForm, setShowAttributeStockForm] = useState(false)

  useEffect(() => {
    if (product) {
      // Parse existing product data
      // Handle stock: check for actualStock and displayStock first, fallback to legacy stock
      let actualStockValue = ''
      let displayStockValue = ''
      let stockUnit = 'kg'

      // Check for actualStock and displayStock first
      if (product.actualStock != null && product.actualStock !== undefined) {
        actualStockValue = String(product.actualStock)
      }
      if (product.displayStock != null && product.displayStock !== undefined) {
        displayStockValue = String(product.displayStock)
      }

      // Fallback to legacy stock field if new fields not available
      if (!actualStockValue && product.stock != null && product.stock !== undefined) {
        if (typeof product.stock === 'number') {
          actualStockValue = String(product.stock)
        } else {
          const stockString = String(product.stock)
          const stockMatch = stockString.match(/^([\d,]+)\s*(kg|L|bags|units)?$/i)
          if (stockMatch) {
            actualStockValue = stockMatch[1].replace(/,/g, '')
            stockUnit = stockMatch[2]?.toLowerCase() || product.stockUnit || 'kg'
          }
        }
      }
      if (!displayStockValue && product.stock != null && product.stock !== undefined) {
        if (typeof product.stock === 'number') {
          displayStockValue = String(product.stock)
        } else {
          const stockString = String(product.stock)
          const stockMatch = stockString.match(/^([\d,]+)\s*(kg|L|bags|units)?$/i)
          if (stockMatch) {
            displayStockValue = stockMatch[1].replace(/,/g, '')
            if (!stockUnit) stockUnit = stockMatch[2]?.toLowerCase() || product.stockUnit || 'kg'
          }
        }
      }

      if (product.stockUnit) {
        stockUnit = product.stockUnit
      }

      // Also check weight.unit as fallback
      if (product.weight?.unit) {
        stockUnit = product.weight.unit
      }

      // Convert prices to string if they're numbers
      const vendorPriceString = product.vendorPrice != null ? String(product.vendorPrice) : ''
      const userPriceString = product.userPrice != null ? String(product.userPrice) : ''
      const vendorPriceValue = vendorPriceString.replace(/[₹,]/g, '') || ''
      const userPriceValue = userPriceString.replace(/[₹,]/g, '') || ''

      // Parse expiry date (assuming format like "Aug 2026" or ISO date)
      let expiryDate = ''
      if (product.expiry) {
        const expiryString = String(product.expiry)
        if (expiryString.includes('-')) {
          expiryDate = expiryString.split('T')[0] // ISO date
        } else {
          // Try to parse "Aug 2026" format
          const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          }
          const parts = expiryString.split(' ')
          if (parts.length === 2) {
            const month = months[parts[0]]
            const year = parts[1]
            if (month && year) {
              expiryDate = `${year}-${month}-15` // Default to 15th of month
            }
          }
        }
      }

      // Parse specifications (attributes) from product
      const attributes = {}
      if (product.specifications && typeof product.specifications === 'object') {
        // Handle Map type from MongoDB
        if (product.specifications instanceof Map) {
          product.specifications.forEach((value, key) => {
            attributes[key] = value
          })
        } else {
          // Handle plain object
          Object.keys(product.specifications).forEach((key) => {
            attributes[key] = product.specifications[key]
          })
        }
      }

      // Parse images
      let productImages = []
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        productImages = product.images.map((img, index) => ({
          url: img.url || (typeof img === 'string' ? img : ''),
          publicId: img.publicId || '',
          isPrimary: img.isPrimary === true || (index === 0 && img.isPrimary !== false),
          order: img.order !== undefined ? img.order : index,
        }))
      }

      setFormData({
        name: product.name || '',
        category: product.category || 'npk',
        shortDescription: product.shortDescription || '',
        description: product.description || product.longDescription || '',
        actualStock: actualStockValue,
        displayStock: displayStockValue,
        stockUnit: stockUnit,
        vendorPrice: vendorPriceValue,
        userPrice: userPriceValue,
        expiry: expiryDate,
        visibility: product.isActive !== false ? 'active' : 'inactive',
        batchNumber: product.batchNumber || '',
        tags: product.tags && Array.isArray(product.tags) ? product.tags : [],
        attributes: attributes,
        images: productImages,
        attributeStocks: product.attributeStocks && Array.isArray(product.attributeStocks)
          ? product.attributeStocks.map((stock, index) => {
            // Convert attributes Map to plain object if needed
            let attributesObj = {}
            if (stock.attributes) {
              if (stock.attributes instanceof Map) {
                stock.attributes.forEach((value, key) => {
                  attributesObj[key] = value
                })
              } else if (typeof stock.attributes === 'object') {
                attributesObj = stock.attributes
              }
            }

            return {
              ...stock,
              attributes: attributesObj,
              vendorPrice: stock.vendorPrice != null ? String(stock.vendorPrice) : '',
              userPrice: stock.userPrice != null ? String(stock.userPrice) : '',
              id: stock.id || stock._id || Date.now() + index, // Ensure each has an ID
            }
          })
          : [],
      })
    }
  }, [product])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }

    // Reset attributes when category changes
    if (name === 'category') {
      setFormData((prev) => ({ ...prev, attributes: {} }))
    }
  }

  const handleAttributeChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
      },
    }))
  }

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().toLowerCase()
      if (!formData.tags.includes(newTag)) {
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, newTag],
        }))
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  // Sync displayStock unit when stockUnit changes
  useEffect(() => {
    // When stockUnit changes, we don't need to do anything special
    // The disabled select will show the same unit automatically
  }, [formData.stockUnit])

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required'
    }

    if (!formData.category) {
      newErrors.category = 'Category is required'
    }

    if (!formData.shortDescription.trim()) {
      newErrors.shortDescription = 'Short description is required (for product cards)'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Long description is required (for product details page)'
    }

    // Only validate main stock and price fields if no attributeStocks are configured
    if (!formData.attributeStocks || formData.attributeStocks.length === 0) {
      if (!formData.actualStock || parseFloat(formData.actualStock) < 0) {
        newErrors.actualStock = 'Actual quantity is required and cannot be negative'
      }
      if (!formData.displayStock || parseFloat(formData.displayStock) < 0) {
        newErrors.displayStock = 'Display quantity is required and cannot be negative'
      }
      if (parseFloat(formData.displayStock) > parseFloat(formData.actualStock)) {
        newErrors.displayStock = 'Display quantity cannot exceed actual quantity'
      }

      if (!formData.vendorPrice || parseFloat(formData.vendorPrice) <= 0) {
        newErrors.vendorPrice = 'Vendor price must be greater than 0'
      }

      if (!formData.userPrice || parseFloat(formData.userPrice) <= 0) {
        newErrors.userPrice = 'User price must be greater than 0'
      }

      if (parseFloat(formData.userPrice) <= parseFloat(formData.vendorPrice)) {
        newErrors.userPrice = 'User price must be greater than vendor price'
      }

      if (!formData.expiry) {
        newErrors.expiry = 'Expiry date is required'
      }
    } else {
      // Validate that at least one attributeStock entry exists
      if (formData.attributeStocks.length === 0) {
        newErrors.attributeStocks = 'At least one stock entry with attributes is required'
      }
    }

    setErrors(newErrors)
    const isValid = Object.keys(newErrors).length === 0

    // Scroll to first error if validation fails
    if (!isValid) {
      setTimeout(() => {
        const firstErrorField = Object.keys(newErrors)[0]
        if (firstErrorField) {
          const errorElement = document.getElementById(firstErrorField) || document.querySelector(`[name="${firstErrorField}"]`)
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            errorElement.focus()
          }
        }
      }, 100)
    }

    return isValid
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) {
      return
    }

    // Ensure prices are valid numbers (only if not using attributeStocks)
    const vendorPrice = (!formData.attributeStocks || formData.attributeStocks.length === 0)
      ? parseFloat(formData.vendorPrice)
      : 0
    const userPrice = (!formData.attributeStocks || formData.attributeStocks.length === 0)
      ? parseFloat(formData.userPrice)
      : 0

    // Build specifications object from attributes (only include non-empty values)
    const specifications = {}
    Object.keys(formData.attributes).forEach((key) => {
      const value = formData.attributes[key]
      if (value !== '' && value !== null && value !== undefined) {
        specifications[key] = String(value)
      }
    })

    // Calculate total stock and prices from attributeStocks if they exist, otherwise use main fields
    let actualStockValue = 0
    let displayStockValue = 0
    let vendorPriceValue = 0
    let userPriceValue = 0
    let expiryValue = ''
    let batchNumberValue = ''

    if (formData.attributeStocks && formData.attributeStocks.length > 0) {
      // Sum up all attributeStocks
      actualStockValue = formData.attributeStocks.reduce((sum, stock) => sum + (parseFloat(stock.actualStock) || 0), 0)
      displayStockValue = formData.attributeStocks.reduce((sum, stock) => sum + (parseFloat(stock.displayStock) || 0), 0)

      // Calculate weighted average prices based on stock quantities
      let totalStock = 0
      let weightedVendorPrice = 0
      let weightedUserPrice = 0

      formData.attributeStocks.forEach(stock => {
        const stockQty = parseFloat(stock.displayStock) || 0
        totalStock += stockQty
        weightedVendorPrice += (parseFloat(stock.vendorPrice) || 0) * stockQty
        weightedUserPrice += (parseFloat(stock.userPrice) || 0) * stockQty
      })

      if (totalStock > 0) {
        vendorPriceValue = weightedVendorPrice / totalStock
        userPriceValue = weightedUserPrice / totalStock
      }

      // Use first entry's expiry and batchNumber as defaults (or leave empty)
      const firstEntry = formData.attributeStocks[0]
      expiryValue = firstEntry.expiry || ''
      batchNumberValue = firstEntry.batchNumber || ''
    } else {
      // Use main fields
      actualStockValue = parseFloat(formData.actualStock) || 0
      displayStockValue = parseFloat(formData.displayStock) || 0
      vendorPriceValue = !isNaN(vendorPrice) && vendorPrice > 0 ? vendorPrice : 0
      userPriceValue = !isNaN(userPrice) && userPrice > 0 ? userPrice : 0
      expiryValue = formData.expiry
      batchNumberValue = formData.batchNumber || ''
    }

    const submitData = {
      name: formData.name.trim(),
      category: formData.category,
      shortDescription: formData.shortDescription.trim(),
      description: formData.description.trim(),
      longDescription: formData.description.trim(), // Also save as longDescription for clarity
      actualStock: actualStockValue,
      displayStock: displayStockValue,
      stockUnit: formData.stockUnit,
      priceToVendor: vendorPriceValue > 0 ? vendorPriceValue : undefined,
      priceToUser: userPriceValue > 0 ? userPriceValue : undefined,
      ...(expiryValue && { expiry: expiryValue }),
      isActive: formData.visibility === 'active',
      ...(batchNumberValue && { batchNumber: batchNumberValue.trim() }),
      tags: formData.tags.filter((tag) => tag.trim() !== ''),
      ...(Object.keys(specifications).length > 0 && { specifications }),
      ...(formData.images && formData.images.length > 0 && { images: formData.images }),
      ...(formData.attributeStocks && formData.attributeStocks.length > 0 && {
        attributeStocks: formData.attributeStocks.map(({ id, ...stock }) => stock) // Remove temporary IDs
      }),
    }

    onSubmit(submitData)
  }

  // Handle attribute stock form save
  const handleAttributeStockSave = (stocks) => {
    setFormData((prev) => ({
      ...prev,
      attributeStocks: stocks.map((stock, index) => ({
        ...stock,
        id: stock.id || Date.now() + index, // Ensure each has an ID
      })),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Name */}
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-bold text-gray-900">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., NPK 24:24:0 Fertilizer"
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
            errors.name
              ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
              : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
          )}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Category Selection */}
      <div>
        <label htmlFor="category" className="mb-2 block text-sm font-bold text-gray-900">
          Fertilizer Category <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2',
            errors.category
              ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
              : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
          )}
        >
          {FERTILIZER_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label} - {cat.description}
            </option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
      </div>

      {/* Short Description - For Product Cards */}
      <div>
        <label htmlFor="shortDescription" className="mb-2 block text-sm font-bold text-gray-900">
          Short Description <span className="text-red-500">*</span>
          <span className="text-xs font-normal text-gray-500 ml-2">(Shown on product cards in user dashboard)</span>
        </label>
        <textarea
          id="shortDescription"
          name="shortDescription"
          value={formData.shortDescription}
          onChange={handleChange}
          placeholder="Brief description (1-2 lines) that will appear on product cards..."
          rows={2}
          maxLength={150}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 resize-none',
            errors.shortDescription
              ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
              : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
          )}
        />
        <p className="mt-1 text-xs text-gray-500">{formData.shortDescription.length}/150 characters</p>
        {errors.shortDescription && <p className="mt-1 text-xs text-red-600">{errors.shortDescription}</p>}
      </div>

      {/* Long Description - For Product Details Page */}
      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-bold text-gray-900">
          Long Description <span className="text-red-500">*</span>
          <span className="text-xs font-normal text-gray-500 ml-2">(Shown on product details page)</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Detailed description with composition, benefits, usage instructions, etc. (Line breaks will be preserved)..."
          rows={5}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 resize-none',
            errors.description
              ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
              : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
          )}
        />
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
      </div>

      {/* Product Images */}
      <div>
        <ImageUpload
          images={formData.images || []}
          onChange={(images) => setFormData((prev) => ({ ...prev, images }))}
          maxImages={4}
          disabled={loading}
        />
      </div>

      {/* Stock Quantity & Unit - Only show if no attributeStocks are configured */}
      {(!formData.attributeStocks || formData.attributeStocks.length === 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="actualStock" className="mb-2 block text-sm font-bold text-gray-900">
              Actual Quantity <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-500 ml-2">(Internal/Admin use)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                id="actualStock"
                name="actualStock"
                value={formData.actualStock}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="0.01"
                className={cn(
                  'flex-1 rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                  errors.actualStock
                    ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                    : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
                )}
              />
              <select
                name="stockUnit"
                value={formData.stockUnit}
                onChange={handleChange}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {STOCK_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            {errors.actualStock && <p className="mt-1 text-xs text-red-600">{errors.actualStock}</p>}
          </div>

          <div>
            <label htmlFor="displayStock" className="mb-2 block text-sm font-bold text-gray-900">
              Quantity to Show to Vendors <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-500 ml-2">(Visible to vendors)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                id="displayStock"
                name="displayStock"
                value={formData.displayStock}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="0.01"
                className={cn(
                  'flex-1 rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                  errors.displayStock
                    ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                    : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
                )}
              />
              <select
                value={formData.stockUnit}
                disabled
                className="rounded-xl border border-gray-300 bg-gray-100 px-3 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                {STOCK_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            {errors.displayStock && <p className="mt-1 text-xs text-red-600">{errors.displayStock}</p>}
            {formData.displayStock && parseFloat(formData.displayStock) > parseFloat(formData.actualStock || 0) && (
              <p className="mt-1 text-xs text-yellow-600">⚠️ Display quantity exceeds actual quantity</p>
            )}
          </div>
        </div>
      )}

      {/* Expiry Date - Only show if no attributeStocks are configured */}
      {(!formData.attributeStocks || formData.attributeStocks.length === 0) && (
        <div>
          <label htmlFor="expiry" className="mb-2 block text-sm font-bold text-gray-900">
            Expiry Date / Batch <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              id="expiry"
              name="expiry"
              value={formData.expiry}
              onChange={handleChange}
              className={cn(
                'w-full rounded-xl border pl-10 pr-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
                errors.expiry
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
              )}
            />
          </div>
          {errors.expiry && <p className="mt-1 text-xs text-red-600">{errors.expiry}</p>}
        </div>
      )}

      {/* Batch Number (Optional) - Only show if no attributeStocks are configured */}
      {(!formData.attributeStocks || formData.attributeStocks.length === 0) && (
        <div>
          <label htmlFor="batchNumber" className="mb-2 block text-sm font-bold text-gray-900">
            Batch Number <span className="text-xs font-normal text-gray-500">(Optional)</span>
          </label>
          <input
            type="text"
            id="batchNumber"
            name="batchNumber"
            value={formData.batchNumber}
            onChange={handleChange}
            placeholder="e.g., BATCH-2024-001"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      )}

      {/* Pricing - Only show if no attributeStocks are configured */}
      {(!formData.attributeStocks || formData.attributeStocks.length === 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="vendorPrice" className="mb-2 block text-sm font-bold text-gray-900">
              <IndianRupee className="mr-1 inline h-4 w-4" />
              Vendor Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="vendorPrice"
              name="vendorPrice"
              value={formData.vendorPrice}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                errors.vendorPrice
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
              )}
            />
            {errors.vendorPrice && <p className="mt-1 text-xs text-red-600">{errors.vendorPrice}</p>}
          </div>

          <div>
            <label htmlFor="userPrice" className="mb-2 block text-sm font-bold text-gray-900">
              <IndianRupee className="mr-1 inline h-4 w-4" />
              User Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="userPrice"
              name="userPrice"
              value={formData.userPrice}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                errors.userPrice
                  ? 'border-red-300 bg-red-50 focus:ring-red-500/50'
                  : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-purple-500/50',
              )}
            />
            {errors.userPrice && <p className="mt-1 text-xs text-red-600">{errors.userPrice}</p>}
          </div>
        </div>
      )}

      {/* Custom Attributes - Stock Management */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-blue-700">Stock Management by Custom Attributes</h3>
            <p className="text-sm text-gray-600 mt-1">
              Add custom attributes (e.g., Type, Percentage, NPK Ratio) and manage stock for each combination
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAttributeStockForm(!showAttributeStockForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-[0_4px_15px_rgba(168,85,247,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(168,85,247,0.4)]"
          >
            <Layers className="h-4 w-4" />
            {showAttributeStockForm ? 'Close Stock Manager' : 'Manage Stock by Attributes'}
            {formData.attributeStocks && formData.attributeStocks.length > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {formData.attributeStocks.length}
              </span>
            )}
          </button>
        </div>

        {/* Display existing attribute stocks summary when form is closed */}
        {!showAttributeStockForm && formData.attributeStocks && formData.attributeStocks.length > 0 && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
            <p className="text-sm font-semibold text-purple-700 mb-2">
              Stock Entries Configured: {formData.attributeStocks.length}
            </p>
            <div className="space-y-2">
              {formData.attributeStocks.slice(0, 3).map((stock, index) => {
                const attributeSummary = Object.entries(stock.attributes || {})
                  .filter(([_, value]) => value && value !== '')
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')

                return (
                  <div key={stock.id || index} className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2">
                    <span className="font-semibold">Entry #{index + 1}:</span> {attributeSummary || 'No attributes'}
                    {' - '}
                    <span className="font-semibold">Stock:</span> {stock.displayStock || 0} {stock.stockUnit || formData.stockUnit}
                  </div>
                )
              })}
              {formData.attributeStocks.length > 3 && (
                <p className="text-xs text-gray-500 italic">
                  + {formData.attributeStocks.length - 3} more entries...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attribute Stock Form - Inline Dropdown */}
      {showAttributeStockForm && (
        <AttributeStockForm
          isOpen={showAttributeStockForm}
          onClose={() => setShowAttributeStockForm(false)}
          category={formData.category}
          categoryAttributes={[]}
          attributeStocks={formData.attributeStocks || []}
          onSave={handleAttributeStockSave}
          stockUnit={formData.stockUnit}
        />
      )}

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="mb-2 block text-sm font-bold text-gray-900">
          <Tag className="mr-1 inline h-4 w-4" />
          Product Tags
          <span className="text-xs font-normal text-gray-500 ml-2">(Press Enter to add, used for search and identification)</span>
        </label>
        <div className="space-y-3">
          <input
            type="text"
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Type a tag and press Enter (e.g., organic, premium, fast-acting)"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700 shadow-[0_2px_8px_rgba(168,85,247,0.2),inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 rounded-full hover:bg-purple-200 transition-colors"
                    aria-label={`Remove ${tag} tag`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visibility Toggle */}
      <div>
        <label className="mb-2 block text-sm font-bold text-gray-900">
          <Eye className="mr-1 inline h-4 w-4" />
          Product Visibility <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, visibility: 'active' }))}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all',
              formData.visibility === 'active'
                ? 'border-[#017827] bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'border-gray-300 bg-white text-gray-700 hover:border-[rgba(1,120,39,0.4)] hover:bg-[rgba(1,120,39,0.05)]',
            )}
          >
            <Eye className="h-4 w-4" />
            Active
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, visibility: 'inactive' }))}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all',
              formData.visibility === 'inactive'
                ? 'border-gray-500 bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-[0_4px_15px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50',
            )}
          >
            <EyeOff className="h-4 w-4" />
            Inactive
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(168,85,247,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
        >
          {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  )
}

