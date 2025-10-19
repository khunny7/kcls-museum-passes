import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PassCard } from '../components/PassCard'

interface Pass {
  id: string
  name: string
  description: string
  imageUrl?: string
  available: boolean
}

async function fetchPassesByDate(date: string): Promise<Pass[]> {
  const params = new URLSearchParams({
    date,
    digital: 'true',
    physical: 'false',
    location: '0'
  })
  
  const response = await fetch(`/api/passes/by-date?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch passes for date')
  }
  return response.json()
}

export function PassesByDatePage() {
  const navigate = useNavigate()
  
  // Default to tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]
  
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate)

  const { data: passes, isLoading, error } = useQuery({
    queryKey: ['passesByDate', selectedDate],
    queryFn: () => fetchPassesByDate(selectedDate),
    enabled: !!selectedDate,
  })

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }

  // Get today's date for min date validation
  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all passes
      </button>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Find Passes by Date
        </h1>
        <p className="text-gray-600 mb-6">
          Select a date to see all available museum passes for that day.
        </p>

        <div className="flex items-center gap-4">
          <label htmlFor="date-picker" className="text-sm font-medium text-gray-700">
            Select Date:
          </label>
          <input
            id="date-picker"
            type="date"
            value={selectedDate}
            min={today}
            onChange={handleDateChange}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-sm text-gray-500">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load passes</h3>
          <p className="text-gray-500">There was an error fetching passes for this date.</p>
        </div>
      )}

      {!isLoading && !error && passes && (
        <>
          {passes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No passes available
              </h3>
              <p className="text-gray-500 mb-4">
                There are no museum passes available for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              </p>
              <p className="text-sm text-gray-400">
                Try selecting a different date or check back later.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {passes.length} {passes.length === 1 ? 'Pass' : 'Passes'} Available
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {passes.map((pass) => (
                  <PassCard key={pass.id} pass={pass} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
