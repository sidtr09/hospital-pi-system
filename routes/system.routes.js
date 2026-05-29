/**
 * [ System Health Module ] — admin-only operational telemetry.
 * Surfaces SD-card pressure, attachment growth and per-table row counts so
 * the admin running this Pi can decide when to rotate to a fresh card.
 */

'use strict';

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const { execFile } = require('child_process');

const db        = require('../database/db');
const appConfig = require('../config/app.config');

const router = express.Router();

// Inlined to avoid coupling this module to auth.routes (circular risk).
function requireAdmin(req, res, next) {
  if (req.session?.userRole === 'Administrator') return next();
  res.status(403).json({ error: 'Administrator only' });
}
router.use(requireAdmin);

// ── Helpers ──────────────────────────────────────────────────────────────

// Recursive directory size. Soft-fails on permission errors so the endpoint
// never 500s just because one file is locked.
async function dirSize(dir) {
  let total = 0;
  let files = 0;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          const sub = await dirSize(p);
          total += sub.bytes;
          files += sub.files;
        } else if (e.isFile()) {
          const s = await fs.promises.stat(p);
          total += s.size;
          files += 1;
        }
      } catch { /* unreadable entry — ignore */ }
    }
  } catch { /* missing dir — return zero */ }
  return { bytes: total, files };
}

// Disk free/total via `df -k -P` — portable across macOS and Linux (Pi).
// `fs.statfs` only landed in Node 19, so we shell out to keep Node 18 support.
function diskFor(targetPath) {
  return new Promise((resolve) => {
    execFile('df', ['-k', '-P', targetPath], (err, stdout) => {
      if (err) return resolve(null);
      const lines = String(stdout).trim().split('\n');
      if (lines.length < 2) return resolve(null);
      // Last line is the data row (some dfs wrap long filesystem names)
      const cols = lines[lines.length - 1].trim().split(/\s+/);
      // POSIX columns: Filesystem  1024-blocks  Used  Available  Capacity  Mounted
      const total = Number(cols[1]) * 1024;
      const used  = Number(cols[2]) * 1024;
      const free  = Number(cols[3]) * 1024;
      const mount = cols.slice(5).join(' ') || '/';
      if (!Number.isFinite(total) || !Number.isFinite(free)) return resolve(null);
      resolve({ total_bytes: total, used_bytes: used, free_bytes: free, mount });
    });
  });
}

async function fileSizeSafe(p) {
  try { return (await fs.promises.stat(p)).size; } catch { return 0; }
}

// ── GET /api/system/db-health ────────────────────────────────────────────
router.get('/db-health', async (_req, res, next) => {
  try {
    const dbPath = appConfig.dbPath;
    const dbDir  = path.dirname(dbPath);

    // SQLite WAL mode keeps -wal and -shm alongside the main db — they count
    // toward the disk pressure even though they're transient.
    const [dbBytes, walBytes, shmBytes] = await Promise.all([
      fileSizeSafe(dbPath),
      fileSizeSafe(dbPath + '-wal'),
      fileSizeSafe(dbPath + '-shm'),
    ]);

    // Folders that grow over time on a running Pi
    const projectRoot = path.join(__dirname, '..');
    const [attach, logs, disk] = await Promise.all([
      dirSize(path.join(projectRoot, 'data', 'attachments')),
      dirSize(path.join(projectRoot, 'logs')),
      diskFor(dbDir),
    ]);

    // Row counts per user table — skip SQLite's own bookkeeping tables.
    const tableRows = await db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name ASC`
    );
    const tables = [];
    for (const t of tableRows) {
      try {
        // Table names come from sqlite_master so they're trusted identifiers;
        // still wrap in quotes to be safe against any odd naming.
        const r = await db.get(`SELECT COUNT(*) AS n FROM "${t.name}"`);
        tables.push({ name: t.name, rows: r?.n ?? 0 });
      } catch {
        tables.push({ name: t.name, rows: null });
      }
    }

    res.json({
      generated_at: new Date().toISOString(),
      db: {
        path: dbPath,
        main_bytes: dbBytes,
        wal_bytes:  walBytes,
        shm_bytes:  shmBytes,
        total_bytes: dbBytes + walBytes + shmBytes,
      },
      attachments: { bytes: attach.bytes, files: attach.files },
      logs:        { bytes: logs.bytes,   files: logs.files },
      disk,
      tables,
    });
  } catch (err) { next(err); }
});

module.exports = router;
