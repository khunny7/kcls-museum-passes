import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

const CREDENTIALS_STORAGE_KEY = 'kcls_credentials'

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [hasCredentials, setHasCredentials] = useState(false)

  // Check if credentials exist on mount
  useEffect(() => {
    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    setHasCredentials(!!stored)
  }, [])

  const navItems = [
    {
      label: 'Browse Passes',
      to: '/',
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4h16v16H4z" />
          <path d="M9 4v16" />
          <path d="M4 9h5" />
        </svg>
      )
    },
    {
      label: 'Find by Date',
      to: '/by-date',
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    {
      label: 'Scheduled',
      to: '/scheduled',
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ]
  
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-36 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-300 via-sky-200 to-indigo-200 opacity-60 blur-3xl" />
        <div className="absolute -bottom-40 left-8 h-96 w-96 rounded-full bg-blue-200 opacity-70 blur-3xl" />
        <div className="absolute right-0 top-10 h-80 w-72 rounded-full bg-indigo-200 opacity-70 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 flex justify-center py-6">
        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between rounded-3xl bg-white/80 px-6 py-3 shadow-xl ring-1 ring-white/50 backdrop-blur">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-left"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-500 text-white shadow-lg">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h10" />
                  <path d="M4 18h7" />
                </svg>
              </span>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-blue-600">Piano8283 Studio</span>
                <span className="text-lg font-semibold text-slate-900">KCLS Museum Pass Helper</span>
              </div>
            </button>

            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Unofficial resource maintained by Piano8283 Studio
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCredentialsModal(true)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 ${
                  hasCredentials
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700'
                    : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'
                }`}
              >
                {hasCredentials ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Credentials Saved
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Set Credentials
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/by-date')}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 md:hidden"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Find by Date
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        {children}
      </main>

      <CredentialsModal 
        isOpen={showCredentialsModal} 
        onClose={() => setShowCredentialsModal(false)}
        onSave={() => setHasCredentials(true)}
        onClear={() => setHasCredentials(false)}
      />
    </div>
  )
}

interface CredentialsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  onClear: () => void
}

function CredentialsModal({ isOpen, onClose, onSave, onClear }: CredentialsModalProps) {
  const [libraryCard, setLibraryCard] = useState('')
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Load existing credentials when modal opens
      const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setLibraryCard(parsed.libraryCard || '')
          setPin(parsed.pin || '')
        } catch (e) {
          // Invalid stored data
        }
      }
    }
  }, [isOpen])

  const handleSave = () => {
    if (!libraryCard.trim() || !pin.trim()) {
      alert('Please enter both library card number and PIN')
      return
    }

    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({
      libraryCard: libraryCard.trim(),
      pin: pin.trim()
    }))

    onSave()
    onClose()
  }

  const handleClear = () => {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY)
    setLibraryCard('')
    setPin('')
    onClear()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Library Credentials</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Save your credentials</strong> to enable one-click booking. Your library card and PIN will be stored locally in your browser and used automatically when you select a date.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="libraryCard" className="block text-sm font-medium text-gray-700 mb-1">
              Library Card Number
            </label>
            <input
              type="text"
              id="libraryCard"
              value={libraryCard}
              onChange={(e) => setLibraryCard(e.target.value)}
              placeholder="Enter your library card number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">
              PIN
            </label>
            <input
              type="password"
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIN"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save Credentials
            </button>
            <button
              onClick={handleClear}
              className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            ⚠️ Your credentials are stored locally in your browser only. Clear them when done or if using a shared computer.
          </p>
        </div>
      </div>
    </div>
  )
}