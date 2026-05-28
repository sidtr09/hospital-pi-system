'use strict';

const express = require('express');
const db      = require('../database/db');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

// ── GET /api/messages — current user's inbox (received) ────────────────────
router.get('/', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const onlyUnread = req.query.unread === '1';
    const sql = `SELECT id, from_username, from_name, from_role, to_username, kind, body, is_read, created_at
                 FROM messages
                 WHERE to_username = ?
                 ${onlyUnread ? 'AND is_read = 0' : ''}
                 ORDER BY created_at DESC
                 LIMIT 100`;
    const rows = await db.all(sql, [me]);
    const unread = rows.filter(r => !r.is_read).length;
    res.json({ data: rows, count: rows.length, unread });
  } catch (err) { next(err); }
});

// ── GET /api/messages/sent — current user's sent messages ─────────────────
router.get('/sent', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const rows = await db.all(
      `SELECT id, from_username, from_name, from_role, to_username, kind, body, is_read, created_at
       FROM messages WHERE from_username = ?
       ORDER BY created_at DESC LIMIT 100`,
      [me]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/messages — send a new message or request ────────────────────
router.post('/', async (req, res, next) => {
  try {
    const me     = req.session.userUsername;
    const myName = req.session.userName;
    const myRole = req.session.userRole;
    const { to_username, kind = 'message', body } = req.body;
    if (!to_username || !body || !body.trim()) {
      return res.status(400).json({ error: 'Recipient and message body are required' });
    }
    if (!['message', 'request'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    if (to_username === me) {
      return res.status(400).json({ error: "You can't send a message to yourself" });
    }
    if (body.length > 2000) {
      return res.status(400).json({ error: 'Message body too long (max 2000 chars)' });
    }
    const result = await db.run(
      `INSERT INTO messages (from_username, from_name, from_role, to_username, kind, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [me, myName, myRole, to_username, kind, body.trim()]
    );
    res.status(201).json({ id: result.lastInsertRowid, ok: true });
  } catch (err) { next(err); }
});

// ── PATCH /api/messages/:id/read — mark received message as read ───────────
router.patch('/:id/read', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const result = await db.run(
      `UPDATE messages SET is_read = 1
       WHERE id = ? AND to_username = ?`,
      [req.params.id, me]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/messages/read-all — mark every received message as read ──────
router.post('/read-all', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const result = await db.run(
      `UPDATE messages SET is_read = 1 WHERE to_username = ? AND is_read = 0`,
      [me]
    );
    res.json({ ok: true, updated: result.changes });
  } catch (err) { next(err); }
});

// ── DELETE /api/messages/:id — delete a message you sent OR received ──────
router.delete('/:id', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const result = await db.run(
      `DELETE FROM messages
       WHERE id = ? AND (from_username = ? OR to_username = ?)`,
      [req.params.id, me, me]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
