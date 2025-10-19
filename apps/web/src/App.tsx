import { Routes, Route } from 'react-router-dom'
import { PassesListPage } from './pages/PassesListPage'
import { PassDetailPage } from './pages/PassDetailPage'
import { PassesByDatePage } from './pages/PassesByDatePage'
import { Layout } from './components/Layout'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PassesListPage />} />
        <Route path="/by-date" element={<PassesByDatePage />} />
        <Route path="/pass/:id" element={<PassDetailPage />} />
      </Routes>
    </Layout>
  )
}

export default App