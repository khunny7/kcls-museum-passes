import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BookingModal } from './BookingModal'
import { BookingResultModal } from './BookingResultModal'
import { ScheduleFutureModal } from './ScheduleFutureModal'
import { BookingOptionsModal } from './BookingOptionsModal'

const CREDENTIALS_STORAGE_KEY = 'kcls_credentials'

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
  museumId: string
  passName?: string
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

export function AvailabilityCalendar({ passId, museumId, passName, selectedDate, onDateSelect }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showBookingOptionsModal, setShowBookingOptionsModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [schedulingDate, setSchedulingDate] = useState<string>('')
  const [isScheduling, setIsScheduling] = useState(false)
  const [bookingResult, setBookingResult] = useState<{ success: boolean; message: string; bookingId?: string; authUrl?: string } | null>(null)
  const queryClient = useQueryClient()

  const getBookingUrl = (date: string) => {
    return `https://rooms.kcls.org/passes/${museumId}/book?digital=true&physical=false&location=0&date=${date}`
  }

  const handleBooking = (slot: AvailabilitySlot) => {
    if (!slot.available) return
    
    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    if (!stored) {
      alert('Please set your library credentials first using the button in the header.')
      return
    }

    let credentials
    try {
      credentials = JSON.parse(stored)
      if (!credentials.libraryCard || !credentials.pin) {
        alert('Invalid credentials stored. Please update your credentials.')
        return
      }
    } catch (e) {
      alert('Invalid credentials stored. Please update your credentials.')
      return
    }

    setSelectedSlot(slot)
    setShowBookingOptionsModal(true)
  }

  const handleBookNow = () => {
    setShowBookingModal(true)
  }

  const handleScheduleFromOptions = () => {
    if (selectedSlot) {
      setSchedulingDate(selectedSlot.date)
      setShowScheduleModal(true)
    }
  }

  const handleScheduleFutureBooking = (date: string) => {
    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    if (!stored) {
      alert('Please set your library credentials first using the button in the header.')
      return
    }

    let credentials
    try {
      credentials = JSON.parse(stored)
      if (!credentials.libraryCard || !credentials.pin) {
        alert('Invalid credentials stored. Please update your credentials.')
        return
      }
    } catch (e) {
      alert('Invalid credentials stored. Please update your credentials.')
      return
    }

    setSchedulingDate(date)
    setShowScheduleModal(true)
  }

  const confirmScheduling = async (scheduledTime: string) => {
    setShowScheduleModal(false)
    setIsScheduling(true)

    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    if (!stored) {
      setBookingResult({
        success: false,
        message: 'Credentials not found. Please set your credentials first.'
      })
      setShowResultModal(true)
      setIsScheduling(false)
      return
    }

    let credentials
    try {
      credentials = JSON.parse(stored)
    } catch (e) {
      setBookingResult({
        success: false,
        message: 'Invalid credentials. Please update your credentials.'
      })
      setShowResultModal(true)
      setIsScheduling(false)
      return
    }

    try {
      const response = await fetch('/api/scheduler/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          museumId,
          date: schedulingDate,
          passId,
          credentials,
          digital: true,
          physical: false,
          location: '0',
          customScheduledTime: scheduledTime
        }),
      })

      const result = await response.json()

      if (result.success) {
        setBookingResult({
          success: true,
          message: `Booking scheduled successfully! It will run automatically on ${new Date(result.booking.scheduledFor).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}.`
        })
        setShowResultModal(true)
      } else {
        setBookingResult({
          success: false,
          message: result.error || 'Failed to schedule booking.'
        })
        setShowResultModal(true)
      }
    } catch (error: any) {
      setBookingResult({
        success: false,
        message: error.message || 'An error occurred while scheduling.'
      })
      setShowResultModal(true)
    } finally {
      setIsScheduling(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const getMonthStartDate = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    return formatDate(firstDay)
  }

  const monthKey = getMonthStartDate(currentMonth)

  const { data: availability, isLoading, refetch } = useQuery({
    queryKey: ['availability', passId, monthKey],
    queryFn: () => fetchAvailability(passId, monthKey),
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    networkMode: 'online'
  })

  const handleDateInteraction = () => {
    refetch()
  }

  const bookingMutation = useMutation({
    mutationFn: (bookingData: any) => bookPass(passId, bookingData),
    onSuccess: (result) => {
      if (result.success) {
        setBookingResult({
          success: true,
          message: 'Your museum pass has been reserved successfully!',
          bookingId: result.bookingId
        })
        setShowResultModal(true)
        queryClient.invalidateQueries({ queryKey: ['availability', passId] })
      } else if (result.requiresAuth) {
        setBookingResult({
          success: false,
          message: 'You need to authenticate to complete this reservation.',
          authUrl: result.authUrl
        })
        setShowResultModal(true)
      } else {
        setBookingResult({
          success: false,
          message: result.error || 'Unable to complete the reservation. Please try again.'
        })
        setShowResultModal(true)
      }
    },
    onError: (error) => {
      setBookingResult({
        success: false,
        message: error.message || 'An unexpected error occurred. Please try again.'
      })
      setShowResultModal(true)
    }
  })

  const confirmBooking = async () => {
    if (!selectedSlot) return
    
    setShowBookingModal(false)

    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    if (!stored) {
      setBookingResult({
        success: false,
        message: 'Credentials not found. Please set your credentials first.'
      })
      setShowResultModal(true)
      return
    }

    let credentials
    try {
      credentials = JSON.parse(stored)
    } catch (e) {
      setBookingResult({
        success: false,
        message: 'Invalid credentials. Please update your credentials.'
      })
      setShowResultModal(true)
      return
    }

    try {
      const bookingUrl = getBookingUrl(selectedSlot.date)
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          libraryCard: credentials.libraryCard,
          pin: credentials.pin,
          bookingUrl: bookingUrl
        }),
      })

      const loginResult = await loginResponse.json()

      if (!loginResult.success) {
        setBookingResult({
          success: false,
          message: loginResult.error || 'Login failed. Please check your credentials.'
        })
        setShowResultModal(true)
        return
      }

      bookingMutation.mutate({
        date: selectedSlot.date,
        passId: selectedSlot.passId,
        digital: selectedSlot.digital,
        physical: selectedSlot.physical,
        location: '0',
        sessionId: loginResult.sessionId
      })
    } catch (error: any) {
      setBookingResult({
        success: false,
        message: error.message || 'An error occurred during login.'
      })
      setShowResultModal(true)
    }
  }

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
          
          const daySlot = availability?.find((s: any) => s.date === dateStr)
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
                } else if (isNotYetAvailable && isCurrentMonth && !isPast) {
                  handleScheduleFutureBooking(dateStr)
                }
              }}
              disabled={(!isAvailable && !isNotYetAvailable) || bookingMutation.isPending}
              className={`
                h-12 text-sm rounded-lg transition-colors relative
                ${!isCurrentMonth ? 'text-gray-300' : 'font-medium'}
                ${isPast && isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
                ${isAvailable ? 'bg-green-50 text-green-700 hover:bg-green-100 border-2 border-green-200 cursor-pointer font-semibold' : ''}
                ${isBooked && isCurrentMonth && !isPast ? 'bg-red-50 text-red-600 border border-red-200' : ''}
                ${isClosed && isCurrentMonth && !isPast ? 'bg-gray-100 text-gray-500' : ''}
                ${isNotYetAvailable && isCurrentMonth && !isPast ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 cursor-pointer' : ''}
                ${selectedDate === dateStr ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                ${!daySlot && isCurrentMonth && !isPast ? 'bg-gray-50 text-gray-400' : ''}
              `}
              title={
                isPast ? 'Past date' :
                isAvailable ? 'Pass available - click to book' :
                isBooked ? 'All passes booked for this date' :
                isClosed ? 'Museum closed' :
                isNotYetAvailable ? 'Click to schedule automatic booking (runs 14 days before at 2pm PST)' :
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
        {availability && availability.some((s: any) => s.available) && (
          <p className="text-xs text-gray-600">
            <strong></strong> Green dates have passes available. Click to book.
          </p>
        )}
        {availability && availability.some((s: any) => s.state === 'not-yet-available') && (
          <p className="text-xs text-yellow-700">
            <strong></strong> Yellow dates are beyond the booking window. Click to schedule automatic booking.
          </p>
        )}
      </div>

      <BookingOptionsModal
        isOpen={showBookingOptionsModal}
        onClose={() => setShowBookingOptionsModal(false)}
        onBookNow={handleBookNow}
        onSchedule={handleScheduleFromOptions}
        date={selectedSlot?.date || ''}
        passName={passName}
      />

      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={confirmBooking}
        date={selectedSlot?.date || ''}
        passName={passName}
        isLoading={bookingMutation.isPending}
      />

      <ScheduleFutureModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onConfirm={confirmScheduling}
        date={schedulingDate}
        museumId={museumId}
        passName={passName}
        isLoading={isScheduling}
      />

      <BookingResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        success={bookingResult?.success || false}
        message={bookingResult?.message || ''}
        bookingId={bookingResult?.bookingId}
        authUrl={bookingResult?.authUrl}
      />

      {bookingMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Processing Your Reservation</h3>
                <p className="text-sm text-gray-600">
                  Logging in and completing your booking automatically...
                </p>
                <div className="pt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Authenticating with your credentials</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                    <span>Navigating to booking page</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-150"></div>
                    <span>Completing reservation</span>
                  </div>
                </div>
              </div>

              <div className="w-full bg-gray-100 rounded-full p-1">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse"></div>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Please wait, this may take 15-30 seconds...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
