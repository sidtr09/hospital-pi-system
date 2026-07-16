/**
 * Cliniq — Primary Backend Framework Configuration
 * Target: Raspberry Pi 3B+ | LAN-Only Deployment | Express.js
 *
 * Performance Contract:
 *   - Gzip compression on all text responses
 *   - Response-time header injection for LAN latency monitoring
 *   - Static asset caching via Cache-Control headers (LAN-safe TTL)
 *   - No external CDN or internet dependency
 */

'use strict';

const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const compression = require('compression');
const morgan     = require('morgan');
const rfs        = require('rotating-file-stream');

const appConfig      = require('./config/app.config');
const db             = require('./database/db');
const patientRoutes  = require('./routes/patient.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const queueRoutes    = require('./routes/queue.routes');
const authRoutes     = require('./routes/auth.routes');
const messagesRoutes = require('./routes/messages.routes');
const auditRoutes    = require('./routes/audit');
const settingsRoutes = require('./routes/settings.routes');
const systemRoutes   = require('./routes/system.routes');
const wristbandRoutes = require('./routes/wristband.routes');
const sessionMiddleware = require('./middleware/session.middleware');

const app = express();
let httpServer = null;
let shuttingDown = false;
const zxingBrowserBundle = path.join(
  path.dirname(require.resolve('@zxing/browser/package.json')),
  'umd',
  'zxing-browser.min.js'
);

// ── Security headers (CSP locked to LAN — no external resource fetch) ────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip/Brotli compression — critical for weak LAN Wi-Fi throughput ─────────
app.use(compression({
  level: 6,
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ── Request body parsers ──────────────────────────────────────────────────────
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// ── Rotating access log (avoids SD card exhaustion over time) ─────────────────
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: path.join(__dirname, 'logs'),
  maxFiles: 7,
});
app.use(morgan('combined', { stream: accessLogStream }));
if (appConfig.env !== 'production') {
  app.use(morgan('dev'));
}

// ── Lightweight LAN session (no heavy JWT or OAuth — shared workstations) ─────
app.use(sessionMiddleware);

// ── Static file serving with aggressive LAN caching ──────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: appConfig.staticCacheMaxAge,
  etag: true,
  lastModified: true,
}));

// Serve the pinned npm browser bundle locally. Cliniq never loads scanner code
// from a CDN or cloud service, so decoding remains fully offline.
app.get('/vendor/zxing-browser.min.js', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(zxingBrowserBundle);
});

// ── Response-time header injection (must run before response is written) ──────
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const originalWrite = res.write.bind(res);
  const originalEnd   = res.end.bind(res);
  const stamp = () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (!res.headersSent) res.setHeader('X-Response-Time', `${ms.toFixed(2)}ms`);
  };
  res.write = (...args) => { stamp(); return originalWrite(...args); };
  res.end   = (...args) => { stamp(); return originalEnd(...args); };
  next();
});

// ── API Route Modules ─────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/patients',  patientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/queue',     queueRoutes);
app.use('/api/messages',  messagesRoutes);
app.use('/api/audit',     auditRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/system',    systemRoutes);
app.use('/api/wristbands', wristbandRoutes);

// ── Health check endpoint (LAN monitoring / watchdog ping) ───────────────────
app.get('/api/health', (req, res) => {
  const { rss, heapUsed, heapTotal } = process.memoryUsage();
  res.json({
    status:    'operational',
    timestamp: new Date().toISOString(),
    uptime_s:  Math.floor(process.uptime()),
    memory: {
      rss_mb:       (rss       / 1024 / 1024).toFixed(1),
      heap_used_mb: (heapUsed  / 1024 / 1024).toFixed(1),
      heap_total_mb:(heapTotal / 1024 / 1024).toFixed(1),
    },
    db_status: db.isOpen() ? 'connected' : 'error',
  });
});

// ── SPA fallback — serves [ Navigation Bar Component ] shell for all views ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${err.message}`);
  const status = err.status || 500;
  res.status(status).json({
    error:   err.message || '[ Internal Server Error ]',
    code:    status,
    path:    req.path,
  });
});

// ── Server bootstrap ──────────────────────────────────────────────────────────
async function bootstrap() {
  await db.initialize();
  const patientCount = await db.get('SELECT COUNT(*) AS count FROM patients');
  console.log(`[DB] Patient count: ${patientCount?.count ?? 0}`);

  httpServer = app.listen(appConfig.port, appConfig.host, () => {
    console.log(`Cliniq running on http://${appConfig.host}:${appConfig.port}`);
    console.log(`Environment : ${appConfig.env}`);
    console.log(`Database    : ${appConfig.dbPath}`);
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down cleanly`);

  if (httpServer) {
    await new Promise(resolve => httpServer.close(resolve));
  }
  await db.close();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Shutdown error:', err);
        process.exit(1);
      });
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

module.exports = app;
