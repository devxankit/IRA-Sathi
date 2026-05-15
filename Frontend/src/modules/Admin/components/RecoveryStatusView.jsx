import { RefreshCw, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { cn } from '../../../lib/cn'

export function RecoveryStatusView({ recoveryData, onViewDetails }) {
  if (!recoveryData || recoveryData.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className="text-sm text-gray-600">No recovery data available</p>
      </div>
    )
  }

  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)} Cr`
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'recovered':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-[#017827]" />
      case 'in_progress':
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-600" />
      case 'overdue':
      case 'delayed':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <RefreshCw className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusTone = (status) => {
    switch (status?.toLowerCase()) {
      case 'recovered':
      case 'completed':
        return 'success'
      case 'in_progress':
      case 'pending':
        return 'warning'
      case 'overdue':
      case 'delayed':
        return 'neutral'
      default:
        return 'neutral'
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-indigo-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 text-indigo-600" />
        <div>
          <h3 className="text-lg font-bold text-indigo-700">Recovery Status</h3>
          <p className="text-sm text-gray-600">Track recovery progress and overdue accounts</p>
        </div>
      </div>
      <div className="space-y-3">
        {recoveryData.map((item, index) => (
          <div
            key={item.id || index}
            className="rounded-2xl border border-gray-200 bg-white p-4 hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] cursor-pointer"
            onClick={() => onViewDetails?.(item)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(item.status)}
                  <p className="text-sm font-bold text-gray-900">{item.title || item.label || `Recovery ${index + 1}`}</p>
                </div>
                <p className="text-xs text-gray-600 mb-2">{item.description || item.meta}</p>
                {item.amount && (
                  <p className="text-sm font-bold text-indigo-600">{formatCurrency(item.amount)}</p>
                )}
                {item.vendorCount && (
                  <p className="text-xs text-gray-500 mt-1">{item.vendorCount} vendor(s)</p>
                )}
              </div>
              <StatusBadge tone={getStatusTone(item.status)}>
                {item.status || 'Unknown'}
              </StatusBadge>
            </div>
            {item.progress !== undefined && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-gray-600">Recovery Progress</span>
                  <span className="font-bold text-gray-900">{item.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={cn(
                      'h-full transition-all',
                      item.progress >= 80 ? 'bg-[#017827]' : item.progress >= 50 ? 'bg-orange-500' : 'bg-red-500',
                    )}
                    style={{ width: `${Math.min(item.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

