import { Clock, XCircle, CheckCircle } from 'lucide-react'

export function VendorStatusMessage({ status, onBack }) {
  const isPending = status === 'pending'
  const isRejected = status === 'rejected'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[rgba(1,120,39,0.04)] via-white to-[rgba(1,120,39,0.04)] px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-[rgba(1,120,39,0.15)] bg-white/90 p-8 shadow-xl backdrop-blur-sm text-center">
          {isPending && (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 mb-6">
                <Clock className="w-10 h-10 text-yellow-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Waiting for Approval</h1>
              <p className="text-gray-600 mb-6">
                Wait for Admin to Approve your Request. You can access your Dashboard After Admin approves you.
              </p>
            </>
          )}

          {isRejected && (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Profile Rejected</h1>
              <p className="text-gray-600 mb-6">
                Your profile was rejected by the Admin. You can't access your Dashboard.
              </p>
            </>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="w-full rounded-full bg-gradient-to-r from-[#017827] to-[#015c1f] px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

