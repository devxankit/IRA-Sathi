import { Link } from 'react-router-dom'
import { Container } from './Layout'

export function WebsiteFooter() {
  return (
    <footer className="website-footer">
      <Container className="website-footer__container">
        {/* 4-Column Grid - Desktop */}
        <div className="website-footer__grid">
          {/* Column 1: About */}
          <div className="website-footer__column">
            <h3 className="website-footer__column-title">About Us</h3>
            <ul className="website-footer__links">
              <li><Link to="/about" className="website-footer__link">About IRA Sathi</Link></li>
              <li><Link to="/contact" className="website-footer__link">Contact Us</Link></li>
              <li><Link to="/careers" className="website-footer__link">Careers</Link></li>
              <li><Link to="/blog" className="website-footer__link">Blog</Link></li>
            </ul>
          </div>

          {/* Column 2: Quick Links */}
          <div className="website-footer__column">
            <h3 className="website-footer__column-title">Quick Links</h3>
            <ul className="website-footer__links">
              <li><Link to="/products" className="website-footer__link">All Products</Link></li>
              <li><Link to="/categories" className="website-footer__link">Categories</Link></li>
              <li><Link to="/offers" className="website-footer__link">Special Offers</Link></li>
              <li><Link to="/faq" className="website-footer__link">FAQ</Link></li>
            </ul>
          </div>

          {/* Column 3: Customer Service */}
          <div className="website-footer__column">
            <h3 className="website-footer__column-title">Customer Service</h3>
            <ul className="website-footer__links">
              <li><Link to="/support" className="website-footer__link">Support</Link></li>
              <li><Link to="/shipping" className="website-footer__link">Shipping Info</Link></li>
              <li><Link to="/returns" className="website-footer__link">Returns</Link></li>
              <li><Link to="/terms" className="website-footer__link">Terms & Conditions</Link></li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="website-footer__column">
            <h3 className="website-footer__column-title">Newsletter</h3>
            <p className="website-footer__newsletter-text">Subscribe to get updates on new products and special offers.</p>
            <form className="website-footer__newsletter-form">
              <input
                type="email"
                placeholder="Enter your email"
                className="website-footer__newsletter-input"
              />
              <button type="submit" className="website-footer__newsletter-button">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="website-footer__bottom">
          <p className="website-footer__copyright">
            © {new Date().getFullYear()} IRA Sathi. All rights reserved.
          </p>
          <div className="website-footer__social">
            <a href="#" className="website-footer__social-link" aria-label="Facebook">
              <svg className="website-footer__social-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a href="#" className="website-footer__social-link" aria-label="Twitter">
              <svg className="website-footer__social-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
            </a>
            <a href="#" className="website-footer__social-link" aria-label="Instagram">
              <svg className="website-footer__social-icon" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}








