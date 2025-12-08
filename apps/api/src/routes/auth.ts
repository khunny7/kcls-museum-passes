import { Router, Request, Response } from 'express';
import { httpAuthService } from '../services/auth-http.js';
import { httpBookingService } from '../services/booking-http.js';

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
    const { libraryCard, pin, bookingUrl }: { libraryCard: string; pin: string; bookingUrl?: string } = req.body;

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
    if (bookingUrl) {
      console.log('[AUTH ROUTE] Using HTTP auth with booking URL');
      result = await httpAuthService.loginForBooking({ libraryCard, pin }, bookingUrl);
    } else {
      console.log('[AUTH ROUTE] Using HTTP auth (standard login)');
      result = await httpAuthService.login({ libraryCard, pin });
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
 * POST /api/auth/logout
 * Logout and destroy session
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const success = httpAuthService.logout(sessionId);

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

    const session = httpAuthService.getSession(sessionId);

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
    const { museum, pass, date } = req.body;

    if (!museum || !pass || !date) {
      return res.status(400).json({
        error: 'museum, pass, and date are required',
      });
    }

    const crc = httpBookingService.calculateCRC(museum, pass, date);

    res.json({ crc });
  } catch (error: any) {
    console.error('CRC calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
