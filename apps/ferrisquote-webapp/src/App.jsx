import './App.css'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/layouts/layout'
import { PageFlows } from '@/pages/flows/page-flows'
import { QUOTES_URL } from '@/routes/router'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path={`${QUOTES_URL()}/flows/*`} element={<PageFlows />} />
        <Route path="/" element={<Navigate to={QUOTES_URL()} replace />} />
        <Route path={`${QUOTES_URL()}`} element={<Navigate to={`${QUOTES_URL()}/flows`} replace />} />
      </Route>
    </Routes>
  )
}

export default App
