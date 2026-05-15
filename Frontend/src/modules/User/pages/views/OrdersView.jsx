import { useState, useMemo } from 'react'
import { useUserState } from '../../context/UserContext'
import { useUserApi } from '../../hooks/useUserApi'
import { PackageIcon, TruckIcon, ClockIcon, CheckCircleIcon, CreditCardIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'
import { useToast } from '../../components/ToastNotification'
import { getPrimaryImageUrl } from '../../utils/productImages'
import { openRazorpayCheckout } from '../../../../utils/razorpay'
import { Trans } from '../../../../components/Trans'
import { useTranslatedArray } from '../../../../hooks/useTranslatedArray'
import { TransText } from '../../../../components/TransText'

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'awaiting', label: 'Awaiting' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'added_to_cart', label: 'In Cart' },
]

const USER_ORDER_STATUSES = ['awaiting', 'dispatched', 'delivered']
const STATUS_LABELS = {
  awaiting: 'Awaiting',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
}
const STATUS_DESCRIPTIONS = {
  awaiting: 'Vendor is confirming stock and assigning a delivery partner.',
  dispatched: 'Order handed over for delivery. Track updates in real time.',
  delivered: 'Order delivered. Complete remaining payment if pending.',
}

// Hook to get translated filter tabs
function useTranslatedFilterTabs() {
  const labels = FILTER_TABS.map(tab => tab.label)
  const translatedLabels = useTranslatedArray(labels)
  
  return FILTER_TABS.map((tab, index) => ({
    ...tab,
    label: translatedLabels[index] || tab.label,
  }))
}

// Hook to get translated status labels
function useTranslatedStatusLabels() {
  const statusKeys = Object.keys(STATUS_LABELS)
  const statusValues = statusKeys.map(key => STATUS_LABELS[key])
  const translatedValues = useTranslatedArray(statusValues)
  
  const translated = {}
  statusKeys.forEach((key, index) => {
    translated[key] = translatedValues[index] || STATUS_LABELS[key]
  })
  return translated
}

// Hook to get translated status descriptions
function useTranslatedStatusDescriptions() {
  const statusKeys = Object.keys(STATUS_DESCRIPTIONS)
  const statusValues = statusKeys.map(key => STATUS_DESCRIPTIONS[key])
  const translatedValues = useTranslatedArray(statusValues)
  
  const translated = {}
  statusKeys.forEach((key, index) => {
    translated[key] = translatedValues[index] || STATUS_DESCRIPTIONS[key]
  })
  return translated
}

const getStatusKey = (status) => {
  if (!status) return 'awaiting'
  const normalized = status.toLowerCase()
  if (normalized.includes('deliver')) return 'delivered'
  if (normalized.includes('dispatch')) return 'dispatched'
  if (normalized.includes('await')) return 'awaiting'
  return normalized
}

const getDisplayStatus = (status, translatedLabels, paymentStatus) => {
  if (status === 'added_to_cart') return 'In Cart'
  
  // If status is fully_paid, just show "Fully Paid"
  const normalizedStatus = status?.toLowerCase()
  if (normalizedStatus === 'fully_paid' || normalizedStatus === 'fully paid') {
    return 'Fully Paid'
  }
  
  const key = getStatusKey(status)
  const statusLabel = translatedLabels[key] || STATUS_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1)
  
  // If fully paid and has a delivery status, show both status and payment status
  if (paymentStatus === 'fully_paid' && key !== 'fully_paid') {
    return `${statusLabel} • Fully Paid`
  }
  
  return statusLabel
}

const formatTimelineTimestamp = (timestamp) => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return timestamp
  }
}

