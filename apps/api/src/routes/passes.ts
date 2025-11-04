import { Router } from 'express';
import type { Request, Response } from 'express';
import { PassesService } from '../services/passes.js';

export const passesRouter = Router();
const passesService = new PassesService();

// Ensure no downstream caching of passes data or availability responses
passesRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// GET /api/passes - List all available passes
passesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const passes = await passesService.getAllPasses();
    res.json(passes);
  } catch (error) {
    console.error('Failed to fetch passes:', error);
    res.status(500).json({ error: 'Failed to fetch passes' });
  }
});

// GET /api/passes/by-date - Get all available passes for a specific date
passesRouter.get('/by-date', async (req: Request, res: Response) => {
  try {
    const { date, digital = 'true', physical = 'false', location = '0' } = req.query;
    
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const passes = await passesService.getPassesByDate(
      date,
      digital === 'true',
      physical === 'true',
      location as string
    );
    
    res.json(passes);
  } catch (error) {
    console.error(`Failed to fetch passes for date ${req.query.date}:`, error);
    res.status(500).json({ error: 'Failed to fetch passes by date' });
  }
});

// GET /api/passes/:id - Get pass details
passesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pass = await passesService.getPassDetails(req.params.id);
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }
    res.json(pass);
  } catch (error) {
    console.error(`Failed to fetch pass ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch pass details' });
  }
});

// GET /api/passes/:id/availability - Get pass availability
passesRouter.get('/:id/availability', async (req: Request, res: Response) => {
  try {
    const { date, digital = 'true', physical = 'false', location = '0' } = req.query;
    
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const availability = await passesService.getPassAvailability(
      req.params.id,
      date,
      digital === 'true',
      physical === 'true',
      location as string
    );
    
    res.json(availability);
  } catch (error) {
    console.error(`Failed to fetch availability for pass ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST /api/passes/:id/book - Book a pass
passesRouter.post('/:id/book', async (req: Request, res: Response) => {
  try {
    const { date, passId, digital, physical, location, sessionId } = req.body;
    
    if (!date || !passId) {
      return res.status(400).json({ error: 'Date and passId are required' });
    }

    if (!sessionId) {
      return res.status(401).json({ 
        success: false,
        requiresAuth: true,
        error: 'You must be logged in to book a pass' 
      });
    }

    const booking = await passesService.bookPass(
      req.params.id,
      date,
      passId,
      sessionId,
      digital,
      physical,
      location
    );
    
    res.json(booking);
  } catch (error) {
    console.error(`Failed to book pass ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to book pass' });
  }
});