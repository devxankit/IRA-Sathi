import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWebsiteState } from '../context/WebsiteContext'
import { Container } from './Layout'

export function WebsiteHeader() {
  const { authenticated, profile, cart, favourites } = useWebsiteState()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const favouritesCount = favourites.length

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="website-header">
      {/* Main Header - Desktop & Mobile */}
      <div className="website-header__main">
        <Container className="website-header__container">
          {/* Left: Logo */}
          <div className="website-header__logo">
            <Link to="/" className="website-header__logo-link">
              <img 
                src="/logo.png" 
                alt="IRA Sathi" 
                className="website-header__logo-img"
              />
            </Link>
          </div>

          {/* Center: Search Bar - Desktop Only */}
          <div className="website-header__search-desktop">
            <form onSubmit={handleSearch} className="website-header__search-form">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Products, Seeds, Fertilizers, etc"
                className="website-header__search-input"
              />
              <button type="submit" className="website-header__search-button">
                <svg className="website-header__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </form>
          </div>

          {/* Right: Icons - Desktop */}
          <div className="website-header__icons-desktop">
            <Link to="/account" className="website-header__icon-button" aria-label="Account">
              <svg className="website-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="website-header__icon-text">{authenticated ? profile.name?.split(' ')[0] : 'Account'}</span>
            </Link>

            <Link to="/favourites" className="website-header__icon-button" aria-label="Wishlist">
              <svg className="website-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {favouritesCount > 0 && (
                <span className="website-header__badge">{favouritesCount}</span>
              )}
            </Link>

            <Link to="/cart" className="website-header__icon-button" aria-label="Cart">
              <svg className="website-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {cartCount > 0 && (
                <span className="website-header__badge">{cartCount}</span>
              )}
            </Link>
          </div>

          {/* Right: Icons - Mobile */}
          <div className="website-header__icons-mobile">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="website-header__hamburger"
              aria-label="Menu"
            >
              <svg className="website-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>

            <Link to="/cart" className="website-header__icon-button" aria-label="Cart">
              <svg className="website-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {cartCount > 0 && (
                <span className="website-header__badge">{cartCount}</span>
              )}
            </Link>

            <Link to="/account" className="website-header__icon-button" aria-label="Account">
              <svg className="website-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          </div>
        </Container>
      </div>

      {/* Search Bar - Mobile (below header) */}
      <div className="website-header__search-mobile">
        <Container>
          <form onSubmit={handleSearch} className="website-header__search-form">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Products, Seeds, Fertilizers, etc"
              className="website-header__search-input"
            />
            <button type="submit" className="website-header__search-button">
              <svg className="website-header__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </form>
        </Container>
      </div>

      {/* Navigation Bar - Desktop (optional second row) */}
      <nav className="website-header__nav-desktop">
        <Container>
          <ul className="website-header__nav-list">
            <li><Link to="/" className="website-header__nav-link">Home</Link></li>
            <li><Link to="/products" className="website-header__nav-link">All Products</Link></li>
            <li><Link to="/categories" className="website-header__nav-link">Categories</Link></li>
            <li><Link to="/offers" className="website-header__nav-link">Offers</Link></li>
            <li><Link to="/about" className="website-header__nav-link">About</Link></li>
            <li><Link to="/contact" className="website-header__nav-link">Contact</Link></li>
          </ul>
        </Container>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="website-header__mobile-menu">
          <div className="website-header__mobile-menu-content">
            <Link to="/" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link to="/products" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>All Products</Link>
            <Link to="/categories" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>Categories</Link>
            <Link to="/favourites" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>Wishlist</Link>
            <Link to="/account/orders" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>My Orders</Link>
            <Link to="/account" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>Account</Link>
            {!authenticated && (
              <Link to="/login" className="website-header__mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
