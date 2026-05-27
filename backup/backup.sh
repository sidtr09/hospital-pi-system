#!/usr/bin/env bash
# [ Website Name ] — SQLite Backup Script
# Cron schedule (Step 4.3): daily at 02:00 AM
#   0 2 * * * /bin/bash /path/to/hospital-pi-system/backup/backup.sh >> /path/to/hospital-pi-system/logs/backup.log 2>&1
#
# Uses the SQLite .backup command (hot backup — safe while server is running).

set -euo pipefail

DB_PATH="${DB_PATH:-$(dirname "$0")/../database/hospital.db}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEST="${BACKUP_DIR}/hospital_backup_${TIMESTAMP}.db"
KEEP_DAYS="${KEEP_DAYS:-7}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting backup: ${DB_PATH} → ${DEST}"

sqlite3 "${DB_PATH}" ".backup '${DEST}'"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup complete. Size: $(du -sh "${DEST}" | cut -f1)"

# Prune backups older than KEEP_DAYS to preserve SD card space
find "${BACKUP_DIR}" -maxdepth 1 -name "hospital_backup_*.db" -mtime "+${KEEP_DAYS}" -delete
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Old backups pruned (>${KEEP_DAYS} days)"
