import './App.css'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/layouts/layout'
import { PageHome } from '@/pages/home/page-home'
import { PageFlows } from '@/pages/flows/page-flows'
import { HOME_URL, QUOTES_URL } from '@/routes/router'
import { initApiClient } from '@/api/index'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
initApiClient(API_URL)

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path={HOME_URL()} element={<PageHome />} />
        <Route path={`${QUOTES_URL()}/flows/*`} element={<PageFlows />} />
        <Route path={QUOTES_URL()} element={<Navigate to={`${QUOTES_URL()}/flows`} replace />} />
      </Route>
    </Routes>
  )
}

export default App
