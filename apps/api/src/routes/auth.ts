import { Router, Request, Response } from 'express';
import { authService, AuthCredentials, AuthResponse } from '../services/auth.js';

const router = Router();

// Toggle between browser-based (Puppeteer) and direct HTTP auth
const USE_BROWSER_AUTH = true; // Direct HTTP gets 400 - need real browser to bypass bot detection

/**
 * POST /api/auth/login
 * Authenticate with library card and PIN
 */
router.post('/login', async (req: Request, res: Response) => {
  console.log('[AUTH ROUTE] ========================================');
  console.log('[AUTH ROUTE] POST /api/auth/login received');
  console.log('[AUTH ROUTE] Request body:', req.body);
  console.log('[AUTH ROUTE] USE_BROWSER_AUTH =', USE_BROWSER_AUTH);
  
  try {
    const { libraryCard, pin }: AuthCredentials = req.body;

    if (!libraryCard || !pin) {
      console.log('[AUTH ROUTE] Validation failed: missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Library card and PIN are required',
      });
    }

    console.log('[AUTH ROUTE] Credentials validated');
    console.log('[AUTH ROUTE] Library card:', libraryCard);

    // Use browser-based auth if enabled, otherwise use direct HTTP
    let result: AuthResponse;
    if (USE_BROWSER_AUTH) {
      console.log('[AUTH ROUTE] Using browser-based auth (Puppeteer)');
      // Dynamic import to avoid blocking tsx
      const { browserAuthService } = await import('../services/auth-browser.js');
      console.log('[AUTH ROUTE] Calling browserAuthService.login()...');
      result = await browserAuthService.login({ libraryCard, pin });
      console.log('[AUTH ROUTE] browserAuthService.login() returned:', result);
    } else {
      console.log('[AUTH ROUTE] Using direct HTTP auth');
      result = await authService.login({ libraryCard, pin });
    }

    if (!result.success) {
      return res.status(401).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
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
    const { museum, pass, date } = req.body;

    if (!museum || !pass || !date) {
      return res.status(400).json({
        error: 'museum, pass, and date are required',
      });
    }

    const crc = authService.calculateCRC(museum, pass, date);

    res.json({ crc });
  } catch (error: any) {
    console.error('CRC calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
