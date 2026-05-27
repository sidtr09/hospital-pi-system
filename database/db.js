/**
 * Core Database Interface Layer — node:sqlite (built-in, no compilation needed)
 * Synchronous API identical in shape to better-sqlite3 — zero external dependency.
 */

'use strict';

const { DatabaseSync } = require('node:sqlite');
const path     = require('path');
const fs       = require('fs');
const appConfig = require('../config/app.config');

let _db = null;

function applyPragmas(db, pragmas) {
  for (const [key, value] of Object.entries(pragmas)) {
    db.exec(`PRAGMA ${key} = ${value};`);
  }
}

function loadSchema(db) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn('[DB] schema.sql not found — skipping schema initialization');
    return;
  }
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  console.log('[DB] Schema applied successfully');
}

const db = {
  isOpen() {
    return _db !== null;
  },

  async initialize() {
    if (_db) return _db;

    const dir = path.dirname(appConfig.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new DatabaseSync(appConfig.dbPath);

    applyPragmas(_db, appConfig.dbPragmas);
    loadSchema(_db);

    process.on('exit', () => { try { _db?.close(); } catch {} });
    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));

    console.log(`[DB] Connected: ${appConfig.dbPath}`);
    return _db;
  },

  get instance() {
    if (!_db) throw new Error('[DB] Database not initialized. Call db.initialize() first.');
    return _db;
  },

  all(sql, params = []) {
    return this.instance.prepare(sql).all(...params);
  },

  get(sql, params = []) {
    return this.instance.prepare(sql).get(...params);
  },

  run(sql, params = []) {
    return this.instance.prepare(sql).run(...params);
  },

  transaction(fn) {
    this.instance.exec('BEGIN');
    try {
      const result = fn();
      this.instance.exec('COMMIT');
      return result;
    } catch (err) {
      this.instance.exec('ROLLBACK');
      throw err;
    }
  },
};

module.exports = db;
