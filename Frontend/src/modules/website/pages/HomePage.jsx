import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout, Container, Section } from '../components/Layout'
import { useWebsiteApi } from '../hooks/useWebsiteApi'
import { useWebsiteState, useWebsiteDispatch } from '../context/WebsiteContext'
import * as websiteApi from '../services/websiteApi'
import { getPrimaryImageUrl } from '../utils/productImages'
import { cn } from '../../../lib/cn'
import '../styles/website.css'

// Helper function to format category names
const formatCategoryName = (name) => {
  if (!name) return name
  const fertilizerMatch = name.match(/(\w+)(Fertilizer)/i)
  if (fertilizerMatch && fertilizerMatch[1] && fertilizerMatch[2]) {
    return `${fertilizerMatch[1]} ${fertilizerMatch[2]}`
  }
  return name
}

export function HomePage() {
  const navigate = useNavigate()
  const dispatch = useWebsiteDispatch()
  const { favourites, authenticated } = useWebsiteState()
  const { fetchCategories, fetchPopularProducts, addToCart, addToFavourites, removeFromFavourites } = useWebsiteApi()
  
  const [bannerIndex, setBannerIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const autoSlideTimeoutRef = useRef(null)
  const touchStartXRef = useRef(null)
  const touchEndXRef = useRef(null)
  
  // Data state
  const [categories, setCategories] = useState([])
  const [popularProducts, setPopularProducts] = useState([])
  const [carousels, setCarousels] = useState([])
  const [specialOffers, setSpecialOffers] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch data on mount
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
        const popularResult = await websiteApi.getPopularProducts({ limit: 4 })
        if (popularResult.success && popularResult.data?.products) {
          setPopularProducts(popularResult.data.products)
        }

        // Fetch offers (carousels and special offers)
        const offersResult = await websiteApi.getOffers()
        if (offersResult.success && offersResult.data) {
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

  // Banner carousel logic
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
        goToNextSlide()
      } else {
        goToPreviousSlide()
      }
    }

    resetAutoSlide()
    touchStartXRef.current = null
    touchEndXRef.current = null
  }

  // Handlers
  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`)
  }

  const handleCategoryClick = (categoryId) => {
    if (categoryId === 'all') {
      navigate('/products')
    } else {
      navigate(`/products?category=${categoryId}`)
    }
  }

  const handleAddToCart = async (e, productId) => {
    e.stopPropagation()
    if (!authenticated) {
      navigate('/login')
      return
    }
    try {
      await addToCart(productId, 1)
      // Cart will be updated via context
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

  const handleBannerClick = (banner) => {
    if (banner.productIds && banner.productIds.length > 0) {
      navigate(`/products?carousel=${banner.id}`)
    }
  }

  return (
    <Layout>
      {/* Hero/Banner Section - Only show if carousels exist */}
      {banners.length > 0 && (
        <Section className="home-hero">
          <Container>
            <div
              className="home-hero__carousel"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {banners.map((banner, index) => (
                <div
                  key={banner.id}
                  className={cn(
                    'home-hero__slide',
                    index === bannerIndex ? 'home-hero__slide--active' : 'home-hero__slide--hidden'
                  )}
                  style={{ backgroundImage: `url(${banner.image})` }}
                  onClick={() => handleBannerClick(banner)}
                >
                  <div className="home-hero__overlay" />
                  <div className="home-hero__content">
                    <h1 className="home-hero__title">{banner.title}</h1>
                    <p className="home-hero__subtitle">{banner.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <div className="home-hero__indicators">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      'home-hero__indicator',
                      index === bannerIndex && 'home-hero__indicator--active'
                    )}
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </Container>
        </Section>
      )}

      {/* Categories Section */}
      <Section className="home-categories">
        <Container>
          <div className="home-section__header">
            <h2 className="home-section__title">Browse Categories</h2>
            <Link to="/products" className="home-section__link">
              See All
            </Link>
          </div>
          <div className="home-categories__grid">
            {loading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No categories available</p>
              </div>
            ) : (
              categories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/products?category=${category.id}`}
                  className="home-category-card"
                >
                  <div className="home-category-card__image">
                    {category.icon ? (
                      <img src={category.icon} alt={category.name} />
                    ) : (
                      <span className="text-4xl">{category.emoji || '📦'}</span>
                    )}
                  </div>
                  <div className="home-category-card__title">
                    {formatCategoryName(category.name)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Container>
      </Section>

      {/* Featured/Popular Products Section */}
      <Section className="home-featured">
        <Container>
          <div className="home-section__header">
            <div>
              <h2 className="home-section__title">Featured Products</h2>
              <p className="home-section__subtitle">Best sellers this week</p>
            </div>
            <Link to="/products" className="home-section__link">
              View All
            </Link>
          </div>
          <div className="home-featured__grid">
            {loading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">Loading products...</p>
              </div>
            ) : popularProducts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No products available</p>
              </div>
            ) : (
              popularProducts.map((product) => {
                const productId = product._id || product.id
                const inStock = (product.stock || 0) > 0
                const productImage = getPrimaryImageUrl(product)
                const isWishlisted = favourites.includes(productId)
                
                return (
                  <div
                    key={productId}
                    className="home-product-card"
                    onClick={() => handleProductClick(productId)}
                  >
                    <div className="home-product-card__image-wrapper">
                      <img
                        src={productImage}
                        alt={product.name}
                        className="home-product-card__image"
                      />
                      {authenticated && (
                        <button
                          type="button"
                          className="home-product-card__wishlist"
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
                    <h3 className="home-product-card__title">{product.name}</h3>
                    <div className="home-product-card__price">
                      ₹{(product.priceToUser || product.price || 0).toLocaleString('en-IN')}
                    </div>
                    <button
                      className="home-product-card__button"
                      onClick={(e) => handleAddToCart(e, productId)}
                      disabled={!inStock}
                    >
                      {inStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </Container>
      </Section>

      {/* Deals/Highlights Section */}
      {specialOffers.length > 0 && (
        <Section className="home-deals">
          <Container>
            <div className="home-section__header">
              <div>
                <h2 className="home-section__title">Special Offers</h2>
                <p className="home-section__subtitle">Limited time deals</p>
              </div>
            </div>
            <div className="home-deals__container">
              {specialOffers.slice(0, 3).map((offer) => (
                <div key={offer.id} className="home-deal-card">
                  {offer.image && (
                    <div className="home-deal-card__image">
                      <img src={offer.image} alt={offer.title} />
                      {offer.specialTag && (
                        <div className="home-deal-card__badge">{offer.specialTag}</div>
                      )}
                    </div>
                  )}
                  <div className="home-deal-card__content">
                    <h4 className="home-deal-card__title">{offer.title}</h4>
                    {offer.description && (
                      <p className="home-deal-card__description">{offer.description}</p>
                    )}
                    {offer.specialValue && (
                      <div className="home-deal-card__price">
                        <span className="home-deal-card__price-current">{offer.specialValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </Layout>
  )
}
