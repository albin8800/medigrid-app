#!/usr/bin/env bash
# ==============================================================================
# MediGrid Enterprise Database Backup Script (Disaster Recovery)
# Creates a timestamped, gzip-compressed snapshot of PostgreSQL & Redis
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/medigrid_backup_${TIMESTAMP}.sql.gz"
REDIS_BACKUP_FILE="$BACKUP_DIR/medigrid_redis_${TIMESTAMP}.rdb"

mkdir -p "$BACKUP_DIR"

echo "=========================================================="
echo "  💾 MediGrid Production Database Backup"
echo "  Timestamp: $TIMESTAMP"
echo "=========================================================="

# Check if PostgreSQL container is running
if docker ps --format '{{.Names}}' | grep -q "^medigrid-postgres$"; then
  echo "📦 Step 1: Exporting PostgreSQL snapshot via Docker..."
  docker exec -t medigrid-postgres pg_dump -U medigrid -d medigrid_db --clean --if-exists | gzip > "$BACKUP_FILE"
  FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ PostgreSQL backup created: $BACKUP_FILE ($FILESIZE)"
else
  echo "⚠️ Warning: medigrid-postgres container is not running. Checking local pg_dump..."
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump -h localhost -p 5432 -U medigrid -d medigrid_db --clean --if-exists | gzip > "$BACKUP_FILE"
    echo "✅ Local PostgreSQL backup created: $BACKUP_FILE"
  else
    echo "❌ Error: Could not connect to PostgreSQL to take backup."
    exit 1
  fi
fi

# Optional Redis Snapshot
if docker ps --format '{{.Names}}' | grep -q "^medigrid-redis$"; then
  echo "📦 Step 2: Triggering Redis background save..."
  docker exec medigrid-redis redis-cli BGSAVE >/dev/null 2>&1 || true
  docker cp medigrid-redis:/data/dump.rdb "$REDIS_BACKUP_FILE" 2>/dev/null || true
  if [ -f "$REDIS_BACKUP_FILE" ]; then
    echo "✅ Redis snapshot saved: $REDIS_BACKUP_FILE"
  fi
fi

echo "=========================================================="
echo "  🎉 Backup Completed Successfully!"
echo "  File: $BACKUP_FILE"
echo "=========================================================="
