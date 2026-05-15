import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Layout, Container } from '../components/Layout'
import { useWebsiteState, useWebsiteDispatch } from '../context/WebsiteContext'
import { useWebsiteApi } from '../hooks/useWebsiteApi'
import { MIN_ORDER_VALUE } from '../services/websiteData'
import * as websiteApi from '../services/websiteApi'
import { getPrimaryImageUrl } from '../utils/productImages'
import { cn } from '../../../lib/cn'
import '../styles/website.css'

export function CartPage() {
  const navigate = useNavigate()
  const dispatch = useWebsiteDispatch()
  const { cart } = useWebsiteState()
  const { updateCartItem, removeFromCart, fetchProducts, getProductDetails, addToCart } = useWebsiteApi()
  
  const [suggestedProducts, setSuggestedProducts] = useState([])
  const [cartProducts, setCartProducts] = useState({})
  const [expandedVariants, setExpandedVariants] = useState({})
  const fetchingProductsRef = useRef(new Set())

  // Fetch suggested products
  useEffect(() => {
    const loadSuggested = async () => {
      try {
        const cartProductIds = cart.map((item) => item.productId)
        const result = await fetchProducts({ limit: 20 })
        if (result.data?.products) {
          const available = result.data.products.filter(
            (p) => !cartProductIds.includes(p._id || p.id)
          )
          const shuffled = [...available].sort(() => Math.random() - 0.5)
          setSuggestedProducts(shuffled.slice(0, 8))
        }
      } catch (error) {
        console.error('Error loading suggested products:', error)
      }
    }
    
    if (cart.length > 0) {
      loadSuggested()
    }
  }, [cart, fetchProducts])

  // Fetch product details for cart items
  useEffect(() => {
    const loadCartProducts = async () => {
      setCartProducts(currentProducts => {
        const productsToFetch = cart.filter(item => 
          !currentProducts[item.productId] && !fetchingProductsRef.current.has(item.productId)
        )
        
        if (productsToFetch.length === 0) {
          return currentProducts
        }
        
        productsToFetch.forEach(item => fetchingProductsRef.current.add(item.productId))
        
        productsToFetch.forEach(async (item) => {
          try {
            const result = await websiteApi.getProductDetails(item.productId)
            if (result.success && result.data?.product) {
              setCartProducts(prev => ({
                ...prev,
                [item.productId]: result.data.product
              }))
            }
          } catch (error) {
            console.error(`Error loading product ${item.productId}:`, error)
          } finally {
            fetchingProductsRef.current.delete(item.productId)
          }
        })
        
        return currentProducts
      })
    }
    
    if (cart.length > 0) {
      loadCartProducts()
    } else {
      setCartProducts({})
      fetchingProductsRef.current.clear()
    }
  }, [cart])

  // Group items by productId with variants
  const groupedCartItems = useMemo(() => {
    const grouped = {}
    
    cart.forEach((item) => {
      const product = cartProducts[item.productId]
      const unitPrice = item.unitPrice || item.price || (product ? (product.priceToUser || product.price || 0) : 0)
      const variantAttrs = item.variantAttributes || {}
      const hasVariants = variantAttrs && typeof variantAttrs === 'object' && Object.keys(variantAttrs).length > 0
      const key = item.productId
      
      if (!grouped[key]) {
        grouped[key] = {
          productId: item.productId,
          product,
          name: item.name || product?.name || 'Product',
          image: product ? getPrimaryImageUrl(product) : (item.image || 'https://via.placeholder.com/400'),
          variants: [],
          hasVariants: false,
        }
      }
      
      const variantItem = {
        ...item,
        id: item.id || item._id || item.cartItemId,
        cartItemId: item.id || item._id || item.cartItemId,
        product,
        unitPrice,
        variantAttributes: variantAttrs,
        hasVariants,
      }
      
      grouped[key].variants.push(variantItem)
      
      if (hasVariants) {
        grouped[key].hasVariants = true
      }
    })
    
    return Object.values(grouped)
  }, [cart, cartProducts])

  const totals = useMemo(() => {
    const subtotal = groupedCartItems.reduce((sum, group) => {
      return sum + group.variants.reduce((variantSum, variant) => {
        return variantSum + (variant.unitPrice * variant.quantity)
      }, 0)
    }, 0)
    const delivery = subtotal >= 5000 ? 0 : 50
    const total = subtotal + delivery
    const meetsMinimum = total >= MIN_ORDER_VALUE

    return {
      subtotal,
      delivery,
      total,
      meetsMinimum,
      shortfall: meetsMinimum ? 0 : MIN_ORDER_VALUE - total,
    }
  }, [groupedCartItems])

  const totalItemsCount = useMemo(() => {
    return groupedCartItems.reduce((sum, group) => sum + group.variants.length, 0)
  }, [groupedCartItems])

  const handleUpdateQuantity = async (variantId, newQuantity) => {
    if (newQuantity < 1) return
    try {
      await updateCartItem(variantId, newQuantity)
    } catch (error) {
      console.error('Error updating quantity:', error)
    }
  }

  const handleRemove = async (cartItemId) => {
    try {
      await removeFromCart(cartItemId)
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const handleAddSuggestedToCart = async (productId) => {
    try {
      await addToCart(productId, 1)
    } catch (error) {
      console.error('Error adding to cart:', error)
    }
  }

  const handleCheckout = () => {
    if (totals.meetsMinimum) {
      navigate('/checkout')
    }
  }

  if (groupedCartItems.length === 0) {
    return (
      <Layout>
        <Container className="cart-page">
          <div className="cart-page__empty">
            <h1 className="cart-page__title">Your cart is empty</h1>
            <p className="cart-page__empty-text">Add some products to get started</p>
            <Link to="/products" className="cart-page__continue">
              Continue Shopping
            </Link>
          </div>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Container className="cart-page">
        <div className="cart-page__header">
          <h1 className="cart-page__title">Shopping Cart</h1>
          <p className="cart-page__count">{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}</p>
        </div>

        <div className="cart-page__layout">
          {/* Left: Cart Items */}
          <div className="cart-page__items">
            {groupedCartItems.map((group) => (
              <div key={group.productId} className="cart-page__item-group">
                {/* Product Header */}
                <div className="cart-page__item-header">
                  <div className="cart-page__item-image-wrapper">
                    <img src={group.image} alt={group.name} className="cart-page__item-image" />
                  </div>
                  <div className="cart-page__item-info">
                    <h3 className="cart-page__item-name">{group.name}</h3>
                    {group.product?.vendor && (
                      <p className="cart-page__item-vendor">{group.product.vendor.name}</p>
                    )}
                  </div>
                </div>

                {/* Variants List */}
                <div className="cart-page__variants">
                  {group.variants.map((variant, variantIdx) => {
                    const variantId = variant.id || variant._id || variant.cartItemId
                    const cartItemId = variant.cartItemId || variant.id || variant._id
                    const isExpanded = expandedVariants[variantId] || false
                    
                    return (
                      <div key={variantId} className="cart-page__variant">
                        {/* Variant Header - Collapsible */}
                        <button
                          type="button"
                          onClick={() => setExpandedVariants(prev => ({ ...prev, [variantId]: !prev[variantId] }))}
                          className="cart-page__variant-header"
                        >
                          <div className="cart-page__variant-info">
                            <div className="cart-page__variant-label">
                              <span>Variant {variantIdx + 1}</span>
                              {variant.variantAttributes && Object.keys(variant.variantAttributes).length > 0 && (
                                <span>({Object.keys(variant.variantAttributes).length} properties)</span>
                              )}
                            </div>
                            {variant.variantAttributes && Object.keys(variant.variantAttributes).length > 0 ? (
                              <div className="cart-page__variant-preview">
                                {Object.entries(variant.variantAttributes).slice(0, 1).map(([key, value]) => (
                                  <span key={key}>
                                    <span className="font-medium">{key}:</span> {value}
                                    {Object.keys(variant.variantAttributes).length > 1 && ' + more'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="cart-page__variant-preview">Standard variant</p>
                            )}
                            <div className="cart-page__variant-price">
                              ₹{(variant.unitPrice || 0).toLocaleString('en-IN')} per unit
                            </div>
                          </div>
                          <svg 
                            className={cn(
                              "cart-page__variant-chevron",
                              isExpanded && "cart-page__variant-chevron--expanded"
                            )}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        
                        {/* Expanded Variant Details */}
                        {isExpanded && (
                          <div className="cart-page__variant-details">
                            {variant.variantAttributes && Object.keys(variant.variantAttributes).length > 0 ? (
                              <div className="cart-page__variant-properties">
                                <p className="cart-page__variant-properties-title">Variant Properties:</p>
                                {Object.entries(variant.variantAttributes).map(([key, value]) => (
                                  <div key={key} className="cart-page__variant-property">
                                    <span className="cart-page__variant-property-key">{key}:</span>
                                    <span className="cart-page__variant-property-value">{value}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="cart-page__variant-no-properties">No variant properties available</p>
                            )}
                          </div>
                        )}
                        
                        {/* Variant Controls */}
                        <div className="cart-page__variant-controls">
                          <div className="cart-page__quantity-controls">
                            <button
                              type="button"
                              className="cart-page__quantity-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateQuantity(variantId, variant.quantity - 1)
                              }}
                              disabled={variant.quantity <= 1}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="cart-page__quantity-value">{variant.quantity}</span>
                            <button
                              type="button"
                              className="cart-page__quantity-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateQuantity(variantId, variant.quantity + 1)
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                          
                          <div className="cart-page__variant-total">
                            ₹{((variant.unitPrice || 0) * variant.quantity).toLocaleString('en-IN')}
                          </div>
                          
                          <button
                            type="button"
                            className="cart-page__variant-remove"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemove(cartItemId)
                            }}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Summary */}
          <div className="cart-page__summary">
            <div className="cart-page__summary-card">
              <h3 className="cart-page__summary-title">Order Summary</h3>
              
              <div className="cart-page__summary-row">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toLocaleString('en-IN')}</span>
              </div>
              
              <div className="cart-page__summary-row">
                <span>Delivery</span>
                <span>{totals.delivery === 0 ? 'Free' : `₹${totals.delivery}`}</span>
              </div>
              
              <div className="cart-page__summary-row cart-page__summary-row--total">
                <span>Total</span>
                <span>₹{totals.total.toLocaleString('en-IN')}</span>
              </div>
              
              {!totals.meetsMinimum && (
                <div className="cart-page__summary-warning">
                  <p>
                    Add ₹{totals.shortfall.toLocaleString('en-IN')} more to reach minimum order value of ₹{MIN_ORDER_VALUE.toLocaleString('en-IN')}
                  </p>
                </div>
              )}
              
              <button
                type="button"
                className={cn(
                  'cart-page__checkout-button',
                  !totals.meetsMinimum && 'cart-page__checkout-button--disabled'
                )}
                onClick={handleCheckout}
                disabled={!totals.meetsMinimum}
              >
                {totals.meetsMinimum ? 'Proceed to Checkout' : `Add ₹${totals.shortfall.toLocaleString('en-IN')} more`}
              </button>
            </div>
          </div>
        </div>

        {/* Suggested Items Section */}
        {suggestedProducts.length > 0 && (
          <div className="cart-page__suggested">
            <h3 className="cart-page__suggested-title">You might also like</h3>
            <div className="cart-page__suggested-grid">
              {suggestedProducts.map((product) => {
                const productId = product._id || product.id
                return (
                  <div key={productId} className="cart-page__suggested-card">
                    <div className="cart-page__suggested-image-wrapper">
                      <img 
                        src={getPrimaryImageUrl(product)} 
                        alt={product.name} 
                        className="cart-page__suggested-image"
                        onClick={() => navigate(`/product/${productId}`)}
                      />
                    </div>
                    <div className="cart-page__suggested-content">
                      <h4 
                        className="cart-page__suggested-name"
                        onClick={() => navigate(`/product/${productId}`)}
                      >
                        {product.name}
                      </h4>
                      <div className="cart-page__suggested-price">
                        ₹{(product.priceToUser || product.price || 0).toLocaleString('en-IN')}
                      </div>
                      <button
                        type="button"
                        className="cart-page__suggested-add-btn"
                        onClick={() => handleAddSuggestedToCart(productId)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add</span>
                      </button>
                    </div>
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
