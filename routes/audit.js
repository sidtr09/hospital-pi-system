'use strict';

const express = require('express');
const db      = require('../database/db');

// ── Fire-and-forget event logger — used from every other route ─────────────
async function logEvent(req, action, opts = {}) {
  try {
    await db.run(
      `INSERT INTO audit_log
         (actor_username, actor_name, actor_role, action,
          target_kind, target_id, detail, ip, user_agent)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        req.session?.userUsername || null,
        req.session?.userName     || null,
        req.session?.userRole     || null,
        action,
        opts.target_kind || null,
        opts.target_id != null ? String(opts.target_id) : null,
        opts.detail ? JSON.stringify(opts.detail) : null,
        req.ip || req.connection?.remoteAddress || null,
        (req.get && req.get('user-agent')) || null,
      ]
    );
  } catch { /* swallow — audit must never break the caller */ }
}

// ── Admin-only read/export endpoints ──────────────────────────────────────
const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session?.userRole === 'Administrator') return next();
  res.status(403).json({ error: 'Administrator only' });
}

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { action, actor, since, limit = 200 } = req.query;
    const where = [];
    const params = [];
    if (action) { where.push('action = ?');          params.push(action); }
    if (actor)  { where.push('actor_username LIKE ?'); params.push(`%${actor}%`); }
    if (since)  { where.push('occurred_at >= ?');    params.push(since); }
    const sql = `SELECT * FROM audit_log
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY occurred_at DESC LIMIT ?`;
    params.push(Math.min(Number(limit) || 200, 500));
    const rows = await db.all(sql, params);
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.get('/export', requireAdmin, async (req, res, next) => {
  try {
    const { since, until } = req.query;
    const where = [];
    const params = [];
    if (since) { where.push('occurred_at >= ?'); params.push(since); }
    if (until) { where.push('occurred_at <= ?'); params.push(until); }
    const sql = `SELECT * FROM audit_log
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY occurred_at ASC LIMIT 10000`;
    const rows = await db.all(sql, params);

    await logEvent(req, 'audit.export', { detail: { rows: rows.length, since, until } });

    const escape = v => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['id','occurred_at','actor_username','actor_name','actor_role',
                    'action','target_kind','target_id','detail','ip','user_agent'];
    const csv = [header.join(',')]
      .concat(rows.map(r => header.map(h => escape(r[h])).join(',')))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.logEvent = logEvent;
