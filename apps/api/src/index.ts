import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { passesRouter } from './routes/passes.js';
import authRouter from './routes/auth.js';
import { schedulerRouter } from './routes/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Azure App Service sets PORT environment variable
const PORT = Number(process.env.PORT) || 4000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_AZURE = process.env.WEBSITE_INSTANCE_ID !== undefined;

console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT,
  IS_AZURE,
  IS_PRODUCTION
});

// Middleware
app.use(express.json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/passes', passesRouter);
app.use('/api/scheduler', schedulerRouter);

// Health check endpoint for Azure
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT 
  });
});

// In development, proxy frontend to Vite dev server
if (process.env.NODE_ENV === 'development') {
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true,
    logLevel: 'silent'
  }));
} else {
  // In production, serve built frontend from public folder
  // During deployment, the built web assets are copied to public/
  const frontendPath = path.join(__dirname, '../public');
  console.log('Serving static files from:', frontendPath);
  app.use(express.static(frontendPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// In Azure or production, always use the PORT environment variable
if (IS_AZURE || IS_PRODUCTION) {
  app.listen(PORT, () => {
    console.log(`✅ Production server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`☁️  Azure: ${IS_AZURE ? 'Yes' : 'No'}`);
  });
} else {
  // Local development - try multiple ports
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
}