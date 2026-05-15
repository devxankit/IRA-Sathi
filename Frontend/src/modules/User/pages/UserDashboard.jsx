import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useUserDispatch, useUserState } from '../context/UserContext'
import { MobileShell } from '../components/MobileShell'
import { BottomNavItem } from '../components/BottomNavItem'
import { MenuList } from '../components/MenuList'
import { HomeIcon, SearchIcon, CartIcon, UserIcon, MenuIcon, HeartIcon, PackageIcon } from '../components/icons'
import { Trans } from '../../../components/Trans'
import { MIN_ORDER_VALUE } from '../services/userData'
import * as userApi from '../services/userApi'
import { cn } from '../../../lib/cn'
import { useToast, ToastProvider } from '../components/ToastNotification'
import { useUserApi } from '../hooks/useUserApi'
import { useTranslatedNavItems } from '../../../utils/translateNavItems'
import { HomeView } from './views/HomeView'
import { SearchView } from './views/SearchView'
import { ProductDetailView } from './views/ProductDetailView'
import { CartView } from './views/CartView'
import { CheckoutView } from './views/CheckoutView'
import { OrderConfirmationView } from './views/OrderConfirmationView'
import { AccountView } from './views/AccountView'
import { FavouritesView } from './views/FavouritesView'
import { CategoryProductsView } from './views/CategoryProductsView'
import { CarouselProductsView } from './views/CarouselProductsView'
import { OrdersView } from './views/OrdersView'
import { LoginPageView } from './views/LoginPageView'
import { SignupPageView } from './views/SignupPageView'
import { VendorAvailabilityWarning } from '../components/VendorAvailabilityWarning'
import { AuthPromptModal } from '../components/AuthPromptModal'
import { AuthPromptLaptop } from '../components/AuthPromptLaptop'
import { AuthPromptMobile } from '../components/AuthPromptMobile'
import { removeFCMTokenFromBackend } from '../../../utils/pushNotificationService'
import '../user.css'

const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    description: 'Browse products and categories',
    icon: HomeIcon,
  },
  {
    id: 'favourites',
    label: 'Favourites',
    description: 'Your favourite products',
    icon: HeartIcon,
  },
  {
    id: 'cart',
    label: 'Cart',
    description: 'Your shopping cart',
    icon: CartIcon,
  },
  {
    id: 'orders',
    label: 'Orders',
    description: 'Your orders',
    icon: PackageIcon,
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Orders, profile, settings',
    icon: UserIcon,
  },
]

