import { useEffect, useState } from 'react'
import { cn } from '../../../lib/cn'
import { CloseIcon, MenuIcon, BellIcon, SearchIcon, FilterIcon, UserIcon, ChevronRightIcon } from './icons'
import iraSathiLogo from '../../../assets/IRA Sathi.png'
import { MapPinIcon } from './icons'
import { NotificationsDropdown } from './NotificationsDropdown'
import { LanguageToggle } from '../../../components/LanguageToggle'
import { Trans } from '../../../components/Trans'
import { useTranslation } from '../../../context/TranslationContext'
import { TransText } from '../../../components/TransText'

// Component for translated search input placeholder
function TranslatedSearchInput({ onSearchClick }) {
  const { translate, isEnglish, language } = useTranslation()
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)
  const [suggestions, setSuggestions] = useState(['Products', 'Seeds', 'Fertilizers'])
  const [isAnimating, setIsAnimating] = useState(false)

  // Get base text for translation
  const baseText = isEnglish ? 'Search' : 'Search'

  useEffect(() => {
    // Cycle through suggestions - each visible for 2 seconds
    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentSuggestionIndex((prev) => (prev + 1) % suggestions.length)
        setIsAnimating(false)
      }, 300) // Quick transition: 300ms fade out, then change, then fade in
    }, 2000) // Change every 2 seconds

    return () => clearInterval(interval)
  }, [suggestions.length])

  // Translate suggestions when language changes
  useEffect(() => {
    if (isEnglish) {
      setSuggestions(['Products', 'Seeds', 'Fertilizers'])
      return
    }

    // Translate each suggestion
    Promise.all([
      translate('Products'),
      translate('Seeds'),
      translate('Fertilizers')
    ])
      .then((translated) => {
        setSuggestions(translated)
      })
      .catch(() => {
        setSuggestions(['Products', 'Seeds', 'Fertilizers'])
      })
  }, [isEnglish, translate, language])

  const currentSuggestion = suggestions[currentSuggestionIndex] || 'Products'
  const displayPlaceholder = `${baseText} ${currentSuggestion}`

  return (
    <>
      <input
        type="text"
        className="home-search-bar__input"
        onClick={onSearchClick}
        readOnly
      />
      <div className="home-search-bar__placeholder-animated">
        <span className="home-search-bar__placeholder-static">{baseText}</span>
        <span className="home-search-bar__placeholder-space"> </span>
        <span className={cn('home-search-bar__placeholder-suggestion', isAnimating && 'fade-out')}>
          {currentSuggestion}
        </span>
      </div>
    </>
  )
}

// Component for translated email input placeholder
function TranslatedEmailInput() {
  const { translate, isEnglish, language } = useTranslation()
  const [placeholder, setPlaceholder] = useState('Write Email')

  useEffect(() => {
    if (isEnglish) {
      setPlaceholder('Write Email')
      return
    }

    translate('Write Email')
      .then((translated) => {
        setPlaceholder(translated)
      })
      .catch(() => {
        setPlaceholder('Write Email')
      })
  }, [isEnglish, translate, language])

  return (
    <input
      type="email"
      placeholder={placeholder}
      className="user-shell-footer__email-input"
    />
  )
}

