import { Outlet, Link } from 'react-router-dom'
import { APP_NAME, ROUTES } from '../utils/constants'
import './layouts.css'

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <Link className="auth-brand" to={ROUTES.home}>
          <span className="auth-brand-mark">CA</span>
          <span>{APP_NAME}</span>
        </Link>
        <Outlet />
      </div>
    </div>
  )
}

export default AuthLayout
