/**
 * Lightweight session middleware for shared clinical workstations.
 * Uses express-session with in-process MemoryStore — zero external dependencies.
 * Suitable for LAN environments where a Redis/Postgres session store is unavailable.
 *
 * Limitation: sessions are lost on Pi reboot (acceptable for shift-based access).
 */

'use strict';

const session    = require('express-session');
const rateLimit  = require('express-rate-limit');
const appConfig  = require('../config/app.config');

const sessionHandler = session(appConfig.session);

// Attaches to every API route — rejects unauthenticated requests to protected paths.
function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: '[ Authentication Required ]', code: 401 });
}

// Per-IP rate limiter — protects Pi CPU from LAN request floods
const apiLimiter = rateLimit({
  windowMs:        appConfig.rateLimit.windowMs,
  max:             appConfig.rateLimit.maxRequests,
  standardHeaders: appConfig.rateLimit.standardHeaders,
  legacyHeaders:   appConfig.rateLimit.legacyHeaders,
  message:         { error: '[ Rate Limit Exceeded ]', code: 429 },
});

module.exports              = sessionHandler;
module.exports.requireAuth  = requireAuth;
module.exports.apiLimiter   = apiLimiter;
