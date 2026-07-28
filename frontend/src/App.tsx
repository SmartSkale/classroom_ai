import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GenerationProvider } from './context/GenerationContext'
import { ScrollToTop } from './components/ScrollToTop/ScrollToTop'
import { SessionTimeoutProvider } from './components/SessionTimeoutModal'
import { AppRoutes } from './routes/AppRoutes'

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <SessionTimeoutProvider />
        <GenerationProvider>
          <AppRoutes />
        </GenerationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
