/**
 * Cliniq — Centralized Application Configuration
 * All environment-sensitive values are resolved here.
 * On Pi deployments, override via process environment variables or a .env file.
 */

'use strict';

const path = require('path');

const projectRoot = path.join(__dirname, '..');
const configuredDbPath = process.env.DB_PATH;

const config = {
  env:  process.env.NODE_ENV || 'production',
  host: process.env.HOST     || '0.0.0.0',       // Bind to all LAN interfaces
  port: parseInt(process.env.PORT || '3000', 10),

  // SQLite database file — store on USB-attached drive if available
  // Resolve relative overrides from the project root rather than the shell's
  // working directory. A Pi therefore opens the same database regardless of
  // which directory systemd (or an operator) starts Node from.
  dbPath: configuredDbPath
    ? (path.isAbsolute(configuredDbPath)
        ? configuredDbPath
        : path.resolve(projectRoot, configuredDbPath))
    : path.join(projectRoot, 'database', 'hospital.db'),

  // Backup destination — external USB mount or fallback to local backup/
  backupDir: process.env.BACKUP_DIR
    || path.join(projectRoot, 'backup'),

  // Static asset Cache-Control max-age (1 hour — safe for LAN, no stale risk)
  staticCacheMaxAge: '1h',

  // Lightweight session configuration (no external session store required)
  session: {
    secret:            process.env.SESSION_SECRET || '[ REPLACE_WITH_STRONG_SECRET ]',
    name:              'hpi.sid',
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   false,        // TLS not enforced on LAN (no cert infrastructure)
      maxAge:   8 * 60 * 60 * 1000,   // 8-hour clinical shift duration
      sameSite: 'strict',
    },
  },

  // Request rate limiter — protects Pi CPU under concurrent LAN access
  rateLimit: {
    windowMs:        60 * 1000,    // 1-minute window
    maxRequests:     300,          // ~5 req/sec per IP — adequate for LAN clients
    standardHeaders: true,
    legacyHeaders:   false,
  },

  // SQLite WAL mode and performance tuning pragmas
  dbPragmas: {
    journal_mode: 'WAL',
    synchronous:  'NORMAL',
    cache_size:   -8000,
    temp_store:   'MEMORY',
    foreign_keys: 'ON',
  },
};

module.exports = config;
