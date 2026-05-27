/**
 * [ Inventory Tracking API Engine ] — Route Module
 * Serves: [ Stock Ledger View ] | [ Low Inventory Alert Dashboard ]
 */

'use strict';

const express   = require('express');
const db        = require('../database/db');
const { requireAuth, apiLimiter } = require('../middleware/session.middleware');

const router = express.Router();
router.use(apiLimiter);
router.use(requireAuth);

// ── [ Stock Ledger View ] — full inventory list ───────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { category, limit = 100, offset = 0 } = req.query;
    let sql = `SELECT * FROM inventory_items`;
    const params = [];

    if (category) {
      sql += ` WHERE category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY item_name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    res.json({ data: await db.all(sql, params) });
  } catch (err) { next(err); }
});

// ── [ Low Inventory Alert Dashboard ] ────────────────────────────────────────
router.get('/alerts/low-stock', async (req, res, next) => {
  try {
    const items = await db.all(
      `SELECT id, item_code, item_name, category, unit,
              quantity_on_hand, reorder_threshold, location, expiry_date
       FROM inventory_items
       WHERE quantity_on_hand <= reorder_threshold
       ORDER BY (reorder_threshold - quantity_on_hand) DESC`
    );
    res.json({ data: items, alert_count: items.length });
  } catch (err) { next(err); }
});

// GET /api/inventory/alerts/expiring?days=<n>
router.get('/alerts/expiring', async (req, res, next) => {
  try {
    const days = Math.max(1, parseInt(req.query.days || '30', 10));
    const items = await db.all(
      `SELECT * FROM inventory_items
       WHERE expiry_date IS NOT NULL
         AND expiry_date <= date('now', ? || ' days')
         AND expiry_date >= date('now')
       ORDER BY expiry_date ASC`,
      [`+${days}`]
    );
    res.json({ data: items, window_days: days });
  } catch (err) { next(err); }
});

// POST /api/inventory — add new item to [ Stock Ledger View ]
router.post('/', async (req, res, next) => {
  try {
    const { item_code, item_name, category, unit,
            quantity_on_hand, reorder_threshold, location, expiry_date } = req.body;

    if (!item_code || !item_name || !category || !unit) {
      return res.status(400).json({ error: '[ Required: item_code, item_name, category, unit ]' });
    }

    const result = await db.run(
      `INSERT INTO inventory_items
         (item_code, item_name, category, unit, quantity_on_hand, reorder_threshold, location, expiry_date)
       VALUES (?,?,?,?,?,?,?,?)`,
      [item_code, item_name, category, unit,
       quantity_on_hand ?? 0, reorder_threshold ?? 10, location, expiry_date]
    );
    res.status(201).json({ id: result.lastInsertRowid, item_code });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: '[ Item code already exists ]' });
    }
    next(err);
  }
});

// ── [ Stock Ledger View ] — record a transaction (dispense / restock) ─────────
router.post('/:id/transactions', async (req, res, next) => {
  try {
    const { txn_type, quantity_delta, performed_by, notes } = req.body;

    if (!txn_type || quantity_delta === undefined || !performed_by) {
      return res.status(400).json({ error: '[ Required: txn_type, quantity_delta, performed_by ]' });
    }

    const updated = await db.transaction(async () => {
      await db.run(
        `INSERT INTO inventory_transactions (item_id, txn_type, quantity_delta, performed_by, notes)
         VALUES (?,?,?,?,?)`,
        [req.params.id, txn_type, quantity_delta, performed_by, notes]
      );
      const result = await db.run(
        `UPDATE inventory_items
         SET quantity_on_hand = quantity_on_hand + ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?`,
        [quantity_delta, req.params.id]
      );
      if (result.changes === 0) throw Object.assign(new Error('[ Item Not Found ]'), { status: 404 });
      return db.get('SELECT quantity_on_hand FROM inventory_items WHERE id=?', [req.params.id]);
    });

    res.json({ recorded: true, quantity_on_hand: updated.quantity_on_hand });
  } catch (err) { next(err); }
});

// GET /api/inventory/:id/transactions — full ledger for one item
router.get('/:id/transactions', async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT * FROM inventory_transactions WHERE item_id=? ORDER BY created_at DESC LIMIT 200`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
