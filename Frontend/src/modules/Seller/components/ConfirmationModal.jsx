import { AlertTriangle, X as CloseIcon } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Trans } from '../../../components/Trans'

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = <Trans>Confirm Action</Trans>,
  message,
  details = null,
  loading = false,
}) {
  if (!isOpen) return null

  return (
    <div className={cn('seller-panel', isOpen && 'is-open')}>
      <div className={cn('seller-panel__overlay', isOpen && 'is-open')} onClick={onClose} />
      <div className={cn('seller-panel__content', isOpen && 'is-open')} style={{ maxWidth: '500px' }}>
        <div className="seller-panel__header">
          <div className="seller-panel__header-content">
            <h3 className="seller-panel__title">{title}</h3>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="seller-panel__close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="seller-panel__body" style={{ padding: '1.5rem' }}>
          {/* Warning Message */}
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-700 mb-2">
                  <Trans>Please Double-Check Before Proceeding</Trans>
                </p>
                {message && (
                  <p className="text-sm text-yellow-700">
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Details Section */}
          {details && Object.keys(details).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-3"><Trans>Transaction Details:</Trans></p>
              <div className="space-y-2">
                {Object.entries(details).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-start text-sm">
                    <span className="text-gray-600 font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-gray-900 font-semibold text-right ml-4">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="seller-panel__button seller-panel__button--secondary"
            >
              <Trans>Cancel</Trans>
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="seller-panel__button seller-panel__button--primary"
            >
              {loading ? <Trans>Processing...</Trans> : <Trans>Confirm</Trans>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

