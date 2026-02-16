import schedule from 'node-schedule';
import { getBookingService } from './booking-http.js';
import { DEFAULT_LIBRARY_SYSTEM, LibrarySystem, SYSTEM_CONFIG } from './library-system.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScheduledBooking {
  id: string;
  system: LibrarySystem;
  museumId: string;
  date: string; // The date to book (YYYY-MM-DD)
  passId: string;
  credentials: {
    libraryCard: string;
    pin: string;
    email?: string;
  };
  digital: boolean;
  physical: boolean;
  location: string;
  scheduledFor: Date; // When to execute the booking (per-system: KCLS=14 days @ 2pm PST, Seattle=30 days @ noon PST)
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  executedAt?: Date;
  cancelledAt?: Date;
  result?: any;
  logs: string[];
}

class SchedulerService {
  private scheduledBookings: Map<string, ScheduledBooking> = new Map();
  private jobs: Map<string, schedule.Job> = new Map();
  private logsDir: string;
  private defaultLogsDir: string;

  constructor() {
    console.log('🔧 Initializing Scheduler Service...');
    console.log('   __dirname:', __dirname);
    console.log('   __filename:', __filename);
    
    // Determine the logs directory
    // When running compiled: __dirname is apps/api/dist, so go up one level to apps/api
    // When running with tsx: __dirname is apps/api/src, so go up one level to apps/api
    // Then add 'logs' to get apps/api/logs
    const apiRoot = __dirname.includes('dist')
      ? path.join(__dirname, '..') // From dist -> api
      : path.join(__dirname, '..'); // From src -> api

    // Default logs dir inside repo (legacy behavior)
    this.defaultLogsDir = path.join(apiRoot, 'logs');

    // Allow overriding data dir for persistence across deploys
    const configuredDir = process.env.SCHEDULER_DATA_DIR || process.env.KCLS_DATA_DIR;
    this.logsDir = configuredDir ? configuredDir : this.defaultLogsDir;
    
    console.log('   API root:', apiRoot);
    console.log('   Logs directory will be:', this.logsDir);
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      console.log('   Creating logs directory...');
      fs.mkdirSync(this.logsDir, { recursive: true });
      console.log('   ✅ Logs directory created');
    } else {
      console.log('   ✅ Logs directory exists');
    }

    // If a new data dir is configured and it's empty, but legacy data exists, migrate it
    try {
      if (this.logsDir !== this.defaultLogsDir) {
        const newBookingsFile = path.join(this.logsDir, 'scheduled_bookings.json');
        const oldBookingsFile = path.join(this.defaultLogsDir, 'scheduled_bookings.json');
        const newHasBookings = fs.existsSync(newBookingsFile);
        const oldHasBookings = fs.existsSync(oldBookingsFile);
        if (!newHasBookings && oldHasBookings) {
          this.logTemporary(`[MIGRATION] Copying legacy bookings and logs from ${this.defaultLogsDir} to ${this.logsDir}`);
          this.migrateLogsDir(this.defaultLogsDir, this.logsDir);
        }
      }
    } catch (e) {
      console.warn('   ⚠️ Migration check failed:', (e as any)?.message);
    }

    console.log(`📁 Scheduler logs directory: ${this.logsDir}`);

