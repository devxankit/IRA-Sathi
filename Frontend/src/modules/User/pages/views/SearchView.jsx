import { useMemo, useState, useRef, useEffect } from 'react'
import { ProductCard } from '../../components/ProductCard'
import { FilterIcon, ChevronDownIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import * as userApi from '../../services/userApi'

export function SearchView({ query = '', onProductClick, onAddToCart, onToggleFavourite, categoryId, favourites = [] }) {
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(categoryId || 'all')
  const [sortBy, setSortBy] = useState('popular')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const sortDropdownRef = useRef(null)

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

  // Fetch products based on filters
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      try {
        const params = {
          limit: 100,
          maxPrice,
        }
        
        if (query.trim()) {
          params.search = query.trim()
        }
        
        if (selectedCategory !== 'all') {
          params.category = selectedCategory
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
  }, [query, selectedCategory, sortBy, maxPrice])

  const filteredProducts = useMemo(() => {
    return products
  }, [products])

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false)
      }
    }
    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSortDropdown])

  return (
    <div className="space-y-4 user-search-view">
      {/* Search Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#172022] mb-1">
            {query ? `Search: "${query}"` : 'All Products'}
          </h2>
          <p className="text-sm text-[rgba(26,42,34,0.65)]">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[rgba(1, 78, 23,0.18)] bg-white text-[rgba(26,42,34,0.75)] text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-[rgba(1, 78, 23,0.28)] hover:bg-[rgba(255,255,255,0.92)]"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FilterIcon className="h-5 w-5" />
          Filters
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 rounded-2xl border border-[rgba(1, 78, 23,0.16)] bg-gradient-to-br from-white to-[rgba(241,244,236,0.9)] shadow-[0_18px_38px_-28px_rgba(1, 32, 9,0.35)] space-y-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-[rgba(26,42,34,0.75)] mb-2 uppercase tracking-[0.05em]">Category</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-[#017827] to-[#0a9937] text-white shadow-md'
                    : 'bg-[rgba(240,245,242,0.8)] text-[rgba(23,32,34,0.65)] border border-[rgba(1, 78, 23,0.15)] hover:bg-[rgba(248,252,249,0.95)]'
                )}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {categories.map((cat, index) => (
                <button
                  key={cat._id || cat.id || `category-${index}`}
                  type="button"
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                    selectedCategory === (cat._id || cat.id)
                      ? 'bg-gradient-to-r from-[#017827] to-[#0a9937] text-white shadow-md'
                      : 'bg-[rgba(240,245,242,0.8)] text-[rgba(23,32,34,0.65)] border border-[rgba(1, 78, 23,0.15)] hover:bg-[rgba(248,252,249,0.95)]'
                  )}
                  onClick={() => setSelectedCategory(cat._id || cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          <div className="user-search-view__sort-section">
            <label className="block text-sm font-semibold text-[rgba(26,42,34,0.75)] mb-2 uppercase tracking-[0.05em]">Sort By</label>
            <div className="user-search-view__sort-wrapper" ref={sortDropdownRef}>
              <button
                type="button"
                className="user-search-view__sort-button"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
              >
                <span className="user-search-view__sort-button-text">
                  {sortBy === 'popular' && 'Most Popular'}
                  {sortBy === 'price-low' && 'Price: Low to High'}
                  {sortBy === 'price-high' && 'Price: High to Low'}
                  {sortBy === 'rating' && 'Highest Rated'}
                </span>
                <ChevronDownIcon className={cn('user-search-view__sort-chevron', showSortDropdown && 'user-search-view__sort-chevron--open')} />
              </button>
              {showSortDropdown && (
                <div className="user-search-view__sort-dropdown">
                  <button
                    type="button"
                    className={cn('user-search-view__sort-option', sortBy === 'popular' && 'user-search-view__sort-option--active')}
                    onClick={() => {
                      setSortBy('popular')
                      setShowSortDropdown(false)
                    }}
                  >
                    <span>Most Popular</span>
                    {sortBy === 'popular' && (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn('user-search-view__sort-option', sortBy === 'price-low' && 'user-search-view__sort-option--active')}
                    onClick={() => {
                      setSortBy('price-low')
                      setShowSortDropdown(false)
                    }}
                  >
                    <span>Price: Low to High</span>
                    {sortBy === 'price-low' && (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn('user-search-view__sort-option', sortBy === 'price-high' && 'user-search-view__sort-option--active')}
                    onClick={() => {
                      setSortBy('price-high')
                      setShowSortDropdown(false)
                    }}
                  >
                    <span>Price: High to Low</span>
                    {sortBy === 'price-high' && (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn('user-search-view__sort-option', sortBy === 'rating' && 'user-search-view__sort-option--active')}
                    onClick={() => {
                      setSortBy('rating')
                      setShowSortDropdown(false)
                    }}
                  >
                    <span>Highest Rated</span>
                    {sortBy === 'rating' && (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[rgba(26,42,34,0.75)] mb-2 uppercase tracking-[0.05em]">
              Price Range: ₹0 - ₹{maxPrice.toLocaleString('en-IN')}
            </label>
            <div className="user-search-view__price-slider-wrapper">
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                className="user-search-view__price-slider"
                style={{
                  '--slider-progress': `${(maxPrice / 10000) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-base font-semibold text-[rgba(26,42,34,0.75)] mb-2">Loading products...</p>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product._id || product.id || `search-product-${index}`}
              product={{ 
                ...product, 
                id: product._id || product.id,
                price: product.priceToUser || product.price || 0,
                image: product.images?.[0]?.url || product.primaryImage || product.image,
                isWishlisted: favourites.includes(product._id || product.id),
                rating: product.rating ?? product.averageRating,
                reviews: product.reviews ?? product.reviewCount,
                reviewCount: product.reviewCount ?? product.reviews,
              }}
              onNavigate={onProductClick}
              onAddToCart={onAddToCart}
              onWishlist={onToggleFavourite}
              className="h-full"
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-base font-semibold text-[rgba(26,42,34,0.75)] mb-2">No products found</p>
          <p className="text-sm text-[rgba(26,42,34,0.55)]">Try adjusting your filters or search query</p>
        </div>
      )}
    </div>
  )
}

