#!/usr/bin/env bash
# Backup the StablePay SQLite ledger.
# Usage: ./scripts/backup-db.sh [DB_PATH] [BACKUP_DIR]
#
# Uses the SQLite online backup API via the .backup command so the DB can stay
# open. Gzip-compressed, timestamped, and a daily rotation drops anything
# older than 30 days.

set -euo pipefail

DB_PATH="${1:-./data/stablepay.db}"
BACKUP_DIR="${2:-./data/backups}"

if [ ! -f "$DB_PATH" ]; then
  echo "DB not found at $DB_PATH"; exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/stablepay-$TS.db"

echo "Backing up $DB_PATH -> $OUT"
sqlite3 "$DB_PATH" ".backup '$OUT'"
gzip -9 "$OUT"
echo "Compressed: ${OUT}.gz"

# Rotate: drop files older than 30 days
find "$BACKUP_DIR" -name 'stablepay-*.db.gz' -mtime +30 -delete
echo "Rotation complete."
