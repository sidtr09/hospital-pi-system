'use strict';

const express = require('express');
const crypto  = require('node:crypto');
const bcrypt  = require('bcryptjs');
const db      = require('../database/db');

const PASSWORD_MIN_LENGTH = 12;

const router = express.Router();

// ── Demo accounts (always available, never deletable) ───────────────────────
const DEMO_USERS = [
  { id: -1, username: 'admin',  password: 'admin123',  role: 'Administrator', name: 'Admin User' },
  { id: -2, username: 'doctor', password: 'doctor123', role: 'Doctor',        name: 'Dr. Smith' },
  { id: -3, username: 'nurse',  password: 'nurse123',  role: 'Nurse',         name: 'Nurse Patel' },
];

// ── Password hashing (bcrypt for new hashes; scrypt verify kept for
//     backward compatibility with anything stored before this upgrade) ───────
const BCRYPT_ROUNDS = 12;

function hashPassword(password) {
  // bcryptjs is pure-JS, so it works on the Pi without a native compile.
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  // New format: bcrypt hashes start with $2a$, $2b$ or $2y$
  if (stored.startsWith('$2')) {
    try { return bcrypt.compareSync(password, stored); }
    catch { return false; }
  }
  // Legacy: scrypt hex "salt:hash" — still verify so old accounts keep working.
  if (stored.includes(':')) {
    const [salt, hash] = stored.split(':');
    try {
      const check = crypto.scryptSync(password, salt, 64).toString('hex');
      const a = Buffer.from(hash, 'hex');
      const b = Buffer.from(check, 'hex');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch { return false; }
  }
  return false;
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: 'Empty', tone: 'gray' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Weak',     tone: 'red'    };
  if (score <= 4) return { score, label: 'Medium',   tone: 'orange' };
  if (score <= 5) return { score, label: 'Strong',   tone: 'green'  };
  return            { score, label: 'Very Strong', tone: 'teal'   };
}

// ── Middleware: require Administrator role on the session ────────────────────
function requireAdmin(req, res, next) {
  if (req.session?.userRole === 'Administrator') return next();
  return res.status(403).json({ error: 'Administrator only' });
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
//   Lookup order is DB-first then demo, so that once an admin (or any demo
//   account) changes their password the DB "claim" row takes precedence and
//   the original hardcoded password no longer works. This matters because
//   the Pi ships with admin/admin123 and the hospital is expected to change
//   it on first login.
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Real database users first — a claim row trumps any hardcoded demo.
    const dbUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (dbUser) {
      if (dbUser.status === 'pending') {
        return res.status(403).json({
          error: 'Your account is awaiting administrator approval. Please check back later.',
          code: 'pending',
        });
      }
      if (dbUser.status === 'rejected') {
        return res.status(403).json({
          error: 'Your account request was not approved. Please contact your administrator.',
          code: 'rejected',
        });
      }
      if (!verifyPassword(password, dbUser.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      req.session.userId       = dbUser.id;
      req.session.userUsername = dbUser.username;
      req.session.userName     = dbUser.full_name;
      req.session.userRole     = dbUser.role;
      return res.json({ ok: true, name: dbUser.full_name, role: dbUser.role });
    }

    // Fallback: hardcoded demo account (only on a fresh install — once
    // the user changes their password we create a DB row and skip this branch).
    const demo = DEMO_USERS.find(u => u.username === username);
    if (demo) {
      if (demo.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      req.session.userId       = demo.id;
      req.session.userUsername = demo.username;
      req.session.userName     = demo.name;
      req.session.userRole     = demo.role;
      return res.json({ ok: true, name: demo.name, role: demo.role });
    }

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
// ── POST /api/auth/change-password ──────────────────────────────────────────
//   Works for both demo accounts and DB users. For demo accounts (id < 0)
//   we INSERT or UPDATE a claim row in the users table; subsequent logins
//   route through the DB branch and the old hardcoded password no longer
//   works. This is how a fresh-install admin secures their Pi.
router.post('/change-password', async (req, res, next) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not signed in' });
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    if (new_password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: 'New password must be different from your current one' });
    }
    if (passwordStrength(new_password).tone === 'red') {
      return res.status(400).json({ error: 'New password is too weak — mix upper, lower, digits and symbols' });
    }

    const me = req.session.userUsername;
    const newHash = hashPassword(new_password);

    // Demo account branch — claim it by writing a row to users
    if (req.session.userId < 0) {
      const demo = DEMO_USERS.find(u => u.username === me);
      if (!demo || demo.password !== current_password) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const existing = await db.get('SELECT id FROM users WHERE username = ?', [me]);
      if (existing) {
        await db.run(
          `UPDATE users SET password_hash = ?,
             decided_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
             decided_by = 'self'
           WHERE id = ?`,
          [newHash, existing.id]
        );
      } else {
        await db.run(
          `INSERT INTO users (username, password_hash, full_name, role, status, decided_at, decided_by)
           VALUES (?, ?, ?, ?, 'approved', strftime('%Y-%m-%dT%H:%M:%SZ','now'), 'self')`,
          [demo.username, newHash, demo.name, demo.role]
        );
      }
      // Re-anchor the session to the new DB row so subsequent calls
      // (including the next change-password) take the DB branch.
      const row = await db.get('SELECT id FROM users WHERE username = ?', [me]);
      if (row) req.session.userId = row.id;
      return res.json({ ok: true });
    }

    // Real DB user branch
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (!verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await db.run(
      `UPDATE users SET password_hash = ?,
         decided_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?`,
      [newHash, user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/auth/password-strength — public so login + register can use it
//     to show live "Weak / Medium / Strong / Very Strong" feedback while
//     typing. Returns the same struct the server uses to enforce minimums. ───
router.post('/password-strength', (req, res) => {
  const pw = (req.body && req.body.password) || '';
  res.json({
    min:      PASSWORD_MIN_LENGTH,
    length:   pw.length,
    strength: passwordStrength(pw),
  });
});

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
    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }
    if (passwordStrength(password).tone === 'red') {
      return res.status(400).json({ error: 'Password is too weak — mix upper, lower, digits and symbols' });
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

// ── GET /api/auth/staff ─ approved clinical staff visible to any signed-in
//     user. Used by doctors and nurses to see who else is on the team.
router.get('/staff', async (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not signed in' });
  try {
    const me = req.session.userUsername;
    const dbUsers = await db.all(
      `SELECT username, full_name, role
       FROM users WHERE status = 'approved'
       ORDER BY full_name ASC`
    );
    // A claimed demo account exists in BOTH places; the DB row wins.
    const claimed = new Set(dbUsers.map(u => u.username));
    const demoRows = DEMO_USERS
      .filter(u => !claimed.has(u.username))
      .map(u => ({
        username:  u.username,
        full_name: u.name,
        role:      u.role,
        is_demo:   true,
      }));
    const all = [...demoRows, ...dbUsers]
      .filter(u => u.username !== me); // exclude self
    res.json({ data: all, count: all.length });
  } catch (err) { next(err); }
});

// ── GET /api/auth/users (admin only) — every account on the system ─────────
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `SELECT id, username, full_name, role, status,
                      requested_at, decided_at, decided_by
               FROM users`;
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY requested_at DESC';
    const dbUsers = await db.all(sql, params);

    // Demo accounts (hardcoded, always "approved") — pinned to the top,
    // but if a demo username has been "claimed" (password-changed) the
    // DB row already covers it and we skip the demo placeholder.
    const claimed = new Set(dbUsers.map(u => u.username));
    const showDemo = !status || status === 'approved';
    const demoRows = showDemo ? DEMO_USERS
      .filter(u => !claimed.has(u.username))
      .map(u => ({
        id:            u.id,
        username:      u.username,
        full_name:     u.name,
        role:          u.role,
        status:        'approved',
        requested_at:  null,
        decided_at:    null,
        decided_by:    null,
        is_demo:       true,
      })) : [];

    const all = [...demoRows, ...dbUsers];
    res.json({ data: all, count: all.length });
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
