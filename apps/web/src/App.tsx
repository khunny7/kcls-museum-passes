import { Routes, Route } from 'react-router-dom'
import { PassesListPage } from './pages/PassesListPage'
import { PassDetailPage } from './pages/PassDetailPage'
import { PassesByDatePage } from './pages/PassesByDatePage'
import { ScheduledBookingsPage } from './pages/ScheduledBookingsPage'
import { Layout } from './components/Layout'
import { AuthProvider } from './contexts/AuthContext'
import { LibrarySystemProvider } from './contexts/LibrarySystemContext'

function App() {
  return (
    <LibrarySystemProvider>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<PassesListPage />} />
            <Route path="/by-date" element={<PassesByDatePage />} />
            <Route path="/pass/:id" element={<PassDetailPage />} />
            <Route path="/scheduled" element={<ScheduledBookingsPage />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </LibrarySystemProvider>
  )
}

export default App