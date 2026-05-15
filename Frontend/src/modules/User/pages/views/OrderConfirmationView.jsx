import { useEffect, useState } from 'react'
import { CheckIcon } from '../../components/icons'
import { cn } from '../../../../lib/cn'

export function OrderConfirmationView({ order, onBackToHome }) {
  const [animationProgress, setAnimationProgress] = useState(0)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Animate the circular progress
    const duration = 2000 // 2 seconds
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      setAnimationProgress(progress)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Show content after animation completes
        setTimeout(() => setShowContent(true), 300)
      }
    }
    
    requestAnimationFrame(animate)
  }, [])

  const circumference = 2 * Math.PI * 45 // radius = 45
  const strokeDashoffset = circumference * (1 - animationProgress)

  return (
    <div className="user-order-confirmation-view user-order-confirmation">
      <div className="user-order-confirmation__container">
        {/* Animated Circular Checkmark */}
        <div className="user-order-confirmation__icon-wrapper">
          <svg className="user-order-confirmation__circle-svg" viewBox="0 0 100 100">
            {/* Background Circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(1, 120, 39, 0.1)"
              strokeWidth="4"
            />
            {/* Animated Progress Circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#017827"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className="user-order-confirmation__progress-circle"
            />
          </svg>
          {/* Checkmark Icon */}
          <div className={cn(
            "user-order-confirmation__checkmark",
            animationProgress >= 1 && "user-order-confirmation__checkmark--visible"
          )}>
            <CheckIcon className="h-12 w-12 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "user-order-confirmation__content",
          showContent && "user-order-confirmation__content--visible"
        )}>
          <h1 className="user-order-confirmation__title">Order Confirmed!</h1>
          <p className="user-order-confirmation__subtitle">
            Your order has been successfully placed and is being processed.
          </p>

          {/* Order Details */}
          {order && (
            <div className="user-order-confirmation__details">
              <div className="user-order-confirmation__detail-item">
                <span className="user-order-confirmation__detail-label">Order ID</span>
                <span className="user-order-confirmation__detail-value">{order.id}</span>
              </div>
              <div className="user-order-confirmation__detail-item">
                <span className="user-order-confirmation__detail-label">Total Amount</span>
                <span className="user-order-confirmation__detail-value">
                  ₹{order.total?.toLocaleString('en-IN') || '0'}
                </span>
              </div>
              <div className="user-order-confirmation__detail-item">
                <span className="user-order-confirmation__detail-label">Advance Paid</span>
                <span className="user-order-confirmation__detail-value text-[#017827]">
                  ₹{order.advancePaid?.toLocaleString('en-IN') || '0'}
                </span>
              </div>
            </div>
          )}

          {/* Delivery Information */}
          <div className="user-order-confirmation__info">
            <div className="user-order-confirmation__info-card">
              <h3 className="user-order-confirmation__info-title">What's Next?</h3>
              <ul className="user-order-confirmation__info-list">
                <li>
                  <span className="user-order-confirmation__info-icon">📦</span>
                  <div>
                    <strong>Order Processing</strong>
                    <p>We're preparing your order for shipment. You'll receive a confirmation email shortly.</p>
                  </div>
                </li>
                <li>
                  <span className="user-order-confirmation__info-icon">🚚</span>
                  <div>
                    <strong>Delivery Updates</strong>
                    <p>Track your order in real-time. Estimated delivery: {order?.deliveryTime || '24 hours'}.</p>
                  </div>
                </li>
                <li>
                  <span className="user-order-confirmation__info-icon">💳</span>
                  <div>
                    <strong>Remaining Payment</strong>
                    <p>Pay the remaining ₹{order?.remaining?.toLocaleString('en-IN') || '0'} upon delivery. Cash or card accepted.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={onBackToHome}
            className="user-order-confirmation__button"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

