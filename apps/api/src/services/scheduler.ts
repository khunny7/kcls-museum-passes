import schedule from 'node-schedule';
import { PassesService } from './passes.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScheduledBooking {
  id: string;
  museumId: string;
  date: string; // The date to book (YYYY-MM-DD)
  passId: string;
  credentials: {
    libraryCard: string;
    pin: string;
  };
  digital: boolean;
  physical: boolean;
  location: string;
  scheduledFor: Date; // When to execute the booking (2pm PST on date - 14 days)
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  executedAt?: Date;
  result?: any;
  logs: string[];
}

class SchedulerService {
  private scheduledBookings: Map<string, ScheduledBooking> = new Map();
  private jobs: Map<string, schedule.Job> = new Map();
  private passesService: PassesService;
  private logsDir: string;

  constructor() {
    this.passesService = new PassesService();
    
    // Determine the logs directory
    // When running compiled: __dirname is apps/api/dist, so go up one level to apps/api
    // When running with tsx: __dirname is apps/api/src, so go up one level to apps/api
    // Then add 'logs' to get apps/api/logs
    const apiRoot = __dirname.includes('dist') 
      ? path.join(__dirname, '..') // From dist -> api
      : path.join(__dirname, '..'); // From src -> api
    
    this.logsDir = path.join(apiRoot, 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    console.log(`📁 Scheduler logs directory: ${this.logsDir}`);

    // Load saved bookings on startup
    this.loadScheduledBookings();
  }

  private log(bookingId: string, message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`[Scheduler:${bookingId}] ${message}`);

    // Add to booking logs
    const booking = this.scheduledBookings.get(bookingId);
    if (booking) {
      booking.logs.push(logMessage);
      this.saveScheduledBookings();
    }

    // Also write to file
    const logFile = path.join(this.logsDir, `${bookingId}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  private calculateScheduleTime(bookingDate: string): Date {
    // Parse the booking date (YYYY-MM-DD)
    const [year, month, day] = bookingDate.split('-').map(Number);
    
    // Bookings open 14 days before at 2pm PST
    // Calculate the date 14 days before
    const targetDate = new Date(year, month - 1, day);
    targetDate.setDate(targetDate.getDate() - 14);
    
    // We want 2pm PST on that date
    // PST is UTC-8 (Pacific Standard Time, winter)
    // PDT is UTC-7 (Pacific Daylight Time, summer)
    // For now, we'll use PST (UTC-8)
    
    // Create the date in PST: 2pm PST = 2pm local time in America/Los_Angeles
    // Then convert to UTC by adding 8 hours
    // 2pm PST = 10pm UTC (22:00 UTC)
    
    const pstYear = targetDate.getFullYear();
    const pstMonth = targetDate.getMonth();
    const pstDay = targetDate.getDate();
    
    // Create UTC date for 2pm PST (which is 10pm UTC)
    const utcDate = new Date(Date.UTC(pstYear, pstMonth, pstDay, 22, 0, 0, 0));
    
    return utcDate;
  }

  scheduleBooking(
    museumId: string,
    date: string,
    passId: string,
    credentials: { libraryCard: string; pin: string },
    digital: boolean = true,
    physical: boolean = false,
    location: string = '0',
    customScheduledTime?: string // Optional custom time for debugging
  ): ScheduledBooking {
    const id = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use custom time if provided, otherwise calculate
    const scheduledFor = customScheduledTime 
      ? new Date(customScheduledTime) 
      : this.calculateScheduleTime(date);

    const booking: ScheduledBooking = {
      id,
      museumId,
      date,
      passId,
      credentials,
      digital,
      physical,
      location,
      scheduledFor,
      status: 'pending',
      createdAt: new Date(),
      logs: []
    };

    this.log(id, `Booking scheduled for ${scheduledFor.toISOString()}`);
    this.log(id, `Museum: ${museumId}, Date: ${date}, Pass: ${passId}`);

    this.scheduledBookings.set(id, booking);
    this.saveScheduledBookings();

    // Schedule the job
    this.scheduleJob(booking);

    return booking;
  }

  private scheduleJob(booking: ScheduledBooking) {
    const now = new Date();
    
    if (booking.scheduledFor <= now) {
      // If scheduled time has passed, execute immediately
      this.log(booking.id, 'Scheduled time has passed, executing immediately');
      this.executeBooking(booking.id);
    } else {
      // Schedule for future execution
      this.log(booking.id, `Scheduling job for ${booking.scheduledFor.toISOString()}`);
      
      const job = schedule.scheduleJob(booking.scheduledFor, () => {
        this.executeBooking(booking.id);
      });

      if (job) {
        this.jobs.set(booking.id, job);
        this.log(booking.id, 'Job scheduled successfully');
      } else {
        this.log(booking.id, 'ERROR: Failed to schedule job');
      }
    }
  }

  private async executeBooking(bookingId: string) {
    const booking = this.scheduledBookings.get(bookingId);
    if (!booking) {
      console.error(`Booking ${bookingId} not found`);
      return;
    }

    this.log(bookingId, '=== STARTING BOOKING EXECUTION ===');
    booking.status = 'running';
    booking.executedAt = new Date();
    this.saveScheduledBookings();

    try {
      // First, login with credentials
      this.log(bookingId, 'Logging in...');
      const bookingUrl = `https://rooms.kcls.org/passes/${booking.museumId}/book?digital=${booking.digital}&physical=${booking.physical}&location=${booking.location}&date=${booking.date}`;
      
      const loginResponse = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          libraryCard: booking.credentials.libraryCard,
          pin: booking.credentials.pin,
          bookingUrl: bookingUrl
        }),
      });

      const loginResult: any = await loginResponse.json();

      if (!loginResult.success) {
        throw new Error(`Login failed: ${loginResult.error}`);
      }

      this.log(bookingId, `Login successful, sessionId: ${loginResult.sessionId}`);

      // Now book the pass
      this.log(bookingId, 'Attempting to book pass...');
      const result = await this.passesService.bookPass(
        booking.museumId,
        booking.date,
        booking.passId,
        loginResult.sessionId,
        booking.digital,
        booking.physical,
        booking.location
      );

      this.log(bookingId, `Booking result: ${JSON.stringify(result)}`);

      if (result.success) {
        booking.status = 'completed';
        booking.result = result;
        this.log(bookingId, '=== BOOKING COMPLETED SUCCESSFULLY ===');
      } else {
        booking.status = 'failed';
        booking.result = result;
        this.log(bookingId, `=== BOOKING FAILED: ${result.error} ===`);
      }
    } catch (error: any) {
      booking.status = 'failed';
      booking.result = { error: error.message };
      this.log(bookingId, `=== BOOKING ERROR: ${error.message} ===`);
      console.error(`Error executing booking ${bookingId}:`, error);
    }

    this.saveScheduledBookings();

    // Remove the job from memory
    const job = this.jobs.get(bookingId);
    if (job) {
      job.cancel();
      this.jobs.delete(bookingId);
    }
  }

  getScheduledBooking(id: string): ScheduledBooking | undefined {
    return this.scheduledBookings.get(id);
  }

  getAllScheduledBookings(): ScheduledBooking[] {
    return Array.from(this.scheduledBookings.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getBookingLogs(id: string): string[] {
    const booking = this.scheduledBookings.get(id);
    if (!booking) {
      return [];
    }

    // Also try to read from log file
    const logFile = path.join(this.logsDir, `${id}.log`);
    if (fs.existsSync(logFile)) {
      const fileLogs = fs.readFileSync(logFile, 'utf-8').split('\n').filter(l => l.trim());
      return fileLogs;
    }

    return booking.logs;
  }

  cancelScheduledBooking(id: string): boolean {
    const booking = this.scheduledBookings.get(id);
    if (!booking || booking.status !== 'pending') {
      return false;
    }

    const job = this.jobs.get(id);
    if (job) {
      job.cancel();
      this.jobs.delete(id);
    }

    this.scheduledBookings.delete(id);
    this.saveScheduledBookings();
    this.log(id, 'Booking cancelled');

    return true;
  }

  getActiveJobs() {
    const activeJobs = [];
    
    for (const [bookingId, job] of this.jobs.entries()) {
      const booking = this.scheduledBookings.get(bookingId);
      if (booking) {
        activeJobs.push({
          bookingId,
          museumId: booking.museumId,
          date: booking.date,
          scheduledFor: booking.scheduledFor,
          status: booking.status,
          nextInvocation: job.nextInvocation()?.toISOString() || null
        });
      }
    }

    return activeJobs;
  }

  private saveScheduledBookings() {
    const bookingsFile = path.join(this.logsDir, 'scheduled_bookings.json');
    const bookings = Array.from(this.scheduledBookings.values());
    
    // Convert dates to ISO strings for JSON serialization
    const serializable = bookings.map(b => ({
      ...b,
      scheduledFor: b.scheduledFor.toISOString(),
      createdAt: b.createdAt.toISOString(),
      executedAt: b.executedAt?.toISOString()
    }));

    fs.writeFileSync(bookingsFile, JSON.stringify(serializable, null, 2));
  }

  private loadScheduledBookings() {
    const bookingsFile = path.join(this.logsDir, 'scheduled_bookings.json');
    
    if (!fs.existsSync(bookingsFile)) {
      console.log('No saved bookings found, starting fresh');
      return;
    }

    try {
      const data = fs.readFileSync(bookingsFile, 'utf-8');
      const bookings = JSON.parse(data);

      for (const b of bookings) {
        const booking: ScheduledBooking = {
          ...b,
          scheduledFor: new Date(b.scheduledFor),
          createdAt: new Date(b.createdAt),
          executedAt: b.executedAt ? new Date(b.executedAt) : undefined,
          logs: b.logs || [] // Ensure logs array exists
        };

        this.scheduledBookings.set(booking.id, booking);

        // Re-schedule pending jobs
        if (booking.status === 'pending') {
          this.scheduleJob(booking);
          console.log(`Re-scheduled pending job: ${booking.id} for ${booking.scheduledFor}`);
        }
      }

      const pendingCount = bookings.filter((b: any) => b.status === 'pending').length;
      const completedCount = bookings.filter((b: any) => b.status === 'completed').length;
      const failedCount = bookings.filter((b: any) => b.status === 'failed').length;
      
      console.log(`✅ Loaded ${bookings.length} scheduled bookings from disk:`);
      console.log(`   - ${pendingCount} pending (re-scheduled)`);
      console.log(`   - ${completedCount} completed`);
      console.log(`   - ${failedCount} failed`);
    } catch (error) {
      console.error('❌ Error loading scheduled bookings:', error);
    }
  }
}

export const schedulerService = new SchedulerService();
