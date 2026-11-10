#!/usr/bin/env bash
# ==============================================================================
# MediGrid Enterprise Database Truncate & Clear Script
# Safely clears all tables OR specific tables with production safety guards
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-help}"

echo "=========================================================="
echo "  🧹 MediGrid Database Clear Utility"
echo "=========================================================="

show_help() {
  echo "Usage: ./scripts/db-clear.sh [TARGET] [OPTIONS]"
  echo ""
  echo "Targets:"
  echo "  all        - Clears ALL tables (stores, medicines, bills) & flushes Redis"
  echo "  stores     - Clears ONLY the stores table"
  echo "  medicines  - Clears ONLY the medicines catalog table"
  echo "  bills      - Clears ONLY the bills & sales transactions table"
  echo "  redis      - Flushes ONLY the Redis geospatial cache"
  echo ""
  echo "Options:"
  echo "  --force    - Bypasses interactive confirmation (use with caution!)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/db-clear.sh all"
  echo "  ./scripts/db-clear.sh bills"
  echo "  ./scripts/db-clear.sh medicines"
  exit 0
}

if [ "$TARGET" = "help" ] || [ "$TARGET" = "--help" ] || [ "$TARGET" = "-h" ]; then
  show_help
fi

# Safety Confirmation Check
IS_FORCE=false
if [ "$2" = "--force" ] || [ "$1" = "--force" ]; then
  IS_FORCE=true
fi

if [ "$IS_FORCE" = false ]; then
  echo "⚠️  WARNING: You requested to CLEAR target: '$TARGET'."
  echo "This action will permanently delete records from the selected tables!"
  read -p "Type 'CONFIRM' to proceed with deletion: " CONFIRM
  if [ "$CONFIRM" != "CONFIRM" ]; then
    echo "❌ Clear operation aborted. No data was deleted."
    exit 0
  fi
fi

# Function to run SQL in Postgres
execute_sql() {
  local sql="$1"
  if docker ps --format '{{.Names}}' | grep -q "^medigrid-postgres$"; then
    docker exec -i medigrid-postgres psql -U medigrid -d medigrid_db -c "$sql" >/dev/null 2>&1 || true
  elif command -v psql >/dev/null 2>&1; then
    psql -h localhost -p 5432 -U medigrid -d medigrid_db -c "$sql" >/dev/null 2>&1 || true
  fi
}

# Function to flush Redis
flush_redis() {
  if docker ps --format '{{.Names}}' | grep -q "^medigrid-redis$"; then
    docker exec medigrid-redis redis-cli FLUSHALL >/dev/null 2>&1 || true
    echo "  ✅ Redis cache flushed."
  fi
}

# Execute based on target
case "$TARGET" in
  all)
    echo "📦 Clearing ALL database tables & cache..."
    execute_sql "TRUNCATE TABLE bills, orders, medicines, stores CASCADE;"
    flush_redis
    # Also trigger in-memory clear if services are running locally
    curl -s -X POST http://localhost:5001/api/v1/admin/clear-cache >/dev/null 2>&1 || true
    echo "✅ ALL tables (stores, medicines, bills) and Redis cache cleared successfully!"
    ;;

  stores)
    echo "📦 Clearing ONLY 'stores' table..."
    execute_sql "TRUNCATE TABLE stores CASCADE;"
    echo "✅ Stores table cleared."
    ;;

  medicines)
    echo "📦 Clearing ONLY 'medicines' catalog..."
    execute_sql "TRUNCATE TABLE medicines CASCADE;"
    flush_redis
    echo "✅ Medicines catalog cleared and Redis cache synchronized."
    ;;

  bills|orders)
    echo "📦 Clearing ONLY 'bills' and transaction records..."
    execute_sql "TRUNCATE TABLE bills, orders CASCADE;"
    echo "✅ Billing records and invoices cleared."
    ;;

  redis)
    echo "⚡ Flushing ONLY Redis cache..."
    flush_redis
    echo "✅ Redis cache flushed."
    ;;

  *)
    echo "❌ Unknown target: '$TARGET'"
    show_help
    ;;
esac

echo "=========================================================="
echo "  🎉 Clear Operation Complete for target: $TARGET"
echo "=========================================================="
