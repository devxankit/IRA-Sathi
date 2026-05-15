import { WebsiteHeader } from './WebsiteHeader'
import { WebsiteFooter } from './WebsiteFooter'
import '../styles/website.css'

export function Layout({ children }) {
  return (
    <div className="website-layout">
      <WebsiteHeader />
      <main className="website-main">
        {children}
      </main>
      <WebsiteFooter />
    </div>
  )
}

export function Container({ children, className = '' }) {
  return (
    <div className={`website-container ${className}`}>
      {children}
    </div>
  )
}

export function Section({ children, className = '' }) {
  return (
    <section className={`website-section ${className}`}>
      {children}
    </section>
  )
}