export function OrdersView() {
  const { orders, cart } = useUserState()
  const { createRemainingPaymentIntent, confirmRemainingPayment, loading } = useUserApi()
  const { success, error: showError } = useToast()
  const [activeFilter, setActiveFilter] = useState('all')
  const [processingPayment, setProcessingPayment] = useState(null)
  
  // Get translated labels
  const translatedFilterTabs = useTranslatedFilterTabs()
  const translatedStatusLabels = useTranslatedStatusLabels()
  const translatedStatusDescriptions = useTranslatedStatusDescriptions()

  // Combine orders and cart items
  const allItems = useMemo(() => {
    const orderItems = orders.map((order, index) => {
      let deliveryStatus = order.status
      const normalizedStatus = order.status?.toLowerCase()
      
      // If status is payment-related (fully_paid), extract delivery status from statusTimeline
      if (normalizedStatus === 'fully_paid' || normalizedStatus === 'fully paid') {
        if (order.statusTimeline && Array.isArray(order.statusTimeline) && order.statusTimeline.length > 0) {
          // Find the latest delivery status (delivered > dispatched > awaiting)
          const deliveryStatuses = ['delivered', 'dispatched', 'awaiting']
          for (const ds of deliveryStatuses) {
            // Optimize: check timeline entries more efficiently
            const timelineEntry = order.statusTimeline.find(entry => {
              if (!entry?.status) return false
              const entryStatusKey = getStatusKey(entry.status)
              return entryStatusKey === ds
            })
            if (timelineEntry) {
              // Use the normalized status key directly
              deliveryStatus = ds
              break
            }
          }
        }
        // If no delivery status found in timeline, default to awaiting
        if (deliveryStatus === order.status || getStatusKey(deliveryStatus) === 'fully_paid') {
          deliveryStatus = 'awaiting'
        }
      }
      
      // Normalize the final status (only if not already normalized)
      const normalizedDeliveryStatus = deliveryStatus && ['awaiting', 'dispatched', 'delivered'].includes(deliveryStatus)
        ? deliveryStatus
        : getStatusKey(deliveryStatus || 'awaiting')
      
      return {
        ...order,
        type: 'order',
        status: normalizedDeliveryStatus,
        statusTimeline: order.statusTimeline || [],
        // Ensure unique ID - use id or _id, fallback to index-based unique key
        uniqueId: order.id || order._id || `order-${index}-${Date.now()}`,
      }
    })

    // Add cart items as "added_to_cart" status
    const cartItems = cart.length > 0
      ? [
          {
            id: 'cart',
            type: 'cart',
            status: 'added_to_cart',
            date: new Date().toISOString(),
            items: cart,
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            paymentStatus: 'pending',
            uniqueId: 'cart',
          },
        ]
      : []

    return [...cartItems, ...orderItems]
  }, [orders, cart])

  // Filter items based on active filter
  const filteredItems = useMemo(() => {
    // Early return for 'all' filter - no filtering needed
    if (activeFilter === 'all') {
      return allItems
    }
    
    // Early return for 'added_to_cart' filter
    if (activeFilter === 'added_to_cart') {
      const cartFiltered = allItems.filter((item) => item.status === 'added_to_cart' || item.type === 'cart')
      return cartFiltered
    }
    
    // For status filters (awaiting, dispatched, delivered)
    // Status is already normalized in allItems, so direct comparison is faster
    const filtered = []
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i]
      // Skip cart items for status filters
      if (item.type === 'cart' || item.status === 'added_to_cart') {
        continue
      }
      // Direct comparison - status is already normalized in allItems
      // Only include items that match the active filter exactly
      if (item.status === activeFilter) {
        filtered.push(item)
      }
    }
    // Return a new array to ensure React detects the change
    return [...filtered]
  }, [allItems, activeFilter])

  const getStatusIcon = (status) => {
    if (status === 'added_to_cart') return <PackageIcon className="h-4 w-4" />
    const key = getStatusKey(status)
    if (key === 'awaiting') return <ClockIcon className="h-4 w-4" />
    if (key === 'dispatched') return <TruckIcon className="h-4 w-4" />
    if (key === 'delivered') return <CheckCircleIcon className="h-4 w-4" />
    return <PackageIcon className="h-4 w-4" />
  }

  const getStatusColor = (status) => {
    if (status === 'added_to_cart') return 'bg-blue-100 text-blue-700'
    const key = getStatusKey(status)
    if (key === 'awaiting') return 'bg-yellow-100 text-yellow-700'
    if (key === 'dispatched') return 'bg-indigo-100 text-indigo-700'
    if (key === 'delivered') return 'bg-[rgba(1,120,39,0.1)] text-[#017827]'
    return 'bg-gray-100 text-gray-700'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const handlePayRemaining = async (order) => {
    if (!order || !order.id) {
      showError('Invalid order')
      return
    }

    setProcessingPayment(order.id)

    try {
      // Create remaining payment intent
      const paymentIntentResult = await createRemainingPaymentIntent(order.id, 'razorpay')

      if (paymentIntentResult.error) {
        showError(paymentIntentResult.error.message || 'Failed to initialize payment')
        setProcessingPayment(null)
        return
      }

      const { paymentIntent } = paymentIntentResult.data
      const { razorpayOrderId, keyId, amount } = paymentIntent

      // Open Razorpay Checkout for remaining payment
      try {
        const razorpayResponse = await openRazorpayCheckout({
          key: keyId,
          amount: amount,
          currency: 'INR',
          order_id: razorpayOrderId,
          name: 'IRA SATHI',
          description: `Remaining payment for Order ${order.orderNumber || order.id}`,
          prefill: {
            name: order.userName || '',
            email: order.userEmail || '',
            contact: order.userPhone || '',
          },
        })

        // Confirm remaining payment with Razorpay response
        const confirmResult = await confirmRemainingPayment({
          orderId: order.id,
          paymentIntentId: paymentIntent.id,
          gatewayPaymentId: razorpayResponse.paymentId,
          gatewayOrderId: razorpayResponse.orderId,
          gatewaySignature: razorpayResponse.signature,
          paymentMethod: 'razorpay',
        })

        if (confirmResult.error) {
          showError(confirmResult.error.message || 'Payment failed')
          setProcessingPayment(null)
          return
        }

        success(`Remaining payment of ₹${amount.toLocaleString('en-IN')} completed successfully!`)
        setProcessingPayment(null)
        
        // Order status will be updated via real-time notification or refresh
      } catch (razorpayError) {
        // Handle Razorpay errors
        if (razorpayError.error) {
          showError(razorpayError.error || 'Payment was cancelled or failed')
        } else {
          showError(razorpayError.message || 'Payment processing failed. Please try again.')
        }
        setProcessingPayment(null)
        return
      }
    } catch {
      showError('Payment processing failed. Please try again.')
      setProcessingPayment(null)
    }
  }

  const renderStatusTracker = (item) => {
    if (item.type !== 'order') return null
    const currentStatus = getStatusKey(item.status)
    const currentIndex = USER_ORDER_STATUSES.indexOf(currentStatus)
    
    // Only show steps up to and including current step (not future steps)
    const maxIndex = currentIndex >= 0 ? currentIndex : 0
    
    return (
      <div className="user-orders-view__tracker">
        {USER_ORDER_STATUSES.filter((_, index) => index <= maxIndex).map((status, index) => {
          const timelineEntry = item.statusTimeline?.find((entry) => {
            const entryStatusKey = getStatusKey(entry.status)
            return entryStatusKey === status
          })
          const actualIndex = USER_ORDER_STATUSES.indexOf(status)
          const isCompleted = actualIndex < currentIndex
          
          return (
            <div
              key={`${item.id}-${status}`}
              className={cn(
                'user-orders-view__tracker-step',
                index <= currentIndex && 'user-orders-view__tracker-step--active',
              )}
            >
              <span className="user-orders-view__tracker-step-index">{index + 1}</span>
              <div className="user-orders-view__tracker-step-body">
                <p className="user-orders-view__tracker-step-title">{translatedStatusLabels[status] || STATUS_LABELS[status]}</p>
                <p className="user-orders-view__tracker-step-desc">{translatedStatusDescriptions[status] || STATUS_DESCRIPTIONS[status]}</p>
                {/* Only show timestamp for completed steps, not current step */}
                {isCompleted && timelineEntry?.timestamp && (
                  <p className="user-orders-view__tracker-step-time">
                    {formatTimelineTimestamp(timelineEntry.timestamp)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="user-orders-view space-y-6">
      <div className="user-orders-view__header">
        <h2 className="user-orders-view__title"><Trans>My Orders</Trans></h2>
      </div>

      {/* Main Content - 2 Column Layout for Laptop */}
      <div className="user-orders-view__main-content">
        {/* Left Column - Filter Sidebar */}
        <div className="user-orders-view__filters-sidebar hidden lg:block">
          <div className="user-orders-view__filter-panel-desktop">
            <div className="user-orders-view__filter-header-desktop">
              <h3 className="user-orders-view__filter-title-desktop"><Trans>Filter Orders</Trans></h3>
            </div>
            <div className="user-orders-view__filter-content-desktop">
              {translatedFilterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    'user-orders-view__filter-option',
                    activeFilter === tab.id && 'user-orders-view__filter-option--active'
                  )}
                  onClick={() => setActiveFilter(tab.id)}
                >
                  <input
                    type="radio"
                    checked={activeFilter === tab.id}
                    onChange={() => {}}
                    className="user-orders-view__filter-option-input"
                  />
                  <span className="user-orders-view__filter-option-label">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Orders List */}
        <div className="user-orders-view__orders-column">
          {/* Filter Tabs - Mobile View Only */}
          <div className="user-orders-view__filters">
            <div className="user-orders-view__filters-rail">
              {translatedFilterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    'user-orders-view__filter-tab',
                    activeFilter === tab.id && 'user-orders-view__filter-tab--active'
                  )}
                  onClick={() => setActiveFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div key={`orders-list-${activeFilter}`} className="user-orders-view__list">
        {filteredItems.length === 0 ? (
          <div className="user-orders-view__empty">
            <PackageIcon className="user-orders-view__empty-icon" />
            <h3 className="user-orders-view__empty-title"><Trans>No orders found</Trans></h3>
            <p className="user-orders-view__empty-text">
              {activeFilter === 'all' ? (
                <Trans>You haven't placed any orders yet</Trans>
              ) : (
                <Trans>No {translatedFilterTabs.find((t) => t.id === activeFilter)?.label.toLowerCase()} orders</Trans>
              )}
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <div key={`${activeFilter}-${item.uniqueId || `${item.type}-${item.id || item._id || index}`}`} className="user-orders-view__card">
              <div className="user-orders-view__card-header">
                <div className="user-orders-view__card-header-left">
                  <div className="user-orders-view__card-id">
                    {item.type === 'cart' ? <Trans>Cart</Trans> : <Trans>Order #{item.id?.slice(-8) || 'N/A'}</Trans>}
                  </div>
                  <div className="user-orders-view__card-date">{formatDate(item.date)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('user-orders-view__card-status', getStatusColor(item.status))}>
                    {getStatusIcon(item.status)}
                    <span className="user-orders-view__card-status-text">
                      {getDisplayStatus(item.status, translatedStatusLabels, item.paymentStatus)}
                    </span>
                  </div>
                  {item.paymentStatus === 'fully_paid' && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-[rgba(1,120,39,0.1)] px-2.5 py-1 text-xs font-semibold text-[#017827]">
                      <CreditCardIcon className="h-3 w-3" />
                      <span><Trans>Fully Paid</Trans></span>
                    </div>
                  )}
                </div>
              </div>

              {renderStatusTracker(item)}

              <div className="user-orders-view__card-items">
                {item.items?.map((orderItem, index) => {
                  // Handle variant attributes display
                  const variantAttrs = orderItem.variantAttributes || {}
                  const variantKeys = Object.keys(variantAttrs)
                  const hasVariants = variantKeys.length > 0
                  
                  // Get product name - use productName from orderItem or product.name
                  const productName = orderItem.productName || orderItem.name || (orderItem.product?.name || 'Product')
                  
                  // Get price - use unitPrice from orderItem or price
                  const unitPrice = orderItem.unitPrice || orderItem.price || 0
                  
                  // Create unique key for order item - include index to ensure uniqueness even if productId is same
                  const orderItemId = orderItem.id || orderItem._id || orderItem.productId
                  const orderItemKey = `${item.uniqueId || item.id || item._id || 'order'}-item-${orderItemId || index}-${index}`
                  
                  return (
                    <div key={orderItemKey} className="user-orders-view__card-item">
                      <div className="user-orders-view__card-item-image">
                        <img
                          src={orderItem.product ? getPrimaryImageUrl(orderItem.product) : (orderItem.image || 'https://via.placeholder.com/60')}
                          alt={productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="user-orders-view__card-item-details">
                        <h4 className="user-orders-view__card-item-name"><TransText>{productName}</TransText></h4>
                        {hasVariants && (
                          <div className="user-orders-view__card-item-variants">
                            {variantKeys.map((key) => (
                              <span key={`${orderItemKey}-variant-${key}`} className="text-xs text-gray-600">
                                {key}: {variantAttrs[key]}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="user-orders-view__card-item-meta">
                          <span className="user-orders-view__card-item-quantity">
                            <Trans>Qty</Trans>: {orderItem.quantity}
                          </span>
                          <span className="user-orders-view__card-item-price">
                            ₹{unitPrice.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="user-orders-view__card-footer">
                {/* Order Amount Breakdown */}
                <div className="space-y-2 mb-3">
                  {item.subtotal !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600"><Trans>Subtotal</Trans>:</span>
                      <span className="text-gray-900 font-medium">₹{item.subtotal?.toLocaleString('en-IN') || '0'}</span>
                    </div>
                  )}
                  {item.deliveryCharge !== undefined && item.deliveryCharge > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600"><Trans>Delivery</Trans>:</span>
                      <span className="text-gray-900 font-medium">₹{item.deliveryCharge?.toLocaleString('en-IN') || '0'}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                    <span className="text-gray-900"><Trans>Total</Trans>:</span>
                    <span className="text-gray-900">₹{(item.totalAmount || item.total || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                
                {/* Payment Status */}
                {item.paymentStatus && (
                  <div className="space-y-2 mb-3">
                    {item.paymentStatus !== 'fully_paid' && (
                      <>
                        {item.paymentPreference === 'partial' && item.upfrontAmount !== undefined && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600"><Trans>Advance (30%)</Trans>:</span>
                            <span className="text-[#017827] font-medium">₹{item.upfrontAmount?.toLocaleString('en-IN') || '0'}</span>
                          </div>
                        )}
                        {item.paymentPreference === 'partial' && item.remainingAmount !== undefined && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600"><Trans>Remaining (70%)</Trans>:</span>
                            <span className={cn(
                              'font-medium',
                              item.paymentStatus === 'partial_paid' ? 'text-orange-600' : 'text-red-600'
                            )}>
                              ₹{item.remainingAmount?.toLocaleString('en-IN') || '0'}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-600"><Trans>Payment Status</Trans>:</span>
                      <span
                        className={cn(
                          'font-semibold',
                          item.paymentStatus === 'fully_paid' && 'text-[#017827]',
                          item.paymentStatus === 'partial_paid' && 'text-orange-600',
                          item.paymentStatus === 'pending' && 'text-red-600'
                        )}
                      >
                        {item.paymentStatus === 'fully_paid' ? (
                          <Trans>Fully Paid</Trans>
                        ) : item.paymentStatus === 'partial_paid' ? (
                          <Trans>Partial Paid</Trans>
                        ) : item.paymentStatus === 'pending' ? (
                          <Trans>Pending</Trans>
                        ) : (
                          item.paymentStatus
                        )}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Pay Remaining Button - Show when order is delivered and partially paid */}
                {item.status === 'delivered' && item.paymentStatus === 'partial_paid' && (item.remainingAmount || item.remaining) > 0 && (
                  <button
                    type="button"
                    onClick={() => handlePayRemaining(item)}
                    disabled={processingPayment === item.id || loading}
                    className="mt-3 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] text-white text-sm font-semibold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CreditCardIcon className="h-4 w-4" />
                    {processingPayment === item.id || loading ? (
                      <Trans>Processing...</Trans>
                    ) : (
                      <><Trans>Pay Remaining</Trans> ₹{((item.remainingAmount || item.remaining) || 0).toLocaleString('en-IN')}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
          </div>
        </div>
      </div>
    </div>
  )
}

