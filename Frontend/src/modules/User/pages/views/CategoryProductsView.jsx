import { useMemo, useState, useEffect } from 'react'
import { ProductCard } from '../../components/ProductCard'
import { ChevronLeftIcon, FilterIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import * as userApi from '../../services/userApi'
import { TransText } from '../../../../components/TransText'
import { Trans } from '../../../../components/Trans'

export function CategoryProductsView({ categoryId, onProductClick, onAddToCart, onBack, onToggleFavourite, favourites = [] }) {
  const [selectedCategory, setSelectedCategory] = useState(categoryId || 'all')
  const [showFilters, setShowFilters] = useState(false)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    priceRange: 'all',
    availability: {
      inStock: true,
      lowStock: false,
      outOfStock: false,
    },
    rating: {
      rating45: false,
      rating40: false,
      rating35: false,
    },
  })

  // Fetch categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await userApi.getCategories()
        if (result.success && result.data?.categories) {
          setCategories(result.data.categories)
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Fetch products for selected category
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      try {
        const params = { limit: 100 }
        if (selectedCategory !== 'all') {
          params.category = selectedCategory
        }
        const result = await userApi.getProducts(params)
        if (result.success && result.data?.products) {
          setProducts(result.data.products)
        }
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [selectedCategory])

  const category = useMemo(() => {
    if (selectedCategory === 'all') return null
    return categories.find((cat) => (cat._id || cat.id) === selectedCategory)
  }, [selectedCategory, categories])

  const categoryProducts = useMemo(() => {
    let filtered = [...products]

    // Apply price filter
    if (filters.priceRange !== 'all') {
      const [min, max] = filters.priceRange.split('-').map((v) => (v === '+' ? Infinity : parseInt(v.replace(/[₹,]/g, ''))))
      filtered = filtered.filter((product) => {
        const price = product.priceToUser || product.price || 0
        if (max === Infinity) {
          return price >= min
        }
        return price >= min && price <= max
      })
    }

    // Apply availability filter
    const availabilityFilters = []
    if (filters.availability.inStock) availabilityFilters.push('inStock')
    if (filters.availability.lowStock) availabilityFilters.push('lowStock')
    if (filters.availability.outOfStock) availabilityFilters.push('outOfStock')

    if (availabilityFilters.length > 0) {
      filtered = filtered.filter((product) => {
        const stockStatus = product.stock > 10 ? 'inStock' : product.stock > 0 ? 'lowStock' : 'outOfStock'
        return availabilityFilters.includes(stockStatus)
      })
    }

    // Apply rating filter
    const ratingFilters = []
    if (filters.rating.rating45) ratingFilters.push(4.5)
    if (filters.rating.rating40) ratingFilters.push(4.0)
    if (filters.rating.rating35) ratingFilters.push(3.5)

    if (ratingFilters.length > 0) {
      const minRating = Math.max(...ratingFilters)
      filtered = filtered.filter((product) => (product.rating || 0) >= minRating)
    }

    return filtered
  }, [products, filters])

  const allCategories = [
    { id: 'all', name: 'All' },
    ...categories,
  ]

  const handleCategoryClick = (catId) => {
    setSelectedCategory(catId)
  }

  return (
    <div className="user-category-products-view space-y-4">
      {/* Header */}
      <div className="user-category-products-view__header">
        <button
          type="button"
          className="user-category-products-view__back"
          onClick={onBack}
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="user-category-products-view__header-content">
          <div className="user-category-products-view__header-text">
            <h2 className="user-category-products-view__title">
              {category ? <TransText>{category.name}</TransText> : <Trans>All Products</Trans>}
            </h2>
            <p className="user-category-products-view__subtitle">
              {categoryProducts.length} <Trans>{categoryProducts.length === 1 ? 'product' : 'products'}</Trans> <Trans>available</Trans>
            </p>
          </div>
          <button
            type="button"
            className="user-category-products-view__filter-btn"
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Filter"
          >
            <FilterIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Category Filter Menu */}
      <div className="user-category-products-view__categories">
        <div className="user-category-products-view__categories-rail">
          {allCategories.map((cat, index) => (
            <button
              key={cat._id || cat.id || `category-${index}`}
              type="button"
              className={cn(
                'user-category-products-view__category-tab',
                selectedCategory === (cat._id || cat.id) && 'user-category-products-view__category-tab--active'
              )}
              onClick={() => handleCategoryClick(cat._id || cat.id)}
            >
              {cat.name === 'All' ? <Trans>All</Trans> : <TransText>{cat.name}</TransText>}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="user-category-products-view__filter-overlay" onClick={() => setShowFilters(false)}>
          <div className="user-category-products-view__filter-panel" onClick={(e) => e.stopPropagation()}>
            <div className="user-category-products-view__filter-header">
              <h3 className="user-category-products-view__filter-title"><Trans>Filter Products</Trans></h3>
              <button
                type="button"
                className="user-category-products-view__filter-close"
                onClick={() => setShowFilters(false)}
                aria-label="Close filter"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="user-category-products-view__filter-content">
              <div className="user-category-products-view__filter-section">
                <h4 className="user-category-products-view__filter-section-title"><Trans>Price Range</Trans></h4>
                <div className="user-category-products-view__filter-options">
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="radio"
                      name="price"
                      value="all"
                      checked={filters.priceRange === 'all'}
                      onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                    />
                    <span><Trans>All Prices</Trans></span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="radio"
                      name="price"
                      value="0-500"
                      checked={filters.priceRange === '0-500'}
                      onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                    />
                    <span>₹0 - ₹500</span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="radio"
                      name="price"
                      value="500-1000"
                      checked={filters.priceRange === '500-1000'}
                      onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                    />
                    <span>₹500 - ₹1,000</span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="radio"
                      name="price"
                      value="1000-2000"
                      checked={filters.priceRange === '1000-2000'}
                      onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                    />
                    <span>₹1,000 - ₹2,000</span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="radio"
                      name="price"
                      value="2000+"
                      checked={filters.priceRange === '2000+'}
                      onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                    />
                    <span>₹2,000+</span>
                  </label>
                </div>
              </div>
              <div className="user-category-products-view__filter-section">
                <h4 className="user-category-products-view__filter-section-title"><Trans>Availability</Trans></h4>
                <div className="user-category-products-view__filter-options">
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="checkbox"
                      checked={filters.availability.inStock}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          availability: { ...filters.availability, inStock: e.target.checked },
                        })
                      }
                    />
                    <span><Trans>In Stock</Trans></span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="checkbox"
                      checked={filters.availability.lowStock}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          availability: { ...filters.availability, lowStock: e.target.checked },
                        })
                      }
                    />
                    <span><Trans>Low Stock</Trans></span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="checkbox"
                      checked={filters.availability.outOfStock}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          availability: { ...filters.availability, outOfStock: e.target.checked },
                        })
                      }
                    />
                    <span><Trans>Out of Stock</Trans></span>
                  </label>
                </div>
              </div>
              <div className="user-category-products-view__filter-section">
                <h4 className="user-category-products-view__filter-section-title"><Trans>Rating</Trans></h4>
                <div className="user-category-products-view__filter-options">
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="checkbox"
                      checked={filters.rating.rating45}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          rating: { ...filters.rating, rating45: e.target.checked },
                        })
                      }
                    />
                    <span>4.5 & <Trans>above</Trans></span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="checkbox"
                      checked={filters.rating.rating40}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          rating: { ...filters.rating, rating40: e.target.checked },
                        })
                      }
                    />
                    <span>4.0 & <Trans>above</Trans></span>
                  </label>
                  <label className="user-category-products-view__filter-option">
                    <input
                      type="checkbox"
                      checked={filters.rating.rating35}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          rating: { ...filters.rating, rating35: e.target.checked },
                        })
                      }
                    />
                    <span>3.5 & <Trans>above</Trans></span>
                  </label>
                </div>
              </div>
            </div>
            <div className="user-category-products-view__filter-actions">
              <button
                type="button"
                className="user-category-products-view__filter-reset"
                onClick={() => {
                  setFilters({
                    priceRange: 'all',
                    availability: {
                      inStock: true,
                      lowStock: false,
                      outOfStock: false,
                    },
                    rating: {
                      rating45: false,
                      rating40: false,
                      rating35: false,
                    },
                  })
                }}
              >
                <Trans>Reset</Trans>
              </button>
              <button
                type="button"
                className="user-category-products-view__filter-apply"
                onClick={() => setShowFilters(false)}
              >
                <Trans>Apply Filters</Trans>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - 2 Column Layout for Laptop */}
      <div className="user-category-products-view__main-content">
        {/* This wrapper is hidden on laptop, only used for mobile structure */}
      </div>

      {/* Left Column - Filters Sidebar (Laptop) - Outside main-content for sticky behavior */}
      <div className="user-category-products-view__filters-sidebar">
        <div className="user-category-products-view__filter-panel-desktop">
          <div className="user-category-products-view__filter-header-desktop">
            <h3 className="user-category-products-view__filter-title-desktop">Filter Products</h3>
          </div>
          <div className="user-category-products-view__filter-content-desktop">
            <div className="user-category-products-view__filter-section">
              <h4 className="user-category-products-view__filter-section-title">Price Range</h4>
              <div className="user-category-products-view__filter-options">
                <label className="user-category-products-view__filter-option">
                  <input
                    type="radio"
                    name="price-desktop"
                    value="all"
                    checked={filters.priceRange === 'all'}
                    onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  />
                  <span>All Prices</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="radio"
                    name="price-desktop"
                    value="0-500"
                    checked={filters.priceRange === '0-500'}
                    onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  />
                  <span>₹0 - ₹500</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="radio"
                    name="price-desktop"
                    value="500-1000"
                    checked={filters.priceRange === '500-1000'}
                    onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  />
                  <span>₹500 - ₹1,000</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="radio"
                    name="price-desktop"
                    value="1000-2000"
                    checked={filters.priceRange === '1000-2000'}
                    onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  />
                  <span>₹1,000 - ₹2,000</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="radio"
                    name="price-desktop"
                    value="2000+"
                    checked={filters.priceRange === '2000+'}
                    onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  />
                  <span>₹2,000+</span>
                </label>
              </div>
            </div>
            <div className="user-category-products-view__filter-section">
              <h4 className="user-category-products-view__filter-section-title">Availability</h4>
              <div className="user-category-products-view__filter-options">
                <label className="user-category-products-view__filter-option">
                  <input
                    type="checkbox"
                    checked={filters.availability.inStock}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        availability: { ...filters.availability, inStock: e.target.checked },
                      })
                    }
                  />
                  <span>In Stock</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="checkbox"
                    checked={filters.availability.lowStock}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        availability: { ...filters.availability, lowStock: e.target.checked },
                      })
                    }
                  />
                  <span>Low Stock</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="checkbox"
                    checked={filters.availability.outOfStock}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        availability: { ...filters.availability, outOfStock: e.target.checked },
                      })
                    }
                  />
                  <span>Out of Stock</span>
                </label>
              </div>
            </div>
            <div className="user-category-products-view__filter-section">
              <h4 className="user-category-products-view__filter-section-title">Rating</h4>
              <div className="user-category-products-view__filter-options">
                <label className="user-category-products-view__filter-option">
                  <input
                    type="checkbox"
                    checked={filters.rating.rating45}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        rating: { ...filters.rating, rating45: e.target.checked },
                      })
                    }
                  />
                  <span>4.5 & above</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="checkbox"
                    checked={filters.rating.rating40}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        rating: { ...filters.rating, rating40: e.target.checked },
                      })
                    }
                  />
                  <span>4.0 & above</span>
                </label>
                <label className="user-category-products-view__filter-option">
                  <input
                    type="checkbox"
                    checked={filters.rating.rating35}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        rating: { ...filters.rating, rating35: e.target.checked },
                      })
                    }
                  />
                  <span>3.5 & above</span>
                </label>
              </div>
            </div>
          </div>
          <div className="user-category-products-view__filter-actions-desktop">
            <button
              type="button"
              className="user-category-products-view__filter-reset-desktop"
              onClick={() => {
                setFilters({
                  priceRange: 'all',
                  availability: {
                    inStock: true,
                    lowStock: false,
                    outOfStock: false,
                  },
                  rating: {
                    rating45: false,
                    rating40: false,
                    rating35: false,
                  },
                })
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Right Column - Products Grid (Laptop) - Outside main-content */}
      <div className="user-category-products-view__products-column">
        {/* Products List */}
        {loading ? (
          <div className="user-category-products-view__empty">
            <p className="user-category-products-view__empty-text">Loading products...</p>
          </div>
        ) : categoryProducts.length === 0 ? (
          <div className="user-category-products-view__empty">
            <p className="user-category-products-view__empty-text">No products found in this category</p>
          </div>
        ) : (
          <div className="user-category-products-view__list-desktop">
            {categoryProducts.map((product, index) => (
              <ProductCard
                key={product._id || product.id || `product-${index}`}
                product={{
                  id: product._id || product.id,
                  name: product.name,
                  price: product.priceToUser || product.price || 0,
                  image: product.images?.[0]?.url || product.primaryImage || product.image,
                  category: product.category,
                  stock: product.stock,
                  description: product.description,
                  isWishlisted: favourites.includes(product._id || product.id),
                  rating: product.rating ?? product.averageRating,
                  reviews: product.reviews ?? product.reviewCount,
                  reviewCount: product.reviewCount ?? product.reviews,
                }}
                onNavigate={onProductClick}
                onAddToCart={onAddToCart}
                onWishlist={onToggleFavourite}
                className="product-card-wrapper"
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile Products List */}
      {loading ? (
        <div className="user-category-products-view__empty-mobile">
          <p className="user-category-products-view__empty-text">Loading products...</p>
        </div>
      ) : categoryProducts.length === 0 ? (
        <div className="user-category-products-view__empty-mobile">
          <p className="user-category-products-view__empty-text">No products found in this category</p>
        </div>
      ) : (
        <div className="user-category-products-view__list-mobile">
          {categoryProducts.map((product, index) => (
            <div key={product._id || product.id || `product-${index}`} className="user-category-products-view__card-wrapper">
              <div
                className="user-category-products-view__card"
                onClick={() => onProductClick?.(product._id || product.id)}
              >
                <div className="user-category-products-view__card-image-section">
                  <div className="user-category-products-view__card-image-wrapper">
                    <img
                      src={product.images?.[0]?.url || product.primaryImage || product.image || 'https://via.placeholder.com/300'}
                      alt={product.name}
                      className="user-category-products-view__card-image"
                    />
                    <button
                      type="button"
                      className="user-category-products-view__card-wishlist"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFavourite?.(product._id || product.id)
                      }}
                      aria-label="Add to wishlist"
                    >
                      <svg className="h-5 w-5" fill={favourites.includes(product._id || product.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                  <div className={cn(
                    'user-category-products-view__card-stock',
                    product.stock > 10 ? 'user-category-products-view__card-stock--in' : product.stock > 0 ? 'user-category-products-view__card-stock--low' : 'user-category-products-view__card-stock--out'
                  )}>
                    <Trans>{product.stock > 10 ? 'In Stock' : product.stock > 0 ? 'Low Stock' : 'Out of Stock'}</Trans>
                  </div>
                </div>
                <div className="user-category-products-view__card-content">
                  <div className="user-category-products-view__card-header">
                    <div className="user-category-products-view__card-info">
                      <h3 className="user-category-products-view__card-title"><TransText>{product.name}</TransText></h3>
                      {product.vendor && (
                        <p className="user-category-products-view__card-vendor"><TransText>{product.vendor.name}</TransText></p>
                      )}
                    </div>
                    <div className="user-category-products-view__card-rating">
                      <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="user-category-products-view__card-rating-text">
                        {product.rating?.toFixed(1) || '4.0'}
                      </span>
                    </div>
                  </div>
                  <div className="user-category-products-view__card-body">
                    <div className="user-category-products-view__card-price-section">
                      <div className="user-category-products-view__card-price-main">
                        <span className="user-category-products-view__card-price">₹{(product.priceToUser || product.price || 0).toLocaleString('en-IN')}</span>
                        {product.originalPrice && product.originalPrice > (product.priceToUser || product.price) && (
                          <span className="user-category-products-view__card-price-original">
                            ₹{product.originalPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="user-category-products-view__card-footer">
                    <button
                      type="button"
                      className={cn(
                        'user-category-products-view__card-button',
                        product.stock > 0 ? 'user-category-products-view__card-button--active' : 'user-category-products-view__card-button--disabled'
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (product.stock > 0) {
                          onAddToCart?.(product._id || product.id)
                        }
                      }}
                      disabled={product.stock === 0}
                    >
                      <Trans>{product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}</Trans>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
