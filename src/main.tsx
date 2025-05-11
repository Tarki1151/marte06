import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css' // KALDIRILDI
import App from './App.tsx'
import { AuthProvider } from './utils/AuthContext';
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
