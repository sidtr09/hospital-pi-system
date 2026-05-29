-- [ Website Name ] — SQLite Schema
-- All tables use INTEGER PRIMARY KEY (rowid alias) for maximum B-tree efficiency.
-- Indexes are placed on every foreign key and high-frequency search column.

PRAGMA foreign_keys = ON;

-- ── [ Patient Intake & Records Module ] ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS patients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_ref     TEXT    NOT NULL UNIQUE,  -- Human-readable LAN reference code
    full_name       TEXT    NOT NULL,
    date_of_birth   TEXT    NOT NULL,         -- ISO-8601 YYYY-MM-DD
    sex             TEXT    CHECK(sex IN ('M','F','O')),
    contact_number  TEXT,
    address         TEXT,
    blood_group     TEXT,
    allergy_notes   TEXT,
    registered_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_patients_ref       ON patients(patient_ref);
CREATE INDEX IF NOT EXISTS idx_patients_name      ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_dob       ON patients(date_of_birth);

CREATE TABLE IF NOT EXISTS clinical_notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    authored_by     TEXT    NOT NULL,         -- Staff name or ID
    note_type       TEXT    NOT NULL CHECK(note_type IN ('admission','progress','discharge','procedure')),
    body            TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_patient      ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_notes_created      ON clinical_notes(created_at);

-- ── [ Inventory & Pharmacy Module ] ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code       TEXT    NOT NULL UNIQUE,
    item_name       TEXT    NOT NULL,
    category        TEXT    NOT NULL CHECK(category IN ('medicine','supply','equipment','consumable')),
    unit            TEXT    NOT NULL,         -- e.g. tablet, vial, box, unit
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 10,
    location        TEXT,                     -- Ward / shelf identifier
    expiry_date     TEXT,                     -- ISO-8601; NULL for non-expiring items
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_code     ON inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_low      ON inventory_items(quantity_on_hand);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    txn_type        TEXT    NOT NULL CHECK(txn_type IN ('restock','dispense','adjustment','expired')),
    quantity_delta  INTEGER NOT NULL,         -- Positive = add, Negative = consume
    performed_by    TEXT    NOT NULL,
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_txn_item       ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_created    ON inventory_transactions(created_at);

-- ── [ Clinical Queue & Scheduling Module ] ────────────────────────────────────

CREATE TABLE IF NOT EXISTS queue_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    triage_level    INTEGER NOT NULL CHECK(triage_level BETWEEN 1 AND 5),  -- 1=Immediate
    chief_complaint TEXT    NOT NULL,
    assigned_to     TEXT,                     -- Staff name or NULL if unassigned
    status          TEXT    NOT NULL DEFAULT 'waiting'
                        CHECK(status IN ('waiting','in_progress','completed','deferred')),
    queued_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    resolved_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_status       ON queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_queue_triage       ON queue_entries(triage_level, queued_at);

CREATE TABLE IF NOT EXISTS staff_roster (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_name      TEXT    NOT NULL,
    role            TEXT    NOT NULL,         -- doctor, nurse, technician, etc.
    shift_start     TEXT    NOT NULL,         -- ISO-8601 datetime
    shift_end       TEXT    NOT NULL,
    ward            TEXT,
    on_duty         INTEGER NOT NULL DEFAULT 1 CHECK(on_duty IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_roster_duty        ON staff_roster(on_duty);
CREATE INDEX IF NOT EXISTS idx_roster_shift       ON staff_roster(shift_start, shift_end);

-- ── [ Offline Documentation & Resource Module ] ───────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_code        TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    category        TEXT    NOT NULL,         -- guideline, SOP, reference, calculator
    body_markdown   TEXT    NOT NULL,
    version         TEXT    NOT NULL DEFAULT '1.0',
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_title    ON documents(title);

-- ── User Accounts (self-signup with admin approval) ──────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,         -- scrypt: "salt:hash" hex
    full_name       TEXT    NOT NULL,
    role            TEXT    NOT NULL CHECK(role IN ('Administrator','Doctor','Nurse')),
    status          TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','approved','rejected')),
    requested_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    decided_at      TEXT,
    decided_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users(status);

-- ── Staff Messages & Requests (team chatter) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username   TEXT    NOT NULL,
    from_name       TEXT    NOT NULL,
    from_role       TEXT,
    to_username     TEXT    NOT NULL,
    kind            TEXT    NOT NULL DEFAULT 'message'
                        CHECK(kind IN ('message','request')),
    body            TEXT    NOT NULL,
    is_read         INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_to_unread ON messages(to_username, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_from      ON messages(from_username);
CREATE INDEX IF NOT EXISTS idx_messages_created   ON messages(created_at);

-- ── Audit Log — every security-relevant event for accountability ───────────

CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actor_username  TEXT,                       -- NULL on failed-login before session
    actor_name      TEXT,
    actor_role      TEXT,
    action          TEXT NOT NULL,              -- login.ok|login.fail|patient.view|
                                                -- patient.create|patient.update|patient.delete|
                                                -- audit.export
    target_kind     TEXT,                       -- 'patient'|'user'|NULL
    target_id       TEXT,                       -- patient_ref / username / etc
    detail          TEXT,                       -- short JSON for changed fields
    ip              TEXT,
    user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_occurred ON audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log(actor_username);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(action);
