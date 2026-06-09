#!/usr/bin/env bash
# Restore a StablePay SQLite ledger from a gzipped backup.
# Usage: ./scripts/restore-db.sh BACKUP.db.gz [DB_PATH]

set -euo pipefail

BACKUP="${1:-}"
DB_PATH="${2:-./data/stablepay.db}"

if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  echo "Usage: $0 BACKUP.db.gz [DB_PATH]"; exit 1
fi

echo "Restoring $BACKUP -> $DB_PATH"
echo "WARNING: this REPLACES the current $DB_PATH and all WAL/SHM files."
read -r -p "Type 'restore' to continue: " confirm
if [ "$confirm" != "restore" ]; then
  echo "Aborted."; exit 1
fi

mkdir -p "$(dirname "$DB_PATH")"
gunzip -c "$BACKUP" > "$DB_PATH"
rm -f "$DB_PATH-wal" "$DB_PATH-shm"

# Smoke test
COUNT=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM transactions;')
echo "Restore complete. Transactions in restored DB: $COUNT"
