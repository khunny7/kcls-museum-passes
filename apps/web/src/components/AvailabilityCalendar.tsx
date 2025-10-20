import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface AvailabilitySlot {
  date: string
  passId: string
  available: boolean
  digital: boolean
  physical: boolean
  state?: 'available' | 'booked' | 'closed' | 'not-yet-available'
}

interface BookingResult {
  success: boolean
  bookingId?: string
  error?: string
  requiresAuth?: boolean
  authUrl?: string
}

interface AvailabilityCalendarProps {
  passId: string
  selectedDate: string
  onDateSelect: (date: string) => void
}

async function fetchAvailability(passId: string, date: string): Promise<AvailabilitySlot[]> {
  const params = new URLSearchParams({
    date,
    digital: 'true',
    physical: 'false',
    location: '0'
  })

  const response = await fetch(`/api/passes/${passId}/availability?${params}`, {
    cache: 'no-store'
  })
  if (!response.ok) {
    throw new Error('Failed to fetch availability')
  }
  return response.json()
}

async function bookPass(passId: string, data: any): Promise<BookingResult> {
  const response = await fetch(`/api/passes/${passId}/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    throw new Error('Failed to book pass')
  }
  return response.json()
}

export function AvailabilityCalendar({ passId, selectedDate, onDateSelect }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const queryClient = useQueryClient()

  // Format date for API (YYYY-MM-DD)
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Format date for display (first day of the month for full month calendar)
  const getMonthStartDate = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    return formatDate(firstDay)
  }

  const monthKey = getMonthStartDate(currentMonth)

  const { data: availability, isLoading, refetch } = useQuery({
    queryKey: ['availability', passId, monthKey],
    queryFn: () => fetchAvailability(passId, monthKey),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: 10000,
    networkMode: 'always'
  })

  // Force refetch whenever user interacts with dates
  const handleDateInteraction = () => {
    refetch()
  }

  const bookingMutation = useMutation({
    mutationFn: (bookingData: any) => bookPass(passId, bookingData),
    onSuccess: (result) => {
      if (result.success) {
        alert('Pass booked successfully!')
        queryClient.invalidateQueries({ queryKey: ['availability', passId] })
      } else if (result.requiresAuth) {
        alert(`Authentication required. Please log in at: ${result.authUrl}`)
      } else {
        alert(`Booking failed: ${result.error}`)
      }
    },
    onError: (error) => {
      alert(`Booking failed: ${error.message}`)
    }
  })

  const handleBooking = (slot: AvailabilitySlot) => {
    if (!slot.available) return

    const confirmed = confirm(`Book pass for ${slot.date}?`)
    if (!confirmed) return

    bookingMutation.mutate({
      date: slot.date,
      passId: slot.passId,
      digital: slot.digital,
      physical: slot.physical,
      location: '0'
    })
  }

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days = []
    const currentDate = new Date(startDate)
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const goToMonth = (target: Date) => {
    const targetKey = getMonthStartDate(target)
    // Remove the query from cache before switching months to force fresh fetch
    queryClient.removeQueries({ queryKey: ['availability', passId, targetKey], exact: true })
    setCurrentMonth(target)
  }

  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    goToMonth(next)
  }

  const prevMonth = () => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    goToMonth(prev)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Previous month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => {
              queryClient.removeQueries({ queryKey: ['availability', passId, monthKey], exact: true })
              refetch()
            }}
            disabled={isLoading}
            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors disabled:opacity-50"
            title="Refresh availability"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Next month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const dateStr = formatDate(day)
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          const isPast = day < today
          
          // Find availability data for this date
          const daySlot = availability?.find(s => s.date === dateStr)
          const isAvailable = daySlot?.state === 'available' && !isPast
          const isClosed = daySlot?.state === 'closed'
          const isBooked = daySlot?.state === 'booked'
          const isNotYetAvailable = daySlot?.state === 'not-yet-available'
          
          return (
            <button
              key={index}
              onClick={() => {
                handleDateInteraction()
                if (isAvailable && daySlot) {
                  onDateSelect(dateStr)
                  handleBooking(daySlot)
                }
              }}
              disabled={!isAvailable || bookingMutation.isPending}
              className={`
                h-12 text-sm rounded-lg transition-colors relative
                ${!isCurrentMonth ? 'text-gray-300' : 'font-medium'}
                ${isPast && isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
                ${isAvailable ? 'bg-green-50 text-green-700 hover:bg-green-100 border-2 border-green-200 cursor-pointer font-semibold' : ''}
                ${isBooked && isCurrentMonth && !isPast ? 'bg-red-50 text-red-600 border border-red-200' : ''}
                ${isClosed && isCurrentMonth && !isPast ? 'bg-gray-100 text-gray-500' : ''}
                ${isNotYetAvailable && isCurrentMonth && !isPast ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : ''}
                ${selectedDate === dateStr ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                ${!daySlot && isCurrentMonth && !isPast ? 'bg-gray-50 text-gray-400' : ''}
              `}
              title={
                isPast ? 'Past date' :
                isAvailable ? 'Pass available - click to book' :
                isBooked ? 'All passes booked for this date' :
                isClosed ? 'Museum closed' :
                isNotYetAvailable ? 'Not yet available - check back closer to the date' :
                'Not available'
              }
            >
              {day.getDate()}
              {bookingMutation.isPending && daySlot?.date === dateStr && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-50 border-2 border-green-200 rounded"></div>
            <span className="text-gray-700">Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span className="text-gray-700">Fully booked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
            <span className="text-gray-700">Not yet available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <span className="text-gray-700">Closed</span>
          </div>
        </div>
        {availability && availability.some(s => s.available) && (
          <p className="text-xs text-gray-600">
            <strong>✓</strong> Green dates have passes available. Click to book.
          </p>
        )}
        {availability && availability.some(s => s.state === 'not-yet-available') && (
          <p className="text-xs text-yellow-700">
            <strong>ⓘ</strong> Yellow dates are beyond the booking window. Check back closer to the date.
          </p>
        )}
      </div>
    </div>
  )
}