import { Trans } from '../../../components/Trans'
import { UserIcon } from './icons'
import { useNavigate } from 'react-router-dom'

export function AuthPromptMobile({ isOpen, onClose, actionType }) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const getMessage = () => {
    switch (actionType) {
      case 'favourites':
        return <Trans>You can't add to favourites now. First login or create your account.</Trans>
      case 'cart':
        return <Trans>You can't add to cart now. First login or create your account.</Trans>
      case 'orders':
        return <Trans>You can't view your orders now. First login or create your account.</Trans>
      case 'profile':
        return <Trans>You can't update your profile now. First login or create your account.</Trans>
      default:
        return <Trans>Please login or create your account to continue.</Trans>
    }
  }

  const handleSignIn = () => {
    navigate('/user/login')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            <Trans>Authentication Required</Trans>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6">
            <p className="text-sm text-gray-700">
              {getMessage()}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              <Trans>Cancel</Trans>
            </button>
            <button
              onClick={handleSignIn}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#017827] to-[#015c1f] text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <UserIcon className="h-4 w-4" />
              <Trans>Sign In</Trans>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

