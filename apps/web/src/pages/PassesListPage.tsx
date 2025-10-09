import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PassCard } from '../components/PassCard'

interface Pass {
  id: string
  name: string
  description: string
  imageUrl?: string
  available: boolean
}

async function fetchPasses(): Promise<Pass[]> {
  const response = await fetch('/api/passes')
  if (!response.ok) {
    throw new Error('Failed to fetch passes')
  }
  return response.json()
}

export function PassesListPage() {
  const { data: passes, isLoading, error } = useQuery({
    queryKey: ['passes'],
    queryFn: fetchPasses,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading passes</h3>
        <p className="text-gray-500">Please try again later.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Available Museum Passes</h2>
        <p className="text-lg text-gray-600">
          Reserve free museum passes with your KCLS library card. Select a museum to see available dates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {passes?.map((pass) => (
          <Link key={pass.id} to={`/pass/${pass.id}`}>
            <PassCard pass={pass} />
          </Link>
        ))}
      </div>

      {passes && passes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No passes available</h3>
          <p className="text-gray-500">Check back later for new museum passes.</p>
        </div>
      )}
    </div>
  )
}