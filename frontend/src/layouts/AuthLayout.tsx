import { Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ROUTES } from '../utils/constants'
import './layouts.css'

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <Logo className="auth-brand" variant="full" to={ROUTES.home} />
        <Outlet />
      </div>
    </div>
  )
}

export default AuthLayout
