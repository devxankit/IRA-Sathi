import { User, Hash, Percent, Target, IndianRupee, TrendingUp, Users, Award } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { cn } from '../../../lib/cn'

export function SellerDetailModal({ isOpen, onClose, seller, onEdit }) {
  if (!seller) return null

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  const monthlyTarget = typeof seller.monthlyTarget === 'number'
    ? seller.monthlyTarget
    : parseFloat(seller.target?.replace(/[₹,\sL]/g, '') || '0') * 100000

  const totalSales = typeof seller.totalSales === 'number'
    ? seller.totalSales
    : parseFloat(seller.sales?.replace(/[₹,\sL]/g, '') || '0') * 100000

  const achieved = typeof seller.achieved === 'number'
    ? seller.achieved
    : typeof seller.progress === 'number'
    ? seller.progress
    : monthlyTarget > 0 ? ((totalSales / monthlyTarget) * 100).toFixed(1) : 0

  const cashbackRate = typeof seller.cashbackRate === 'number'
    ? seller.cashbackRate
    : parseFloat(seller.cashback?.replace(/[%\s]/g, '') || '0')

  const commissionRate = typeof seller.commissionRate === 'number'
    ? seller.commissionRate
    : parseFloat(seller.commission?.replace(/[%\s]/g, '') || '0')

  const referrals = seller.referrals || seller.referredUsers || 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="IRA Partner Performance Details" size="lg">
      <div className="space-y-6">
        {/* IRA Partner Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{seller.name}</h3>
                <p className="text-sm text-gray-600">IRA Partner ID: {seller.sellerId || seller.id}</p>
                {seller.area && (
                  <p className="mt-1 text-xs text-gray-500">{seller.area}</p>
                )}
              </div>
            </div>
            <StatusBadge tone={seller.status === 'On Track' || seller.status === 'on_track' ? 'success' : 'warning'}>
              {seller.status || 'Unknown'}
            </StatusBadge>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Target className="h-4 w-4" />
              <span>Monthly Target</span>
            </div>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(monthlyTarget)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <TrendingUp className="h-4 w-4" />
              <span>Total Sales</span>
            </div>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(totalSales)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users className="h-4 w-4" />
              <span>Referred Users</span>
            </div>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {referrals.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Award className="h-4 w-4" />
              <span>Progress</span>
            </div>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {parseFloat(achieved).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-gray-900">Target Achievement</span>
            <span className="font-bold text-yellow-700">{parseFloat(achieved).toFixed(1)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
            <div
              className={cn(
                'h-full rounded-full transition-all shadow-[0_2px_8px_rgba(234,179,8,0.3)]',
                parseFloat(achieved) >= 100
                  ? 'bg-gradient-to-r from-[#017827] to-[#0a9937]'
                  : parseFloat(achieved) >= 80
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600',
              )}
              style={{ width: `${Math.min(achieved, 100)}%` }}
            />
          </div>
        </div>

        {/* Incentive Settings */}
        <div className="rounded-xl border border-yellow-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-900">Incentive Settings</h4>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-gray-500">Cashback Rate: </span>
                  <span className="font-bold text-gray-900">{cashbackRate}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Commission Rate: </span>
                  <span className="font-bold text-gray-900">{commissionRate}%</span>
                </div>
              </div>
            </div>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(seller)}
                className="rounded-lg border border-yellow-300 bg-white px-4 py-2 text-xs font-bold text-yellow-700 transition-all hover:bg-yellow-50"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Contact Information */}
        {(seller.email || seller.phone) && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h4 className="mb-3 text-sm font-bold text-gray-900">Contact Information</h4>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {seller.email && (
                <div>
                  <span className="text-gray-500">Email: </span>
                  <span className="text-gray-900">{seller.email}</span>
                </div>
              )}
              {seller.phone && (
                <div>
                  <span className="text-gray-500">Phone: </span>
                  <span className="text-gray-900">{seller.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

