import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useLibrarySystem } from '../contexts/LibrarySystemContext'
import { LIBRARY_SYSTEM_LABELS, STORAGE_KEYS, SYSTEM_THEMES, type LibrarySystem } from '../utils/librarySystem'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { system, setSystem } = useLibrarySystem()
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [hasCredentials, setHasCredentials] = useState(false)

  const credentialsKey = STORAGE_KEYS.credentials(system)
  const theme = SYSTEM_THEMES[system]

  // Check if credentials exist on mount and when system changes
  useEffect(() => {
    const stored = localStorage.getItem(credentialsKey)
    setHasCredentials(!!stored)
  }, [credentialsKey])

  const handleSystemChange = (newSystem: LibrarySystem) => {
    setSystem(newSystem)
    // Invalidate all cached queries so data refreshes for the new system
    queryClient.invalidateQueries()
  }

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
      <div className="pointer-events-none absolute inset-0 -z-10 transition-colors duration-500">
        <div className={`absolute -top-36 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br ${theme.blob1} opacity-60 blur-3xl transition-colors duration-500`} />
        <div className={`absolute -bottom-40 left-8 h-96 w-96 rounded-full ${theme.blob2} opacity-70 blur-3xl transition-colors duration-500`} />
        <div className={`absolute right-0 top-10 h-80 w-72 rounded-full ${theme.blob3} opacity-70 blur-3xl transition-colors duration-500`} />
      </div>

      <header className="sticky top-0 z-30 flex justify-center py-6">
        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between rounded-3xl bg-white/80 px-6 py-3 shadow-xl ring-1 ${theme.headerRing} backdrop-blur transition-all duration-500`}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-left"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${theme.iconGradient} text-white shadow-lg transition-colors duration-500`}>
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
                <span className={`block text-xs font-semibold uppercase tracking-wide ${theme.studioLabel} transition-colors duration-500`}>Piano8283 Studio</span>
                <span className="text-lg font-semibold text-slate-900">Museum Pass Helper</span>
              </div>
            </button>

            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
                      active
                        ? `${theme.navActive} text-white shadow-lg ${theme.navActiveShadow}`
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
              <select
                value={system}
                onChange={(e) => handleSystemChange(e.target.value as LibrarySystem)}
                className={`rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition ${theme.selectFocus} focus:outline-none focus:ring-2 ${theme.selectFocusRing}`}
              >
                {(Object.entries(LIBRARY_SYSTEM_LABELS) as [LibrarySystem, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowCredentialsModal(true)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${
                  hasCredentials
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700'
                    : `${theme.credBtn} text-white ${theme.credBtnShadow} ${theme.credBtnHover}`
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
        credentialsKey={credentialsKey}
        system={system}
      />
    </div>
  )
}

interface CredentialsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  onClear: () => void
  credentialsKey: string
  system: LibrarySystem
}

function CredentialsModal({ isOpen, onClose, onSave, onClear, credentialsKey, system }: CredentialsModalProps) {
  const [libraryCard, setLibraryCard] = useState('')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<null | { ok: boolean; message: string }>(null)

  const needsEmail = system === 'seattle'

  useEffect(() => {
    if (isOpen) {
      // Load existing credentials when modal opens
      const stored = localStorage.getItem(credentialsKey)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setLibraryCard(parsed.libraryCard || '')
          setPin(parsed.pin || '')
          setEmail(parsed.email || '')
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
    if (needsEmail && !email.trim()) {
      alert('Please enter your email address (required for Seattle Public Library bookings)')
      return
    }

    const creds: Record<string, string> = {
      libraryCard: libraryCard.trim(),
      pin: pin.trim()
    }
    if (needsEmail) {
      creds.email = email.trim()
    }
    localStorage.setItem(credentialsKey, JSON.stringify(creds))

    onSave()
    onClose()
  }

  const handleClear = () => {
    localStorage.removeItem(credentialsKey)
    setLibraryCard('')
    setPin('')
    setEmail('')
    onClear()
    onClose()
  }

  const handleVerify = async () => {
    setVerifyResult(null)
    if (!libraryCard.trim() || !pin.trim()) {
      setVerifyResult({ ok: false, message: 'Please enter both library card number and PIN' })
      return
    }
    try {
      setVerifying(true)
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryCard: libraryCard.trim(), pin: pin.trim(), system })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setVerifyResult({ ok: true, message: 'Credentials verified successfully' })
      } else {
        setVerifyResult({ ok: false, message: data.error || 'Verification failed' })
      }
    } catch (e: any) {
      setVerifyResult({ ok: false, message: e.message || 'Verification failed' })
    } finally {
      setVerifying(false)
    }
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

          {verifyResult && (
            <div className={`rounded-md px-3 py-2 text-sm ${verifyResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {verifyResult.message}
            </div>
          )}

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

          {needsEmail && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
                <span className="ml-1 text-xs text-amber-600 font-normal">(required for Seattle)</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="email"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2 flex-wrap">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className={`bg-emerald-600 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${verifying ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
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