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
router.get('/', async (req, res, next) => {
  try {
    const { status = 'waiting' } = req.query;
    const rows = await db.all(
      `SELECT q.id, q.triage_level, q.triage_color, q.chief_complaint,
              q.assigned_to, q.status, q.queued_at,
              p.full_name, p.patient_ref, p.blood_group
       FROM queue_entries q
       JOIN patients p ON p.id = q.patient_id
       WHERE q.status = ?
       ORDER BY q.triage_level ASC, q.queued_at ASC`,
      [status]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// WHO triage rule:
//   any red flag → red; else any yellow flag → yellow; else green.
// Inputs: emergency_flags{ q1..q10 booleans } and vitals.
function computeTriageColor(emergency_flags = {}, vitals = {}) {
  const ef = emergency_flags || {};
  // RED — life-threatening NOW (Qs 1, 2, 3, 4, 5, 6)
  if (ef.unconscious || ef.no_breathing || ef.severe_bleeding ||
      ef.chest_pain || ef.seizure || ef.shock) return 'red';
  // RED via vitals — extreme hypoxia or no pulse
  if (vitals.vitals_spo2_pct != null && Number(vitals.vitals_spo2_pct) < 88) return 'red';
  if (vitals.vitals_hr_bpm   != null && (Number(vitals.vitals_hr_bpm) > 150 || Number(vitals.vitals_hr_bpm) < 40)) return 'red';
  // YELLOW — urgent (Qs 7, 8, 9)
  if (ef.dehydrated || ef.high_fever || ef.severe_pain) return 'yellow';
  // YELLOW via vitals — moderate distress
  if (vitals.vitals_temp_f   != null && Number(vitals.vitals_temp_f) >= 103) return 'yellow';
  if (vitals.vitals_spo2_pct != null && Number(vitals.vitals_spo2_pct) < 94) return 'yellow';
  return 'green';
}

const COLOR_TO_LEVEL = { red: 1, yellow: 3, green: 4, black: 5 };

// POST /api/queue — enqueue a patient (WHO triage form aware)
router.post('/', async (req, res, next) => {
  try {
    const {
      patient_id, triage_level, chief_complaint, assigned_to,
      // WHO extensions (all optional — the legacy 3-field intake still works)
      triage_color: explicit_color,
      vitals_temp_f, vitals_hr_bpm, vitals_bp, vitals_spo2_pct, vitals_rr,
      emergency_flags, symptoms, duration,
      drug_allergies, food_allergies, other_allergies,
      current_meds, medical_history,
    } = req.body;

    if (!patient_id || !chief_complaint) {
      return res.status(400).json({ error: '[ Required: patient_id, chief_complaint ]' });
    }

    const vitals = { vitals_temp_f, vitals_hr_bpm, vitals_spo2_pct };
    const color = explicit_color
      || computeTriageColor(emergency_flags, vitals);
    const level = triage_level || COLOR_TO_LEVEL[color] || 3;

    const result = await db.run(
      `INSERT INTO queue_entries
         (patient_id, triage_level, chief_complaint, assigned_to,
          triage_color,
          vitals_temp_f, vitals_hr_bpm, vitals_bp, vitals_spo2_pct, vitals_rr,
          emergency_flags, symptoms, duration,
          drug_allergies, food_allergies, other_allergies,
          current_meds, medical_history)
       VALUES (?,?,?,?, ?, ?,?,?,?,?, ?,?,?, ?,?,?, ?,?)`,
      [
        patient_id, level, chief_complaint, assigned_to,
        color,
        vitals_temp_f ?? null, vitals_hr_bpm ?? null, vitals_bp ?? null,
        vitals_spo2_pct ?? null, vitals_rr ?? null,
        emergency_flags ? JSON.stringify(emergency_flags) : null,
        symptoms ?? null, duration ?? null,
        drug_allergies ?? null, food_allergies ?? null, other_allergies ?? null,
        current_meds ?? null,
        Array.isArray(medical_history) ? medical_history.join(',') : (medical_history ?? null),
      ]
    );
    res.status(201).json({ id: result.lastInsertRowid, triage_color: color, triage_level: level });
  } catch (err) { next(err); }
});

// PATCH /api/queue/:id — update status or assignment
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, assigned_to } = req.body;
    const result = await db.run(
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
router.get('/roster', async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    if (req.query.all === '1') {
      // Full roster — every entry plus an is_active flag computed from the
      // on_duty column and current shift window. The Staff Roster page splits
      // these into on/off-duty sections.
      const rows = await db.all(
        `SELECT *,
                (on_duty = 1 AND shift_start <= ? AND shift_end >= ?) AS is_active
           FROM staff_roster
          ORDER BY is_active DESC, role ASC, staff_name ASC`,
        [now, now]
      );
      return res.json({ data: rows });
    }
    const staff = await db.all(
      `SELECT * FROM staff_roster
       WHERE on_duty = 1 AND shift_start <= ? AND shift_end >= ?
       ORDER BY role ASC, staff_name ASC`,
      [now, now]
    );
    res.json({ data: staff });
  } catch (err) { next(err); }
});

// POST /api/queue/roster — add roster entry
router.post('/roster', async (req, res, next) => {
  try {
    const { staff_name, role, shift_start, shift_end, ward } = req.body;
    if (!staff_name || !role || !shift_start || !shift_end) {
      return res.status(400).json({ error: '[ Required: staff_name, role, shift_start, shift_end ]' });
    }
    const result = await db.run(
      `INSERT INTO staff_roster (staff_name, role, shift_start, shift_end, ward) VALUES (?,?,?,?,?)`,
      [staff_name, role, shift_start, shift_end, ward]
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { next(err); }
});

module.exports = router;
