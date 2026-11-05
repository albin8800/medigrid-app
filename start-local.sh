#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  🚀 Starting MediGrid Full-Stack Enterprise System"
echo "=========================================================="

# 1. Start Dockerized Postgres & Redis
echo "📦 Step 1: Launching PostgreSQL & Redis containers..."
docker compose up -d

# 2. Start pharmacy-service (Port 5001)
echo "⚡ Step 2: Starting Catalog & Inventory Service (:5001)..."
(cd services/pharmacy-service && PORT=5001 npm start) &
PID_PHARMACY=$!

# 3. Start order-service (Port 5002)
echo "⚡ Step 3: Starting In-Store POS & Billing Service (:5002)..."
(cd services/order-service && PORT=5002 npm start) &
PID_ORDER=$!

# 4. Start Next.js frontend (Port 3000)
echo "⚡ Step 4: Starting Next.js 14 Web Portal (:3000)..."
(cd frontend && npm run dev) &
PID_FRONTEND=$!

cleanup() {
    echo ""
    echo "🛑 Shutting down MediGrid services..."
    kill $PID_PHARMACY 2>/dev/null || true
    kill $PID_ORDER 2>/dev/null || true
    kill $PID_FRONTEND 2>/dev/null || true
    wait $PID_PHARMACY 2>/dev/null || true
    wait $PID_ORDER 2>/dev/null || true
    wait $PID_FRONTEND 2>/dev/null || true
    echo "✅ All application processes stopped."
    echo "💡 Note: PostgreSQL & Redis containers remain running in Docker."
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "=========================================================="
echo "  🎉 MediGrid is LIVE and Running!"
echo "=========================================================="
echo "  🌐 Web App:         http://localhost:3000"
echo "  📦 Catalog Service: http://localhost:5001/healthz"
echo "  🧾 Billing Service: http://localhost:5002/healthz"
echo "  🗄️  PostgreSQL DB:   localhost:5432 (User: medigrid)"
echo "  ⚡ Redis Cache:     localhost:6379"
echo "=========================================================="
echo "  Press Ctrl+C at any time to stop the application."
echo "=========================================================="
echo ""

wait
