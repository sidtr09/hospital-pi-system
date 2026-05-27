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

function loadSchema(db) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) return Promise.resolve();
  const sql = fs.readFileSync(schemaPath, 'utf8');
  return new Promise((res, rej) => db.exec(sql, err => err ? rej(err) : res()));
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
