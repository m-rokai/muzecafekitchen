import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, copy bundled seed images (baked into the Docker image at
// /app/uploads) onto the /data uploads volume on first boot. Idempotent —
// only writes files that don't already exist, so admin-uploaded images are
// untouched and re-deploys are no-ops once images are in place.
function seedBundledImages() {
  if (process.env.NODE_ENV !== 'production') return;
  const src = path.join(__dirname, 'uploads');
  const dst = '/data/uploads';
  try {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    let copied = 0;
    for (const file of fs.readdirSync(src)) {
      const srcPath = path.join(src, file);
      const dstPath = path.join(dst, file);
      if (fs.existsSync(dstPath)) continue;
      const stat = fs.statSync(srcPath);
      if (!stat.isFile()) continue;
      fs.copyFileSync(srcPath, dstPath);
      copied++;
    }
    if (copied > 0) console.log(`Seeded ${copied} bundled image(s) into ${dst}`);
  } catch (err) {
    console.error('Error seeding bundled images:', err);
  }
}
seedBundledImages();

const app = express();
const httpServer = createServer(app);
// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow all localhost ports in development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    // Allow Fly.io domains
    if (origin.match(/\.fly\.dev$/)) {
      return callback(null, true);
    }
    // Allow configured client URL
    if (origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    // In production, allow same origin
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};

const io = new Server(httpServer, { cors: corsOptions });

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Serve uploaded images (before API routes so /uploads path is handled)
const uploadsPath = process.env.NODE_ENV === 'production'
  ? '/data/uploads'
  : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // In Docker, client is built to ./public; locally it's ../client/dist
  const staticPath = process.env.STATIC_PATH || path.join(__dirname, '../client/dist');
  app.use(express.static(staticPath));

  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // Development only - show API info at root
  app.get('/', (req, res) => {
    res.json({
      name: 'Muze Cafe Order API',
      status: 'running',
      version: '1.0.0',
      endpoints: {
        menu: '/api/menu',
        orders: '/api/orders',
        admin: '/api/admin',
        health: '/api/health',
      },
      frontend: 'http://localhost:5173',
      message: 'This is the API server. Access the app at the frontend URL.',
    });
  });
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
});

export { io };
