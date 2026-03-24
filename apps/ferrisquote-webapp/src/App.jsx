import './App.css'
import { Routes, Route } from 'react-router'
import { Layout } from '@/components/layouts/layout'
import { PageFlowCanvas } from '@/pages/flows/feature/page-flow-canvas'

function App() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <h1 className="text-2xl font-bold">Welcome to FerrisQuote</h1>
              <p className="text-muted-foreground mt-2">Select a section from the navigation.</p>
            </>
          }
        />
        <Route path="/quotes/flows/:flowId" element={<PageFlowCanvas />} />
      </Routes>
    </Layout>
  )
}

export default App
