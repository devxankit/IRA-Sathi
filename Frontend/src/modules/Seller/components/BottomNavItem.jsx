import { cn } from '../../../lib/cn'

export function BottomNavItem({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('seller-bottom-nav-item', active && 'is-active')}
      aria-label={label}
    >
      <span className="seller-bottom-nav-item__icon">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

