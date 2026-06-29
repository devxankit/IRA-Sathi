import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from '../../../context/TranslationContext'
import { Layout, Container } from '../components/Layout'
import { useWebsiteApi } from '../hooks/useWebsiteApi'
import { useWebsiteState, useWebsiteDispatch } from '../context/WebsiteContext'
import * as websiteApi from '../services/websiteApi'
import { getAllImageUrls, getPrimaryImageUrl } from '../utils/productImages'
import { cn } from '../../../lib/cn'
import '../styles/website.css'

export function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const dispatch = useWebsiteDispatch()
  const { favourites, authenticated } = useWebsiteState()
  const { addToCart, addToFavourites, removeFromFavourites, fetchProducts } = useWebsiteApi()

  const { translateProduct } = useTranslation()
  const [rawProduct, setProduct] = useState(null)
  const product = useMemo(() => translateProduct(rawProduct), [rawProduct, translateProduct])
  const [similarProducts, setSimilarProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [selectedAttributes, setSelectedAttributes] = useState({})
  const [selectedAttributeStock, setSelectedAttributeStock] = useState(null)
  const [selectedVariants, setSelectedVariants] = useState([])
  const [variantQuantities, setVariantQuantities] = useState({})
  const [activeTab, setActiveTab] = useState('description')
  const [variantError, setVariantError] = useState('')
  const variantSectionRef = useRef(null)
  const containerRef = useRef(null)

  // Fetch product details and related products
  useEffect(() => {
    const loadProduct = async () => {
      if (!productId || productId === 'all') {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await websiteApi.getProductDetails(productId)
        if (result.success && result.data?.product) {
          const productData = result.data.product
          setProduct(productData)
          setIsWishlisted(productData.isWishlisted || favourites.includes(productId))

          // Fetch similar products (same category)
          if (productData.category) {
            const similarResult = await websiteApi.getProducts({
              category: productData.category,
              limit: 10
            })
            if (similarResult.success && similarResult.data?.products) {
              const similar = similarResult.data.products
                .filter((p) => (p._id || p.id) !== productId)
                .slice(0, 8)
              setSimilarProducts(similar)
            }
          }
        }
      } catch (error) {
        console.error('Error loading product:', error)
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      loadProduct()
    }
  }, [productId, favourites])

  // Smart attribute mapping: Group by attribute name, then show properties
  const attributeStructure = useMemo(() => {
    if (!product?.attributeStocks || product.attributeStocks.length === 0) {
      return { attributeNameKey: null, attributeNames: [], attributeProperties: {} }
    }

    const allKeys = new Set()
    product.attributeStocks.forEach(stock => {
      if (stock.attributes) {
        Object.keys(stock.attributes).forEach(key => allKeys.add(key))
      }
    })

    let attributeNameKey = null
    const possibleNameKeys = Array.from(allKeys).filter(key =>
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('attribute') ||
      key.toLowerCase() === 'type' && Array.from(allKeys).length > 2
    )

    if (possibleNameKeys.length > 0) {
      attributeNameKey = possibleNameKeys[0]
    } else {
      const keyValueCounts = {}
      Array.from(allKeys).forEach(key => {
        const uniqueValues = new Set()
        product.attributeStocks.forEach(stock => {
          if (stock.attributes && stock.attributes[key]) {
            uniqueValues.add(stock.attributes[key])
          }
        })
        keyValueCounts[key] = uniqueValues.size
      })
      const sortedKeys = Object.entries(keyValueCounts)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count < product.attributeStocks.length)

      attributeNameKey = sortedKeys.length > 0 ? sortedKeys[0][0] : Array.from(allKeys)[0]
    }

    const attributeNames = new Set()
    product.attributeStocks.forEach(stock => {
      if (stock.attributes && stock.attributes[attributeNameKey]) {
        attributeNames.add(stock.attributes[attributeNameKey])
      }
    })

    const attributeProperties = {}
    Array.from(attributeNames).forEach(attrName => {
      attributeProperties[attrName] = {}

      const relevantStocks = product.attributeStocks.filter(stock =>
        stock.attributes && stock.attributes[attributeNameKey] === attrName
      )

      relevantStocks.forEach(stock => {
        Object.keys(stock.attributes).forEach(key => {
          if (key !== attributeNameKey) {
            if (!attributeProperties[attrName][key]) {
              attributeProperties[attrName][key] = new Set()
            }
            const value = stock.attributes[key]
            if (value) {
              if (Array.isArray(value)) {
                value.forEach(v => attributeProperties[attrName][key].add(v))
              } else {
                attributeProperties[attrName][key].add(value)
              }
            }
          }
        })
      })

      Object.keys(attributeProperties[attrName]).forEach(propKey => {
        attributeProperties[attrName][propKey] = Array.from(attributeProperties[attrName][propKey]).sort()
      })
    })

    return {
      attributeNameKey,
      attributeNames: Array.from(attributeNames).sort(),
      attributeProperties
    }
  }, [product])

  const availableProperties = useMemo(() => {
    if (!selectedAttributes[attributeStructure.attributeNameKey]) {
      return {}
    }
    const selectedAttrName = selectedAttributes[attributeStructure.attributeNameKey]
    return attributeStructure.attributeProperties[selectedAttrName] || {}
  }, [selectedAttributes, attributeStructure])

  const findMatchingAttributeStock = useMemo(() => {
    if (!product?.attributeStocks || product.attributeStocks.length === 0) {
      return null
    }

    if (Object.keys(selectedAttributes).length === 0) {
      return null
    }

    return product.attributeStocks.find(stock => {
      if (!stock.attributes) return false
      return Object.keys(selectedAttributes).every(key => {
        const stockValue = stock.attributes[key]
        const selectedValue = selectedAttributes[key]

        if (Array.isArray(stockValue)) {
          return stockValue.includes(selectedValue)
        }
        if (Array.isArray(selectedValue)) {
          return selectedValue.includes(stockValue)
        }
        return stockValue === selectedValue
      })
    }) || null
  }, [product, selectedAttributes])

  useEffect(() => {
    setSelectedAttributeStock(findMatchingAttributeStock)
    if (findMatchingAttributeStock) {
      setQuantity(1)
    }
  }, [findMatchingAttributeStock])

  useEffect(() => {
    if (product) {
      setQuantity(1)
      setSelectedImage(0)
      setSelectedAttributes({})
      setSelectedAttributeStock(null)
      setSelectedVariants([])
      setVariantError('')
      setIsWishlisted(product.isWishlisted || favourites.includes(productId))
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [productId, product, favourites])

  const images = useMemo(() => {
    if (!product) {
      return ['https://via.placeholder.com/400']
    }
    const allImages = getAllImageUrls(product)
    return allImages.length > 0 ? allImages : ['https://via.placeholder.com/400']
  }, [product])

  const currentStock = useMemo(() => {
    if (!product) return 0
    if (selectedAttributeStock) {
      return selectedAttributeStock.displayStock || 0
    }
    return product.displayStock || product.stock || 0
  }, [product, selectedAttributeStock])

  const currentPrice = useMemo(() => {
    if (!product) return 0
    if (selectedAttributeStock) {
      return Math.round(selectedAttributeStock.userPrice || 0)
    }
    return Math.round(product.priceToUser || product.price || 0)
  }, [product, selectedAttributeStock])

  const originalPrice = useMemo(() => {
    if (!product) return 0
    if (selectedAttributeStock && selectedAttributeStock.originalPrice) {
      return Math.round(selectedAttributeStock.originalPrice)
    }
    return Math.round(product.originalPrice || product.priceToUser || product.price || 0)
  }, [product, selectedAttributeStock])

  const currentStockUnit = useMemo(() => {
    if (!product) return 'kg'
    if (selectedAttributeStock) {
      return selectedAttributeStock.stockUnit || 'kg'
    }
    return product.stockUnit || 'kg'
  }, [product, selectedAttributeStock])

  const hasAttributes = useMemo(() => {
    if (!product) return false
    if (product.attributeStocks && Array.isArray(product.attributeStocks) && product.attributeStocks.length > 0) {
      return product.attributeStocks.some(stock =>
        stock &&
        stock.attributes &&
        typeof stock.attributes === 'object' &&
        Object.keys(stock.attributes).length > 0
      )
    }
    return false
  }, [product])

  const getVariantKey = useCallback((variantStock) => {
    const stockAttrs = variantStock.attributes instanceof Map
      ? Object.fromEntries(variantStock.attributes)
      : variantStock.attributes || {}
    return JSON.stringify(stockAttrs)
  }, [])

  const totalVariantPrice = useMemo(() => {
    return selectedVariants.reduce((total, variant) => {
      const variantKey = getVariantKey(variant)
      const variantQty = variantQuantities[variantKey] || 1
      return total + (Math.round(variant.userPrice || variant.priceToUser || 0) * variantQty)
    }, 0)
  }, [selectedVariants, variantQuantities, getVariantKey])

  useEffect(() => {
    if (selectedVariants.length === 1) {
      setSelectedAttributeStock(selectedVariants[0])
    } else if (selectedVariants.length === 0) {
      setSelectedAttributeStock(null)
    }
  }, [selectedVariants])

  const inStock = currentStock > 0
  const stockStatus = currentStock > 10 ? 'In Stock' : currentStock > 0 ? 'Low Stock' : 'Out of Stock'
  const maxQuantity = currentStock

  const handleProductClick = (clickedProductId) => {
    navigate(`/product/${clickedProductId}`)
  }

  if (loading) {
    return (
      <Layout>
        <Container className="product-detail">
          <div className="text-center py-12">
            <p className="text-lg font-semibold text-gray-600">Loading product...</p>
          </div>
        </Container>
      </Layout>
    )
  }

  if (!product) {
    return (
      <Layout>
        <Container className="product-detail">
          <div className="text-center py-12">
            <p className="text-lg font-semibold text-gray-600 mb-4">Product not found</p>
            <button
              type="button"
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#017827] to-[#0a9937] text-white font-semibold"
              onClick={() => navigate(-1)}
            >
              Go Back
            </button>
          </div>
        </Container>
      </Layout>
    )
  }

  const handleAttributeChange = (attributeKey, value) => {
    setSelectedAttributes(prev => {
      const newSelection = { ...prev, [attributeKey]: value }
      if (attributeKey === attributeStructure.attributeNameKey) {
        return { [attributeKey]: value }
      }
      return newSelection
    })
    setVariantError('')
  }

  const handleVariantToggle = (variantStock) => {
    const variantKey = getVariantKey(variantStock)

    setSelectedVariants(prev => {
      const stockAttrs = variantStock.attributes instanceof Map
        ? Object.fromEntries(variantStock.attributes)
        : variantStock.attributes || {}

      const exists = prev.find(v => {
        const vAttrs = v.attributes instanceof Map
          ? Object.fromEntries(v.attributes)
          : v.attributes || {}
        return JSON.stringify(vAttrs) === JSON.stringify(stockAttrs)
      })

      if (exists) {
        setVariantQuantities(prevQty => {
          const newQty = { ...prevQty }
          delete newQty[variantKey]
          return newQty
        })
        return prev.filter(v => {
          const vAttrs = v.attributes instanceof Map
            ? Object.fromEntries(v.attributes)
            : v.attributes || {}
          return JSON.stringify(vAttrs) !== JSON.stringify(stockAttrs)
        })
      } else {
        setVariantQuantities(prevQty => ({
          ...prevQty,
          [variantKey]: 1
        }))
        return [...prev, variantStock]
      }
    })
    setVariantError('')
  }

  const handleVariantQuantityChange = (variantStock, delta) => {
    const variantKey = getVariantKey(variantStock)
    const currentQty = variantQuantities[variantKey] || 1
    const maxQty = variantStock.displayStock || variantStock.actualStock || 999

    const newQty = Math.max(1, Math.min(maxQty, currentQty + delta))
    setVariantQuantities(prev => ({
      ...prev,
      [variantKey]: newQty
    }))
  }

  const formatAttributeLabel = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  const handleAddToCart = async () => {
    if (!inStock) {
      return
    }

    if (!authenticated) {
      navigate('/login')
      return
    }

    if (hasAttributes && attributeStructure.attributeNames.length > 0) {
      if (selectedVariants.length === 0) {
        setVariantError('Please select at least one variant to proceed')
        setTimeout(() => {
          if (variantSectionRef.current) {
            variantSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        return
      }
    }

    setVariantError('')

    try {
      if (selectedVariants.length > 0) {
        for (const variant of selectedVariants) {
          const variantAttrs = variant.attributes instanceof Map
            ? Object.fromEntries(variant.attributes)
            : variant.attributes || {}
          const variantKey = getVariantKey(variant)
          const variantQty = variantQuantities[variantKey] || 1
          await addToCart(productId, variantQty, variantAttrs)
        }
      } else {
        await addToCart(productId, quantity)
      }
    } catch (error) {
      console.error('Failed to add to cart:', error)
    }
  }

  const handleBuyNow = async () => {
    await handleAddToCart()
    navigate('/cart')
  }

  const handleToggleWishlist = async () => {
    if (!authenticated) {
      navigate('/login')
      return
    }

    try {
      if (isWishlisted) {
        await removeFromFavourites(productId)
        dispatch({ type: 'REMOVE_FROM_FAVOURITES', payload: { productId } })
        setIsWishlisted(false)
      } else {
        await addToFavourites(productId)
        dispatch({ type: 'ADD_TO_FAVOURITES', payload: { productId } })
        setIsWishlisted(true)
      }
    } catch (error) {
      console.error('Failed to toggle wishlist:', error)
    }
  }

  const discount = originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0

  return (
    <Layout>
      <Container className="product-detail" ref={containerRef}>
        <div className="product-detail__layout">
          {/* Left Column: Image Gallery */}
          <div className="product-detail__gallery">
            <div className="product-detail__main-image">
              <img src={images[selectedImage] || images[0]} alt={product.name} />
            </div>

            {images.length > 1 && (
              <div className="product-detail__thumbnails">
                {images.map((img, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      'product-detail__thumbnail',
                      selectedImage === index && 'product-detail__thumbnail--active'
                    )}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={img} alt={`${product.name} view ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Info */}
          <div className="product-detail__info">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="product-detail__title">{product.name}</h1>
              {authenticated && (
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className="p-2 rounded-lg border-2 transition-all"
                  style={{
                    borderColor: isWishlisted ? '#ef4444' : '#e5e7eb',
                    backgroundColor: isWishlisted ? '#fef2f2' : 'transparent'
                  }}
                >
                  <svg
                    className="h-6 w-6"
                    fill={isWishlisted ? '#ef4444' : 'none'}
                    stroke={isWishlisted ? '#ef4444' : 'currentColor'}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Rating */}
            <div className="product-detail__rating">
              <div className="product-detail__rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className="h-5 w-5"
                    fill={star <= Math.round(product.rating || 0) ? '#fbbf24' : 'none'}
                    stroke={star <= Math.round(product.rating || 0) ? '#fbbf24' : '#d1d5db'}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                ))}
              </div>
              <span className="product-detail__rating-text">
                {product.rating || 0} ({product.reviews || 0} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="product-detail__price">
              <span className="product-detail__price-current">
                ₹{currentPrice.toLocaleString('en-IN')}
              </span>
              {originalPrice > currentPrice && (
                <>
                  <span className="product-detail__price-original">
                    ₹{originalPrice.toLocaleString('en-IN')}
                  </span>
                  {discount > 0 && (
                    <span className="product-detail__price-discount">
                      {discount}% OFF
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Variant Selection */}
            {hasAttributes && attributeStructure.attributeNames.length > 0 && (
              <div ref={variantSectionRef} className="product-detail__variants">
                {variantError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border-2 border-red-300">
                    <p className="text-sm font-semibold text-red-600">{variantError}</p>
                  </div>
                )}

                {/* Step 1: Select Attribute Name */}
                {attributeStructure.attributeNameKey && (
                  <div className="product-detail__variant-group">
                    <label className="product-detail__variant-label">
                      {formatAttributeLabel(attributeStructure.attributeNameKey)}
                    </label>
                    <div className="product-detail__variant-options">
                      {attributeStructure.attributeNames.map((attrName) => {
                        const isSelected = selectedAttributes[attributeStructure.attributeNameKey] === attrName
                        return (
                          <button
                            key={attrName}
                            type="button"
                            onClick={() => handleAttributeChange(attributeStructure.attributeNameKey, attrName)}
                            className={cn(
                              'product-detail__variant-option',
                              isSelected && 'product-detail__variant-option--selected'
                            )}
                          >
                            {attrName}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Show Properties for selected Attribute Name */}
                {selectedAttributes[attributeStructure.attributeNameKey] && Object.keys(availableProperties).length > 0 && (
                  <div className="product-detail__variant-group">
                    {Object.keys(availableProperties).map((propKey) => (
                      <div key={propKey} className="mb-4">
                        <label className="product-detail__variant-label">
                          {formatAttributeLabel(propKey)}
                        </label>
                        <div className="product-detail__variant-options">
                          {availableProperties[propKey].map((value) => {
                            const isSelected = selectedAttributes[propKey] === value
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => handleAttributeChange(propKey, value)}
                                className={cn(
                                  'product-detail__variant-option',
                                  isSelected && 'product-detail__variant-option--selected'
                                )}
                              >
                                {value}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show all available variants for selection */}
                {selectedAttributes[attributeStructure.attributeNameKey] && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Available Variants (Select one or more):
                    </p>
                    {product.attributeStocks
                      .filter(stock => {
                        if (!stock.attributes || !stock.attributes[attributeStructure.attributeNameKey]) return false
                        const stockAttrs = stock.attributes instanceof Map
                          ? Object.fromEntries(stock.attributes)
                          : stock.attributes
                        return stockAttrs[attributeStructure.attributeNameKey] === selectedAttributes[attributeStructure.attributeNameKey]
                      })
                      .map((variantStock, idx) => {
                        const stockAttrs = variantStock.attributes instanceof Map
                          ? Object.fromEntries(variantStock.attributes)
                          : variantStock.attributes || {}

                        const isSelected = selectedVariants.some(v => {
                          const vAttrs = v.attributes instanceof Map
                            ? Object.fromEntries(v.attributes)
                            : v.attributes || {}
                          return JSON.stringify(vAttrs) === JSON.stringify(stockAttrs)
                        })

                        const variantAttributes = Object.entries(stockAttrs)
                          .filter(([key]) => key !== attributeStructure.attributeNameKey)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ')

                        const variantKey = getVariantKey(variantStock)
                        const variantQty = variantQuantities[variantKey] || 1
                        const maxQty = variantStock.displayStock || variantStock.actualStock || 999
                        const variantPrice = Math.round(variantStock.userPrice || variantStock.priceToUser || 0)

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'p-3 rounded-lg border-2 transition-all',
                              isSelected
                                ? 'bg-[rgba(1,120,39,0.04)] border-[#017827]'
                                : 'bg-white border-gray-200'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-gray-700 mb-1">
                                  Variant {idx + 1}: {variantAttributes || 'No additional attributes'}
                                </p>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-gray-600">
                                    Stock: <span className="font-semibold">{variantStock.displayStock || 0} {variantStock.stockUnit || 'kg'}</span>
                                  </span>
                                  <span className="text-[#017827] font-bold">
                                    ₹{variantPrice.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleVariantToggle(variantStock)}
                                className={cn(
                                  'w-5 h-5 rounded border-2 flex items-center justify-center',
                                  isSelected
                                    ? 'bg-[#017827] border-[#017827]'
                                    : 'bg-white border-gray-300'
                                )}
                              >
                                {isSelected && (
                                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            </div>

                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Quantity</label>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-white p-1.5">
                                    <button
                                      type="button"
                                      className="w-7 h-7 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleVariantQuantityChange(variantStock, -1)
                                      }}
                                      disabled={variantQty <= 1}
                                    >
                                      <span className="text-gray-700">−</span>
                                    </button>
                                    <span className="px-2 text-sm font-semibold text-gray-900 min-w-[2rem] text-center">{variantQty}</span>
                                    <button
                                      type="button"
                                      className="w-7 h-7 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleVariantQuantityChange(variantStock, 1)
                                      }}
                                      disabled={variantQty >= maxQty}
                                    >
                                      <span className="text-gray-700">+</span>
                                    </button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-gray-600">Available: {maxQty}</p>
                                    <p className="text-xs font-bold text-[#017827]">
                                      Total: ₹{(variantPrice * variantQty).toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Quantity - Only show if no variants selected */}
            {(!hasAttributes || selectedVariants.length === 0) && (
              <div className="product-detail__quantity">
                <label>Quantity</label>
                <div className="product-detail__quantity-controls">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxQuantity || 999, q + 1))}
                    disabled={quantity >= maxQuantity}
                  >
                    +
                  </button>
                </div>
                {maxQuantity > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    Available: {maxQuantity} {currentStockUnit}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="product-detail__actions">
              <button
                className="product-detail__button-add"
                onClick={handleAddToCart}
                disabled={!inStock || (hasAttributes && selectedVariants.length === 0)}
              >
                Add to Cart
              </button>
              <button
                className="product-detail__button-buy"
                onClick={handleBuyNow}
                disabled={!inStock || (hasAttributes && selectedVariants.length === 0)}
              >
                Buy Now
              </button>
            </div>

            {/* Vendor Info */}
            {product.vendor && (
              <div className="product-detail__vendor">
                <p className="product-detail__vendor-name">{product.vendor.name}</p>
                {product.vendor.location && (
                  <p className="product-detail__vendor-location">
                    <svg className="h-4 w-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {product.vendor.location}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="product-detail__tabs">
          <div className="product-detail__tabs-nav">
            <button
              className={activeTab === 'description' ? 'active' : ''}
              onClick={() => setActiveTab('description')}
            >
              Description
            </button>
            <button
              className={activeTab === 'stock' ? 'active' : ''}
              onClick={() => setActiveTab('stock')}
            >
              Stock
            </button>
            <button
              className={activeTab === 'delivery' ? 'active' : ''}
              onClick={() => setActiveTab('delivery')}
            >
              Delivery
            </button>
          </div>

          <div className="product-detail__tabs-content">
            {activeTab === 'description' && (
              <div className="product-detail__description">
                {product.longDescription || product.description ? (
                  <div className="prose prose-sm max-w-none">
                    {(product.longDescription || product.description)
                      .split(/\n\n+/)
                      .flatMap(p => p.split(/\n/))
                      .map(p => p.trim())
                      .filter(p => p.length > 0)
                      .map((paragraph, idx) => (
                        <p key={idx} className="mb-4">{paragraph}</p>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No description available for this product.</p>
                )}
              </div>
            )}
            {activeTab === 'stock' && (
              <div className="product-detail__stock">
                <div className={cn(
                  'p-4 rounded-lg border-2',
                  inStock ? 'bg-[rgba(1,120,39,0.04)] border-[#017827]' : 'bg-red-50 border-red-500'
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      'w-4 h-4 rounded-full',
                      inStock ? 'bg-[#017827]' : 'bg-red-500'
                    )} />
                    <h3 className="text-lg font-bold text-gray-900">Stock Availability</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Status:</span>
                      <span className={cn(
                        'text-sm font-bold',
                        inStock ? 'text-[#017827]' : 'text-red-600'
                      )}>
                        {stockStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Available Quantity:</span>
                      <span className="text-sm font-bold text-gray-900">
                        {currentStock.toLocaleString('en-IN')} {currentStockUnit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'delivery' && (
              <div className="product-detail__delivery">
                <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900">Delivery Information</h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Estimated Delivery Time:</span>
                      <p className="text-base font-bold text-gray-900">
                        {product.deliveryTime || 'Within 24 hours'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <div className="product-detail__similar">
            <h2>Similar Products</h2>
            <div className="product-detail__similar-grid">
              {similarProducts.map((similarProduct) => {
                const similarProductId = similarProduct._id || similarProduct.id
                const similarImage = getPrimaryImageUrl(similarProduct)
                const similarInStock = (similarProduct.stock || 0) > 0
                const similarIsWishlisted = favourites.includes(similarProductId)

                return (
                  <div
                    key={similarProductId}
                    className="home-product-card"
                    onClick={() => handleProductClick(similarProductId)}
                  >
                    <div className="home-product-card__image-wrapper">
                      <img
                        src={similarImage}
                        alt={similarProduct.name}
                        className="home-product-card__image"
                      />
                      {authenticated && (
                        <button
                          type="button"
                          className="home-product-card__wishlist"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (similarIsWishlisted) {
                              removeFromFavourites(similarProductId)
                              dispatch({ type: 'REMOVE_FROM_FAVOURITES', payload: { productId: similarProductId } })
                            } else {
                              addToFavourites(similarProductId)
                              dispatch({ type: 'ADD_TO_FAVOURITES', payload: { productId: similarProductId } })
                            }
                          }}
                        >
                          <svg
                            className="h-5 w-5"
                            fill={similarIsWishlisted ? '#ef4444' : 'none'}
                            stroke={similarIsWishlisted ? '#ef4444' : 'currentColor'}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    <h3 className="home-product-card__title">{similarProduct.name}</h3>
                    <div className="home-product-card__price">
                      ₹{Math.round(similarProduct.priceToUser || similarProduct.price || 0).toLocaleString('en-IN')}
                    </div>
                    <button
                      className="home-product-card__button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (authenticated) {
                          addToCart(similarProductId, 1)
                        } else {
                          navigate('/login')
                        }
                      }}
                      disabled={!similarInStock}
                    >
                      {similarInStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Container>
    </Layout>
  )
}
