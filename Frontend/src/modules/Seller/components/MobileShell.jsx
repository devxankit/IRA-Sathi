import { useEffect, useState } from 'react'
import { cn } from '../../../lib/cn'
import { CloseIcon, MenuIcon, SearchIcon, BellIcon, UserIcon } from './icons'
import iraSathiLogo from '../../../assets/IRA Sathi.png'
import { MapPinIcon } from './icons'
import { NotificationsDropdown } from './NotificationsDropdown'
import { LanguageToggle } from '../../../components/LanguageToggle'
import { Trans } from '../../../components/Trans'
import { useTranslation } from '../../../context/TranslationContext'
import { TransText } from '../../../components/TransText'

export function MobileShell({ title, subtitle, children, navigation, menuContent, onSearchClick, notificationsCount = 0, notifications = [], onProfileClick, onNotificationClick, isNotificationAnimating = false }) {
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  useEffect(() => {
    let ticking = false
    let lastScrollY = 0

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          if (currentScrollY > lastScrollY) {
            setCompact(currentScrollY > 30)
          } else {
            setCompact(currentScrollY > 20)
          }
          lastScrollY = currentScrollY
          ticking = false
        })
        ticking = true
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const { translateProduct, language } = useTranslation() // Get language to force re-render

  return (
    <div className="seller-shell">
      <header className={cn('seller-shell-header', compact && 'is-compact')}>
        <div className="seller-shell-header__glow" />
        <div className="seller-shell-header__controls">
          <div className="seller-shell-header__brand">
            <img src={iraSathiLogo} alt="IRA Sathi" className="seller-logo" />
          </div>
          <div className="seller-shell-header__actions">
            <button
              type="button"
              onClick={onSearchClick}
              className="seller-icon-button"
              aria-label="Search"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onNotificationClick || (() => setNotificationsOpen(!notificationsOpen))}
              className={cn('seller-icon-button seller-icon-button--notifications', isNotificationAnimating && 'is-animating')}
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <BellIcon className="h-5 w-5" />
              {notificationsCount > 0 && (
                <span className="seller-notification-badge">
                  {notificationsCount > 3 ? '3+' : notificationsCount}
                </span>
              )}
            </button>
            {onProfileClick && (
              <button
                type="button"
                onClick={onProfileClick}
                className="seller-icon-button"
                aria-label="Profile"
              >
                <UserIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="seller-icon-button"
              aria-label="Open menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className={cn('seller-shell-header__info', compact && 'is-compact')}>
          {title ? <span className="seller-brand-title"><TransText>{title}</TransText></span> : null}
          <div className="seller-shell-header__hint">
            <MapPinIcon className="mr-2 inline h-3.5 w-3.5" />
            <TransText>{subtitle}</TransText>
          </div>
        </div>
      </header>

      <main className="seller-shell-content">
        <div className="space-y-6">{children}</div>
      </main>

      <nav className="seller-shell-bottom-nav">
        <div className="seller-shell-bottom-nav__inner">{navigation}</div>
      </nav>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          'fixed bottom-0 right-0 top-0 z-50 flex w-[78%] max-w-xs flex-col bg-white shadow-[-12px_0_36px_-26px_rgba(15,23,42,0.45)] transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-6">
          <p className="text-sm font-semibold text-surface-foreground"><Trans>Menu</Trans></p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-muted/60 text-muted-foreground"
            aria-label="Close menu"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-10">
          <div className="mb-4">
            <LanguageToggle variant="default" onLanguageChange={() => setOpen(false)} />
          </div>
          {typeof menuContent === 'function'
            ? menuContent({
              close: () => setOpen(false),
              onNavigate: () => setOpen(false),
            })
            : menuContent}
        </div>
      </aside>

      <NotificationsDropdown
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
      />
    </div>
  )
}

