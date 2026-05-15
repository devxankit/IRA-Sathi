import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Layout, Container } from '../components/Layout'
import { useWebsiteApi } from '../hooks/useWebsiteApi'
import { useWebsiteState, useWebsiteDispatch } from '../context/WebsiteContext'
import * as websiteApi from '../services/websiteApi'
import { getPrimaryImageUrl } from '../utils/productImages'
import { cn } from '../../../lib/cn'
import '../styles/website.css'
import { useTranslation } from '../../../context/TranslationContext'
import { Trans } from '../../../components/Trans'
import { TransText } from '../../../components/TransText'

export function ProductListingPage() {
  const navigate = useNavigate()
  const dispatch = useWebsiteDispatch()
  const { favourites, authenticated } = useWebsiteState()
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const categoryId = searchParams.get('category') || ''
  const carouselId = searchParams.get('carousel') || ''

  const { fetchCategories, fetchProducts, addToCart, addToFavourites, removeFromFavourites } = useWebsiteApi()
  const { translateProduct } = useTranslation()

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortBy, setSortBy] = useState('popular')
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 })
  const [selectedCategory, setSelectedCategory] = useState(categoryId || 'all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await fetchCategories()
        if (result.data?.categories) {
          setCategories(result.data.categories)
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Fetch products based on filters
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      try {
        const params = {
          limit: 100,
          maxPrice: priceRange.max,
        }

        if (searchQuery.trim()) {
          params.search = searchQuery.trim()
        }

        if (selectedCategory !== 'all') {
          params.category = selectedCategory
        }

        if (carouselId) {
          // Handle carousel products if needed
          // This might need a separate API endpoint
        }

        // Map sortBy to API sort parameter
        if (sortBy === 'price-low') {
          params.sort = 'price_asc'
        } else if (sortBy === 'price-high') {
          params.sort = 'price_desc'
        } else if (sortBy === 'rating') {
          params.sort = 'rating_desc'
        } else {
          params.sort = 'popular'
        }

        const result = await fetchProducts(params)
        if (result.data?.products) {
          let filteredProducts = result.data.products

          // Apply availability filter client-side
          if (availabilityFilter !== 'all') {
            filteredProducts = filteredProducts.filter((product) => {
              const stock = product.stock || 0
              if (availabilityFilter === 'in-stock') {
                return stock > 10
              } else if (availabilityFilter === 'low-stock') {
                return stock > 0 && stock <= 10
              }
              return true
            })
          }

          // Filter by price range
          filteredProducts = filteredProducts.filter((product) => {
            const price = product.priceToUser || product.price || 0
            return price >= priceRange.min && price <= priceRange.max
          })

          setProducts(filteredProducts)
        }
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [searchQuery, selectedCategory, sortBy, priceRange, availabilityFilter, carouselId])

  // Update selected category when URL param changes
  useEffect(() => {
    if (categoryId) {
      setSelectedCategory(categoryId)
    }
  }, [categoryId])

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`)
  }

  const handleAddToCart = async (e, productId) => {
    e.stopPropagation()
    if (!authenticated) {
      navigate('/login')
      return
    }
    try {
      await addToCart(productId, 1)
    } catch (error) {
      console.error('Failed to add to cart:', error)
    }
  }

  const handleToggleFavourite = async (e, productId) => {
    e.stopPropagation()
    if (!authenticated) {
      navigate('/login')
      return
    }
    try {
      if (favourites.includes(productId)) {
        await removeFromFavourites(productId)
        dispatch({ type: 'REMOVE_FROM_FAVOURITES', payload: { productId } })
      } else {
        await addToFavourites(productId)
        dispatch({ type: 'ADD_TO_FAVOURITES', payload: { productId } })
      }
    } catch (error) {
      console.error('Failed to toggle favourite:', error)
    }
  }

  const handleClearFilters = () => {
    setSelectedCategory('all')
    setPriceRange({ min: 0, max: 10000 })
    setAvailabilityFilter('all')
    setSortBy('popular')
  }

  // Filter content component (reusable)
  const FilterContent = () => (
    <>
      {/* Category Filter */}
      <div className="product-listing__filter-group">
        <h4><Trans>Category</Trans></h4>
        <div className="product-listing__filter-options">
          <label className="product-listing__filter-checkbox">
            <input
              type="radio"
              name="category"
              value="all"
              checked={selectedCategory === 'all'}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />
            <span><Trans>All Categories</Trans></span>
          </label>
          {categories.map((category) => (
            <label key={category.id || category._id} className="product-listing__filter-checkbox">
              <input
                type="radio"
                name="category"
                value={category.id || category._id}
                checked={selectedCategory === (category.id || category._id)}
                onChange={(e) => setSelectedCategory(e.target.value)}
              />
              <span><TransText>{category.name}</TransText></span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="product-listing__filter-group">
        <h4><Trans>Price Range</Trans></h4>
        <div className="product-listing__filter-options">
          <input
            type="range"
            min="0"
            max="10000"
            step="100"
            value={priceRange.max}
            onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })}
            className="product-listing__price-slider"
          />
          <div className="product-listing__price-display">
            ₹{priceRange.min.toLocaleString('en-IN')} - ₹{priceRange.max.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="product-listing__filter-group">
        <h4><Trans>Availability</Trans></h4>
        <div className="product-listing__filter-options">
          <label className="product-listing__filter-checkbox">
            <input
              type="radio"
              name="availability"
              value="all"
              checked={availabilityFilter === 'all'}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
            />
            <span><Trans>All</Trans></span>
          </label>
          <label className="product-listing__filter-checkbox">
            <input
              type="radio"
              name="availability"
              value="in-stock"
              checked={availabilityFilter === 'in-stock'}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
            />
            <span><Trans>In Stock</Trans></span>
          </label>
          <label className="product-listing__filter-checkbox">
            <input
              type="radio"
              name="availability"
              value="low-stock"
              checked={availabilityFilter === 'low-stock'}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
            />
            <span><Trans>Low Stock</Trans></span>
          </label>
        </div>
      </div>
    </>
  )

  return (
    <Layout>
      <Container className="product-listing">
        {/* Filter Button - Mobile (sticky below header) */}
        <button
          className="product-listing__filter-button-mobile"
          onClick={() => setFiltersOpen(true)}
        >
          <Trans>Filters</Trans>
        </button>

        {/* Top Bar */}
        <div className="product-listing__topbar">
          <div className="product-listing__count">
            <span>
              {searchQuery ? <><Trans>Search: </Trans> "{searchQuery}"</> : <Trans>All Products</Trans>} - {products.length} <Trans>{products.length === 1 ? 'product' : 'products'}</Trans>
            </span>
          </div>
          <div className="product-listing__sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="product-listing__sort-select"
            >
              <option value="popular">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className="product-listing__layout">
          {/* Filters Sidebar - Desktop */}
          <aside className="product-listing__filters-desktop">
            <div className="product-listing__filters-header">
              <h3><Trans>Filters</Trans></h3>
              <button onClick={handleClearFilters}><Trans>Clear All</Trans></button>
            </div>
            <div className="product-listing__filters-content">
              <FilterContent />
            </div>
          </aside>

          {/* Products Grid */}
          <div className="product-listing__products">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500"><Trans>Loading products...</Trans></p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg font-semibold text-gray-700 mb-2"><Trans>No products found</Trans></p>
                <p className="text-sm text-gray-500"><Trans>Try adjusting your filters or search query</Trans></p>
              </div>
            ) : (
              <div className="product-listing__grid">
                {products.map((rawProduct) => {
                  const product = translateProduct(rawProduct)
                  const productId = product._id || product.id
                  const inStock = (product.stock || 0) > 0
                  const productImage = getPrimaryImageUrl(product)
                  const isWishlisted = favourites.includes(productId)

                  return (
                    <div
                      key={productId}
                      className="product-listing-card"
                      onClick={() => handleProductClick(productId)}
                    >
                      <div className="product-listing-card__image-wrapper">
                        <img
                          src={productImage}
                          alt={product.name}
                          className="product-listing-card__image"
                        />
                        {authenticated && (
                          <button
                            type="button"
                            className="product-listing-card__wishlist"
                            onClick={(e) => handleToggleFavourite(e, productId)}
                          >
                            <svg
                              className="h-5 w-5"
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
                      <h3 className="product-listing-card__title">{product.name}</h3>
                      <div className="product-listing-card__price">
                        ₹{(product.priceToUser || product.price || 0).toLocaleString('en-IN')}
                      </div>
                      <button
                        className="product-listing-card__button"
                        onClick={(e) => handleAddToCart(e, productId)}
                        disabled={!inStock}
                      >
                        {inStock ? <Trans>Add to Cart</Trans> : <Trans>Out of Stock</Trans>}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Filters Drawer - Mobile */}
        {filtersOpen && (
          <div
            className="product-listing__filters-mobile-drawer"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setFiltersOpen(false)
              }
            }}
          >
            <div className="product-listing__filters-mobile-content">
              <div className="product-listing__filters-mobile-header">
                <h3>Filters</h3>
                <button onClick={() => setFiltersOpen(false)}>Close</button>
              </div>
              <div className="product-listing__filters-mobile-body">
                <FilterContent />
              </div>
            </div>
          </div>
        )}
      </Container>
    </Layout>
  )
}
