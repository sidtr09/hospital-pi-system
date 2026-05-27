# [ Website Name ] — Modular Directory Map
> Generated from: Hospital_Pi_Website_Template.md  
> Target: Raspberry Pi 3B+ | LAN-Only | Express.js + SQLite

```
hospital-pi-system/
│
├── server.js                            ← [ Backend Web Framework Configuration File ]
│                                          Entry point. Registers all middleware,
│                                          mounts route modules, starts HTTP listener.
│
├── package.json                         ← Dependency manifest (Pi-optimized, no build step)
│
├── config/
│   └── app.config.js                    ← Centralized environment configuration
│                                          (port, DB path, session, rate limits,
│                                           SQLite pragmas)
│
├── database/
│   ├── db.js                            ← Core Database Interface Layer
│   │                                      better-sqlite3 wrapper with initialize(),
│   │                                      all(), get(), run(), transaction()
│   ├── schema.sql                       ← SQLite schema — all four primary modules
│   │                                      (WAL mode, FTS5 for doc search, indexes)
│   └── hospital.db                      ← [GENERATED AT RUNTIME] SQLite data file
│
├── routes/
│   ├── patient.routes.js                ← [ Patient Data API Engine ]
│   │                                      GET  /api/patients          → [ Patient Search View ]
│   │                                      POST /api/patients          → [ Patient Registration Form ]
│   │                                      GET  /api/patients/:id      → full record
│   │                                      PUT  /api/patients/:id      → update record
│   │                                      GET  /api/patients/:id/notes → [ Clinical Notes Timeline ]
│   │                                      POST /api/patients/:id/notes → add note
│   │
│   ├── inventory.routes.js              ← [ Inventory Tracking API Engine ]
│   │                                      GET  /api/inventory                     → [ Stock Ledger View ]
│   │                                      GET  /api/inventory/alerts/low-stock    → [ Low Inventory Alert Dashboard ]
│   │                                      GET  /api/inventory/alerts/expiring     → expiry window alerts
│   │                                      POST /api/inventory                     → add item
│   │                                      POST /api/inventory/:id/transactions    → dispense / restock
│   │                                      GET  /api/inventory/:id/transactions    → item ledger
│   │
│   └── queue.routes.js                  ← [ Clinical Queue & Scheduling Module ]
│                                          GET   /api/queue            → [ Triage Priority Queue ]
│                                          POST  /api/queue            → enqueue patient
│                                          PATCH /api/queue/:id        → update status / assign
│                                          GET   /api/queue/roster     → [ Staff Duty Roster ]
│                                          POST  /api/queue/roster     → add roster entry
│
├── middleware/
│   └── session.middleware.js            ← Lightweight session + requireAuth guard
│                                          + per-IP rate limiter (Pi CPU protection)
│
├── public/                              ← [ Static Asset Root ] (served with LAN Cache-Control)
│   ├── index.html                       ← [ Navigation Bar Component ] shell — SPA entry
│   ├── css/
│   │   └── [ Global Stylesheet ]        ← Asset-light CSS grid layout
│   ├── js/
│   │   └── [ App Bootstrap Script ]     ← Module router + Service Worker registration
│   ├── assets/
│   │   └── [ Icons / Images ]
│   └── modules/                         ← Frontend view layer (fetches via API only)
│       ├── patient/
│       │   ├── [ Patient Search View ].html
│       │   ├── [ Patient Registration Form ].html
│       │   └── [ Clinical Notes Timeline ].html
│       ├── inventory/
│       │   ├── [ Stock Ledger View ].html
│       │   └── [ Low Inventory Alert Dashboard ].html
│       ├── queue/
│       │   ├── [ Triage Priority Queue ].html
│       │   └── [ Staff Duty Roster ].html
│       └── docs/
│           ├── [ Document Library Browser ].html
│           └── [ Interactive Calculator Interface ].html
│
├── backup/
│   └── backup.sh                        ← Daily SQLite hot-backup cron script
│                                          (Step 4.3: 0 2 * * * /path/backup.sh)
│                                          Auto-prunes backups older than 7 days
│
└── logs/
    └── access.log                       ← [GENERATED AT RUNTIME] Rotating daily log
                                           (7-day retention — SD card safe)
```

---

## API Surface Summary

| Module | Method | Path | View / Function |
|---|---|---|---|
| [ Patient Data API Engine ] | GET | `/api/patients` | [ Patient Search View ] |
| [ Patient Data API Engine ] | POST | `/api/patients` | [ Patient Registration Form ] |
| [ Patient Data API Engine ] | GET/PUT | `/api/patients/:id` | Record detail / update |
| [ Patient Data API Engine ] | GET/POST | `/api/patients/:id/notes` | [ Clinical Notes Timeline ] |
| [ Inventory Tracking API Engine ] | GET | `/api/inventory` | [ Stock Ledger View ] |
| [ Inventory Tracking API Engine ] | GET | `/api/inventory/alerts/low-stock` | [ Low Inventory Alert Dashboard ] |
| [ Inventory Tracking API Engine ] | GET | `/api/inventory/alerts/expiring` | Expiry window alert |
| [ Inventory Tracking API Engine ] | POST | `/api/inventory/:id/transactions` | Dispense / Restock |
| [ Clinical Queue & Scheduling Module ] | GET | `/api/queue` | [ Triage Priority Queue ] |
| [ Clinical Queue & Scheduling Module ] | GET | `/api/queue/roster` | [ Staff Duty Roster ] |
| Health Check | GET | `/api/health` | Pi CPU / memory / DB status |

---

## Pi Deployment Notes (Part 1 — Step 1.3)

```bash
# Install Node.js 18 LTS on Raspberry Pi OS Lite
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install native build tools for better-sqlite3
sudo apt-get install -y build-essential python3

# Install dependencies and start
cd hospital-pi-system
npm install
npm start

# Add backup cron (Step 4.3)
crontab -e
# Add: 0 2 * * * /bin/bash /home/pi/hospital-pi-system/backup/backup.sh
```
