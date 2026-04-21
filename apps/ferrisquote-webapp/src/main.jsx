import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/query-client'
import { initApiClient } from './api/index'
import './i18n'
import './App.css'
import App from './App.jsx'

initApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
