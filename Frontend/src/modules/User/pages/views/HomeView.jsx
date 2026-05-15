import { useRef, useState, useEffect } from 'react'
import { ProductCard } from '../../components/ProductCard'
import { CategoryCard } from '../../components/CategoryCard'
import { ChevronRightIcon, MapPinIcon, TruckIcon, SearchIcon, FilterIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import { useUserApi } from '../../hooks/useUserApi'
import * as userApi from '../../services/userApi'
import { Trans } from '../../../../components/Trans'
import { TransText } from '../../../../components/TransText'

// Helper function to format category names - split "Fertilizer" word for better display
const formatCategoryName = (name) => {
  if (!name) return name
  // Check if name contains "Fertilizer" as part of a compound word (like "BioFertilizer")
  // Split before "Fertilizer" if it's part of a compound word
  const fertilizerMatch = name.match(/(\w+)(Fertilizer)/i)
  if (fertilizerMatch && fertilizerMatch[1] && fertilizerMatch[2]) {
    // Split compound word: "BioFertilizer" -> "Bio Fertilizer"
    return `${fertilizerMatch[1]} ${fertilizerMatch[2]}`
  }
  return name
}

export function HomeView({ onProductClick, onCategoryClick, onAddToCart, onSearchClick, onFilterClick, onToggleFavourite, favourites = [] }) {
  const [bannerIndex, setBannerIndex] = useState(0)
  const categoriesRef = useRef(null)
  const bannerRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const autoSlideTimeoutRef = useRef(null)
  const touchStartXRef = useRef(null)
  const touchEndXRef = useRef(null)
  
  // Real data from API
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [popularProducts, setPopularProducts] = useState([])
  const [categoryProducts, setCategoryProducts] = useState([]) // Array of 4 random products from different categories
  const [carousels, setCarousels] = useState([])
  const [specialOffers, setSpecialOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const { fetchCategories, fetchProducts } = useUserApi()

  // Fetch categories and products on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Fetch categories
        const categoriesResult = await fetchCategories()
        if (categoriesResult.data?.categories) {
          const cats = categoriesResult.data.categories
          setCategories(cats)
          if (cats.length > 0) {
            setSelectedCategory(cats[0].id)
          }
        }

        // Fetch popular products - limit to 4 for home screen
        const popularResult = await userApi.getPopularProducts({ limit: 4 })
        if (popularResult.success && popularResult.data?.products) {
          setPopularProducts(popularResult.data.products)
        }

        // Fetch all products (or products by selected category)
        const productsResult = await fetchProducts({ limit: 20 })
        if (productsResult.data?.products) {
          setProducts(productsResult.data.products)
        }

        // Fetch products from multiple categories and randomly select 4 products (for laptop category products section)
        const cats = categoriesResult.data?.categories || []
        if (cats.length > 0) {
          // Shuffle categories to get random ones
          const shuffledCategories = [...cats].sort(() => Math.random() - 0.5)
          const selectedCategories = shuffledCategories.slice(0, Math.min(4, cats.length))
          
          // Fetch products from each selected category
          const allCategoryProducts = []
          await Promise.all(
            selectedCategories.map(async (category) => {
              try {
                const catProductsResult = await fetchProducts({ category: category.id, limit: 10 })
                if (catProductsResult.data?.products && catProductsResult.data.products.length > 0) {
                  // Add category info to each product
                  const productsWithCategory = catProductsResult.data.products.map(p => ({
                    ...p,
                    categoryName: category.name,
                    categoryId: category.id
                  }))
                  allCategoryProducts.push(...productsWithCategory)
                }
              } catch (error) {
                console.error(`Error loading products for category ${category.id}:`, error)
              }
            })
          )
          
          // Shuffle and select 4 random products
          const shuffledProducts = allCategoryProducts.sort(() => Math.random() - 0.5)
          const selectedProducts = shuffledProducts.slice(0, 4)
          
          setCategoryProducts(selectedProducts)
        }

        // Fetch offers (carousels and special offers)
        const offersResult = await userApi.getOffers()
        if (offersResult.success && offersResult.data) {
          // Filter active carousels and sort by order
          const activeCarousels = (offersResult.data.carousels || [])
            .filter(c => c.isActive !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
          setCarousels(activeCarousels)
          setSpecialOffers(offersResult.data.specialOffers || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Fetch products when category changes
  useEffect(() => {
    if (selectedCategory) {
      const loadProducts = async () => {
        try {
          const result = await fetchProducts({ category: selectedCategory, limit: 20 })
          if (result.data?.products) {
            setProducts(result.data.products)
          }
        } catch (error) {
          console.error('Error loading products:', error)
        }
      }
      loadProducts()
    }
  }, [selectedCategory, fetchProducts])

  // Use dynamic carousels from API, fallback to empty array
  // Carousels are already filtered and sorted by order in the fetch
  const banners = carousels.length > 0 
    ? carousels.map(carousel => ({
        id: carousel.id || carousel._id,
        title: carousel.title || '',
        subtitle: carousel.description || '',
        image: carousel.image || '',
        productIds: carousel.productIds || [],
      }))
    : []

  const goToNextSlide = () => {
    if (banners.length === 0) return
    setBannerIndex((prev) => (prev + 1) % banners.length)
  }

  const goToPreviousSlide = () => {
    if (banners.length === 0) return
    setBannerIndex((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const goToSlide = (index) => {
    if (banners.length === 0 || index < 0 || index >= banners.length) return
    setBannerIndex(index)
    setIsUserInteracting(true)
    resetAutoSlide()
  }

  const resetAutoSlide = () => {
    if (autoSlideTimeoutRef.current) {
      clearTimeout(autoSlideTimeoutRef.current)
    }
    autoSlideTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false)
    }, 3000)
  }

  // Auto-slide when user is not interacting
  useEffect(() => {
    if (isUserInteracting || banners.length === 0) return

    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isUserInteracting, banners.length])

  // Cleanup on unmount and reset banner index when banners change
  useEffect(() => {
    if (banners.length > 0 && bannerIndex >= banners.length) {
      setBannerIndex(0)
    }
    return () => {
      if (autoSlideTimeoutRef.current) {
        clearTimeout(autoSlideTimeoutRef.current)
      }
    }
  }, [banners.length, bannerIndex])

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX
    setIsUserInteracting(true)
  }

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return

    const distance = touchStartXRef.current - touchEndXRef.current
    const minSwipeDistance = 50

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swiped left - go to next
        goToNextSlide()
      } else {
        // Swiped right - go to previous
        goToPreviousSlide()
      }
    }

    resetAutoSlide()
    touchStartXRef.current = null
    touchEndXRef.current = null
  }

  // Mouse handlers for desktop drag
  const handleMouseDown = (e) => {
    touchStartXRef.current = e.clientX
    setIsUserInteracting(true)
  }

  const handleMouseMove = (e) => {
    if (touchStartXRef.current !== null) {
      touchEndXRef.current = e.clientX
    }
  }

  const handleMouseUp = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) {
      touchStartXRef.current = null
      touchEndXRef.current = null
      return
    }

    const distance = touchStartXRef.current - touchEndXRef.current
    const minSwipeDistance = 50

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        goToNextSlide()
      } else {
        goToPreviousSlide()
      }
    }

    resetAutoSlide()
    touchStartXRef.current = null
    touchEndXRef.current = null
  }

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId)
    onCategoryClick?.(categoryId)
  }

  // Prevent scrolling past the end
  useEffect(() => {
    const container = categoriesRef.current
    if (!container) return

    const handleScroll = () => {
      const maxScroll = container.scrollWidth - container.clientWidth
      if (container.scrollLeft > maxScroll) {
        container.scrollLeft = maxScroll
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="user-home-view space-y-6">
      {/* Hero Banner Section - Only show if carousels exist */}
      {banners.length > 0 && (
      <section id="home-hero" className="home-hero-section">
        <div
          ref={bannerRef}
          className="home-hero-banner"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {banners.map((banner, index) => (
            <div
              key={banner.id || `banner-${index}`}
              className={cn(
                'home-hero-banner__slide',
                index === bannerIndex ? 'home-hero-banner__slide--active' : 'home-hero-banner__slide--hidden'
              )}
              style={{ backgroundImage: `url(${banner.image})` }}
                onClick={() => {
                  // Navigate to carousel products view
                  if (banner.productIds && banner.productIds.length > 0) {
                    onProductClick(`carousel:${banner.id}`)
                  }
                }}
            >
              <div className="home-hero-banner__overlay" />
              <div className="home-hero-banner__content">
                <h2 className="home-hero-banner__title"><TransText>{banner.title}</TransText></h2>
                <p className="home-hero-banner__subtitle"><TransText>{banner.subtitle}</TransText></p>
              </div>
            </div>
          ))}
        </div>
        <div className="home-hero-banner__indicators">
          {banners.map((_, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                'home-hero-banner__indicator',
                index === bannerIndex && 'home-hero-banner__indicator--active'
              )}
              onClick={() => goToSlide(index)}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      </section>
      )}

      {/* Categories Section */}
      <section id="home-categories" className="home-categories-section">
        <div className="home-section-header">
          <div className="home-section-header__content">
            <h3 className="home-section-header__title"><Trans>Categories</Trans></h3>
          </div>
          <button
            type="button"
            className="home-section-header__cta"
            onClick={() => onCategoryClick('all')}
          >
            <Trans>See all</Trans>
          </button>
        </div>
        <div ref={categoriesRef} className="home-categories-rail">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-gray-500"><Trans>Loading categories...</Trans></p>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-gray-500"><Trans>No categories available</Trans></p>
            </div>
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={{
                  id: category.id,
                  name: formatCategoryName(category.name),
                  emoji: category.icon,
                  count: category.count,
                  description: category.description,
                }}
                onClick={handleCategoryClick}
                isSelected={selectedCategory === category.id}
                className="category-card-wrapper"
              />
            ))
          )}
        </div>
      </section>

      {/* Popular Products Section */}
      <section id="home-popular-products" className="home-products-section">
        <div className="home-section-header">
          <div className="home-section-header__content">
            <h3 className="home-section-header__title"><Trans>Popular Products</Trans></h3>
            <p className="home-section-header__subtitle"><Trans>Best sellers this week</Trans></p>
          </div>
          <button
            type="button"
            className="home-section-header__cta"
            onClick={() => onProductClick('all')}
          >
            <Trans>View All</Trans>
            <ChevronRightIcon className="home-section-header__cta-icon" />
          </button>
        </div>
        <div className="home-products-grid">
          {loading ? (
            <div className="flex items-center justify-center p-8 col-span-full">
              <p className="text-sm text-gray-500"><Trans>Loading products...</Trans></p>
            </div>
          ) : popularProducts.length === 0 ? (
            <div className="flex items-center justify-center p-8 col-span-full">
              <p className="text-sm text-gray-500"><Trans>No popular products available</Trans></p>
            </div>
          ) : (
            popularProducts.map((product) => (
              <ProductCard
                key={product._id || product.id}
                product={{
                  id: product._id || product.id,
                  name: product.name,
                  price: product.priceToUser || product.price || 0,
                  image: product.images?.[0]?.url || product.primaryImage || 'https://via.placeholder.com/300',
                  category: product.category,
                  stock: product.stock,
                  description: product.description,
                  shortDescription: product.shortDescription || product.description,
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
            ))
          )}
        </div>
      </section>

      {/* Category Products Section - Laptop Only */}
      {categoryProducts.length > 0 && (
        <section id="home-category-products" className="home-category-products-section">
          <div className="home-section-header">
            <div className="home-section-header__content">
              <h3 className="home-section-header__title"><Trans>Featured Products</Trans></h3>
              <p className="home-section-header__subtitle"><Trans>From different categories</Trans></p>
            </div>
            <button
              type="button"
              className="home-section-header__cta"
              onClick={() => onProductClick('all')}
            >
              <Trans>View All</Trans>
              <ChevronRightIcon className="home-section-header__cta-icon" />
            </button>
          </div>
          <div className="home-products-grid">
            {categoryProducts.map((product) => (
              <ProductCard
                key={product._id || product.id}
                product={{
                  id: product._id || product.id,
                  name: product.name,
                  price: product.priceToUser || product.price || 0,
                  image: product.images?.[0]?.url || product.primaryImage || 'https://via.placeholder.com/300',
                  category: product.category,
                  stock: product.stock,
                  description: product.description,
                  shortDescription: product.shortDescription || product.description,
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
        </section>
      )}

      {/* Special Deals Section - Only show if special offers exist */}
      {specialOffers.length > 0 && (
      <section id="home-deals" className="home-deals-section">
        <div className="home-section-header">
          <div className="home-section-header__content">
            <h3 className="home-section-header__title"><Trans>Special Offers</Trans></h3>
            <p className="home-section-header__subtitle"><Trans>Limited time deals</Trans></p>
          </div>
        </div>
        <div className="home-deals-grid">
            {specialOffers.map((offer) => (
              <div key={offer.id} className="home-deal-card">
                <div className="home-deal-card__badge"><TransText>{offer.specialTag}</TransText></div>
            <div className="home-deal-card__content">
                  <h4 className="home-deal-card__title"><TransText>{offer.title}</TransText></h4>
                  {offer.description && (
                    <p className="home-deal-card__description"><TransText>{offer.description}</TransText></p>
                  )}
              <div className="home-deal-card__price">
                    <span className="home-deal-card__price-current"><TransText>{offer.specialValue}</TransText></span>
            </div>
          </div>
              </div>
            ))}
        </div>
      </section>
      )}

      {/* Quick Stats Section */}
      <section id="home-stats" className="home-stats-section">
        <div className="home-stats-grid">
          <div className="home-stat-card">
            <div className="home-stat-card__icon home-stat-card__icon--delivery">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div className="home-stat-card__content">
              <p className="home-stat-card__label"><Trans>Fast Delivery</Trans></p>
              <span className="home-stat-card__value"><Trans>3-4 Hours</Trans></span>
            </div>
          </div>
          <div className="home-stat-card">
            <div className="home-stat-card__icon home-stat-card__icon--payment">
              <MapPinIcon className="h-5 w-5" />
            </div>
            <div className="home-stat-card__content">
              <p className="home-stat-card__label"><Trans>Easy Payment</Trans></p>
              <span className="home-stat-card__value"><Trans>30% Advance</Trans></span>
            </div>
          </div>
          <div className="home-stat-card">
            <div className="home-stat-card__icon home-stat-card__icon--quality">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div className="home-stat-card__content">
              <p className="home-stat-card__label"><Trans>Quality Assured</Trans></p>
              <span className="home-stat-card__value"><Trans>100% Genuine</Trans></span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
