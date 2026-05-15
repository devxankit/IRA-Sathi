import { useState, useEffect } from 'react'
import { ProductCard } from '../../components/ProductCard'
import { ChevronLeftIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import * as userApi from '../../services/userApi'
import { Trans } from '../../../../components/Trans'
import { TransText } from '../../../../components/TransText'

export function CarouselProductsView({ carouselId, onProductClick, onAddToCart, onBack, onToggleFavourite, favourites = [] }) {
  const [carousel, setCarousel] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch carousel data and products
  useEffect(() => {
    const loadCarouselProducts = async () => {
      setLoading(true)
      try {
        // First, get all offers to find the carousel
        const offersResult = await userApi.getOffers()
        if (offersResult.success && offersResult.data?.carousels) {
          const foundCarousel = offersResult.data.carousels.find(c => c.id === carouselId)
          if (foundCarousel) {
            setCarousel(foundCarousel)

            // Fetch products for the product IDs
            if (foundCarousel.productIds && foundCarousel.productIds.length > 0) {
              const productPromises = foundCarousel.productIds.map(productId =>
                userApi.getProductDetails(productId).catch(err => {
                  console.error(`Failed to load product ${productId}:`, err)
                  return null
                })
              )

              const productResults = await Promise.all(productPromises)
              const validProducts = productResults
                .filter(result => result && result.success && result.data?.product)
                .map(result => result.data.product)

              setProducts(validProducts)
            }
          }
        }
      } catch (error) {
        console.error('Error loading carousel products:', error)
      } finally {
        setLoading(false)
      }
    }

    if (carouselId) {
      loadCarouselProducts()
    }
  }, [carouselId])

  return (
    <div className="user-carousel-products-view space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {carousel?.title ? <TransText>{carousel.title}</TransText> : <Trans>Carousel Products</Trans>}
          </h1>
          {carousel?.description && (
            <p className="text-sm text-gray-600 mt-1"><TransText>{carousel.description}</TransText></p>
          )}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500"><Trans>Loading products...</Trans></p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 font-medium"><Trans>No products available</Trans></p>
          <p className="text-sm text-gray-500 mt-1"><Trans>This carousel doesn't have any products linked yet.</Trans></p>
        </div>
      ) : (
        <div className="home-products-grid">
          {products.map((product) => (
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
  )
}

