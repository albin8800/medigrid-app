# MediGrid — Multi-Tenant Pharmacy Aggregator & In-Store POS Platform

[![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)](https://github.com/albin8800/medigrid-app/releases/tag/v1.0.0)
[![Tests](https://img.shields.io/badge/tests-186%20passed-success.svg)](https://github.com/albin8800/medigrid-app)
[![Node](https://img.shields.io/badge/node->=20.0.0-green.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org)

MediGrid is an enterprise-grade **In-Store Pharmacy Inventory Management & Point-of-Sale (POS) Counter Billing System** paired with a **Real-Time Consumer Medicine Availability Discovery Portal**.

---

## 1. System Architecture

MediGrid is built on a decoupled, microservices architecture designed for multi-tenant scalability and low-latency response times.

```
                               ┌──────────────────────────────────────────────┐
                               │           API GATEWAY / K8S INGRESS          │
                               └──────┬────────────────────────────────┬──────┘
                                      │                                │
                     /api/v1/medicines/*, /public/*           /api/v1/bills/*, /orders/*
                                      │                                │
                                      ▼                                ▼
                       ┌──────────────────────────────┐ ┌──────────────────────────────┐
                       │       pharmacy-service       │ │        order-service         │
                       │         (Port 5001)          │ │         (Port 5002)          │
                       │  (Inventory & Public Search) │ │   (In-Store POS & Invoicing) │
                       └──────────────┬───────────────┘ └──────────────┬───────────────┘
                                      │                                │
                                      │ ◀── Atomic Stock Deduction ────┤
                                      ▼                                ▼
                              ┌─────────────┐                  ┌─────────────┐
                              │    Redis    │                  │ PostgreSQL  │
                              │ (Fast Cache)│                  │(Persistence)│
                              └─────────────┘                  └─────────────┘
```

---

## 2. Core Microservices & Portals

### A. Microservices Backend
* **`pharmacy-service` (Port 5001)**:
  - Pharmacy tenant onboarding and profile management.
  - Medicine catalog batch tracking (batch numbers, expiry dates, rack locations, unit prices).
  - Geolocation proximity search (Haversine formula sorted by distance).
  - Shared PostgreSQL persistence with Redis distributed caching.
  - Prometheus `/metrics` telemetry endpoint.
* **`order-service` (Port 5002)**:
  - In-store POS cash register billing engine.
  - Atomic inventory decrementing on bill completion.
  - Dynamic 5% GST tax calculation and discount adjustments.
  - Real-time platform-wide sales volume and revenue aggregation.
  - Prometheus `/metrics` telemetry endpoint.

### B. User Portals (Next.js 14 Frontend - Port 3000)
1. **Consumer Medicine Discovery (`/`)**: Real-time medication search showing nearest pharmacies, stock counts, distance, and contact details.
2. **Store Staff POS Register (`/store/pos`)**: High-speed counter sales slip, instant barcode/name quick-picker, automated GST calculation, and atomic stock decrementing.
3. **Store Inventory Dashboard (`/store/inventory`)**: Manage stock levels, add new batches, adjust quantities, and monitor low-stock thresholds.
4. **Platform Super Admin (`/admin/dashboard` & `/admin/stores`)**: Multi-tenant store onboarding, verification, and live financial revenue analytics.

---

## 3. Test-Driven Development (TDD) Verification

The application enforces 100% test automation with zero mock leaks:

```bash
# Run tests in pharmacy-service (102 tests)
cd services/pharmacy-service && npm test

# Run tests in order-service (84 tests)
cd services/order-service && npm test
```

```
Test Suites: 16 passed, 16 total
Tests:       186 passed, 186 total
Snapshots:   0 total
Time:        ~7.4s
```

---

## 4. Local Development Quickstart

### Prerequisites
- Node.js >= 20.x
- Docker & Docker Compose

### Running Locally
```bash
# 1. Clone the repository
git clone https://github.com/albin8800/medigrid-app.git
cd medigrid-app

# 2. Start PostgreSQL and Redis
docker compose up -d postgres redis

# 3. Start pharmacy-service
cd services/pharmacy-service && npm install && npm run dev &

# 4. Start order-service
cd services/order-service && npm install && npm run dev &

# 5. Start Next.js frontend
cd frontend && npm install && npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Deployment & Release

* **Release Tag**: `v1.0.0`
* **Docker Registry**: Amazon ECR (`medigrid/frontend:v4`, `medigrid/pharmacy-service:v3`, `medigrid/order-service:v2`)
* **Infrastructure**: Kubernetes manifests and Terraform definitions are managed in [**`medigrid-infra`**](https://github.com/albin8800/medigrid-infra).
