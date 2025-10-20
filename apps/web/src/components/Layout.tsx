import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

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
    </div>
  )
}