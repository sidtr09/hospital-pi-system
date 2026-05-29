'use strict';

const express = require('express');
const db      = require('../database/db');
const { logEvent } = require('./audit');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session?.userRole === 'Administrator') return next();
  res.status(403).json({ error: 'Administrator only' });
}

// Public read so every signed-in client can mirror disaster mode in real time.
router.get('/disaster-mode', async (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not signed in' });
  try {
    const row = await db.get(`SELECT value FROM app_settings WHERE key = 'disaster_mode'`);
    res.json({ enabled: row && row.value === '1' ? 1 : 0 });
  } catch (err) { next(err); }
});

router.post('/disaster-mode', requireAdmin, async (req, res, next) => {
  try {
    const enabled = req.body.enabled ? 1 : 0;
    await db.run(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES('disaster_mode', ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [String(enabled)]
    );
    await logEvent(req, 'settings.disaster_mode', { detail: { enabled } });
    res.json({ ok: true, enabled });
  } catch (err) { next(err); }
});

module.exports = router;
