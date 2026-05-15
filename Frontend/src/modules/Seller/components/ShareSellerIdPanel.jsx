import { useState, useEffect } from 'react'
import { useSellerState } from '../context/SellerContext'
import { sellerSnapshot } from '../services/sellerData'
import { cn } from '../../../lib/cn'
import { ShareIcon, CloseIcon, CheckCircleIcon } from './icons'
import { Trans } from '../../../components/Trans'

export function ShareSellerIdPanel({ isOpen, onClose, onCopy }) {
  const { profile } = useSellerState()
  const [copied, setCopied] = useState(false)
  // Use real sellerId from profile context (from backend), fallback to snapshot if not available
  const sellerId = profile.sellerId || sellerSnapshot.profile.sellerId
  const sellerName = profile.name || sellerSnapshot.profile.name
  const shareText = `Hello! I'm ${sellerName}, your local IRA Sathi IRA Partner. Use my unique IRA Partner ID: *${sellerId}* when you register or place an order on the IRA Sathi app to get exclusive benefits and support. Download the app here: https://irasathi.com/download`
  const shareUrl = `https://irasathi.com/register?seller=${sellerId}`

  useEffect(() => {
    if (!isOpen) {
      setCopied(false)
    }
  }, [isOpen])

  const handleCopy = async (text) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        onCopy?.(text)
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopied(true)
        onCopy?.(text)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShareViaWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Share IRA Sathi IRA Partner ID',
        text: shareText,
        url: shareUrl,
      })
    } else {
      // Fallback for browsers that don't support Web Share API
      handleCopy(shareText)
    }
  }

  if (!isOpen) return null

  return (
    <div className={cn('seller-panel', isOpen && 'is-open')}>
      <div className={cn('seller-panel__overlay', isOpen && 'is-open')} onClick={onClose} />
      <div className={cn('seller-panel__content', isOpen && 'is-open')}>
        <div className="seller-panel__header">
          <div className="seller-panel__header-content">
            <div className="seller-panel__icon">
              <ShareIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="seller-panel__title"><Trans>Share IRA Partner ID</Trans></h3>
              <p className="seller-panel__subtitle"><Trans>Help users register with your unique ID</Trans></p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="seller-panel__close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="seller-panel__body">
          <div className="seller-share-id__display">
            <span className="seller-share-id__label"><Trans>Your Unique IRA Partner ID</Trans></span>
            <span className="seller-share-id__value">{sellerId}</span>
            <button
              type="button"
              onClick={() => handleCopy(sellerId)}
              className={cn('seller-share-id__copy', copied && 'is-copied')}
            >
              {copied ? (
                <>
                  <CheckCircleIcon className="h-4 w-4" /> <Trans>Copied!</Trans>
                </>
              ) : (
                <>
                  <ShareIcon className="h-4 w-4" /> <Trans>Copy ID</Trans>
                </>
              )}
            </button>
          </div>

          <div className="seller-share-id__section">
            <h4 className="seller-share-id__section-title"><Trans>Share Message</Trans></h4>
            <div className="seller-share-id__message-box">
              <p className="seller-share-id__message"><Trans>{shareText}</Trans></p>
            </div>
            <button
              type="button"
              onClick={handleShareViaWhatsApp}
              className="seller-share-id__button seller-share-id__button--primary"
            >
              <Trans>Share via WhatsApp</Trans>
            </button>
          </div>

          <div className="seller-share-id__section">
            <h4 className="seller-share-id__section-title"><Trans>Share App Link</Trans></h4>
            <div className="seller-share-id__link-box">
              <p className="seller-share-id__link">{shareUrl}</p>
            </div>
            <button
              type="button"
              onClick={handleShareLink}
              className="seller-share-id__button"
            >
              <Trans>Share Link</Trans>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