function UserDashboardContent({ onLogout }) {
  const { profile, cart, favourites, notifications, orders, authenticated } = useUserState()
  const dispatch = useUserDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { tab: urlTab } = useParams()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('home')
  const [cartRefreshKey, setCartRefreshKey] = useState(0) // Key to force CartView refresh
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedCarousel, setSelectedCarousel] = useState(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [orderConfirmation, setOrderConfirmation] = useState(null)
  const { toasts, dismissToast, success, error, warning, info } = useToast()
  const [searchMounted, setSearchMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const searchPanelRef = useRef(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAuthPromptLaptop, setShowAuthPromptLaptop] = useState(false)
  const [authActionType, setAuthActionType] = useState(null) // 'favourites' | 'cart' | 'orders' | null
  const [hasShownInitialModal, setHasShownInitialModal] = useState(false)
  const [isLaptopView, setIsLaptopView] = useState(window.innerWidth >= 1024)

  // Valid tabs for navigation
  const validTabs = ['home', 'favourites', 'cart', 'orders', 'account', 'search', 'product-detail', 'category-products', 'carousel-products', 'checkout', 'login', 'signup', 'signin']

  // Initialize tab from URL parameter on mount or when URL changes
  useEffect(() => {
    const tab = urlTab || 'home'
    if (validTabs.includes(tab)) {
      setActiveTab(tab)

      // Extract category ID from URL search params for category-products page
      if (tab === 'category-products') {
        const categoryIdFromUrl = searchParams.get('category')
        if (categoryIdFromUrl) {
          setSelectedCategory(categoryIdFromUrl)
        } else {
          // Default to 'all' if no category in URL
          setSelectedCategory('all')
        }
      } else {
        // Clear selections when navigating to a different tab
        if (tab !== 'product-detail') setSelectedProduct(null)
        if (tab !== 'category-products') setSelectedCategory(null)
        if (tab !== 'carousel-products') setSelectedCarousel(null)
        if (tab !== 'checkout') setShowCheckout(false)
      }
    } else {
      // Invalid tab, redirect to home
      navigate('/user/dashboard/home', { replace: true })
    }
  }, [urlTab, navigate, searchParams])

  // Navigate function that updates both state and URL
  const navigateToTab = useCallback((tab) => {
    // Check authentication for orders tab
    if (tab === 'orders' && !authenticated) {
      if (isLaptopView) {
        // Show prompt on laptop
        setAuthActionType('orders')
        setShowAuthPromptLaptop(true)
      } else {
        // Show modal on mobile
        setAuthActionType('orders')
        setShowAuthModal(true)
      }
      return
    }

    if (validTabs.includes(tab)) {
      // Handle signin as alias for login
      const targetTab = tab === 'signin' ? 'login' : tab
      setActiveTab(targetTab)
      navigate(`/user/dashboard/${targetTab}`, { replace: false })
      // Clear selections when navigating to a different tab type
      if (targetTab !== 'product-detail') setSelectedProduct(null)
      if (targetTab !== 'category-products') setSelectedCategory(null)
      if (targetTab !== 'carousel-products') setSelectedCarousel(null)
      if (targetTab !== 'checkout') setShowCheckout(false)
    }
  }, [navigate, authenticated, isLaptopView])

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  // Fetch user profile from API on mount
  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (token) {
      // Fetch user profile from backend
      const fetchProfile = async () => {
        try {
          const result = await userApi.getUserProfile()
          if (result.success && result.data?.user) {
            const userData = result.data.user
            dispatch({
              type: 'AUTH_LOGIN',
              payload: {
                name: userData.name || 'User',
                phone: userData.phone || '',
                email: userData.email || '',
                sellerId: userData.sellerId || null,
                location: userData.location || null,
              },
            })

            // Set vendor availability status from profile
            if (result.data?.vendorAvailability) {
              dispatch({
                type: 'SET_VENDOR_AVAILABILITY',
                payload: result.data.vendorAvailability,
              })

              // Set assigned vendor if available
              if (result.data.vendorAvailability.assignedVendor) {
                dispatch({
                  type: 'SET_ASSIGNED_VENDOR',
                  payload: result.data.vendorAvailability.assignedVendor,
                })
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error)
          // If token is invalid, remove it but don't redirect
          if (error.error?.message?.includes('unauthorized') || error.error?.message?.includes('token')) {
            localStorage.removeItem('user_token')
            dispatch({ type: 'AUTH_LOGOUT' })
          }
        }
      }
      fetchProfile()
    }
    // Allow browsing without token - authentication prompts will show when user tries to perform actions
  }, [dispatch])

  // Initialize welcome notification (only first time user enters dashboard)
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcomeNotification')
    if (!hasSeenWelcome && notifications.length === 0) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          title: 'Welcome to IRA Sathi!',
          message: 'Start shopping for your farming needs',
          type: 'welcome',
        },
      })
      localStorage.setItem('hasSeenWelcomeNotification', 'true')
    }
  }, [dispatch, notifications.length])

  // Fetch orders and cart from API
  const { fetchOrders, fetchCart } = useUserApi()

  const resolveId = useCallback((value) => {
    if (!value) return ''
    if (typeof value === 'string' || typeof value === 'number') return value.toString()
    if (typeof value === 'object') {
      if (value._id) return value._id.toString()
      if (value.id) return value.id.toString()
      if (typeof value.toString === 'function') return value.toString()
    }
    return ''
  }, [])

  const mapCartItemsFromResponse = useCallback((cartData) => {
    console.log('🔄 Mapping Cart Items from Response:', cartData)

    if (!cartData?.items) {
      console.log('⚠️ No items in cart data')
      return []
    }

    const mappedItems = cartData.items
      .map((item, index) => {
        console.log(`\n🔄 Mapping Item ${index + 1}:`, item)

        const cartItemId = resolveId(item.id || item._id)
        const product = item.product || item.productId || {}
        const productId = resolveId(product.id || product._id || item.productId)

        console.log(`🔄 Item IDs:`, { cartItemId, productId })
        console.log(`🔄 Product:`, product)
        console.log(`🔄 Variant Attributes (raw):`, item.variantAttributes)

        if (!productId) {
          console.log(`⚠️ Skipping item - no productId`)
          return null
        }

        // Use variant-specific price (unitPrice) if available, otherwise fallback
        const price =
          typeof item.unitPrice === 'number'
            ? item.unitPrice
            : typeof product.priceToUser === 'number'
              ? product.priceToUser
              : typeof product.price === 'number'
                ? product.price
                : 0

        // Extract variant attributes if present
        const variantAttributes = item.variantAttributes || null

        console.log(`💰 Price Calculation:`, {
          'item.unitPrice': item.unitPrice,
          'product.priceToUser': product.priceToUser,
          'product.price': product.price,
          'final price': price,
          'final unitPrice': item.unitPrice || price
        })
        console.log(`🔖 Variant Attributes (final):`, variantAttributes)

        const mappedItem = {
          id: cartItemId, // Add id field for compatibility
          cartItemId,
          productId,
          name: product.name || item.productName || 'Unknown Product',
          price,
          unitPrice: item.unitPrice || price, // Variant-specific price
          image: item.image || product.images?.[0]?.url || product.primaryImage || product.image || '',
          quantity: item.quantity || 1,
          vendor: product.vendor || null,
          deliveryTime: product.deliveryTime || null,
          variantAttributes: variantAttributes, // Include variant attributes
        }

        console.log(`✅ Mapped Item:`, mappedItem)

        return mappedItem
      })
      .filter(Boolean)

    console.log(`\n✅ Final Mapped Cart Items (${mappedItems.length} items):`, mappedItems)

    return mappedItems
  }, [resolveId])

  const syncCartState = useCallback(
    (cartData) => {
      const items = mapCartItemsFromResponse(cartData)
      dispatch({ type: 'SET_CART_ITEMS', payload: items })
    },
    [dispatch, mapCartItemsFromResponse],
  )
  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (token) {
      const loadData = async () => {
        try {
          // Fetch orders
          const ordersResult = await fetchOrders()
          if (ordersResult.data?.orders) {
            ordersResult.data.orders.forEach((order) => {
              dispatch({
                type: 'ADD_ORDER',
                payload: {
                  id: order.id || order._id,
                  orderNumber: order.orderNumber,
                  status: order.status,
                  totalAmount: order.totalAmount,
                  subtotal: order.subtotal,
                  deliveryCharge: order.deliveryCharge,
                  paymentPreference: order.paymentPreference,
                  upfrontAmount: order.upfrontAmount,
                  remainingAmount: order.remainingAmount,
                  paymentStatus: order.paymentStatus,
                  items: order.items,
                  statusTimeline: order.statusTimeline,
                  createdAt: order.createdAt,
                },
              })
            })
          }

          // Fetch cart
          const cartResult = await fetchCart()
          if (cartResult.data?.cart) {
            syncCartState(cartResult.data.cart)
          } else {
            dispatch({ type: 'SET_CART_ITEMS', payload: [] })
          }

          // Fetch addresses
          const addressesResult = await userApi.getAddresses()
          if (addressesResult.success && addressesResult.data?.addresses) {
            // Clear existing addresses first
            dispatch({ type: 'CLEAR_ADDRESSES' })
            // Add addresses from API
            addressesResult.data.addresses.forEach((address) => {
              dispatch({
                type: 'ADD_ADDRESS',
                payload: {
                  id: address.id || address._id,
                  name: address.name || address.label,
                  label: address.label || address.name,
                  address: address.address || address.street,
                  street: address.street || address.address,
                  city: address.city,
                  state: address.state,
                  pincode: address.pincode,
                  phone: address.phone,
                  isDefault: address.isDefault || false,
                },
              })
            })
          }
        } catch (error) {
          console.error('Error loading data:', error)
        }
      }
      loadData()
    }
  }, [fetchOrders, fetchCart, dispatch, syncCartState])

  // Track order status changes and send notifications
  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (!token || orders.length === 0) return

    const checkOrderStatusChanges = async () => {
      try {
        const ordersResult = await fetchOrders()
        if (ordersResult.data?.orders) {
          ordersResult.data.orders.forEach((order) => {
            const existingOrder = orders.find((o) => o.id === order.id || o.id === order._id)
            if (existingOrder && existingOrder.status !== order.status) {
              // Order status changed - send notification
              const statusMessages = {
                accepted: 'Your order has been accepted and is being prepared',
                dispatched: 'Your order has been dispatched and is on the way',
                delivered: 'Your order has been delivered successfully',
              }

              const message = statusMessages[order.status] || `Your order status has been updated to ${order.status}`

              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  type: 'order_status',
                  title: 'Order Status Update',
                  message: `${message}. Order #${order.orderNumber?.slice(-8) || order.id?.slice(-8) || 'N/A'}`,
                  orderId: order.id || order._id,
                  orderNumber: order.orderNumber,
                  status: order.status,
                },
              })

              // Update order in state
              dispatch({
                type: 'UPDATE_ORDER',
                payload: {
                  id: order.id || order._id,
                  status: order.status,
                  paymentStatus: order.paymentStatus,
                  statusTimeline: order.statusTimeline,
                },
              })
            }
          })
        }
      } catch (error) {
        console.error('Error checking order status changes:', error)
      }
    }

    // Check immediately
    checkOrderStatusChanges()

    // Poll every 30 seconds for order status changes
    const interval = setInterval(checkOrderStatusChanges, 30000)

    return () => clearInterval(interval)
  }, [orders, fetchOrders, dispatch])

  // Check for new offers and send notifications
  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (!token) return

    const checkNewOffers = async () => {
      try {
        const offersResult = await userApi.getOffers()
        if (offersResult.success && offersResult.data) {
          const activeCarousels = (offersResult.data.carousels || [])
            .filter(c => c.isActive !== false)
          const specialOffers = offersResult.data.specialOffers || []

          // Check for new offers (created in last 24 hours)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const newCarousels = activeCarousels.filter(c => {
            const createdAt = new Date(c.createdAt)
            return createdAt > oneDayAgo
          })
          const newSpecialOffers = specialOffers.filter(o => {
            const createdAt = new Date(o.createdAt)
            return createdAt > oneDayAgo
          })

          // Send notification for new offers (only once per day)
          if (newCarousels.length > 0 || newSpecialOffers.length > 0) {
            const lastOfferCheck = localStorage.getItem('lastOfferCheckTime')
            const now = Date.now()
            const oneDayInMs = 24 * 60 * 60 * 1000

            if (!lastOfferCheck || (now - parseInt(lastOfferCheck)) > oneDayInMs) {
              const offerCount = newCarousels.length + newSpecialOffers.length
              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  type: 'offer',
                  title: 'New Offers Available!',
                  message: `${offerCount} new ${offerCount === 1 ? 'offer' : 'offers'} ${offerCount === 1 ? 'is' : 'are'} now available. Check them out!`,
                },
              })
              localStorage.setItem('lastOfferCheckTime', now.toString())
            }
          }
        }
      } catch (error) {
        console.error('Error checking new offers:', error)
      }
    }

    // Check immediately
    checkNewOffers()

    // Poll every 5 minutes for new offers
    const interval = setInterval(checkNewOffers, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [dispatch])

  // Reload cart data when cart tab is clicked
  useEffect(() => {
    if (activeTab === 'cart') {
      const reloadCart = async () => {
        try {
          const cartResult = await fetchCart()
          if (cartResult.data?.cart) {
            syncCartState(cartResult.data.cart)
            // Force CartView to refresh by updating key
            setCartRefreshKey(prev => prev + 1)
          }
        } catch (error) {
          console.error('Error reloading cart:', error)
        }
      }
      reloadCart()
    }
  }, [activeTab, fetchCart, syncCartState])

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const favouritesCount = useMemo(() => favourites.length, [favourites])
  const unreadNotificationsCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  // Translate navigation items
  const translatedNavItems = useTranslatedNavItems(NAV_ITEMS)

  const tabLabels = useMemo(() => {
    return translatedNavItems.reduce((acc, item) => {
      acc[item.id] = item.label
      return acc
    }, {})
  }, [translatedNavItems])

  const searchCatalog = useMemo(
    () =>
      [
        {
          id: 'search-home-hero',
          label: 'Special Offers',
          keywords: ['offers', 'deals', 'promotions', 'discounts', 'banner', 'special'],
          tab: 'home',
          targetId: 'home-hero',
        },
        {
          id: 'search-home-search',
          label: 'Find Products',
          keywords: ['search', 'find', 'products', 'items', 'look'],
          tab: 'home',
          targetId: 'home-search',
        },
        {
          id: 'search-home-categories',
          label: 'Browse Categories',
          keywords: ['categories', 'seeds', 'fertilizers', 'pesticides', 'tools', 'browse'],
          tab: 'home',
          targetId: 'home-categories',
        },
        {
          id: 'search-home-popular',
          label: 'Best Sellers',
          keywords: ['popular', 'best', 'trending', 'top', 'sellers', 'products'],
          tab: 'home',
          targetId: 'home-popular-products',
        },
        {
          id: 'search-cart',
          label: 'My Cart',
          keywords: ['cart', 'basket', 'items', 'checkout', 'buy'],
          tab: 'cart',
          targetId: null,
        },
        {
          id: 'search-favourites',
          label: 'My Favourites',
          keywords: ['favourites', 'wishlist', 'saved', 'liked', 'favorite'],
          tab: 'favourites',
          targetId: null,
        },
        {
          id: 'search-orders',
          label: 'My Orders',
          keywords: ['orders', 'history', 'purchases', 'deliveries', 'past'],
          tab: 'orders',
          targetId: null,
        },
        {
          id: 'search-account',
          label: 'My Account',
          keywords: ['account', 'profile', 'settings', 'address', 'payment', 'info'],
          tab: 'account',
          targetId: null,
        },
      ].map((item) => ({
        ...item,
        tabLabel: tabLabels[item.tab],
      })),
    [tabLabels],
  )

  const [pendingScroll, setPendingScroll] = useState(null)

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return searchCatalog.slice(0, 7)
    }
    const tokens = query.split(/\s+/).filter(Boolean)
    const results = searchCatalog
      .map((item) => {
        const haystack = `${item.label} ${item.tabLabel} ${item.keywords.join(' ')}`.toLowerCase()
        const directIndex = haystack.indexOf(query)
        const directScore = directIndex >= 0 ? 200 - directIndex : 0
        const tokenScore = tokens.reduce((score, token) => (haystack.includes(token) ? score + 20 : score), 0)
        const score = directScore + tokenScore
        return { ...item, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
    return results.length ? results : searchCatalog.slice(0, 5)
  }, [searchCatalog, searchQuery])

  const handleSearchNavigate = (item) => {
    if (!item) return
    const delay = item.tab === activeTab ? 150 : 420
    navigateToTab(item.tab)
    if (item.targetId) {
      setPendingScroll({ id: item.targetId, delay })
    }
    closeSearch()
  }

  const handleSearchSubmit = () => {
    if (searchResults.length) {
      handleSearchNavigate(searchResults[0])
    } else {
      navigateToTab('search')
      closeSearch()
    }
  }

  useEffect(() => {
    if (!pendingScroll) return
    const { id, delay } = pendingScroll
    const timer = setTimeout(() => {
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
      }
      setPendingScroll(null)
    }, delay)
    return () => clearTimeout(timer)
  }, [pendingScroll, activeTab])

  const handleAddToCart = async (productId, quantity = 1, variantAttributes = {}) => {
    // Check if user is authenticated
    if (!authenticated) {
      if (isLaptopView) {
        // Show prompt on laptop
        setAuthActionType('cart')
        setShowAuthPromptLaptop(true)
      } else {
        // Show modal on mobile
        setAuthActionType('cart')
        setShowAuthModal(true)
      }
      return
    }

    try {
      console.log('🛒 handleAddToCart called:', { productId, quantity, variantAttributes })

      // Fetch product details from API
      const result = await userApi.getProductDetails(productId)
      if (!result.success || !result.data?.product) {
        error('Product not found')
        return
      }

      const product = result.data.product
      if (product.stock === 0) {
        error('Product is out of stock')
        return
      }

      // Prepare cart payload with variant attributes if provided
      const cartPayload = { productId, quantity }
      if (variantAttributes && Object.keys(variantAttributes).length > 0) {
        cartPayload.variantAttributes = variantAttributes
        console.log('🛒 Adding variant to cart:', cartPayload)
      } else {
        console.log('🛒 Adding product without variants to cart:', cartPayload)
      }

      // Add to cart via API and sync state
      const cartResult = await userApi.addToCart(cartPayload)
      if (cartResult?.data?.cart) {
        console.log('🛒 Cart result from API:', cartResult.data.cart)
        syncCartState(cartResult.data.cart)
      }
      success(`${product.name} added to cart`)
    } catch (err) {
      error(err?.error?.message || err.message || 'Failed to add product to cart')
      console.error('Error adding to cart:', err)
    }
  }

  const handleRemoveFromCart = async (itemId) => {
    // itemId can be either cartItemId (string) or productId
    // First, try to find by cartItemId (for variant-based removal)
    let cartItemId = itemId
    let cartItem = cart.find((item) =>
      (item.id || item._id || item.cartItemId) === itemId
    )

    // If not found by ID, try to find by productId (for backward compatibility)
    if (!cartItem) {
      cartItem = cart.find((item) => item.productId === itemId)
      if (cartItem) {
        cartItemId = cartItem.cartItemId || cartItem.id || cartItem._id
      }
    } else {
      cartItemId = cartItem.cartItemId || cartItem.id || cartItem._id
    }

    if (!cartItemId) {
      error('Unable to remove item from cart')
      return
    }

    try {
      const result = await userApi.removeFromCart(cartItemId)
      if (result?.data?.cart) {
        syncCartState(result.data.cart)
      } else {
        // Fallback: remove by productId if available
        const productId = cartItem?.productId || itemId
        dispatch({ type: 'REMOVE_FROM_CART', payload: { productId } })
      }
      success('Item removed from cart')
    } catch (err) {
      error(err?.error?.message || err.message || 'Failed to remove item from cart')
      console.error('Error removing from cart:', err)
    }
  }

  const handleUpdateCartQuantity = async (itemId, quantity) => {
    // itemId can be either cartItemId (string) or cart item object with id
    const cartItemId = typeof itemId === 'string' ? itemId : (itemId?.id || itemId?._id || itemId?.cartItemId)

    if (!cartItemId) {
      error('Unable to update cart item')
      return
    }

    if (quantity <= 0) {
      await handleRemoveFromCart(itemId)
      return
    }

    try {
      const result = await userApi.updateCartItem(cartItemId, { quantity })
      if (result?.data?.cart) {
        syncCartState(result.data.cart)
      } else {
        // Fallback: find item by ID and update
        const cartItem = cart.find((item) => (item.id || item._id || item.cartItemId) === cartItemId)
        if (cartItem) {
          dispatch({ type: 'UPDATE_CART_ITEM', payload: { itemId: cartItemId, quantity } })
        }
      }
    } catch (err) {
      error(err?.error?.message || err.message || 'Failed to update quantity')
      console.error('Error updating cart quantity:', err)
    }
  }

  const handleProceedToCheckout = () => {
    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    if (cartTotal < MIN_ORDER_VALUE) {
      warning(`Minimum order value is ₹${MIN_ORDER_VALUE.toLocaleString('en-IN')}`)
      return
    }
    setShowCheckout(true)
    navigateToTab('checkout')
  }

  const handleBuyNow = async (productsData) => {
    // productsData is an array of { productId, quantity, attributes }
    // Check if user is authenticated
    if (!authenticated) {
      if (isLaptopView) {
        setAuthActionType('cart')
        setShowAuthPromptLaptop(true)
      } else {
        setAuthActionType('cart')
        setShowAuthModal(true)
      }
      return
    }

    try {
      // Add all products to cart first
      for (const item of productsData) {
        const { productId, quantity, attributes } = item

        // Fetch product details to validate
        const result = await userApi.getProductDetails(productId)
        if (!result.success || !result.data?.product) {
          error('Product not found')
          return
        }

        const product = result.data.product
        if (product.stock === 0) {
          error('Product is out of stock')
          return
        }

        // Prepare cart payload
        const cartPayload = { productId, quantity }
        if (attributes && Object.keys(attributes).length > 0) {
          cartPayload.variantAttributes = attributes
        }

        // Add to cart via API
        const cartResult = await userApi.addToCart(cartPayload)
        if (cartResult?.data?.cart) {
          syncCartState(cartResult.data.cart)
        }
      }

      // Navigate to checkout after adding all items
      const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      if (cartTotal < MIN_ORDER_VALUE) {
        warning(`Minimum order value is ₹${MIN_ORDER_VALUE.toLocaleString('en-IN')}`)
        return
      }

      setShowCheckout(true)
      navigateToTab('checkout')
    } catch (err) {
      error(err?.error?.message || err.message || 'Failed to process Buy Now')
      console.error('Error in Buy Now:', err)
    }
  }

  const handleToggleFavourite = (productId) => {
    // Check if user is authenticated
    if (!authenticated) {
      if (isLaptopView) {
        // Show prompt on laptop
        setAuthActionType('favourites')
        setShowAuthPromptLaptop(true)
      } else {
        // Show modal on mobile
        setAuthActionType('favourites')
        setShowAuthModal(true)
      }
      return
    }

    const isFavourite = favourites.includes(productId)
    if (isFavourite) {
      dispatch({ type: 'REMOVE_FROM_FAVOURITES', payload: { productId } })
      success('Removed from favourites')
    } else {
      dispatch({ type: 'ADD_TO_FAVOURITES', payload: { productId } })
      success('Added to favourites')
    }
  }

  const handleFavouritesClick = () => {
    navigateToTab('favourites')
    setShowCheckout(false)
  }

  const handleSearchClick = () => {
    openSearch()
  }

  const handleFilterClick = () => {
    navigateToTab('search')
  }

  const openSearch = () => {
    // Prevent body scroll when search opens
    document.body.style.overflow = 'hidden'
    setSearchMounted(true)
    requestAnimationFrame(() => {
      setSearchOpen(true)
      // Delay focus slightly to allow panel to render first, preventing keyboard jump
      // This prevents the UI hang when keyboard opens
      setTimeout(() => {
        if (searchInputRef.current) {
          // Use requestAnimationFrame for smoother focus
          requestAnimationFrame(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus()
              searchInputRef.current.select()
            }
          })
        }
      }, 150)
    })
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setKeyboardHeight(0)
    // Restore body scroll
    document.body.style.overflow = ''
    setTimeout(() => {
      setSearchMounted(false)
      setSearchQuery('')
    }, 260)
  }

  // Handle keyboard visibility on mobile devices - smooth adjustment
  useEffect(() => {
    if (!searchOpen) {
      setKeyboardHeight(0)
      return
    }

    let rafId = null
    let initialViewportHeight = window.innerHeight

    // Use visualViewport API for better keyboard detection (modern browsers)
    const handleViewportResize = () => {
      if (rafId) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height
          const windowHeight = window.innerHeight
          const keyboardHeight = windowHeight - viewportHeight

          // Only adjust if keyboard is significantly open (more than 150px)
          if (keyboardHeight > 150) {
            // Smooth adjustment - only move panel slightly up to prevent hang
            setKeyboardHeight(Math.min(keyboardHeight * 0.25, 80))
          } else {
            setKeyboardHeight(0)
          }
        }
      })
    }

    // Fallback for browsers without visualViewport
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        if (!window.visualViewport) {
          const currentHeight = window.innerHeight
          const heightDiff = initialViewportHeight - currentHeight

          if (heightDiff > 150) {
            // Smooth adjustment - only move panel slightly up
            setKeyboardHeight(Math.min(heightDiff * 0.25, 80))
          } else {
            setKeyboardHeight(0)
          }
        }
      })
    }

    // Store initial height when search opens
    initialViewportHeight = window.innerHeight

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize)
    } else {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize)
      } else {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [searchOpen])

  const buildMenuItems = (close) => [
    ...translatedNavItems.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      icon: <item.icon className="h-4 w-4" />,
      onSelect: () => {
        navigateToTab(item.id)
        close()
      },
    })),
    {
      id: 'logout',
      label: <Trans>Sign out</Trans>,
      icon: <MenuIcon className="h-4 w-4" />,
      description: <Trans>Log out from your account</Trans>,
      onSelect: () => {
        // Fire-and-forget FCM token cleanup — must happen before token is removed
        removeFCMTokenFromBackend('user').catch(() => { })
        dispatch({ type: 'AUTH_LOGOUT' })
        onLogout?.()
        close()
      },
    },
  ]

  // Handle auth success - refresh profile and close modal
  const handleAuthSuccess = async () => {
    const token = localStorage.getItem('user_token')
    if (token) {
      try {
        const result = await userApi.getUserProfile()
        if (result.success && result.data?.user) {
          const userData = result.data.user
          dispatch({
            type: 'AUTH_LOGIN',
            payload: {
              name: userData.name || 'User',
              phone: userData.phone || '',
              email: userData.email || '',
              sellerId: userData.sellerId || null,
              location: userData.location || null,
            },
          })
        }
      } catch (error) {
        console.error('Error fetching user profile after login:', error)
      }
    }

    // Close modal on mobile, redirect to home on laptop
    if (isLaptopView) {
      navigateToTab('home')
    } else {
      setShowAuthModal(false)
      setAuthActionType(null)
    }
  }

  return (
    <>
      {/* Mobile prompt - redirects to /user/login */}
      <AuthPromptMobile
        isOpen={showAuthModal && !isLaptopView}
        onClose={() => {
          setShowAuthModal(false)
          setAuthActionType(null)
        }}
        actionType={authActionType}
      />
      {/* Laptop prompt - redirects to /user/dashboard/login */}
      <AuthPromptLaptop
        isOpen={showAuthPromptLaptop}
        onClose={() => {
          setShowAuthPromptLaptop(false)
          setAuthActionType(null)
        }}
        actionType={authActionType}
        onNavigateToSignin={() => navigateToTab('signin')}
      />
      <VendorAvailabilityWarning />
      <MobileShell
        title={activeTab === 'home' ? `Hello ${profile.name.split(' ')[0]}` : null}
        subtitle={profile.location?.city ? `${profile.location.city}, ${profile.location.state}` : null}
        onSearchClick={handleSearchClick}
        onFilterClick={handleFilterClick}
        notificationsCount={unreadNotificationsCount}
        navigation={translatedNavItems.filter(item => item.id !== 'home' && item.id !== 'orders').map((item) => (
          <BottomNavItem
            key={item.id}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => navigateToTab(item.id)}
            icon={<item.icon active={activeTab === item.id} className="h-5 w-5" filled={item.id === 'favourites' ? favouritesCount > 0 : undefined} />}
            badge={item.id === 'cart' ? (cartCount > 0 ? cartCount : undefined) : item.id === 'favourites' ? (favouritesCount > 0 ? favouritesCount : undefined) : undefined}
          />
        ))}
        bottomNavigation={translatedNavItems.map((item) => (
          <BottomNavItem
            key={item.id}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => navigateToTab(item.id)}
            icon={<item.icon active={activeTab === item.id} className="h-5 w-5" filled={item.id === 'favourites' ? favouritesCount > 0 : undefined} />}
            badge={item.id === 'cart' ? (cartCount > 0 ? cartCount : undefined) : item.id === 'favourites' ? (favouritesCount > 0 ? favouritesCount : undefined) : undefined}
          />
        ))}
        menuContent={({ close }) => <MenuList items={buildMenuItems(close)} active={activeTab} />}
        cartCount={cartCount}
        isAuthenticated={authenticated}
        onNavigate={navigateToTab}
        onLogout={onLogout}
        onLogin={() => {
          if (isLaptopView) {
            navigateToTab('login')
          } else {
            window.location.href = '/user/login'
          }
        }}
      >
        <section className="space-y-6">
          {activeTab === 'home' && (
            <HomeView
              onProductClick={(productId) => {
                if (productId === 'all') {
                  // "View All" clicked - switch to search view instead of product detail
                  setSearchQuery('')
                  navigateToTab('search')
                } else if (productId && productId.startsWith('carousel:')) {
                  // Carousel clicked - show carousel products
                  const carouselId = productId.replace('carousel:', '')
                  setSelectedCarousel(carouselId)
                  navigateToTab('carousel-products')
                } else {
                  setSelectedProduct(productId)
                  navigateToTab('product-detail')
                }
              }}
              onCategoryClick={(categoryId) => {
                setSelectedCategory(categoryId)
                // Include category ID in URL for refresh persistence
                navigate(`/user/dashboard/category-products?category=${categoryId}`, { replace: false })
              }}
              onAddToCart={handleAddToCart}
              onSearchClick={handleSearchClick}
              onFilterClick={handleFilterClick}
              onToggleFavourite={handleToggleFavourite}
              favourites={favourites}
            />
          )}
          {activeTab === 'favourites' && (
            <FavouritesView
              onProductClick={(productId) => {
                setSelectedProduct(productId)
                navigateToTab('product-detail')
              }}
              onAddToCart={handleAddToCart}
              onRemoveFromFavourites={(productId) => {
                success('Removed from favourites')
              }}
            />
          )}
          {activeTab === 'category-products' && (
            <CategoryProductsView
              categoryId={selectedCategory || 'all'}
              onProductClick={(productId) => {
                setSelectedProduct(productId)
                navigateToTab('product-detail')
              }}
              onAddToCart={handleAddToCart}
              onBack={() => {
                navigateToTab('home')
              }}
              onToggleFavourite={handleToggleFavourite}
              favourites={favourites}
            />
          )}
          {activeTab === 'carousel-products' && selectedCarousel && (
            <CarouselProductsView
              carouselId={selectedCarousel}
              onProductClick={(productId) => {
                setSelectedProduct(productId)
                navigateToTab('product-detail')
              }}
              onAddToCart={handleAddToCart}
              onBack={() => {
                navigateToTab('home')
              }}
              onToggleFavourite={handleToggleFavourite}
              favourites={favourites}
            />
          )}
          {activeTab === 'search' && (
            <SearchView
              query={searchQuery}
              onProductClick={(productId) => {
                setSelectedProduct(productId)
                navigateToTab('product-detail')
              }}
              onAddToCart={handleAddToCart}
              onToggleFavourite={handleToggleFavourite}
              favourites={favourites}
            />
          )}
          {activeTab === 'product-detail' && selectedProduct && (
            <ProductDetailView
              productId={selectedProduct}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              onToggleFavourite={handleToggleFavourite}
              favourites={favourites}
              onBack={() => {
                navigateToTab('home')
              }}
              onProductClick={(productId) => {
                setSelectedProduct(productId)
                navigateToTab('product-detail')
              }}
            />
          )}
          {activeTab === 'cart' && (
            <CartView
              key={cartRefreshKey}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemove={handleRemoveFromCart}
              onCheckout={handleProceedToCheckout}
              onAddToCart={handleAddToCart}
              onNavigateToProduct={(productId) => {
                setSelectedProduct(productId)
                navigateToTab('product-detail')
              }}
            />
          )}
          {orderConfirmation ? (
            <OrderConfirmationView
              order={orderConfirmation}
              onBackToHome={() => {
                setOrderConfirmation(null)
                navigateToTab('home')
              }}
            />
          ) : (
            <>
              {activeTab === 'checkout' && showCheckout && (
                <CheckoutView
                  onBack={() => {
                    setShowCheckout(false)
                    navigateToTab('cart')
                  }}
                  onOrderPlaced={(order) => {
                    dispatch({ type: 'ADD_ORDER', payload: order })
                    dispatch({ type: 'CLEAR_CART' })
                    setOrderConfirmation(order)
                    setShowCheckout(false)
                  }}
                />
              )}
            </>
          )}
          {activeTab === 'orders' && authenticated && <OrdersView />}
          {activeTab === 'orders' && !authenticated && isLaptopView && (
            <div className="user-orders-view__auth-prompt">
              <div className="user-orders-view__auth-prompt-content">
                <h2 className="user-orders-view__auth-prompt-title"><Trans>Authentication Required</Trans></h2>
                <p className="user-orders-view__auth-prompt-message">
                  <Trans>You can't view your orders now. First login or create your account.</Trans>
                </p>
                <button
                  onClick={() => navigateToTab('signin')}
                  className="user-orders-view__auth-prompt-button"
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  <Trans>Sign In</Trans>
                </button>
              </div>
            </div>
          )}
          {activeTab === 'orders' && !authenticated && !isLaptopView && <OrdersView />}
          {activeTab === 'account' && (
            <AccountView
              onNavigate={navigateToTab}
              authenticated={authenticated}
              isLaptopView={isLaptopView}
              onShowAuthPrompt={(actionType) => {
                if (isLaptopView) {
                  setAuthActionType('profile')
                  setShowAuthPromptLaptop(true)
                } else {
                  setAuthActionType('profile')
                  setShowAuthModal(true)
                }
              }}
            />
          )}
          {activeTab === 'login' && (
            <LoginPageView
              onSuccess={handleAuthSuccess}
              onSwitchToSignup={() => navigateToTab('signup')}
            />
          )}
          {activeTab === 'signup' && (
            <SignupPageView
              onSuccess={handleAuthSuccess}
              onSwitchToLogin={() => navigateToTab('login')}
            />
          )}
        </section>
      </MobileShell>

      {searchMounted ? (
        <div className={cn('user-search-sheet', searchOpen && 'is-open')}>
          <div className={cn('user-search-sheet__overlay', searchOpen && 'is-open')} onClick={closeSearch} />
          <div
            ref={searchPanelRef}
            className={cn('user-search-sheet__panel', searchOpen && 'is-open')}
            style={{
              transform: keyboardHeight > 0
                ? `translateY(0) translateY(-${Math.min(keyboardHeight * 0.15, 60)}px)`
                : undefined,
              transition: keyboardHeight > 0
                ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                : undefined,
            }}
          >
            <div className="user-search-sheet__header">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSearchSubmit()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearch()
                  }
                }}
                placeholder="Search for products, orders, cart..."
                className="user-search-input"
                aria-label="Search user dashboard"
              />
              <button
                type="button"
                className="user-search-cancel"
                onClick={closeSearch}
              >
                Cancel
              </button>
            </div>
            <div className="user-search-sheet__body">
              {searchResults.length ? (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSearchNavigate(item)}
                    className="user-search-result"
                  >
                    <span className="user-search-result__label">{item.label}</span>
                    <span className="user-search-result__meta">{item.tabLabel}</span>
                  </button>
                ))
              ) : (
                <p className="user-search-empty">No matches yet. Try another keyword.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function UserDashboard({ onLogout }) {
  return (
    <ToastProvider>
      <UserDashboardContent onLogout={onLogout} />
    </ToastProvider>
  )
}
