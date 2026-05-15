import { cn } from '../../../lib/cn'

export function BottomNavItem({ label, icon, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center py-1 rounded-2xl transition-colors duration-200"
      aria-label={label}
    >
      <span className="relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200"
        style={{
          background: active ? '#017827' : 'rgba(238, 245, 237, 0.7)',
          color: active ? '#ffffff' : '#017827',
          boxShadow: active
            ? '0 12px 20px -14px rgba(1, 52, 16, 0.6), inset 0 0 0 1px rgba(1, 120, 39, 0.16)'
            : 'inset 0 0 0 1px rgba(30, 82, 54, 0.06)',
        }}
      >
        {icon}
        {badge !== undefined && badge !== null && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold text-white bg-red-500">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
    </button>
  )
}

