import { Router, Request, Response } from 'express';
import { getAuthService } from '../services/auth-http.js';
import { getBookingService } from '../services/booking-http.js';
import { parseLibrarySystem } from '../services/library-system.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with library card and PIN using HTTP-only approach (no Puppeteer)
 */
router.post('/login', async (req: Request, res: Response) => {
  console.log('[AUTH ROUTE] ========================================');
  console.log('[AUTH ROUTE] POST /api/auth/login received');
  console.log('[AUTH ROUTE] Request body:', { ...req.body, pin: '****' });
  
  try {
    const { libraryCard, pin, bookingUrl, system }: { libraryCard: string; pin: string; bookingUrl?: string; system?: string } = req.body;

    if (!libraryCard || !pin) {
      console.log('[AUTH ROUTE] Validation failed: missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Library card and PIN are required',
      });
    }

    console.log('[AUTH ROUTE] Credentials validated');
    console.log('[AUTH ROUTE] Library card:', libraryCard);
    console.log('[AUTH ROUTE] Booking URL:', bookingUrl || '(none)');

    // Use HTTP-based auth (no Puppeteer needed)
    let result;
    const resolvedSystem = parseLibrarySystem(system);
    const authService = getAuthService(resolvedSystem);

    if (bookingUrl) {
      console.log('[AUTH ROUTE] Using HTTP auth with booking URL');
      result = await authService.loginForBooking({ libraryCard, pin }, bookingUrl);
    } else {
      console.log('[AUTH ROUTE] Using HTTP auth (standard login)');
      result = await authService.login({ libraryCard, pin });
    }

    console.log('[AUTH ROUTE] Auth result:', { ...result, token: result.token ? '****' : undefined });

    if (!result.success) {
      return res.status(401).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('[AUTH ROUTE] ========================================');
    console.error('[AUTH ROUTE] Login error caught:', error);
    console.error('[AUTH ROUTE] Error message:', error?.message);
    console.error('[AUTH ROUTE] ========================================');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/verify
 * Verifies library card and PIN by performing the HTTP auth flow without booking
 * Returns success/failure without persisting any session state
 */
router.post('/verify', async (req: Request, res: Response) => {
  console.log('[AUTH ROUTE] ========================================');
  console.log('[AUTH ROUTE] POST /api/auth/verify received');
  console.log('[AUTH ROUTE] Request body:', { ...req.body, pin: '****' });

  try {
    const { libraryCard, pin, system }: { libraryCard: string; pin: string; system?: string } = req.body;

    if (!libraryCard || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Library card and PIN are required'
      });
    }

    console.log('[AUTH ROUTE] Verifying credentials via HTTP auth');
    const resolvedSystem = parseLibrarySystem(system);
    const authService = getAuthService(resolvedSystem);
    const result = await authService.login({ libraryCard, pin });

    if (!result.success) {
      console.log('[AUTH ROUTE] Verification failed');
      return res.status(401).json({ success: false, error: result.error || 'Invalid credentials' });
    }

    // Clean up temporary session if one was created
    if (result.sessionId) {
      try {
        authService.deleteSession(result.sessionId);
      } catch (e) {
        // noop
      }
    }

    console.log('[AUTH ROUTE] Verification succeeded');
    return res.json({
      success: true,
      libraryCard,
      verifiedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[AUTH ROUTE] Verify error caught:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Verification failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and destroy session
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const { sessionId, system }: { sessionId: string; system?: string } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const resolvedSystem = parseLibrarySystem(system);
    const authService = getAuthService(resolvedSystem);
    const success = authService.logout(sessionId);

    res.json({ success });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/session/:sessionId
 * Validate session
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const resolvedSystem = parseLibrarySystem(req.query.system);
    const authService = getAuthService(resolvedSystem);

    const session = authService.getSession(sessionId);

    if (!session) {
      return res.status(401).json({
        valid: false,
        error: 'Session expired or invalid',
      });
    }

    res.json({
      valid: true,
      expiresAt: session.expiresAt,
      libraryCard: session.libraryCard,
    });
  } catch (error: any) {
    console.error('Session validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/crc
 * Calculate CRC for booking
 */
router.post('/crc', (req: Request, res: Response) => {
  try {
    const { museum, pass, date, system } = req.body;

    if (!museum || !pass || !date) {
      return res.status(400).json({
        error: 'museum, pass, and date are required',
      });
    }

    const resolvedSystem = parseLibrarySystem(system);
    const bookingService = getBookingService(resolvedSystem);
    const crc = bookingService.calculateCRC(museum, pass, date);

    res.json({ crc });
  } catch (error: any) {
    console.error('CRC calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