    // Load saved bookings on startup
    this.loadScheduledBookings();
  }

  private logTemporary(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[Scheduler] ${timestamp} ${message}`);
  }

  private migrateLogsDir(fromDir: string, toDir: string) {
    try {
      if (!fs.existsSync(fromDir)) return;
      if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, { recursive: true });

      const entries = fs.readdirSync(fromDir);
      for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        if (!entry.endsWith('.json') && !entry.endsWith('.log')) continue;
        const src = path.join(fromDir, entry);
        const dst = path.join(toDir, entry);
        try {
          if (!fs.existsSync(dst)) {
            fs.copyFileSync(src, dst);
          }
        } catch (e) {
          console.warn(`   ⚠️ Failed to copy ${entry}:`, (e as any)?.message);
        }
      }
      this.logTemporary(`[MIGRATION] Completed copying legacy files`);
    } catch (e) {
      this.logTemporary(`[MIGRATION] Error during migration: ${(e as any)?.message}`);
    }
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

  private calculateScheduleTime(bookingDate: string, system: LibrarySystem = DEFAULT_LIBRARY_SYSTEM): Date {
    // Parse the booking date (YYYY-MM-DD)
    const [year, month, day] = bookingDate.split('-').map(Number);
    
    // Get per-system scheduling config
    const config = SYSTEM_CONFIG[system];
    const advanceDays = config.advanceDays; // KCLS: 14, Seattle: 30
    const openHourUTC = config.openHourUTC; // KCLS: 22 (2pm PST), Seattle: 20 (noon PST)
    
    // Calculate the date N days before the booking date
    const targetDate = new Date(year, month - 1, day);
    targetDate.setDate(targetDate.getDate() - advanceDays);
    
    const pstYear = targetDate.getFullYear();
    const pstMonth = targetDate.getMonth();
    const pstDay = targetDate.getDate();
    
    // Create UTC date at the exact opening hour
    const utcDate = new Date(Date.UTC(pstYear, pstMonth, pstDay, openHourUTC, 0, 0, 0));
    
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
    customScheduledTime?: string, // Optional custom time for debugging
    system: LibrarySystem = DEFAULT_LIBRARY_SYSTEM
  ): ScheduledBooking {
    const id = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use custom time if provided, otherwise calculate using per-system schedule
    const scheduledFor = customScheduledTime 
      ? new Date(customScheduledTime) 
      : this.calculateScheduleTime(date, system);

    const booking: ScheduledBooking = {
      id,
      system,
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
      // Schedule for future execution at EXACT time
      const scheduleTimeISO = booking.scheduledFor.toISOString();
      const scheduleTimeMs = booking.scheduledFor.getTime();
      this.log(booking.id, `Scheduling job for EXACT time: ${scheduleTimeISO} (${scheduleTimeMs}ms)`);
      
      // node-schedule will fire at the exact Date object time
      const job = schedule.scheduleJob(booking.scheduledFor, () => {
        const actualExecutionTime = new Date().toISOString();
        this.log(booking.id, `Job fired at: ${actualExecutionTime}`);
        this.executeBooking(booking.id);
      });

      if (job) {
        this.jobs.set(booking.id, job);
        this.log(booking.id, 'Job scheduled successfully - will fire at exact millisecond');
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

    this.log(bookingId, '');
    this.log(bookingId, '═══════════════════════════════════════════════════════════');
    this.log(bookingId, '=== STARTING SCHEDULED BOOKING EXECUTION ===');
    this.log(bookingId, '═══════════════════════════════════════════════════════════');
    this.log(bookingId, `Execution Time: ${new Date().toISOString()}`);
    this.log(bookingId, '');
    
    // Log full booking details
    this.log(bookingId, '📋 BOOKING DETAILS:');
    this.log(bookingId, `  Booking ID: ${booking.id}`);
    this.log(bookingId, `  Museum ID: ${booking.museumId}`);
    this.log(bookingId, `  Target Date: ${booking.date}`);
    this.log(bookingId, `  Pass ID: ${booking.passId}`);
    this.log(bookingId, `  Digital Pass: ${booking.digital}`);
    this.log(bookingId, `  Physical Pass: ${booking.physical}`);
    this.log(bookingId, `  Location: ${booking.location}`);
    this.log(bookingId, '');
    
    // Log credentials (masked for PIN, full for card)
    this.log(bookingId, '🔐 CREDENTIALS:');
    this.log(bookingId, `  Library Card: ${booking.credentials.libraryCard}`);
    this.log(bookingId, `  PIN: ${'*'.repeat(Math.min(booking.credentials.pin.length, 4))} (${booking.credentials.pin.length} chars)`);
    this.log(bookingId, '');
    
    // Log schedule info
    this.log(bookingId, '⏰ SCHEDULE INFO:');
    this.log(bookingId, `  Scheduled For: ${booking.scheduledFor.toISOString()}`);
    this.log(bookingId, `  Created At: ${booking.createdAt.toISOString()}`);
    this.log(bookingId, `  Time Since Creation: ${((new Date().getTime() - booking.createdAt.getTime()) / 1000).toFixed(1)}s`);
    this.log(bookingId, '');
    
    booking.status = 'running';
    booking.executedAt = new Date();
    this.saveScheduledBookings();

    try {
      this.log(bookingId, '🔄 AUTHENTICATION PHASE:');
      this.log(bookingId, '  Initiating login flow with provided credentials...');
      this.log(bookingId, '');
      
      // Use the unified booking method - same code path as regular booking
      const bookingService = getBookingService(booking.system);
      const result = await bookingService.bookWithCredentials(
        {
          libraryCard: booking.credentials.libraryCard,
          pin: booking.credentials.pin,
          email: booking.credentials.email,
        },
        {
          museumId: booking.museumId,
          date: booking.date,
          passId: booking.passId,
          digital: booking.digital,
          physical: booking.physical,
          location: booking.location,
        },
        (message) => this.log(bookingId, `  ${message}`) // Indent sub-messages
      );

      this.log(bookingId, '');
      this.log(bookingId, '📋 BOOKING RESULT:');
      
      if (result.success) {
        booking.status = 'completed';
        booking.result = result;
        this.log(bookingId, '  ✅ SUCCESS');
        this.log(bookingId, `  Message: ${result.message || 'Pass booked successfully'}`);
        if (result.bookingId) {
          this.log(bookingId, `  Booking ID: ${result.bookingId}`);
        }
        if (result.details) {
          this.log(bookingId, `  Details: ${JSON.stringify(result.details)}`);
        }
      } else {
        booking.status = 'failed';
        booking.result = result;
        this.log(bookingId, '  ❌ FAILED');
        this.log(bookingId, `  Error: ${result.error || 'Unknown error'}`);
        if (result.requiresAuth) {
          this.log(bookingId, '  Reason: Authentication failed - credentials may be invalid or session expired');
        }
      }
      
      this.log(bookingId, '');
      this.log(bookingId, '═══════════════════════════════════════════════════════════');
      this.log(bookingId, `=== EXECUTION COMPLETED AT ${new Date().toISOString()} ===`);
      this.log(bookingId, '═══════════════════════════════════════════════════════════');
      this.log(bookingId, '');

    } catch (error: any) {
      booking.status = 'failed';
      booking.result = { error: error.message };
      
      this.log(bookingId, '');
      this.log(bookingId, '❌ EXECUTION ERROR:');
      this.log(bookingId, `  Error Type: ${error.constructor.name}`);
      this.log(bookingId, `  Error Message: ${error.message}`);
      this.log(bookingId, '');
      this.log(bookingId, '📝 Stack Trace:');
      if (error.stack) {
        const stackLines = error.stack.split('\n');
        stackLines.forEach((line: string) => {
          this.log(bookingId, `  ${line}`);
        });
      }
      
      this.log(bookingId, '');
      this.log(bookingId, '═══════════════════════════════════════════════════════════');
      this.log(bookingId, `=== EXECUTION FAILED AT ${new Date().toISOString()} ===`);
      this.log(bookingId, '═══════════════════════════════════════════════════════════');
      this.log(bookingId, '');
      
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

  getAllScheduledBookings(system?: LibrarySystem): ScheduledBooking[] {
    const all = Array.from(this.scheduledBookings.values());
    const filtered = system ? all.filter(b => b.system === system) : all;
    return filtered
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

    // Update booking status to cancelled instead of deleting
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.logs.push(`Cancelled by user at ${new Date().toISOString()}`);
    
    this.scheduledBookings.set(id, booking);
    this.saveScheduledBookings();
    this.log(id, 'Booking cancelled');

    return true;
  }

  deleteBooking(id: string): boolean {
    const booking = this.scheduledBookings.get(id);
    if (!booking) {
      return false;
    }

    // Only allow deleting completed, failed, or cancelled bookings
    if (booking.status === 'pending' || booking.status === 'running') {
      return false;
    }

    this.scheduledBookings.delete(id);
    this.saveScheduledBookings();
    
    // Also delete the log file if it exists
    const logFile = path.join(this.logsDir, `${id}.log`);
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }

    console.log(`Deleted booking ${id} with status ${booking.status}`);
    return true;
  }

  getActiveJobs(system?: LibrarySystem) {
    const activeJobs = [];
    
    for (const [bookingId, job] of this.jobs.entries()) {
      const booking = this.scheduledBookings.get(bookingId);
      if (booking && (!system || booking.system === system)) {
        activeJobs.push({
          bookingId,
          system: booking.system,
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
    
    try {
      // Ensure directory exists before writing
      if (!fs.existsSync(this.logsDir)) {
        console.log(`Creating logs directory: ${this.logsDir}`);
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      
      // Convert dates to ISO strings for JSON serialization
      const serializable = bookings.map(b => ({
        ...b,
        scheduledFor: b.scheduledFor.toISOString(),
        createdAt: b.createdAt.toISOString(),
        executedAt: b.executedAt?.toISOString(),
        cancelledAt: b.cancelledAt?.toISOString()
      }));

      fs.writeFileSync(bookingsFile, JSON.stringify(serializable, null, 2));
      console.log(`💾 Saved ${bookings.length} bookings to disk`);
    } catch (error) {
      console.error('❌ Error saving scheduled bookings:', error);
      console.error('   Logs directory:', this.logsDir);
      console.error('   Bookings file:', bookingsFile);
      
      // Try to provide helpful error message
      if ((error as any).code === 'EACCES') {
        console.error('   ⚠️  Permission denied - directory may be read-only');
      } else if ((error as any).code === 'ENOENT') {
        console.error('   ⚠️  Directory does not exist and could not be created');
      }
    }
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
          system: b.system || DEFAULT_LIBRARY_SYSTEM,
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
