/**
 * [ Patient Data API Engine ] — Route Module
 * Serves: [ Patient Search View ] | [ Patient Registration Form ] | [ Clinical Notes Timeline ]
 */

'use strict';

const express   = require('express');
const db        = require('../database/db');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

// ── [ Patient Search View ] ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q = '', limit = 50, offset = 0 } = req.query;
    const term = `%${q}%`;
    const rows = await db.all(
      `SELECT id, patient_ref, full_name, date_of_birth, sex, blood_group, registered_at
       FROM patients
       WHERE full_name LIKE ? OR patient_ref LIKE ?
       ORDER BY registered_at DESC
       LIMIT ? OFFSET ?`,
      [term, term, Number(limit), Number(offset)]
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

// ── [ Patient Registration Form ] — create ────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { patient_ref, full_name, date_of_birth, sex,
            contact_number, address, blood_group, allergy_notes } = req.body;

    if (!patient_ref || !full_name || !date_of_birth) {
      return res.status(400).json({ error: '[ Required fields missing: patient_ref, full_name, date_of_birth ]' });
    }

    const result = await db.run(
      `INSERT INTO patients
         (patient_ref, full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [patient_ref, full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes]
    );

    res.status(201).json({ id: result.lastInsertRowid, patient_ref });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: '[ Patient reference already exists ]' });
    }
    next(err);
  }
});

// GET /api/patients/:id — full record
router.get('/:id', async (req, res, next) => {
  try {
    const patient = await db.get('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) return res.status(404).json({ error: '[ Patient Not Found ]' });
    res.json(patient);
  } catch (err) { next(err); }
});

// PUT /api/patients/:id — update registration record
router.put('/:id', async (req, res, next) => {
  try {
    const { full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes } = req.body;
    if (!full_name || !date_of_birth) {
      return res.status(400).json({ error: '[ Required fields missing: full_name, date_of_birth ]' });
    }
    const result = await db.run(
      `UPDATE patients
       SET full_name=?, date_of_birth=?, sex=?, contact_number=?, address=?, blood_group=?, allergy_notes=?,
           updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id=?`,
      [full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: '[ Patient Not Found ]' });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// DELETE /api/patients/:id — cascade removes clinical notes + queue entries
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.run('DELETE FROM patients WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: '[ Patient Not Found ]' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── [ Clinical Notes Timeline ] ───────────────────────────────────────────────
router.get('/:id/notes', async (req, res, next) => {
  try {
    const notes = await db.all(
      `SELECT * FROM clinical_notes WHERE patient_id=? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ data: notes });
  } catch (err) { next(err); }
});

router.post('/:id/notes', async (req, res, next) => {
  try {
    const { authored_by, note_type, body } = req.body;
    if (!authored_by || !note_type || !body) {
      return res.status(400).json({ error: '[ Required fields missing: authored_by, note_type, body ]' });
    }
    const result = await db.run(
      `INSERT INTO clinical_notes (patient_id, authored_by, note_type, body) VALUES (?,?,?,?)`,
      [req.params.id, authored_by, note_type, body]
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { next(err); }
});

module.exports = router;
