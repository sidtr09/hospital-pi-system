'use strict';

const express = require('express');
const bwipjs  = require('bwip-js');
const db      = require('../database/db');
const { writeEvent } = require('./audit');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

// New CLQ IDs have a fixed prefix, registration year and at least six digits.
// Legacy PAT IDs are intentionally supported without accepting SQL wildcards,
// whitespace, slashes or arbitrary punctuation.
const PUBLIC_ID_PATTERN = /^(?:CLQ-\d{4}-\d{6,}|PAT-[A-Z0-9](?:[A-Z0-9-]{1,38}[A-Z0-9])?)$/;

function normalizePublicId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return PUBLIC_ID_PATTERN.test(normalized) ? normalized : null;
}

function parseRowId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

async function findPatientByReference(patientRef) {
  return db.get(
    `SELECT id, patient_ref, full_name
       FROM patients
      WHERE patient_ref = ?`,
    [patientRef]
  );
}

async function wristbandPayload(patientId) {
  const patient = await db.get(
    `SELECT id, patient_ref, full_name, date_of_birth, sex,
            allergy_notes, registered_at
       FROM patients
      WHERE id = ?`,
    [patientId]
  );
  if (!patient) return null;

  const [triage, tracking] = await Promise.all([
    db.get(
      `SELECT triage_color, triage_level, status, queued_at
         FROM queue_entries
        WHERE patient_id = ?
        ORDER BY queued_at DESC, id DESC
        LIMIT 1`,
      [patientId]
    ),
    db.get(
      `SELECT print_count, first_print_requested_at, last_print_requested_at
         FROM patient_wristbands
        WHERE patient_id = ?`,
      [patientId]
    ),
  ]);

  return {
    ...patient,
    triage: triage || null,
    wristband: tracking || {
      print_count: 0,
      first_print_requested_at: null,
      last_print_requested_at: null,
    },
  };
}

// Exact lookup for both legacy PAT-* and permanent CLQ-* public IDs.
router.get('/lookup/:patientRef', async (req, res, next) => {
  try {
    const patientRef = normalizePublicId(req.params.patientRef);
    if (!patientRef) {
      return res.status(400).json({ error: 'Invalid Patient ID format' });
    }
    const patient = await findPatientByReference(patientRef);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) { next(err); }
});

// Scanner-facing exact lookup. Stage 4 will call this endpoint; defining it
// now makes scan success and failure audit events durable from the outset.
router.post('/scan', async (req, res, next) => {
  try {
    const patientRef = normalizePublicId(req.body?.patient_ref);
    if (!patientRef) {
      return res.status(400).json({ error: 'Invalid Patient ID format' });
    }
    const patient = await findPatientByReference(patientRef);
    await writeEvent(req, 'wristband.scan', {
      target_kind: 'patient',
      target_id: patientRef,
      detail: { found: Boolean(patient) },
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) { next(err); }
});

// Only fields approved for the paper wristband are returned. Contact details,
// address, notes, medications and medical history are deliberately excluded.
router.get('/patients/:id', async (req, res, next) => {
  try {
    const patientId = parseRowId(req.params.id);
    if (!patientId) return res.status(400).json({ error: 'Invalid patient record ID' });
    const payload = await wristbandPayload(patientId);
    if (!payload) return res.status(404).json({ error: 'Patient not found' });
    res.json(payload);
  } catch (err) { next(err); }
});

// format=code128 is the primary linear barcode; format=qr is a compact backup.
// Both encode exactly and only the immutable public Patient ID.
router.get('/patients/:id/barcode/:format', async (req, res, next) => {
  try {
    const patientId = parseRowId(req.params.id);
    if (!patientId) return res.status(400).json({ error: 'Invalid patient record ID' });
    if (!['code128', 'qr'].includes(req.params.format)) {
      return res.status(400).json({ error: 'Barcode format must be code128 or qr' });
    }
    const patient = await db.get(
      'SELECT patient_ref FROM patients WHERE id = ?',
      [patientId]
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const options = req.params.format === 'code128'
      ? {
          bcid: 'code128', text: patient.patient_ref,
          scale: 3, height: 14, includetext: false,
          paddingwidth: 4, paddingheight: 2,
        }
      : {
          bcid: 'qrcode', text: patient.patient_ref,
          scale: 5, eclevel: 'M', includetext: false,
          paddingwidth: 2, paddingheight: 2,
        };
    const svg = bwipjs.toSVG(options);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(svg);
  } catch (err) { next(err); }
});

// The browser cannot confirm physical printer completion, so this endpoint
// records a print request. First request and reprints are distinguished
// atomically and accompanied by a strict audit_log insert.
router.post('/patients/:id/print-requests', async (req, res, next) => {
  try {
    const patientId = parseRowId(req.params.id);
    if (!patientId) return res.status(400).json({ error: 'Invalid patient record ID' });

    const result = await db.transaction(async () => {
      const patient = await db.get(
        'SELECT patient_ref FROM patients WHERE id = ?',
        [patientId]
      );
      if (!patient) {
        throw Object.assign(new Error('Patient not found'), { status: 404 });
      }

      const existing = await db.get(
        'SELECT print_count FROM patient_wristbands WHERE patient_id = ?',
        [patientId]
      );
      const action = existing ? 'wristband.reprint' : 'wristband.print';
      const printCount = (existing?.print_count || 0) + 1;

      if (existing) {
        await db.run(
          `UPDATE patient_wristbands
              SET print_count = ?,
                  last_print_requested_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                  last_requested_by = ?
            WHERE patient_id = ?`,
          [printCount, req.session.userUsername, patientId]
        );
      } else {
        await db.run(
          `INSERT INTO patient_wristbands
             (patient_id, print_count, first_print_requested_at,
              last_print_requested_at, last_requested_by)
           VALUES (?, 1,
                   strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                   strftime('%Y-%m-%dT%H:%M:%SZ','now'), ?)`,
          [patientId, req.session.userUsername]
        );
      }

      await writeEvent(req, action, {
        target_kind: 'patient',
        target_id: patient.patient_ref,
        detail: { patient_id: patientId, print_count: printCount, physical_completion: 'unknown' },
      });
      return { action, print_count: printCount, patient_ref: patient.patient_ref };
    });

    res.status(201).json({ ok: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.normalizePublicId = normalizePublicId;
