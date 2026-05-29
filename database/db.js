'use strict';

const sqlite3   = require('sqlite3').verbose();
const path      = require('path');
const fs        = require('fs');
const appConfig = require('../config/app.config');

let _db = null;

const runAsync = (db, sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function (err) {
    err ? rej(err) : res({ changes: this.changes, lastInsertRowid: this.lastID });
  })
);
const allAsync = (db, sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows))
);
const getAsync = (db, sql, params = []) => new Promise((res, rej) =>
  db.get(sql, params, (err, row) => err ? rej(err) : res(row))
);

function applyPragmas(db, pragmas) {
  db.serialize(() => {
    for (const [key, value] of Object.entries(pragmas)) {
      db.run(`PRAGMA ${key} = ${value}`);
    }
  });
}

// Additive column migrations. SQLite doesn't support ADD COLUMN IF NOT EXISTS,
// so each is attempted individually and "duplicate column" errors swallowed.
const MIGRATIONS = [
  // Phase C: WHO triage form fields
  "ALTER TABLE queue_entries ADD COLUMN vitals_temp_f      REAL",
  "ALTER TABLE queue_entries ADD COLUMN vitals_hr_bpm      INTEGER",
  "ALTER TABLE queue_entries ADD COLUMN vitals_bp          TEXT",
  "ALTER TABLE queue_entries ADD COLUMN vitals_spo2_pct    INTEGER",
  "ALTER TABLE queue_entries ADD COLUMN vitals_rr          INTEGER",
  "ALTER TABLE queue_entries ADD COLUMN emergency_flags    TEXT",
  "ALTER TABLE queue_entries ADD COLUMN symptoms           TEXT",
  "ALTER TABLE queue_entries ADD COLUMN duration           TEXT",
  "ALTER TABLE queue_entries ADD COLUMN drug_allergies     TEXT",
  "ALTER TABLE queue_entries ADD COLUMN current_meds       TEXT",
  "ALTER TABLE queue_entries ADD COLUMN medical_history    TEXT",
  "ALTER TABLE queue_entries ADD COLUMN triage_color       TEXT",
  // Phase E: complete WHO triage form parity
  "ALTER TABLE patients       ADD COLUMN emergency_contact TEXT",
  "ALTER TABLE queue_entries  ADD COLUMN food_allergies    TEXT",
  "ALTER TABLE queue_entries  ADD COLUMN other_allergies   TEXT",
  // Phase F: message file attachments
  "ALTER TABLE messages       ADD COLUMN attachment_path   TEXT",
  "ALTER TABLE messages       ADD COLUMN attachment_name   TEXT",
  "ALTER TABLE messages       ADD COLUMN attachment_mime   TEXT",
  "ALTER TABLE messages       ADD COLUMN attachment_size   INTEGER",
];

function runOne(db, sql) {
  return new Promise((resolve) => {
    db.run(sql, (err) => {
      if (!err) return resolve();
      const m = String(err.message || '').toLowerCase();
      if (m.includes('duplicate column')) return resolve();
      console.warn('[DB] migration warn:', err.message);
      resolve();
    });
  });
}

async function loadSchema(db) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await new Promise((res, rej) => db.exec(sql, err => err ? rej(err) : res()));
  }
  for (const sql of MIGRATIONS) {
    await runOne(db, sql);
  }
}

const db = {
  isOpen() { return _db !== null; },

  async initialize() {
    if (_db) return _db;

    const dir = path.dirname(appConfig.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await new Promise((res, rej) => {
      _db = new sqlite3.Database(appConfig.dbPath, err => err ? rej(err) : res());
    });

    applyPragmas(_db, appConfig.dbPragmas);
    await loadSchema(_db);
    console.log('[DB] Schema applied successfully');

    process.on('exit',    () => { try { _db?.close(); } catch {} });
    process.on('SIGINT',  () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));

    console.log(`[DB] Connected: ${appConfig.dbPath}`);
    return _db;
  },

  all(sql, params = [])  { return allAsync(_db, sql, params); },
  get(sql, params = [])  { return getAsync(_db, sql, params); },
  run(sql, params = [])  { return runAsync(_db, sql, params); },

  async transaction(fn) {
    await runAsync(_db, 'BEGIN');
    try {
      const result = await fn();
      await runAsync(_db, 'COMMIT');
      return result;
    } catch (err) {
      await runAsync(_db, 'ROLLBACK');
      throw err;
    }
  },
};

module.exports = db;
