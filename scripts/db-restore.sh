#!/usr/bin/env bash
# ==============================================================================
# MediGrid Enterprise Database Restore Script (Disaster Recovery)
# Restores PostgreSQL database state from a compressed snapshot (.sql.gz)
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DIR/backups"

echo "=========================================================="
echo "  🔄 MediGrid Production Database Restore"
echo "=========================================================="

# If an explicit backup file path was provided as an argument
if [ -n "$1" ]; then
  TARGET_FILE="$1"
else
  # List available backups and pick the newest one by default
  BACKUPS=($(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null || true))
  if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo "❌ Error: No backup files found in $BACKUP_DIR."
    echo "💡 Run './scripts/db-backup.sh' first to create a backup."
    exit 1
  fi

  echo "Available backup snapshots:"
  for i in "${!BACKUPS[@]}"; do
    FILENAME=$(basename "${BACKUPS[$i]}")
    FILESIZE=$(du -h "${BACKUPS[$i]}" | cut -f1)
    echo "  [$i] $FILENAME ($FILESIZE)"
  done

  echo ""
  read -p "Select a backup index to restore [default: 0 (newest)]: " CHOICE
  CHOICE=${CHOICE:-0}
  TARGET_FILE="${BACKUPS[$CHOICE]}"
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "❌ Error: Selected backup file does not exist: $TARGET_FILE"
  exit 1
fi

echo ""
echo "⚠️  WARNING: Restoring will overwrite existing data with the snapshot state."
echo "Selected snapshot: $(basename "$TARGET_FILE")"
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore aborted."
  exit 0
fi

# Execute restore via Docker or psql
if docker ps --format '{{.Names}}' | grep -q "^medigrid-postgres$"; then
  echo "📦 Restoring database via Docker container..."
  gunzip -c "$TARGET_FILE" | docker exec -i medigrid-postgres psql -U medigrid -d medigrid_db
  echo "✅ Database restored successfully from $(basename "$TARGET_FILE")!"
else
  if command -v psql >/dev/null 2>&1; then
    gunzip -c "$TARGET_FILE" | psql -h localhost -p 5432 -U medigrid -d medigrid_db
    echo "✅ Database restored successfully from $(basename "$TARGET_FILE")!"
  else
    echo "❌ Error: Could not connect to PostgreSQL to perform restore."
    exit 1
  fi
fi

echo "=========================================================="
echo "  🎉 Disaster Recovery Restore Complete!"
echo "=========================================================="
