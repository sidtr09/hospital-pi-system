/**
 * [ Clinical Queue & Scheduling Module ] — Route Module
 * Serves: [ Triage Priority Queue ] | [ Staff Duty Roster ]
 */

'use strict';

const express = require('express');
const db      = require('../database/db');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

// ── [ Triage Priority Queue ] — active queue (sorted by severity then time) ───
// GET /api/queue?status=waiting
router.get('/', (req, res, next) => {
  try {
    const { status = 'waiting' } = req.query;
    const rows = db.all(
      `SELECT q.id, q.triage_level, q.chief_complaint, q.assigned_to, q.status,
              q.queued_at, p.full_name, p.patient_ref, p.blood_group
       FROM queue_entries q
       JOIN patients p ON p.id = q.patient_id
       WHERE q.status = ?
       ORDER BY q.triage_level ASC, q.queued_at ASC`,
      [status]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /api/queue — enqueue a patient
router.post('/', (req, res, next) => {
  try {
    const { patient_id, triage_level, chief_complaint, assigned_to } = req.body;
    if (!patient_id || !triage_level || !chief_complaint) {
      return res.status(400).json({ error: '[ Required: patient_id, triage_level, chief_complaint ]' });
    }
    const result = db.run(
      `INSERT INTO queue_entries (patient_id, triage_level, chief_complaint, assigned_to)
       VALUES (?,?,?,?)`,
      [patient_id, triage_level, chief_complaint, assigned_to]
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { next(err); }
});

// PATCH /api/queue/:id — update status or assignment
router.patch('/:id', (req, res, next) => {
  try {
    const { status, assigned_to } = req.body;
    const resolved_at = status === 'completed' ? `strftime('%Y-%m-%dT%H:%M:%SZ','now')` : 'resolved_at';
    const result = db.run(
      `UPDATE queue_entries
       SET status=COALESCE(?,status), assigned_to=COALESCE(?,assigned_to),
           resolved_at=CASE WHEN ?='completed' THEN strftime('%Y-%m-%dT%H:%M:%SZ','now') ELSE resolved_at END
       WHERE id=?`,
      [status, assigned_to, status, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: '[ Queue Entry Not Found ]' });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ── [ Staff Duty Roster ] — current on-duty staff ────────────────────────────
// GET /api/queue/roster
router.get('/roster', (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const staff = db.all(
      `SELECT * FROM staff_roster
       WHERE on_duty = 1 AND shift_start <= ? AND shift_end >= ?
       ORDER BY role ASC, staff_name ASC`,
      [now, now]
    );
    res.json({ data: staff });
  } catch (err) { next(err); }
});

// POST /api/queue/roster — add roster entry
router.post('/roster', (req, res, next) => {
  try {
    const { staff_name, role, shift_start, shift_end, ward } = req.body;
    if (!staff_name || !role || !shift_start || !shift_end) {
      return res.status(400).json({ error: '[ Required: staff_name, role, shift_start, shift_end ]' });
    }
    const result = db.run(
      `INSERT INTO staff_roster (staff_name, role, shift_start, shift_end, ward) VALUES (?,?,?,?,?)`,
      [staff_name, role, shift_start, shift_end, ward]
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { next(err); }
});

module.exports = router;
