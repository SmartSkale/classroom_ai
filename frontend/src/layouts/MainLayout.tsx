import { Outlet } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { APP_NAME } from '../utils/constants'
import './layouts.css'

export function MainLayout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <Outlet />
      </main>
      <footer className="layout-footer">
        <div className="layout-footer-inner">
          <span className="layout-footer-brand">
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <nav className="layout-footer-links" aria-label="Footer">
            <a href="#contact">Contact</a>
            <a href="#privacy">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default MainLayout
