import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { passesRouter } from './routes/passes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Middleware
app.use(express.json());

// API routes
app.use('/api/passes', passesRouter);

// In development, proxy frontend to Vite dev server
if (process.env.NODE_ENV === 'development') {
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true,
    logLevel: 'silent'
  }));
} else {
  // In production, serve built frontend
  const frontendPath = path.join(__dirname, '../../web/dist');
  app.use(express.static(frontendPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Try multiple specific ports in sequence
const tryPorts = [4000, 4001, 4002, 4003, 3030, 3031, 3032];
let serverStarted = false;

const startServer = (portIndex: number = 0) => {
  if (portIndex >= tryPorts.length) {
    console.error('Could not find an available port');
    process.exit(1);
  }

  const currentPort = tryPorts[portIndex];
  const server = app.listen(currentPort, () => {
    console.log(`✅ API Server running on port ${currentPort}`);
    console.log(`🔗 Update Vite proxy to: http://localhost:${currentPort}`);
    serverStarted = true;
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ Port ${currentPort} is busy, trying next port...`);
      startServer(portIndex + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer();