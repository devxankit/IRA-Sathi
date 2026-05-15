import { useState, useMemo, useEffect } from 'react'
import { useUserState, useUserDispatch } from '../../context/UserContext'
import { useUserApi } from '../../hooks/useUserApi'
import { ADVANCE_PAYMENT_PERCENTAGE, REMAINING_PAYMENT_PERCENTAGE } from '../../services/userData'
import { MapPinIcon, CreditCardIcon, TruckIcon, ChevronRightIcon, ChevronDownIcon, CheckIcon, PackageIcon, XIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import { useToast } from '../../components/ToastNotification'
import * as userApi from '../../services/userApi'
import { getPrimaryImageUrl } from '../../utils/productImages'
import { openRazorpayCheckout } from '../../../../utils/razorpay'

const STEPS = [
  { id: 1, label: 'Summary', icon: PackageIcon },
  { id: 2, label: 'Address & Shipping', icon: MapPinIcon },
  { id: 3, label: 'Payment', icon: CreditCardIcon },
]

export function CheckoutView({ onBack, onOrderPlaced }) {
  const { cart, profile, assignedVendor, vendorAvailability } = useUserState()
  const dispatch = useUserDispatch()
  const { createOrder, createPaymentIntent, confirmPayment, loading } = useUserApi()
  const { success, error: showError } = useToast()
  
  // Debug: Log state values
  useEffect(() => {
    console.log('🔍 CheckoutView - State Values:', {
      cartLength: cart?.length || 0,
      profile: profile,
      assignedVendor: assignedVendor,
      vendorAvailability: vendorAvailability,
    })
  }, [cart, profile, assignedVendor, vendorAvailability])
  
  const [currentStep, setCurrentStep] = useState(1)
  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [shippingMethod, setShippingMethod] = useState('standard')
  const [paymentMethod, setPaymentMethod] = useState('razorpay')
  const [promoCode, setPromoCode] = useState('')
  const [showChangeAddressPanel, setShowChangeAddressPanel] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [paymentPreference, setPaymentPreference] = useState('partial') // 'partial' | 'full'
  const [cartProducts, setCartProducts] = useState({})

  // Get delivery address from user profile
  const deliveryAddress = useMemo(() => {
    console.log('📍 CheckoutView - Profile data:', profile)
    console.log('📍 CheckoutView - Profile location:', profile?.location)
    
    if (!profile.location || !profile.location.city || !profile.location.state || !profile.location.pincode) {
      console.log('📍 CheckoutView - Delivery address is NULL (missing required fields)')
      return null
    }
    const address = {
      name: profile.name || 'Home',
      address: profile.location.address || '',
      city: profile.location.city,
      state: profile.location.state,
      pincode: profile.location.pincode,
      phone: profile.phone || '',
    }
    console.log('📍 CheckoutView - Delivery address created:', address)
    return address
  }, [profile])

  // Fetch product details for cart items
  useEffect(() => {
    const loadCartProducts = async () => {
      const productMap = {}
      for (const item of cart) {
        try {
          const result = await userApi.getProductDetails(item.productId)
          if (result.success && result.data?.product) {
            productMap[item.productId] = result.data.product
          }
        } catch (error) {
          console.error(`Error loading product ${item.productId}:`, error)
        }
      }
      setCartProducts(productMap)
    }
    
    if (cart.length > 0) {
      loadCartProducts()
    }
  }, [cart])


  const cartItems = useMemo(() => {
    return cart.map((item) => {
      const product = cartProducts[item.productId]
      // Use variant-specific price (unitPrice) if available, otherwise fallback
      const price = item.unitPrice || item.price || (product ? (product.priceToUser || product.price || 0) : 0)
      return {
        ...item,
        product,
        price: typeof price === 'number' && !isNaN(price) ? price : 0,
        unitPrice: price, // Ensure unitPrice is set for variant pricing
        // Ensure image is available using utility function
        image: item.image || (product ? getPrimaryImageUrl(product) : 'https://via.placeholder.com/300'),
        // Ensure name is available
        name: item.name || product?.name || 'Unknown Product',
      }
    })
  }, [cart, cartProducts])

  // Group items by productId, and if variants exist, group variants together
  const groupedCartItems = useMemo(() => {
    const grouped = {}
    
    cartItems.forEach((item) => {
      const product = cartProducts[item.productId]
      
      // Use variant-specific price (unitPrice) if available, otherwise fallback
      const unitPrice = item.unitPrice || item.price || (product ? (product.priceToUser || product.price || 0) : 0)
      
      // Check if item has variant attributes
      const variantAttrs = item.variantAttributes || {}
      const hasVariants = variantAttrs && typeof variantAttrs === 'object' && Object.keys(variantAttrs).length > 0
      const key = item.productId
      
      if (!grouped[key]) {
        grouped[key] = {
          productId: item.productId,
          product,
          name: item.name || product?.name || 'Product',
          image: product ? getPrimaryImageUrl(product) : (item.image || 'https://via.placeholder.com/400'),
          variants: [], // Array of variant items
          hasVariants: false,
        }
      }
      
      // Add this item as a variant - ensure we have proper ID and variant attributes
      const variantItem = {
        ...item,
        id: item.id || item._id || item.cartItemId, // Ensure ID is available
        cartItemId: item.id || item._id || item.cartItemId, // For API calls
        product,
        unitPrice, // Variant-specific price from backend
        variantAttributes: variantAttrs, // Ensure variant attributes are included
        hasVariants,
      }
      
      grouped[key].variants.push(variantItem)
      
      // Mark as having variants if any variant exists
      if (hasVariants) {
        grouped[key].hasVariants = true
      }
    })
    
    return Object.values(grouped)
  }, [cartItems, cartProducts])

  const isFullPayment = paymentPreference === 'full'

  const paymentOptions = [
    {
      id: 'partial',
      title: 'Pay 30% now, 70% later',
      description: 'Keep the standard split. Remaining amount is collected after delivery.',
      badge: 'Standard',
      helper: 'Best when you prefer COD for the remaining balance.',
    },
    {
      id: 'full',
      title: 'Pay 100% now',
      description: 'Settle the entire order upfront and skip delivery charges automatically.',
      badge: 'Free Delivery',
      helper: 'Unlocks complimentary delivery and faster dispatch handling.',
    },
  ]

  const shippingOptions = [
    { id: 'standard', label: 'Standard Delivery', cost: 50, time: '24 hours' },
  ]

  const selectedShipping = shippingOptions.find((s) => s.id === shippingMethod) || shippingOptions[0]

  const totals = useMemo(() => {
    // Calculate subtotal with proper price handling - use variant-specific price (unitPrice)
    // Use groupedCartItems to calculate from variants
    const subtotal = groupedCartItems.reduce((sum, group) => {
      return sum + group.variants.reduce((variantSum, variant) => {
        const itemPrice = typeof variant.unitPrice === 'number' && !isNaN(variant.unitPrice) ? variant.unitPrice : 0
        const itemQuantity = typeof variant.quantity === 'number' && !isNaN(variant.quantity) ? variant.quantity : 0
        return variantSum + (itemPrice * itemQuantity)
      }, 0)
    }, 0)
    
    const deliveryBeforeBenefit = subtotal >= (selectedShipping.minOrder || Infinity) ? 0 : selectedShipping.cost
    const delivery = paymentPreference === 'full' ? 0 : deliveryBeforeBenefit
    const discount = 0 // Promo code discount would be calculated here
    const total = subtotal + delivery - discount
    const advance =
      paymentPreference === 'full'
        ? total
        : Math.round((total * ADVANCE_PAYMENT_PERCENTAGE) / 100)
    const remaining = total - advance

    return {
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      delivery: isNaN(delivery) ? 0 : delivery,
      deliveryBeforeBenefit: isNaN(deliveryBeforeBenefit) ? 0 : deliveryBeforeBenefit,
      discount: isNaN(discount) ? 0 : discount,
      total: isNaN(total) ? 0 : total,
      advance: isNaN(advance) ? 0 : advance,
      remaining: isNaN(remaining) ? 0 : remaining,
    }
  }, [groupedCartItems, selectedShipping, paymentPreference])

  const amountDueNow = totals.advance
  const amountDueLater = totals.remaining
  const paymentDueNowLabel = isFullPayment ? 'Full Payment (100%)' : `Advance (${ADVANCE_PAYMENT_PERCENTAGE}%)`
  const paymentDueLaterLabel = isFullPayment
    ? 'After Delivery'
    : `Remaining (${REMAINING_PAYMENT_PERCENTAGE}%)`

  // Use actual order total if order exists, otherwise use calculated totals (for preview)
  const modalOrderTotal = pendingOrder?.total ?? (pendingOrder?.preview ? totals.total : totals.total)
  const pendingPaymentPreference = pendingOrder?.uiPayment?.paymentPreference || paymentPreference
  const modalAmountDueNow = pendingOrder?.uiPayment?.amountDueNow ?? amountDueNow
  const modalAmountDueLater = pendingOrder?.uiPayment?.amountDueLater ?? amountDueLater
  const modalDueNowLabel =
    pendingPaymentPreference === 'full' ? 'Full Payment (100%)' : `Advance (${ADVANCE_PAYMENT_PERCENTAGE}%)`
  const modalDueLaterLabel =
    pendingPaymentPreference === 'full' ? 'After Delivery' : `Remaining (${REMAINING_PAYMENT_PERCENTAGE}%)`
  const modalDeliveryWaived =
    pendingOrder?.uiPayment?.deliveryWaived ?? (isFullPayment && totals.deliveryBeforeBenefit > 0)

  // Note: Vendor assignment is now handled by the backend during order creation
  // No need to call assignVendor separately - it's done automatically when creating the order

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      onBack()
    }
  }

  const handlePlaceOrder = () => {
    // Block order placement if no vendor available (beyond 20.3km)
    // Allow if in buffer zone (20km to 20.3km)
    if (!vendorAvailability?.canPlaceOrder && !vendorAvailability?.isInBufferZone) {
      showError('No vendor available in your region. You cannot place orders at this location.')
      return
    }
    if (!deliveryAddress) {
      showError('Please update your delivery address in settings before placing an order')
      return
    }

    // Show payment confirmation modal WITHOUT creating order
    // Order will only be created when user confirms payment
    const uiPayment = {
      paymentPreference,
      amountDueNow,
      amountDueLater,
      deliveryWaived: isFullPayment && totals.deliveryBeforeBenefit > 0,
    }
    
    // Store preview data (not actual order) - order will be created on confirmation
    setPendingOrder({
      preview: true, // Flag to indicate this is preview, not actual order
      uiPayment,
      total: totals.total,
    })
    setShowPaymentConfirm(true)
  }

  const handleConfirmPayment = async () => {
    if (!pendingOrder) {
      showError('Order information is missing')
      return
    }

    // Block order placement if no vendor available (beyond 20.3km)
    // Allow if in buffer zone (20km to 20.3km)
    if (!vendorAvailability?.canPlaceOrder && !vendorAvailability?.isInBufferZone) {
      showError('No vendor available in your region. You cannot place orders at this location.')
      setShowPaymentConfirm(false)
      setPendingOrder(null)
      return
    }
    if (!deliveryAddress) {
      showError('Please update your delivery address in settings before placing an order')
      setShowPaymentConfirm(false)
      setPendingOrder(null)
      return
    }

    try {
      const paymentAmount = pendingOrder.uiPayment?.amountDueNow ?? amountDueNow
      const paymentPlan = pendingOrder.uiPayment?.paymentPreference ?? paymentPreference

      // Create order via API FIRST (only when user confirms payment)
      // Note: Backend reads from cart, so we only need to send payment preference and notes
      const orderData = {
        paymentPreference, // 'partial' or 'full'
        notes: `Shipping method: ${selectedShipping.label}`,
        // Backend will calculate amounts from cart items
      }
      
      console.log('📦 Order Data being sent:', orderData)

      const orderResult = await createOrder(orderData)
      if (orderResult.error) {
        showError(orderResult.error.message || 'Failed to create order')
        setShowPaymentConfirm(false)
        setPendingOrder(null)
        return
      }

      const order = orderResult.data.order
      
      // Update pendingOrder with actual order data
      const updatedPendingOrder = {
        ...order,
        uiPayment: pendingOrder.uiPayment,
      }
      setPendingOrder(updatedPendingOrder)

      // Create payment intent (backend calculates amount from order)
      const paymentIntentResult = await createPaymentIntent({
        orderId: order.id,
        paymentMethod: paymentMethod,
      })

      if (paymentIntentResult.error) {
        showError(paymentIntentResult.error.message || 'Failed to initialize payment')
        return
      }

      const { paymentIntent } = paymentIntentResult.data
      const { razorpayOrderId, keyId, amount } = paymentIntent

      console.log('💳 Payment Intent Data:', {
        razorpayOrderId,
        keyId: keyId ? 'Present' : 'Missing',
        amount,
        orderId: pendingOrder.id,
        orderNumber: pendingOrder.orderNumber,
      })

      // Validate payment intent data
      if (!razorpayOrderId) {
        showError('Invalid payment order. Please try again.')
        return
      }
      if (!keyId) {
        showError('Payment gateway configuration error. Please contact support.')
        return
      }
      if (!amount || amount <= 0) {
        showError('Invalid payment amount. Please try again.')
        return
      }

      // Open Razorpay Checkout
      try {
        const razorpayResponse = await openRazorpayCheckout({
          key: keyId,
          amount: amount, // Amount in rupees (will be converted to paise in openRazorpayCheckout)
          currency: 'INR',
          order_id: razorpayOrderId,
          name: 'IRA SATHI',
          description: `Payment for Order ${pendingOrder.orderNumber || pendingOrder.id}`,
          prefill: {
            name: profile.name || '',
            email: profile.email || '',
            contact: profile.phone || '',
          },
        })

        // Confirm payment with Razorpay response
        const confirmResult = await confirmPayment({
          orderId: order.id,
          paymentIntentId: paymentIntent.id,
          gatewayPaymentId: razorpayResponse.paymentId,
          gatewayOrderId: razorpayResponse.orderId,
          gatewaySignature: razorpayResponse.signature,
          paymentMethod: paymentMethod,
        })

        if (confirmResult.error) {
          showError(confirmResult.error.message || 'Payment failed')
          setShowPaymentConfirm(false)
          setPendingOrder(null)
          return
        }

        // Clear cart after successful payment (backend also clears cart, but this keeps frontend state in sync)
        dispatch({ type: 'CLEAR_CART' })

        success(
          paymentPlan === 'full'
            ? 'Order fully paid and confirmed!'
            : 'Order placed successfully! Advance payment confirmed.'
        )
        onOrderPlaced?.(updatedPendingOrder)
        setShowPaymentConfirm(false)
        setPendingOrder(null)
      } catch (razorpayError) {
        // Handle Razorpay errors
        if (razorpayError.error) {
          showError(razorpayError.error || 'Payment was cancelled or failed')
        } else {
          showError(razorpayError.message || 'Payment processing failed. Please try again.')
        }
        setShowPaymentConfirm(false)
        setPendingOrder(null)
        return
      }
    } catch (err) {
      console.error('Payment processing error:', err)
      showError(err.message || 'Payment processing failed. Please try again.')
      setShowPaymentConfirm(false)
      setPendingOrder(null)
    }
  }

  // Collapsible Summary Component
  const OrderSummary = ({ compact = false }) => (
    <div className={cn(
      "user-checkout-summary",
      compact && "user-checkout-summary--compact"
    )}>
      <button
        type="button"
        onClick={() => setSummaryExpanded(!summaryExpanded)}
        className="user-checkout-summary__header"
      >
        <div className="flex items-center gap-2">
          <PackageIcon className="h-4 w-4 text-[#017827]" />
          <span className="text-sm font-semibold text-[#172022]">
            {compact ? `₹${totals.total.toLocaleString('en-IN')}` : 'Order Summary'}
          </span>
          {compact && (
            <span className="text-xs text-[rgba(26,42,34,0.6)]">
              ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
            </span>
          )}
        </div>
        <ChevronDownIcon className={cn(
          "h-4 w-4 text-[rgba(26,42,34,0.6)] transition-transform",
          summaryExpanded && "rotate-180"
        )} />
      </button>

      {summaryExpanded && (
        <div className="user-checkout-summary__content">
          <div className="space-y-3 mb-3">
            {groupedCartItems.map((group, index) => (
              <div key={group.productId || `checkout-group-${index}`} className="space-y-2">
                {/* Product Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-[rgba(1, 78, 23,0.1)]">
                  <img src={group.image} alt={group.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#172022] line-clamp-1">{group.name}</p>
                    <p className="text-[0.65rem] text-[rgba(26,42,34,0.6)]">{group.variants.length} variant{group.variants.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                
                {/* Variants */}
                {group.variants.map((variant, variantIndex) => (
                  <div key={variant.id || variant._id || variant.cartItemId || `variant-${variantIndex}`} className="flex items-start justify-between gap-2 pl-4">
                    <div className="flex-1 min-w-0">
                      {/* Variant Attributes */}
                      {variant.variantAttributes && Object.keys(variant.variantAttributes).length > 0 ? (
                        <div className="mb-1 space-y-0.5">
                          {Object.entries(variant.variantAttributes).map(([key, value], attrIndex) => (
                            <p key={`${variant.id || variant._id || variantIndex}-attr-${key}-${attrIndex}`} className="text-[0.65rem] text-[rgba(26,42,34,0.6)]">
                              <span className="font-medium">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[0.65rem] text-[rgba(26,42,34,0.6)] mb-1">Standard variant</p>
                      )}
                      <p className="text-xs text-[rgba(26,42,34,0.6)]">
                        Qty: {variant.quantity} × ₹{(variant.unitPrice || variant.price || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-[#017827] flex-shrink-0">
                      ₹{((variant.unitPrice || variant.price || 0) * variant.quantity).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-1.5 pt-2 border-t border-[rgba(1, 78, 23,0.1)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[rgba(26,42,34,0.65)]">Subtotal</span>
              <span className="font-semibold text-[#172022]">₹{totals.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[rgba(26,42,34,0.65)]">Delivery</span>
              <div className="text-right">
                <span className="font-semibold text-[#172022]">
                  {totals.delivery === 0 ? 'Free' : `₹${totals.delivery}`}
                </span>
                {totals.delivery === 0 && totals.deliveryBeforeBenefit > 0 && isFullPayment && (
                  <p className="text-[10px] text-[#017827] font-semibold leading-tight">
                    Waived with 100% payment
                  </p>
                )}
              </div>
            </div>
            {totals.discount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[rgba(26,42,34,0.65)]">Discount</span>
                <span className="font-semibold text-[#017827]">-₹{totals.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-[rgba(1, 78, 23,0.1)]">
              <span className="text-sm font-bold text-[#172022]">Total</span>
              <span className="text-base font-bold text-[#017827]">₹{totals.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="user-checkout-view user-checkout-view-container">
      {/* Back Button */}
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-semibold text-[#017827] mb-3"
        onClick={handleBack}
      >
        <ChevronRightIcon className="h-5 w-5 rotate-180" />
        {currentStep === 1 ? 'Back to Cart' : 'Back'}
      </button>

      {/* Progress Indicator */}
      <div className="user-checkout-progress mb-6">
        <div className="user-checkout-progress__steps">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id
            const isLast = index === STEPS.length - 1
            // Connector should be completed if we've passed this step (currentStep > step.id)
            const connectorCompleted = currentStep > step.id

            return (
              <div 
                key={step.id} 
                className={cn(
                  "user-checkout-progress__step-wrapper",
                  !isLast && connectorCompleted && "user-checkout-progress__step-wrapper--connector-completed"
                )}
              >
                <div className="user-checkout-progress__step">
                  <div className={cn(
                    "user-checkout-progress__step-circle",
                    isActive && "user-checkout-progress__step-circle--active",
                    isCompleted && "user-checkout-progress__step-circle--completed"
                  )}>
                    {isCompleted ? (
                      <CheckIcon className="h-4 w-4 text-white" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(
                    "user-checkout-progress__step-label",
                    isActive && "user-checkout-progress__step-label--active"
                  )}>
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sticky Summary (Compact) */}
      {currentStep > 1 && (
        <div className="sticky top-0 z-10 bg-white border-b border-[rgba(1, 78, 23,0.1)] -mx-5 px-5 pb-3 mb-4">
          <OrderSummary compact />
        </div>
      )}

      {/* Step 1: Summary */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#172022] mb-2">Order Summary</h2>

          {/* Expandable Summary */}
          <OrderSummary />

          {/* Promo Code */}
          <div className="p-4 rounded-xl border border-[rgba(1, 78, 23,0.12)] bg-[rgba(240,245,242,0.3)]">
            <label className="block text-sm font-semibold text-[#172022] mb-2">Promo Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                className="flex-1 px-3 py-2 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-white text-sm focus:outline-none focus:border-[#017827]"
              />
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[#017827] text-white text-sm font-semibold hover:bg-[#0a9937] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Payment Preference */}
          <div className="p-4 rounded-xl border border-[rgba(1, 78, 23,0.12)] bg-white">
            <h3 className="text-sm font-semibold text-[#172022] mb-3">Payment Preference</h3>
            <div className="grid gap-3">
              {paymentOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setPaymentPreference(option.id)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all',
                    paymentPreference === option.id
                      ? 'border-[#017827] bg-[rgba(240,245,242,0.6)] shadow-sm'
                      : 'border-[rgba(1, 78, 23,0.15)] bg-white hover:border-[rgba(1, 78, 23,0.25)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#172022]">{option.title}</span>
                    {option.badge && (
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                          option.id === 'full'
                            ? 'bg-[#017827] text-white'
                            : 'bg-[rgba(1, 78, 23,0.08)] text-[#017827]',
                        )}
                      >
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[rgba(26,42,34,0.7)]">{option.description}</p>
                  {option.helper && (
                    <p className="text-xs font-semibold text-[#017827] mt-2">{option.helper}</p>
                  )}
                </button>
              ))}
            </div>
            {isFullPayment && (
              <p className="text-xs text-[#017827] font-semibold mt-3 flex items-center gap-2">
                <CheckIcon className="h-3.5 w-3.5" />
                Delivery fee automatically waived for this order.
              </p>
            )}
          </div>

          {/* Payment Breakdown */}
          <div className="p-4 rounded-xl border border-[rgba(1, 78, 23,0.12)] bg-white user-checkout-payment-breakdown">
            <h3 className="text-sm font-semibold text-[#172022] mb-3">Payment Breakdown</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[rgba(240,245,242,0.5)] border border-[rgba(1, 78, 23,0.15)]">
                <p className="text-xs font-semibold text-[rgba(26,42,34,0.65)] uppercase tracking-wide mb-1">
                  {paymentDueNowLabel}
                </p>
                <p className="text-lg font-bold text-[#017827]">₹{amountDueNow.toLocaleString('en-IN')}</p>
                <p className="text-xs text-[rgba(26,42,34,0.6)] mt-1">Pay now</p>
              </div>
              <div className="p-3 rounded-lg bg-[rgba(240,245,242,0.5)] border border-[rgba(1, 78, 23,0.15)]">
                <p className="text-xs font-semibold text-[rgba(26,42,34,0.65)] uppercase tracking-wide mb-1">
                  {paymentDueLaterLabel}
                </p>
                <p className="text-lg font-bold text-[#017827]">₹{amountDueLater.toLocaleString('en-IN')}</p>
                <p className="text-xs text-[rgba(26,42,34,0.6)] mt-1">
                  {isFullPayment ? 'No pending payment after delivery' : 'Pay after delivery'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Address & Shipping */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#172022] mb-2">Delivery Address</h2>

          {/* Delivery Address Display */}
          {deliveryAddress ? (
            <div className="p-5 rounded-2xl border-2 border-[#017827] bg-gradient-to-br from-[rgba(240,253,249,0.95)] to-[rgba(255,255,255,0.98)] shadow-[0_4px_12px_-4px_rgba(1, 120, 39,0.25)]">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#017827] flex items-center justify-center">
                  <MapPinIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-bold text-[#172022]">{deliveryAddress.name}</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#017827] text-white uppercase tracking-wide">
                      Delivery Address
                    </span>
                  </div>
                  {deliveryAddress.address && (
                    <p className="text-sm text-[rgba(26,42,34,0.75)] mb-2 leading-relaxed font-medium">{deliveryAddress.address}</p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm text-[rgba(26,42,34,0.75)] font-medium">
                    {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
                  </p>
                  </div>
                  {deliveryAddress.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[rgba(26,42,34,0.6)] font-medium">Phone:</span>
                      <p className="text-sm text-[rgba(26,42,34,0.75)] font-semibold">{deliveryAddress.phone}</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeAddressPanel(true)}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-white border border-[rgba(1, 78, 23,0.2)] text-sm font-semibold text-[#017827] hover:bg-[rgba(240,245,242,0.6)] transition-all hover:shadow-sm"
              >
                Want to change Delivery Address?
              </button>
            </div>
          ) : (
            <div className="text-center py-8 p-5 rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white shadow-[0_4px_12px_-4px_rgba(220,38,38,0.2)]">
              <MapPinIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-red-700 mb-4">Delivery address is required to place an order.</p>
              <button
                type="button"
                onClick={() => setShowChangeAddressPanel(true)}
                className="px-6 py-3 rounded-xl bg-[#017827] text-white text-sm font-semibold hover:bg-[#0a9937] transition-colors shadow-md hover:shadow-lg"
              >
                Add Delivery Address
              </button>
            </div>
          )}

          {/* Shipping Methods */}
          <div className="mt-6">
            <h3 className="text-base font-bold text-[#172022] mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(1, 120, 39,0.1)] flex items-center justify-center">
              <TruckIcon className="h-5 w-5 text-[#017827]" />
              </div>
              Shipping Method
            </h3>
            <div className="space-y-3">
              {shippingOptions.map((option) => {
                const isAvailable = !option.minOrder || totals.subtotal >= option.minOrder
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all shadow-sm',
                      !isAvailable && 'opacity-50 cursor-not-allowed',
                      shippingMethod === option.id && isAvailable
                        ? 'border-[#017827] bg-gradient-to-br from-[rgba(240,253,249,0.95)] to-[rgba(255,255,255,0.98)] shadow-[0_4px_12px_-4px_rgba(1, 120, 39,0.25)]'
                        : 'border-[rgba(1, 78, 23,0.15)] bg-white hover:border-[rgba(1, 78, 23,0.3)] hover:shadow-md'
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={option.id}
                      checked={shippingMethod === option.id}
                      onChange={(e) => setShippingMethod(e.target.value)}
                      disabled={!isAvailable}
                      className="w-5 h-5 accent-[#017827]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-bold text-[#172022]">{option.label}</span>
                        <div className="text-right">
                          <span className="text-base font-bold text-[#017827]">
                            {option.cost === 0 || isFullPayment ? 'Free' : `₹${option.cost}`}
                          </span>
                          {isFullPayment && option.cost > 0 && (
                            <p className="text-[10px] text-[#017827] font-bold leading-tight mt-0.5">
                              Savings: ₹{option.cost}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[rgba(26,42,34,0.65)] font-medium">
                        Estimated delivery: {option.time}
                        {option.minOrder && !isAvailable && ` (Min order: ₹${option.minOrder.toLocaleString('en-IN')})`}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {(assignedVendor || cartItems[0]?.vendor) && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[rgba(240,245,242,0.6)] to-[rgba(255,255,255,0.9)] border border-[rgba(1, 78, 23,0.2)] shadow-sm user-checkout-vendor-container">
              <p className="text-xs font-bold text-[rgba(26,42,34,0.7)] uppercase tracking-wide mb-2 flex items-center gap-2">
                <PackageIcon className="h-4 w-4 text-[#017827]" />
                Assigned Vendor
              </p>
              <p className="text-sm font-bold text-[#172022] mb-1">
                {assignedVendor?.name || cartItems[0]?.vendor?.name || 'Assigning...'}
              </p>
              <p className="text-xs text-[rgba(26,42,34,0.65)] font-medium">
                {assignedVendor?.location || cartItems[0]?.vendor?.location || 'Based on your location (20km radius)'}
              </p>
              {!assignedVendor && (
                <p className="text-xs text-orange-600 font-semibold mt-2">Vendor will be assigned automatically based on your address</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Payment */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#172022] mb-2">Payment Method</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#017827] bg-gradient-to-br from-[rgba(240,253,249,0.95)] to-[rgba(255,255,255,0.98)] shadow-[0_4px_12px_-4px_rgba(1, 120, 39,0.25)]">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#017827] flex items-center justify-center">
                <CreditCardIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-base font-bold text-[#172022]">Razorpay</span>
                <p className="text-xs text-[rgba(26,42,34,0.65)] mt-1 font-medium">Secure payment gateway</p>
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#017827] flex items-center justify-center">
                <CheckIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          {/* Final Summary */}
          <div className="p-5 rounded-2xl border-2 border-[rgba(1, 78, 23,0.15)] bg-gradient-to-br from-[rgba(240,245,242,0.6)] to-[rgba(255,255,255,0.95)] shadow-[0_4px_12px_-4px_rgba(1, 37, 11,0.15)] user-checkout-final-summary">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[rgba(1, 120, 39,0.1)] flex items-center justify-center">
                <PackageIcon className="h-5 w-5 text-[#017827]" />
              </div>
              <h3 className="text-base font-bold text-[#172022]">Final Summary</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[rgba(1, 78, 23,0.1)]">
                <span className="text-sm font-medium text-[rgba(26,42,34,0.7)]">Subtotal</span>
                <span className="text-sm font-bold text-[#172022]">₹{totals.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[rgba(1, 78, 23,0.1)]">
                <span className="text-sm font-medium text-[rgba(26,42,34,0.7)]">Delivery</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#172022]">
                    {totals.delivery === 0 ? 'Free' : `₹${totals.delivery}`}
                  </span>
                  {totals.delivery === 0 && totals.deliveryBeforeBenefit > 0 && isFullPayment && (
                    <p className="text-[10px] text-[#017827] font-bold leading-tight mt-0.5">
                      Waived with 100% payment
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[rgba(1, 120, 39,0.1)] to-[rgba(1, 120, 39,0.05)] border-2 border-[#017827]">
                <span className="text-base font-bold text-[#172022]">Total</span>
                <span className="text-xl font-bold text-[#017827]">₹{totals.total.toLocaleString('en-IN')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-gradient-to-br from-[rgba(240,253,249,0.8)] to-white border-2 border-[rgba(1, 120, 39,0.2)] shadow-sm">
                  <p className="text-[10px] font-bold text-[rgba(26,42,34,0.65)] uppercase tracking-wide mb-2">
                    {paymentDueNowLabel}
                  </p>
                  <p className="text-lg font-bold text-[#017827]">₹{amountDueNow.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-[rgba(26,42,34,0.6)] font-medium mt-1">Pay now</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-[rgba(240,245,242,0.6)] to-white border-2 border-[rgba(1, 78, 23,0.15)] shadow-sm">
                  <p className="text-[10px] font-bold text-[rgba(26,42,34,0.65)] uppercase tracking-wide mb-2">
                    {paymentDueLaterLabel}
                  </p>
                  <p className="text-lg font-bold text-[#017827]">₹{amountDueLater.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-[rgba(26,42,34,0.6)] font-medium mt-1">
                    {isFullPayment ? 'No pending payment' : 'Pay after delivery'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-[rgba(1, 78, 23,0.1)] -mx-5 mt-6 space-y-2 user-checkout-navigation">
        {currentStep < 3 ? (
          <button
            type="button"
            className={cn(
              'w-full py-3.5 px-6 rounded-xl text-base font-bold transition-all',
              currentStep === 2 && !deliveryAddress
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#017827] to-[#0a9937] text-white shadow-md hover:shadow-lg'
            )}
            onClick={handleNext}
            disabled={currentStep === 2 && !deliveryAddress}
          >
            {currentStep === 1 ? 'Continue to Address & Shipping' : 'Continue to Payment'}
          </button>
        ) : (
          <>
            {(() => {
              const hasDeliveryAddress = !!deliveryAddress
              
              // Only disable if vendorAvailability has been explicitly checked and found unavailable
              // Logic: If assignedVendor exists, vendor was checked. If not, it's likely default state.
              // Default state (all false, no assignedVendor) should allow order - backend will handle vendor assignment
              const vendorWasChecked = assignedVendor !== null || 
                (vendorAvailability && (vendorAvailability.canPlaceOrder === true || vendorAvailability.isInBufferZone === true))
              
              // Only block if vendor was explicitly checked AND found unavailable (not in buffer zone)
              const vendorCheck = vendorWasChecked && 
                vendorAvailability && 
                !vendorAvailability?.canPlaceOrder && 
                !vendorAvailability?.isInBufferZone
              
              const isDisabled = !hasDeliveryAddress || vendorCheck
              
              console.log('🔘 CheckoutView - Button State Check:', {
                hasDeliveryAddress,
                deliveryAddress,
                assignedVendor,
                vendorAvailability,
                vendorWasChecked,
                vendorCheck,
                canPlaceOrder: vendorAvailability?.canPlaceOrder,
                isInBufferZone: vendorAvailability?.isInBufferZone,
                vendorAvailable: vendorAvailability?.vendorAvailable,
                isDisabled,
                finalDisabled: isDisabled
              })
              
              return (
                <button
                  type="button"
                  className={cn(
                    'w-full py-3.5 px-6 rounded-xl text-base font-bold transition-all',
                    isDisabled
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#017827] to-[#0a9937] text-white shadow-md hover:shadow-lg'
                  )}
                  onClick={handlePlaceOrder}
                  disabled={isDisabled}
                >
                  Pay ₹{amountDueNow.toLocaleString('en-IN')} & Place Order
                </button>
              )
            })()}
            <p className="text-xs text-center text-[rgba(26,42,34,0.65)]">
              {amountDueLater > 0
                ? `You will pay the remaining ₹${amountDueLater.toLocaleString('en-IN')} after delivery`
                : 'This order will be fully prepaid and delivery is complimentary.'}
            </p>
          </>
        )}
      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentConfirm && pendingOrder && (
        <div
          className="user-payment-confirm-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPaymentConfirm(false)
              setPendingOrder(null)
            }
          }}
        >
          <div className="user-payment-confirm-modal__content">
            <button
              type="button"
              onClick={() => {
                setShowPaymentConfirm(false)
                setPendingOrder(null)
              }}
              className="user-payment-confirm-modal__close"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <div className="user-payment-confirm-modal__icon">
              <CreditCardIcon className="h-12 w-12 text-[#017827]" />
            </div>

            <h3 className="user-payment-confirm-modal__title">Confirm Payment</h3>
            <p className="user-payment-confirm-modal__subtitle">
              Please confirm to proceed with your order
            </p>

            <div className="user-payment-confirm-modal__details">
              <div className="user-payment-confirm-modal__detail-row">
                <span className="user-payment-confirm-modal__detail-label">Order Total</span>
                <span className="user-payment-confirm-modal__detail-value">
                  ₹{modalOrderTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="user-payment-confirm-modal__detail-row">
                <span className="user-payment-confirm-modal__detail-label">{modalDueNowLabel}</span>
                <span className="user-payment-confirm-modal__detail-value user-payment-confirm-modal__detail-value--highlight">
                  ₹{modalAmountDueNow.toLocaleString('en-IN')}
                </span>
              </div>
              {modalAmountDueLater > 0 && (
                <div className="user-payment-confirm-modal__detail-row">
                  <span className="user-payment-confirm-modal__detail-label">
                    {modalDueLaterLabel}
                  </span>
                  <span className="user-payment-confirm-modal__detail-value">
                    ₹{modalAmountDueLater.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            <div className="user-payment-confirm-modal__info">
              <div className="user-payment-confirm-modal__info-item">
                <CheckIcon className="h-5 w-5 text-[#017827]" />
                <span>Secure payment via Razorpay</span>
              </div>
              <div className="user-payment-confirm-modal__info-item">
                <CheckIcon className="h-5 w-5 text-[#017827]" />
                <span>
                  {modalAmountDueLater > 0
                    ? 'Remaining amount payable on delivery'
                    : 'Delivery charges waived automatically'}
                </span>
              </div>
              {modalAmountDueLater === 0 && modalDeliveryWaived && (
                <div className="user-payment-confirm-modal__info-item">
                  <CheckIcon className="h-5 w-5 text-[#017827]" />
                  <span>Get priority processing for prepaid orders</span>
                </div>
              )}
            </div>

            <div className="user-payment-confirm-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentConfirm(false)
                  setPendingOrder(null)
                }}
                className="user-payment-confirm-modal__btn user-payment-confirm-modal__btn--cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={loading}
                className="user-payment-confirm-modal__btn user-payment-confirm-modal__btn--confirm"
              >
                {loading
                  ? 'Processing...'
                  : `Pay ₹${modalAmountDueNow.toLocaleString('en-IN')} & Place Order`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Address Instructions Panel */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 transition-opacity duration-300',
          showChangeAddressPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowChangeAddressPanel(false)
          }
        }}
      >
        <div
          className={cn(
            'w-full max-w-md bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out',
            showChangeAddressPanel ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#172022]">Change Delivery Address</h3>
              <button
                type="button"
                onClick={() => setShowChangeAddressPanel(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-[rgba(26,42,34,0.7)] mb-4">
                To change your delivery address, please follow these steps:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(240,245,242,0.5)] border border-[rgba(1, 78, 23,0.15)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#017827] text-white flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#172022]">Go to Settings</p>
                    <p className="text-xs text-[rgba(26,42,34,0.6)] mt-1">Navigate to your account settings</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(240,245,242,0.5)] border border-[rgba(1, 78, 23,0.15)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#017827] text-white flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#172022]">Locate Delivery Address</p>
                    <p className="text-xs text-[rgba(26,42,34,0.6)] mt-1">Find the "Delivery Address" section</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(240,245,242,0.5)] border border-[rgba(1, 78, 23,0.15)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#017827] text-white flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#172022]">Click on Change Delivery Address</p>
                    <p className="text-xs text-[rgba(26,42,34,0.6)] mt-1">Click the button to update your address</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(240,245,242,0.5)] border border-[rgba(1, 78, 23,0.15)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#017827] text-white flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#172022]">Update Your Address</p>
                    <p className="text-xs text-[rgba(26,42,34,0.6)] mt-1">From there you can change your delivery address</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowChangeAddressPanel(false)
                  // Navigate to settings - you may need to adjust this based on your routing
                  if (onBack) {
                    // This will go back, but ideally should navigate to settings
                    // You might want to add a prop for navigation
                  }
                }}
                className="w-full mt-6 py-3 px-4 rounded-xl bg-[#017827] text-white text-sm font-semibold hover:bg-[#0a9937] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
