import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { AvailabilityCalendar } from '../components/AvailabilityCalendar'

interface PassDetails {
  id: string
  name: string
  description: string
  fullDescription: string
  location: string
  imageUrl?: string
  available: boolean
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

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/3">
            {pass.imageUrl ? (
              <img
                src={pass.imageUrl}
                alt={pass.name}
                className="w-full h-64 md:h-full object-cover"
              />
            ) : (
              <div className="w-full h-64 md:h-full bg-gray-200 flex items-center justify-center">
                <svg className="h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>
          
          <div className="md:w-2/3 p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{pass.name}</h1>
              <p className="text-lg text-gray-600 mb-4">{pass.description}</p>
              
              {pass.fullDescription && (
                <div className="prose prose-gray max-w-none">
                  <p>{pass.fullDescription}</p>
                </div>
              )}
              
              <div className="mt-4 flex items-center text-sm text-gray-500">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {pass.location}
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a Date</h2>
              {id && (
                <AvailabilityCalendar
                  passId={id}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}