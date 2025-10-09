import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface AvailabilitySlot {
  date: string
  passId: string
  available: boolean
  digital: boolean
  physical: boolean
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
  
  const response = await fetch(`/api/passes/${passId}/availability?${params}`)
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

export function AvailabilityCalendar({ passId, selectedDate }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const queryClient = useQueryClient()

  // Format date for API (YYYY-MM-DD)
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const { data: availability, isLoading } = useQuery({
    queryKey: ['availability', passId, formatDate(currentMonth)],
    queryFn: () => fetchAvailability(passId, formatDate(currentMonth)),
  })

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

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
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
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
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
          
          // Get all slots for this date and calculate availability
          const daySlots = availability?.filter(s => s.date === dateStr) || []
          const availableSlots = daySlots.filter(s => s.available)
          const totalSlots = daySlots.length
          
          const hasAvailability = availableSlots.length > 0 && !isPast
          const isFullyBooked = totalSlots > 0 && availableSlots.length === 0
          const hasNoData = totalSlots === 0
          
          // Pick the first available slot for booking
          const firstAvailableSlot = availableSlots[0]
          
          return (
            <button
              key={index}
              onClick={() => {
                if (hasAvailability && firstAvailableSlot) {
                  handleBooking(firstAvailableSlot)
                }
              }}
              disabled={!hasAvailability || bookingMutation.isPending}
              className={`
                h-12 text-sm rounded-lg transition-colors relative flex flex-col items-center justify-center
                ${!isCurrentMonth ? 'text-gray-300' : ''}
                ${isPast ? 'text-gray-400 cursor-not-allowed' : ''}
                ${hasAvailability ? 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer' : ''}
                ${isFullyBooked && !isPast ? 'bg-red-100 text-red-800' : ''}
                ${hasNoData && isCurrentMonth && !isPast ? 'bg-gray-100 text-gray-600' : ''}
                ${selectedDate === dateStr ? 'ring-2 ring-blue-500' : ''}
              `}
              title={
                isPast ? 'Past date' :
                hasAvailability ? `${availableSlots.length} of ${totalSlots} passes available` :
                isFullyBooked ? 'All passes booked' :
                'No passes available'
              }
            >
              <span className="font-medium">{day.getDate()}</span>
              {totalSlots > 0 && isCurrentMonth && !isPast && (
                <span className="text-xs">
                  {availableSlots.length}/{totalSlots}
                </span>
              )}
              {bookingMutation.isPending && daySlots.some(s => s.date === dateStr) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
            <span>Available passes</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
            <span>Fully booked</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded mr-2"></div>
            <span>No passes offered</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Numbers show available/total passes for each day. Click any green date to book.
        </p>
      </div>
    </div>
  )
}