export function MobileShell({ title, subtitle, children, navigation, bottomNavigation, menuContent, onSearchClick, onFilterClick, notificationsCount = 0, isAuthenticated = false, onNavigate, onLogout, onLogin }) {
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [hideSecondRow, setHideSecondRow] = useState(false)

  useEffect(() => {
    let ticking = false
    let lastScrollY = window.scrollY
    let scrollDirection = 0 // -1 = up, 1 = down, 0 = neutral
    const scrollThreshold = 10 // Minimum scroll difference to trigger change
    const hideThreshold = 50 // Scroll position to hide second row
    const showThreshold = 20 // Scroll position to show second row

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          const scrollDelta = currentScrollY - lastScrollY
          
          // Determine scroll direction with threshold to prevent jitter
          if (Math.abs(scrollDelta) > scrollThreshold) {
            scrollDirection = scrollDelta > 0 ? 1 : -1
          }

          // Only update state if there's a meaningful scroll change
          if (Math.abs(scrollDelta) > 2) {
            if (scrollDirection === 1) {
              // Scrolling down
              setCompact(currentScrollY > 30)
              setHideSecondRow(currentScrollY > hideThreshold)
            } else if (scrollDirection === -1) {
              // Scrolling up
              setCompact(currentScrollY > 20)
              setHideSecondRow(false)
            }
          }
          
          lastScrollY = currentScrollY
          ticking = false
        })
        ticking = true
      }
    }

    // Initial state
    handleScroll()
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="user-shell">
      <header className={cn('user-shell-header', compact && 'is-compact')}>
        <div className="user-shell-header__glow" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={iraSathiLogo} alt="IRA Sathi" className="h-11 w-auto transition-transform duration-200" />
            <span className="user-shell-header__logo-text">IRA SATHI</span>
          </div>
          {/* Search Bar - Between Logo and Navigation (Laptop Only) */}
          <div className="user-shell-header__search-bar ml-8">
            <div className="home-search-bar__input-wrapper">
              <SearchIcon className="home-search-bar__icon" />
              <TranslatedSearchInput onSearchClick={onSearchClick} />
            </div>
          </div>
          {/* Laptop Navigation - Bottom Nav Items in Header */}
          <nav className="user-shell-header__nav">
            <LanguageToggle variant="compact" />
            {navigation}
            {/* Notifications Button - Adjacent to Navigation Items (Laptop Only) */}
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="user-shell-header__nav-notification"
              aria-label="Notifications"
            >
              <span className="relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200"
                style={{
                  background: 'rgba(238, 245, 237, 0.7)',
                  color: 'rgb(27, 143, 91)',
                  boxShadow: 'rgba(30, 82, 54, 0.06) 0px 0px 0px 1px inset',
                }}
              >
                <BellIcon className="h-5 w-5 stroke-[2.5]" />
                {notificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold text-white bg-red-500">
                    {notificationsCount > 99 ? '99+' : notificationsCount}
                  </span>
                )}
              </span>
            </button>
          </nav>
          <div className="flex items-center gap-2 user-shell-header__right-buttons">
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center justify-center w-10 h-10 rounded-2xl border-none bg-transparent text-white transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-85"
              aria-label="Search"
            >
              <SearchIcon className="h-5 w-5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-2xl border-none bg-transparent text-white transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-85"
              aria-label="Open menu"
            >
              <MenuIcon className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
        {/* Mobile Title/Subtitle - Original Position */}
        {title && (
          <div className={cn('user-shell-header__mobile-info relative z-10 flex flex-col gap-1 opacity-100 transition-all duration-300 pointer-events-auto', compact && 'is-compact')}>
            <span className="relative z-10 text-[0.95rem] font-bold text-white tracking-[0.01em]"><TransText>{title}</TransText></span>
            {subtitle && (
              <p className="relative z-10 text-[0.72rem] font-medium text-white/90 tracking-[0.04em] uppercase">
                <MapPinIcon className="mr-2 inline h-3.5 w-3.5" />
                <TransText>{subtitle}</TransText>
              </p>
            )}
          </div>
        )}
        {/* Second Row - Title/Subtitle and Navigation Links (Laptop Only) */}
        <div className={cn('user-shell-header__second-row', hideSecondRow && 'user-shell-header__second-row--hidden')}>
          {title && (
            <div className="user-shell-header__info">
              <span className="user-shell-header__title-text"><TransText>{title}</TransText></span>
              {subtitle && (
                <p className="user-shell-header__subtitle-text">
                  <MapPinIcon className="mr-2 inline h-3.5 w-3.5" />
                  <TransText>{subtitle}</TransText>
                </p>
              )}
            </div>
          )}
          <nav className="user-shell-header__links">
            <button
              type="button"
              onClick={() => onNavigate?.('home')}
              className="user-shell-header__link"
            >
              <Trans>HOME</Trans>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('favourites')}
              className="user-shell-header__link"
            >
              <Trans>FAVOURITES</Trans>
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigate?.('home')
                // Scroll to categories section or trigger category view
                setTimeout(() => {
                  const categoriesSection = document.getElementById('home-categories')
                  if (categoriesSection) {
                    categoriesSection.scrollIntoView({ behavior: 'smooth' })
                  }
                }, 100)
              }}
              className="user-shell-header__link"
            >
              <Trans>CATEGORIES</Trans>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('orders')}
              className="user-shell-header__link"
            >
              <Trans>ORDERS</Trans>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('account')}
              className="user-shell-header__link"
            >
              <Trans>ACCOUNT</Trans>
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onLogout}
                className="user-shell-header__link user-shell-header__link--signout"
              >
                <UserIcon className="h-4 w-4 mr-1.5" />
                <Trans>SIGNOUT</Trans>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="user-shell-header__link user-shell-header__link--signin"
              >
                <UserIcon className="h-4 w-4 mr-1.5" />
                <Trans>SIGNIN</Trans>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="user-shell-content">
        <div className="space-y-6">{children}</div>
      </main>

      <nav className="user-shell-bottom-nav">
        <div className="flex items-center justify-between ml-3 gap-3">{bottomNavigation || navigation}</div>
      </nav>

      {/* Footer - Laptop Only */}
      <footer className="user-shell-footer">
        <div className="user-shell-footer__top">
          <div className="user-shell-footer__content">
            {/* Brand Column */}
            <div className="user-shell-footer__column">
              <h3 className="user-shell-footer__brand"><Trans>IRA SATHI</Trans></h3>
              <p className="user-shell-footer__slogan"><Trans>Your Trusted Farming Partner</Trans></p>
              <div className="user-shell-footer__about">
                <h4 className="user-shell-footer__heading"><Trans>About Us</Trans></h4>
                <p className="user-shell-footer__text">
                  <Trans>IRA Sathi is a comprehensive agricultural marketplace connecting farmers with quality seeds, fertilizers, pesticides, and farming equipment. We are committed to empowering farmers with the best agricultural products and services across India.</Trans>
                </p>
              </div>
            </div>

            {/* Services Column */}
            <div className="user-shell-footer__column">
              <h4 className="user-shell-footer__heading"><Trans>Services</Trans></h4>
              <ul className="user-shell-footer__list">
                <li><a href="#" className="user-shell-footer__link"><Trans>Seeds & Planting</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Fertilizers</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Pesticides</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Farming Equipment</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Expert Consultation</Trans></a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div className="user-shell-footer__column">
              <h4 className="user-shell-footer__heading"><Trans>Company</Trans></h4>
              <ul className="user-shell-footer__list">
                <li><a href="#" className="user-shell-footer__link"><Trans>About IRA Sathi</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Our Mission</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Become a Seller</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Careers</Trans></a></li>
                <li><a href="#" className="user-shell-footer__link"><Trans>Contact Us</Trans></a></li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="user-shell-footer__column">
              <h4 className="user-shell-footer__heading"><Trans>Contact us</Trans></h4>
              <div className="user-shell-footer__contact">
                <p className="user-shell-footer__text"><Trans>Call</Trans> : <a href="tel:+911234567890" className="user-shell-footer__link">+91 123 456 7890</a></p>
                <p className="user-shell-footer__text"><Trans>Email</Trans>: <a href="mailto:support@irasathi.com" className="user-shell-footer__link">support@irasathi.com</a></p>
              </div>
            </div>

            {/* Newsletter Column */}
            <div className="user-shell-footer__column">
              <div className="user-shell-footer__newsletter">
                <TranslatedEmailInput />
                <button type="button" className="user-shell-footer__subscribe-btn">
                  →
                </button>
              </div>
              <div className="user-shell-footer__social">
                <a href="#" className="user-shell-footer__social-icon" aria-label="Facebook">F</a>
                <a href="#" className="user-shell-footer__social-icon" aria-label="Twitter">T</a>
                <a href="#" className="user-shell-footer__social-icon" aria-label="LinkedIn">L</a>
                <a href="#" className="user-shell-footer__social-icon" aria-label="WhatsApp">W</a>
                <a href="#" className="user-shell-footer__social-icon" aria-label="Instagram">I</a>
              </div>
              <h4 className="user-shell-footer__heading"><Trans>Follow Us</Trans></h4>
            </div>
          </div>
        </div>
        <div className="user-shell-footer__bottom">
          <div className="user-shell-footer__bottom-content">
            <div className="user-shell-footer__legal">
              <a href="#" className="user-shell-footer__legal-link"><Trans>Privacy Policy</Trans></a>
              <span className="user-shell-footer__separator">|</span>
              <a href="#" className="user-shell-footer__legal-link"><Trans>Our History</Trans></a>
              <span className="user-shell-footer__separator">|</span>
              <a href="#" className="user-shell-footer__legal-link"><Trans>What We Do</Trans></a>
            </div>
            <p className="user-shell-footer__copyright">
              <Trans>© 2025 IRA Sathi. All images are for demo purposes only.</Trans>
            </p>
          </div>
        </div>
      </footer>

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
          <p className="text-sm font-semibold text-surface-foreground">Menu</p>
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
      />
    </div>
  )
}

