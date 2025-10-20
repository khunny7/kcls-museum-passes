interface MuseumMetadata {
  id: string
  name: string
  shortName: string
  passesPerDay: number | string
  peoplePerPass: number | string
  ageRequirement: string
  website: string
}

interface Pass {
  id: string
  name: string
  description: string
  imageUrl?: string
  available: boolean
  metadata?: MuseumMetadata
}

interface PassCardProps {
  pass: Pass
  onSelect?: () => void
}

export function PassCard({ pass, onSelect }: PassCardProps) {
  const metadata = pass.metadata

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative w-full text-left focus:outline-none"
    >
      <span className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-sky-400/10 to-indigo-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <span className="float-slow absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] bg-white/90 shadow-lg ring-1 ring-slate-200 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-blue-400/40">
        <div className="relative h-52 overflow-hidden">
          {pass.imageUrl ? (
            <img
              src={pass.imageUrl}
              alt={pass.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100">
              <svg className="h-14 w-14 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          {metadata?.shortName && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {metadata.shortName}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-5 p-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
              {pass.name}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm text-slate-500">
              {pass.description}
            </p>
          </div>

          {metadata && (
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M9 4v16" />
                  <path d="M4 9h5" />
                </svg>
                {metadata.passesPerDay} passes/day
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                {metadata.peoplePerPass}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="6" x2="12" y2="12" />
                  <line x1="12" y1="12" x2="16" y2="14" />
                </svg>
                {metadata.ageRequirement}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                pass.available
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${pass.available ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {pass.available ? 'Available' : 'Unavailable'}
            </span>

            <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition group-hover:gap-2">
              View details
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}