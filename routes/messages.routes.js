'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const multer  = require('multer');
const db      = require('../database/db');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

// ── Attachment storage — small files only, on the same SD card as the DB ──
const ATTACH_DIR = path.join(__dirname, '..', 'data', 'attachments');
fs.mkdirSync(ATTACH_DIR, { recursive: true });

// Permissive within reason: docs and images clinicians routinely share.
// Reject anything executable; we never serve these with a script content-type.
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACH_DIR),
  filename:    (_req, file, cb) => {
    // Random opaque name; original extension preserved for safe download.
    const ext = path.extname(file.originalname || '').slice(0, 8).replace(/[^.\w-]/g, '');
    const rand = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${rand}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },     // 5 MB cap, single file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Unsupported file type'), { status: 415 }));
  },
});

const SELECT_COLS = `id, from_username, from_name, from_role, to_username, kind, body,
                     is_read, created_at,
                     attachment_path, attachment_name, attachment_mime, attachment_size`;

// ── GET /api/messages — current user's inbox (received) ────────────────────
router.get('/', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const onlyUnread = req.query.unread === '1';
    const sql = `SELECT ${SELECT_COLS}
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
      `SELECT ${SELECT_COLS} FROM messages WHERE from_username = ?
       ORDER BY created_at DESC LIMIT 100`,
      [me]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/messages — send a new message or request, optionally with file ──
//     Body is multipart/form-data so a file can ride along. JSON bodies still
//     work because multer leaves text fields on req.body either way.
router.post('/', upload.single('attachment'), async (req, res, next) => {
  try {
    const me     = req.session.userUsername;
    const myName = req.session.userName;
    const myRole = req.session.userRole;
    const { to_username, kind = 'message', body = '' } = req.body;
    const file = req.file;

    const trimmedBody = (body || '').trim();
    if (!to_username || (!trimmedBody && !file)) {
      // Drop the upload — nothing else will reference it.
      if (file) fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'Recipient and a message body or attachment are required' });
    }
    if (!['message', 'request'].includes(kind)) {
      if (file) fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'Invalid kind' });
    }
    if (to_username === me) {
      if (file) fs.unlink(file.path, () => {});
      return res.status(400).json({ error: "You can't send a message to yourself" });
    }
    if (trimmedBody.length > 2000) {
      if (file) fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'Message body too long (max 2000 chars)' });
    }

    const result = await db.run(
      `INSERT INTO messages
         (from_username, from_name, from_role, to_username, kind, body,
          attachment_path, attachment_name, attachment_mime, attachment_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        me, myName, myRole, to_username, kind, trimmedBody,
        file ? path.basename(file.path) : null,
        file ? file.originalname        : null,
        file ? file.mimetype            : null,
        file ? file.size                : null,
      ]
    );
    res.status(201).json({ id: result.lastInsertRowid, ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/messages/:id/attachment — stream the file to sender or recipient ──
router.get('/:id/attachment', async (req, res, next) => {
  try {
    const me = req.session.userUsername;
    const row = await db.get(
      `SELECT attachment_path, attachment_name, attachment_mime
         FROM messages
        WHERE id = ? AND (to_username = ? OR from_username = ?)`,
      [req.params.id, me, me]
    );
    if (!row || !row.attachment_path) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    // Resolve and re-check the path lives inside ATTACH_DIR — defence against
    // any future DB row that smuggled in '..' or an absolute path.
    const file = path.resolve(ATTACH_DIR, row.attachment_path);
    if (!file.startsWith(ATTACH_DIR + path.sep) || !fs.existsSync(file)) {
      return res.status(404).json({ error: 'Attachment file missing on disk' });
    }
    res.setHeader('Content-Type', row.attachment_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition',
      `attachment; filename="${(row.attachment_name || 'attachment').replace(/["\\\r\n]/g, '_')}"`);
    fs.createReadStream(file).pipe(res);
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
    // Grab the attachment first so we can clean it up after the row drops.
    const row = await db.get(
      `SELECT attachment_path FROM messages
        WHERE id = ? AND (from_username = ? OR to_username = ?)`,
      [req.params.id, me, me]
    );
    const result = await db.run(
      `DELETE FROM messages
       WHERE id = ? AND (from_username = ? OR to_username = ?)`,
      [req.params.id, me, me]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Message not found' });
    if (row?.attachment_path) {
      fs.unlink(path.join(ATTACH_DIR, row.attachment_path), () => {});
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Multer error surface — typed 4xx instead of a generic 500 ──────────────
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Attachment too large (max 5 MB)' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err && err.status === 415) return res.status(415).json({ error: err.message });
  next(err);
});

module.exports = router;
