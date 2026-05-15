import { IndianRupee, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { ProgressList } from './ProgressList'
import { cn } from '../../../lib/cn'

export function OutstandingCreditsView({ credits, onViewDetails }) {
  if (!credits || credits.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className="text-sm text-gray-600">No outstanding credits data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-3xl border border-pink-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="flex items-center gap-3">
        <IndianRupee className="h-5 w-5 text-pink-600" />
        <div>
          <h3 className="text-lg font-bold text-pink-700">Outstanding Credits</h3>
          <p className="text-sm text-gray-600">Monitor overall credit utilization and recovery status</p>
        </div>
      </div>
      <ProgressList items={credits} />
    </div>
  )
}

