import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { AvailabilityCalendar } from '../components/AvailabilityCalendar'

interface MuseumMetadata {
  id: string
  name: string
  shortName: string
  passesPerDay: number | string
  peoplePerPass: number | string
  ageRequirement: string
  website: string
}

interface PassDetails {
  id: string
  name: string
  description: string
  fullDescription: string
  location: string
  imageUrl?: string
  available: boolean
  metadata?: MuseumMetadata
}

async function fetchPassDetails(id: string): Promise<PassDetails> {
  const response = await fetch(`/api/passes/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch pass details')
  }
  return response.json()
}

export function PassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<string>('')

  const { data: pass, isLoading, error } = useQuery({
    queryKey: ['pass', id],
    queryFn: () => fetchPassDetails(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !pass) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Pass not found</h3>
        <p className="text-gray-500 mb-4">The requested museum pass could not be found.</p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to all passes
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-white"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to all passes
      </button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-3xl bg-white/90 p-8 shadow-xl ring-1 ring-slate-200 backdrop-blur">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M4 12h12" />
                <path d="M4 18h8" />
              </svg>
            </span>
            Library Pass Program
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">{pass.name}</h1>
          <p className="mt-3 text-lg text-slate-600">{pass.description}</p>

          {pass.fullDescription && (
            <div className="mt-6 rounded-2xl bg-slate-50/80 p-6 text-sm text-slate-600">
              <p className="whitespace-pre-line leading-relaxed">{pass.fullDescription}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {pass.available ? 'Currently available' : 'Check availability calendar'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {pass.location}
            </span>
          </div>

          {pass.metadata && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">Passes per day</span>
                <p className="mt-2 text-xl font-semibold text-blue-900">{pass.metadata.passesPerDay}</p>
                <p className="mt-1 text-xs text-blue-600/70">Digital pass allotment released each morning</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Admits</span>
                <p className="mt-2 text-xl font-semibold text-emerald-900">{pass.metadata.peoplePerPass}</p>
                <p className="mt-1 text-xs text-emerald-600/70">All guests must arrive together</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Age guidance</span>
                <p className="mt-2 text-sm font-semibold text-violet-900">{pass.metadata.ageRequirement}</p>
                <p className="mt-1 text-xs text-violet-600/70">Confirm details on museum site before visiting</p>
              </div>
            </div>
          )}

          {pass.metadata?.website && (
            <a
              href={pass.metadata.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" />
                <path d="M14 4h6v6" />
                <path d="M14 10l6-6" />
              </svg>
              Visit museum website
            </a>
          )}
        </div>

        <div className="rounded-3xl bg-white/90 p-8 shadow-xl ring-1 ring-slate-200 backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-900">Reserve an upcoming date</h2>
          <p className="mt-2 text-sm text-slate-500">
            Pick an available day below to request a pass. Green dates indicate open reservations.
          </p>
          <div className="mt-6">
            {id && (
              <AvailabilityCalendar
                passId={id}
                museumId={id}
                passName={pass.name}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}