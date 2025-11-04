import { Router, Request, Response } from 'express';
import { schedulerService } from '../services/scheduler.js';

export const schedulerRouter = Router();

// POST /api/scheduler/schedule - Schedule a future booking
schedulerRouter.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { museumId, date, passId, credentials, digital, physical, location, customScheduledTime } = req.body;

    if (!museumId || !date || !passId || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: museumId, date, passId, credentials'
      });
    }

    if (!credentials.libraryCard || !credentials.pin) {
      return res.status(400).json({
        success: false,
        error: 'Credentials must include libraryCard and pin'
      });
    }

    const booking = schedulerService.scheduleBooking(
      museumId,
      date,
      passId,
      credentials,
      digital !== false,
      physical === true,
      location || '0',
      customScheduledTime // Pass the custom time to the scheduler
    );

    res.json({
      success: true,
      booking: {
        id: booking.id,
        scheduledFor: booking.scheduledFor,
        status: booking.status,
        date: booking.date,
        museumId: booking.museumId
      }
    });
  } catch (error: any) {
    console.error('Error scheduling booking:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to schedule booking'
    });
  }
});

// GET /api/scheduler/bookings - Get all scheduled bookings
schedulerRouter.get('/bookings', (req: Request, res: Response) => {
  try {
    const bookings = schedulerService.getAllScheduledBookings();
    
    // Remove sensitive credentials from response
    const sanitized = bookings.map(b => ({
      id: b.id,
      museumId: b.museumId,
      date: b.date,
      passId: b.passId,
      scheduledFor: b.scheduledFor,
      status: b.status,
      createdAt: b.createdAt,
      executedAt: b.executedAt,
      result: b.result,
      hasCredentials: !!b.credentials
    }));

    res.json({
      success: true,
      bookings: sanitized
    });
  } catch (error: any) {
    console.error('Error getting bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduled bookings'
    });
  }
});

// GET /api/scheduler/bookings/:id - Get a specific booking
schedulerRouter.get('/bookings/:id', (req: Request, res: Response) => {
  try {
    const booking = schedulerService.getScheduledBooking(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Remove sensitive credentials
    const sanitized = {
      id: booking.id,
      museumId: booking.museumId,
      date: booking.date,
      passId: booking.passId,
      scheduledFor: booking.scheduledFor,
      status: booking.status,
      createdAt: booking.createdAt,
      executedAt: booking.executedAt,
      result: booking.result,
      hasCredentials: !!booking.credentials
    };

    res.json({
      success: true,
      booking: sanitized
    });
  } catch (error: any) {
    console.error('Error getting booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get booking'
    });
  }
});

// GET /api/scheduler/bookings/:id/logs - Get logs for a specific booking
schedulerRouter.get('/bookings/:id/logs', (req: Request, res: Response) => {
  try {
    const logs = schedulerService.getBookingLogs(req.params.id);

    res.json({
      success: true,
      logs
    });
  } catch (error: any) {
    console.error('Error getting logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get booking logs'
    });
  }
});

// DELETE /api/scheduler/bookings/:id - Cancel a scheduled booking
schedulerRouter.delete('/bookings/:id', (req: Request, res: Response) => {
  try {
    const cancelled = schedulerService.cancelScheduledBooking(req.params.id);

    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Booking cannot be cancelled (not found or already executed)'
      });
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

// GET /api/scheduler/jobs - Get all active scheduled jobs (cron jobs)
schedulerRouter.get('/jobs', (req: Request, res: Response) => {
  try {
    const jobs = schedulerService.getActiveJobs();

    res.json({
      success: true,
      jobs
    });
  } catch (error: any) {
    console.error('Error getting jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active jobs'
    });
  }
});
