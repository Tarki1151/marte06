import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './utils/AuthContext'; // AuthProvider'ı import et
import { BrowserRouter } from 'react-router-dom'; // BrowserRouter'ı import et

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider> {/* AuthProvider ile sarmala */}
      <BrowserRouter> {/* BrowserRouter ile sarmala */}
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
