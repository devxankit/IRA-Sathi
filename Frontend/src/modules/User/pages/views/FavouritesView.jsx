import { useState, useEffect } from 'react'
import { useUserState, useUserDispatch } from '../../context/UserContext'
import { ProductCard } from '../../components/ProductCard'
import { HeartIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import * as userApi from '../../services/userApi'
import { Trans } from '../../../../components/Trans'

export function FavouritesView({ onProductClick, onAddToCart, onRemoveFromFavourites }) {
  const { favourites } = useUserState()
  const dispatch = useUserDispatch()
  const [favouriteProducts, setFavouriteProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch favourite products from API
  useEffect(() => {
    const loadFavourites = async () => {
      setLoading(true)
      try {
        const productPromises = favourites.map(async (id) => {
          try {
            const result = await userApi.getProductDetails(id)
            if (result.success && result.data?.product) {
              return result.data.product
            }
            return null
          } catch (error) {
            console.error(`Error loading favourite product ${id}:`, error)
            return null
          }
        })
        const products = await Promise.all(productPromises)
        setFavouriteProducts(products.filter(Boolean))
      } catch (error) {
        console.error('Error loading favourites:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (favourites.length > 0) {
      loadFavourites()
    } else {
      setFavouriteProducts([])
      setLoading(false)
    }
  }, [favourites])

  const handleRemoveFromFavourites = (productId) => {
    dispatch({ type: 'REMOVE_FROM_FAVOURITES', payload: { productId } })
    onRemoveFromFavourites?.(productId)
  }

  return (
    <div className="user-favourites-view space-y-6">
      <div className="user-favourites-view__header">
        <h2 className="user-favourites-view__title"><Trans>My Favourites</Trans></h2>
        <p className="user-favourites-view__subtitle">
          {favouriteProducts.length} {favouriteProducts.length === 1 ? <Trans>item saved</Trans> : <Trans>items saved</Trans>}
        </p>
      </div>

      {loading ? (
        <div className="user-favourites-view__empty">
          <div className="user-favourites-view__empty-icon">
            <HeartIcon className="h-16 w-16" filled={false} />
          </div>
          <h3 className="user-favourites-view__empty-title"><Trans>Loading favourites...</Trans></h3>
        </div>
      ) : favouriteProducts.length === 0 ? (
        <div className="user-favourites-view__empty">
          <div className="user-favourites-view__empty-icon">
            <HeartIcon className="h-16 w-16" filled={false} />
          </div>
          <h3 className="user-favourites-view__empty-title"><Trans>No favourites yet</Trans></h3>
          <p className="user-favourites-view__empty-text">
            <Trans>Start adding products to your favourites by tapping the heart icon on any product</Trans>
          </p>
        </div>
      ) : (
        <div className="user-favourites-view__grid">
          {favouriteProducts.map((product, index) => (
            <ProductCard
              key={product._id || product.id || `favourite-${index}`}
              product={{ 
                ...product, 
                id: product._id || product.id,
                price: product.priceToUser || product.price,
                image: product.images?.[0]?.url || product.primaryImage || product.image,
                isWishlisted: true,
                rating: product.rating ?? product.averageRating,
                reviews: product.reviews ?? product.reviewCount,
                reviewCount: product.reviewCount ?? product.reviews,
              }}
              onNavigate={onProductClick}
              onAddToCart={onAddToCart}
              onWishlist={handleRemoveFromFavourites}
              className="user-favourites-view__card"
            />
          ))}
        </div>
      )}
    </div>
  )
}

