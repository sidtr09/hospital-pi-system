'use strict';

const express = require('express');
const crypto  = require('node:crypto');
const db      = require('../database/db');

const router = express.Router();

// ── Demo accounts (always available, never deletable) ───────────────────────
const DEMO_USERS = [
  { id: -1, username: 'admin',  password: 'admin123',  role: 'Administrator', name: 'Admin User' },
  { id: -2, username: 'doctor', password: 'doctor123', role: 'Doctor',        name: 'Dr. Smith' },
  { id: -3, username: 'nurse',  password: 'nurse123',  role: 'Nurse',         name: 'Nurse Patel' },
];

// ── Password hashing (scrypt — built-in, no native deps) ────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  // Constant-time compare to avoid timing attacks
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Middleware: require Administrator role on the session ────────────────────
function requireAdmin(req, res, next) {
  if (req.session?.userRole === 'Administrator') return next();
  return res.status(403).json({ error: 'Administrator only' });
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Try demo accounts first
    const demo = DEMO_USERS.find(u => u.username === username);
    if (demo) {
      if (demo.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      req.session.userId   = demo.id;
      req.session.userName = demo.name;
      req.session.userRole = demo.role;
      return res.json({ ok: true, name: demo.name, role: demo.role });
    }

    // Then real database users
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is awaiting administrator approval. Please check back later.',
        code: 'pending',
      });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'Your account request was not approved. Please contact your administrator.',
        code: 'rejected',
      });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.userId   = user.id;
    req.session.userName = user.full_name;
    req.session.userRole = user.role;
    res.json({ ok: true, name: user.full_name, role: user.role });
  } catch (err) { next(err); }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not logged in' });
  res.json({ name: req.session.userName, role: req.session.userRole });
});

// ── POST /api/auth/register (self-signup, creates pending account) ───────────
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Username, password, name and role are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!['Administrator', 'Doctor', 'Nurse'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Block usernames that collide with demo accounts
    if (DEMO_USERS.some(u => u.username === username)) {
      return res.status(409).json({ error: 'That username is reserved. Please choose another.' });
    }

    // Block duplicates in the users table
    const exists = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const hash = hashPassword(password);
    await db.run(
      'INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?,?,?,?,?)',
      [username, hash, full_name, role, 'pending']
    );
    res.status(201).json({
      ok: true,
      message: 'Your account request has been submitted and is awaiting administrator approval.',
    });
  } catch (err) { next(err); }
});

// ── GET /api/auth/pending (admin only) ──────────────────────────────────────
router.get('/pending', requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT id, username, full_name, role, requested_at
       FROM users WHERE status = 'pending' ORDER BY requested_at ASC`
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

// ── POST /api/auth/users/:id/approve (admin only) ───────────────────────────
router.post('/users/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.run(
      `UPDATE users SET status='approved',
         decided_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),
         decided_by=?
       WHERE id=? AND status='pending'`,
      [req.session.userName, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Pending user not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/auth/users/:id (admin only — reject + remove) ──────────────
router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
