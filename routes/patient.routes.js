/**
 * [ Patient Data API Engine ] — Route Module
 * Serves: [ Patient Search View ] | [ Patient Registration Form ] | [ Clinical Notes Timeline ]
 */

'use strict';

const express   = require('express');
const crypto    = require('node:crypto');
const db        = require('../database/db');
const patientSearch = require('../services/typesense-patient-search');
const patientMutationLock = require('../services/patient-mutation-lock');
const { logEvent } = require('./audit');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

function requireAdmin(req, res, next) {
  if (req.session?.userRole === 'Administrator') return next();
  return res.status(403).json({ error: 'Administrator only' });
}

function searchSqlite(q, limit, offset, database = db) {
  const term = `%${q}%`;
  return database.all(
    `SELECT id, patient_ref, full_name, date_of_birth, sex, blood_group, registered_at
     FROM patients
     WHERE full_name LIKE ? OR patient_ref LIKE ?
     ORDER BY registered_at DESC
     LIMIT ? OFFSET ?`,
    [term, term, limit, offset]
  );
}

async function hydrateSearchResults(patientRefs, database = db) {
  if (!patientRefs.length) return [];
  const placeholders = patientRefs.map(() => '?').join(',');
  const rows = await database.all(
    `SELECT id, patient_ref, full_name, date_of_birth, sex, blood_group, registered_at
       FROM patients WHERE patient_ref IN (${placeholders})`,
    patientRefs
  );
  const byReference = new Map(rows.map(row => [row.patient_ref, row]));
  return patientRefs.map(ref => byReference.get(ref)).filter(Boolean);
}

async function executePatientSearch(q, limit, offset, dependencies = {}) {
  const searchService = dependencies.searchService || patientSearch;
  const database = dependencies.database || db;
  const logger = dependencies.logger || console;
  if (String(q).trim()) {
    try {
      const patientRefs = await searchService.search(q, limit, offset);
      if (patientRefs) return hydrateSearchResults(patientRefs, database);
    } catch {
      logger.warn('[Typesense] Patient search unavailable; using SQLite fallback');
    }
  }
  return searchSqlite(q, limit, offset, database);
}

async function indexPatientBestEffort(patient, searchService = patientSearch, logger = console) {
  try {
    return await searchService.indexPatient(patient);
  } catch {
    logger.warn('[Typesense] Patient indexing unavailable; SQLite record remains saved');
    return { enabled: true, indexed: false };
  }
}

async function reindexUpdatedPatient(patientId, dependencies = {}) {
  const database = dependencies.database || db;
  const searchService = dependencies.searchService || patientSearch;
  const logger = dependencies.logger || console;
  const patient = await database.get(
    'SELECT patient_ref, full_name FROM patients WHERE id = ?',
    [patientId]
  );
  if (!patient) return { enabled: false, indexed: false };
  return indexPatientBestEffort(patient, searchService, logger);
}

async function deletePatientFromIndexBestEffort(patientRef, searchService = patientSearch, logger = console) {
  try {
    return await searchService.deletePatient(patientRef);
  } catch {
    logger.warn('[Typesense] Patient index deletion unavailable; SQLite deletion remains saved');
    return { enabled: true, deleted: false };
  }
}

function synchronizationHttpStatus(summary) {
  return summary.ready === true ? 200 : 503;
}

function sendSynchronizationSummary(res, summary) {
  return res.status(synchronizationHttpStatus(summary)).json(summary);
}

// ── [ Patient Search View ] ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q = '', limit = 50, offset = 0 } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 250);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const rows = await executePatientSearch(q, safeLimit, safeOffset);
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

