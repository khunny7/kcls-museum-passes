import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ScheduledBooking {
  id: string
  museumId: string
  date: string
  passId: string
  scheduledFor: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  executedAt?: string
  cancelledAt?: string
  result?: any
  hasCredentials: boolean
  libraryCard?: string | null
}

interface ActiveJob {
  bookingId: string
  museumId: string
  date: string
  scheduledFor: string
  status: string
  nextInvocation: string | null
}

interface Museum {
  id: string
  name: string
  shortName: string
  metadata?: {
    id: string
    name: string
    shortName: string
  }
}

async function fetchScheduledBookings(): Promise<ScheduledBooking[]> {
  const response = await fetch('/api/scheduler/bookings')
  if (!response.ok) {
    throw new Error('Failed to fetch scheduled bookings')
  }
  const data = await response.json()
  return data.bookings || []
}

async function fetchMuseums(): Promise<Museum[]> {
  const response = await fetch('/api/passes')
  if (!response.ok) {
    throw new Error('Failed to fetch museums')
  }
  // The API returns an array of passes, each with metadata
  const passes = await response.json()
  return passes || []
}

async function fetchActiveJobs(): Promise<ActiveJob[]> {
  const response = await fetch('/api/scheduler/jobs')
  if (!response.ok) {
    throw new Error('Failed to fetch active jobs')
  }
  const data = await response.json()
  return data.jobs || []
}

async function fetchBookingLogs(id: string): Promise<string[]> {
  const response = await fetch(`/api/scheduler/bookings/${id}/logs`)
  if (!response.ok) {
    throw new Error('Failed to fetch logs')
  }
  const data = await response.json()
  return data.logs || []
}

async function cancelBooking(id: string): Promise<void> {
  const response = await fetch(`/api/scheduler/bookings/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to cancel booking')
  }
}

async function deleteBooking(id: string): Promise<void> {
  const response = await fetch(`/api/scheduler/bookings/${id}/remove`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete booking')
  }
}

export function ScheduledBookingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [showActiveJobs, setShowActiveJobs] = useState(false)

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['scheduledBookings'],
    queryFn: fetchScheduledBookings,
    refetchInterval: 5000 // Refresh every 5 seconds
  })

  const { data: museums = [] } = useQuery({
    queryKey: ['museums'],
    queryFn: fetchMuseums,
    staleTime: 60000 * 5 // Cache for 5 minutes
  })

  const { data: activeJobs = [] } = useQuery({
    queryKey: ['activeJobs'],
    queryFn: fetchActiveJobs,
    refetchInterval: 5000 // Refresh every 5 seconds
  })

  const getMuseumName = (museumId: string): string => {
    const museum = museums.find(m => m.id === museumId)
    if (museum) {
      // If it has metadata, use that name, otherwise use the pass name
      return museum.metadata?.name || museum.name || museumId
    }
    return museumId
  }

  const { data: logs = [] } = useQuery({
    queryKey: ['bookingLogs', selectedBookingId],
    queryFn: () => selectedBookingId ? fetchBookingLogs(selectedBookingId) : Promise.resolve([]),
    enabled: !!selectedBookingId,
    refetchInterval: 2000 // Refresh logs every 2 seconds when viewing
  })

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledBookings'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledBookings'] })
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'running':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'running':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scheduled Bookings</h1>
          <p className="mt-2 text-gray-600">
            Automatic bookings that will run at 2pm PST, 14 days before your selected date
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowActiveJobs(!showActiveJobs)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition hover:-translate-y-0.5 ${
              showActiveJobs 
                ? 'bg-purple-600 text-white ring-purple-600 hover:bg-purple-700' 
                : 'bg-white/70 text-purple-700 ring-purple-100 hover:bg-white'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            {showActiveJobs ? 'Hide' : 'View'} Cron Jobs ({activeJobs.length})
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to Passes
          </button>
        </div>
      </div>

      {/* Active Cron Jobs Panel */}
      {showActiveJobs && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-sm border-2 border-purple-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900">Active Scheduled Jobs</h2>
            <span className="ml-auto text-sm text-purple-600 font-medium">
              {activeJobs.length} active job{activeJobs.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {activeJobs.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No active cron jobs running</p>
          ) : (
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <div key={job.bookingId} className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-semibold text-gray-900 text-base">{getMuseumName(job.museumId)}</h4>
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {job.museumId}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Booking ID:</span>
                      <p className="font-mono text-xs text-gray-700">{job.bookingId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Target Date:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Scheduled For:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(job.scheduledFor).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short'
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Next Invocation:</span>
                      <p className="font-medium text-gray-900">
                        {job.nextInvocation 
                          ? new Date(job.nextInvocation).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              second: '2-digit',
                              timeZoneName: 'short'
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <p className="text-xs text-purple-600 mt-4 text-center">
            These are the actual scheduled jobs running on the server. Auto-refreshes every 5 seconds.
          </p>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No scheduled bookings</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by scheduling a booking for a future date.</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Browse Museum Passes
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        {booking.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {getMuseumName(booking.museumId)}
                      </h3>
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {booking.museumId}
                      </span>
                    </div>
                    
                    <p className="text-base text-gray-600 mb-4">
                      Booking for {new Date(booking.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Library Card:</span>
                        <p className="font-mono text-sm font-medium text-gray-900">
                          {booking.libraryCard || 'Not available'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Booking ID:</span>
                        <p className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded inline-block mt-1">
                          {booking.id}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Scheduled For:</span>
                        <p className="font-medium text-gray-900">
                          {new Date(booking.scheduledFor).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <p className="font-medium text-gray-900">
                          {new Date(booking.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {booking.executedAt && (
                        <div>
                          <span className="text-gray-500">Executed:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(booking.executedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                      {booking.cancelledAt && (
                        <div>
                          <span className="text-gray-500">Cancelled:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(booking.cancelledAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                      {booking.result && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Result:</span>
                          <p className={`font-medium ${booking.result.success ? 'text-green-600' : 'text-red-600'}`}>
                            {booking.result.message || booking.result.error || (booking.result.success ? 'Success!' : 'Failed')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setSelectedBookingId(booking.id === selectedBookingId ? null : booking.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {selectedBookingId === booking.id ? 'Hide' : 'View'} Logs
                    </button>
                    {booking.status === 'pending' && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to cancel this scheduled booking?')) {
                            cancelMutation.mutate(booking.id)
                          }
                        }}
                        disabled={cancelMutation.isPending}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    )}
                    {(booking.status === 'completed' || booking.status === 'failed' || booking.status === 'cancelled') && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this booking from history? This cannot be undone.')) {
                            deleteMutation.mutate(booking.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Logs Section */}
                {selectedBookingId === booking.id && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Execution Logs
                      <span className="text-gray-400 text-xs">(auto-refreshing)</span>
                    </h4>
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 max-h-96 overflow-y-auto">
                      {logs.length === 0 ? (
                        <div className="text-gray-500">No logs available yet...</div>
                      ) : (
                        logs.map((log, index) => (
                          <div key={index} className="whitespace-pre-wrap break-all">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
