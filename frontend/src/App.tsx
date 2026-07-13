import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GenerationProvider } from './context/GenerationContext'
import { AppRoutes } from './routes/AppRoutes'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GenerationProvider>
          <AppRoutes />
        </GenerationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