// ── [ Patient Registration Form ] — create ────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { full_name, date_of_birth, sex,
            contact_number, address, blood_group, allergy_notes,
            emergency_contact } = req.body;

    if (!full_name || !date_of_birth) {
      return res.status(400).json({ error: '[ Required fields missing: full_name, date_of_birth ]' });
    }

    // patient_ref is deliberately ignored if an older client submits it. The
    // backend is the sole authority for new public Patient IDs.
    const created = await patientMutationLock.runExclusive(async () => {
      const result = await db.transaction(async () => {
        const placeholder = `__pending__-${crypto.randomUUID()}`;
        const inserted = await db.run(
          `INSERT INTO patients
             (patient_ref, full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, emergency_contact)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [placeholder, full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, emergency_contact]
        );

        const year = new Date().getUTCFullYear();
        const patientRef = `CLQ-${year}-${String(inserted.lastInsertRowid).padStart(6, '0')}`;
        await db.run('UPDATE patients SET patient_ref = ? WHERE id = ?',
          [patientRef, inserted.lastInsertRowid]);
        return { id: inserted.lastInsertRowid, patient_ref: patientRef };
      });

      await logEvent(req, 'patient.create', {
        target_kind: 'patient',
        target_id: result.patient_ref,
        detail: { id: result.id },
      });
      await indexPatientBestEffort({ patient_ref: result.patient_ref, full_name });
      return result;
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Administrator-only, idempotent backfill from authoritative SQLite records.
router.post('/search-index/sync', requireAdmin, async (_req, res, next) => {
  try {
    const summary = await patientMutationLock.runExclusive(async () => {
      const patients = await db.all('SELECT patient_ref, full_name FROM patients ORDER BY id ASC');
      await patientSearch.initializeCollection();
      return patientSearch.synchronize(patients);
    });
    sendSynchronizationSummary(res, summary);
  } catch (err) { next(err); }
});

// GET /api/patients/:id — full record
router.get('/:id', async (req, res, next) => {
  try {
    const patient = await db.get('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) return res.status(404).json({ error: '[ Patient Not Found ]' });
    await logEvent(req, 'patient.view', { target_kind: 'patient', target_id: patient.patient_ref });
    res.json(patient);
  } catch (err) { next(err); }
});

// PUT /api/patients/:id — update registration record
router.put('/:id', async (req, res, next) => {
  try {
    const { full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, emergency_contact } = req.body;
    if (!full_name || !date_of_birth) {
      return res.status(400).json({ error: '[ Required fields missing: full_name, date_of_birth ]' });
    }
    const updated = await patientMutationLock.runExclusive(async () => {
      // Snapshot the pre-update row so the audit detail can list changed fields
      const before = await db.get('SELECT patient_ref, full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, emergency_contact FROM patients WHERE id = ?', [req.params.id]);
      const result = await db.run(
        `UPDATE patients
         SET full_name=?, date_of_birth=?, sex=?, contact_number=?, address=?, blood_group=?, allergy_notes=?, emergency_contact=?,
             updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id=?`,
        [full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, emergency_contact, req.params.id]
      );
      if (result.changes === 0) return false;

      const next_ = { full_name, date_of_birth, sex, contact_number, address, blood_group, allergy_notes, emergency_contact };
      const changed = Object.keys(next_).filter(k => (before?.[k] ?? null) !== (next_[k] ?? null));
      await logEvent(req, 'patient.update', { target_kind: 'patient', target_id: before?.patient_ref, detail: { changed } });
      await reindexUpdatedPatient(req.params.id);
      return true;
    });
    if (!updated) return res.status(404).json({ error: '[ Patient Not Found ]' });

    res.json({ updated: true });
  } catch (err) { next(err); }
});

// DELETE /api/patients/:id — cascade removes clinical notes + queue entries
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await patientMutationLock.runExclusive(async () => {
      const before = await db.get('SELECT patient_ref, full_name FROM patients WHERE id = ?', [req.params.id]);
      const result = await db.run('DELETE FROM patients WHERE id = ?', [req.params.id]);
      if (result.changes === 0) return false;
      await logEvent(req, 'patient.delete', { target_kind: 'patient', target_id: before?.patient_ref, detail: { full_name: before?.full_name } });
      await deletePatientFromIndexBestEffort(before.patient_ref);
      return true;
    });
    if (!deleted) return res.status(404).json({ error: '[ Patient Not Found ]' });
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
module.exports.indexPatientBestEffort = indexPatientBestEffort;
module.exports.executePatientSearch = executePatientSearch;
module.exports.reindexUpdatedPatient = reindexUpdatedPatient;
module.exports.deletePatientFromIndexBestEffort = deletePatientFromIndexBestEffort;
module.exports.synchronizationHttpStatus = synchronizationHttpStatus;
module.exports.sendSynchronizationSummary = sendSynchronizationSummary;
