import { User, Hash, MapPin, ShoppingBag, CreditCard, MessageSquare, Ban, CheckCircle } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { Timeline } from './Timeline'
import { cn } from '../../../lib/cn'

export function UserDetailModal({ isOpen, onClose, user, onBlock, onDeactivate, onActivate, onViewSupportTickets }) {
  if (!user) return null

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Details & Activity" size="xl">
      <div className="space-y-6">
        {/* User Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                <p className="text-sm text-gray-600">User ID: {user.id}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  {user.region && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{user.region}</span>
                    </div>
                  )}
                  {user.phone && (
                    <div>
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <StatusBadge tone={user.status === 'Active' || user.status === 'active' ? 'success' : user.status === 'Blocked' || user.status === 'blocked' ? 'neutral' : 'warning'}>
              {user.status || 'Unknown'}
            </StatusBadge>
          </div>
        </div>

        {/* Linked IRA Partner */}
        {user.sellerId && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-500">Linked IRA Partner ID</p>
                  <p className="text-sm font-bold text-blue-900">{user.sellerId}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <ShoppingBag className="h-4 w-4" />
              <span>Total Orders</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {user.orders || user.totalOrders || 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <CreditCard className="h-4 w-4" />
              <span>Payment Status</span>
            </div>
            <StatusBadge tone={user.payments === 'On Time' || user.payments === 'on_time' ? 'success' : 'warning'}>
              {user.payments || 'Unknown'}
            </StatusBadge>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <MessageSquare className="h-4 w-4" />
              <span>Support Tickets</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-gray-900">
                {user.supportTickets || user.openTickets || 0}
              </p>
              {user.supportTickets > 0 && onViewSupportTickets && (
                <button
                  type="button"
                  onClick={() => onViewSupportTickets(user)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700"
                >
                  View All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders History */}
        {user.ordersHistory && user.ordersHistory.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-gray-600" />
                <h4 className="text-sm font-bold text-gray-900">Order History</h4>
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {user.ordersHistory.map((order, index) => (
                <div key={order.id || index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{order.id || `Order #${index + 1}`}</p>
                      <p className="text-xs text-gray-600">{order.date || order.createdAt}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(order.value || order.amount || 0)}</p>
                      <StatusBadge tone={order.status === 'completed' ? 'success' : order.status === 'pending' ? 'warning' : 'neutral'}>
                        {order.status || 'Unknown'}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment History */}
        {user.paymentHistory && user.paymentHistory.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <h4 className="text-sm font-bold text-gray-900">Payment History</h4>
            </div>
            <Timeline
              events={user.paymentHistory.map((payment, index) => ({
                id: payment.id || `payment-${index}`,
                title: payment.description || `Payment ${index + 1}`,
                timestamp: payment.date || payment.timestamp || 'N/A',
                description: formatCurrency(payment.amount || 0),
                status: payment.status || 'completed',
              }))}
            />
          </div>
        )}

        {/* Support Tickets Summary */}
        {user.supportTickets > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-orange-900">Active Support Tickets</p>
                <p className="text-xs text-orange-700">{user.supportTickets} ticket(s) require attention</p>
              </div>
              {onViewSupportTickets && (
                <button
                  type="button"
                  onClick={() => onViewSupportTickets(user)}
                  className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100"
                >
                  View Tickets
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
          >
            Close
          </button>
          <div className="flex gap-3">
            {user.status === 'Active' || user.status === 'active' ? (
              <>
                <button
                  type="button"
                  onClick={() => onDeactivate(user.id)}
                  className="flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-6 py-3 text-sm font-bold text-orange-600 transition-all hover:bg-orange-50"
                >
                  <Ban className="h-4 w-4" />
                  Deactivate
                </button>
                <button
                  type="button"
                  onClick={() => onBlock(user.id)}
                  className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
                >
                  <Ban className="h-4 w-4" />
                  Block User
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onActivate(user.id)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
              >
                <CheckCircle className="h-4 w-4" />
                Activate User
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

