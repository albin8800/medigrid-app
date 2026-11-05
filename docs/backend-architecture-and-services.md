# MediGrid End-to-End Backend Architecture & Microservices Blueprint

## 1. Executive Summary & Architecture Overview

MediGrid is an enterprise B2B2C Pharmacy Aggregator connecting retail consumers, licensed independent pharmacies, and pharmaceutical distributors.

To ensure resilience, strict separation of concerns, and alignment with the **Enterprise Golden Path (Docker, Kubernetes, ArgoCD)**, the backend is built on a **Lean Microservices Architecture** consisting of two decoupled Node.js/Express services backed by dedicated datastores.

```
                              ┌──────────────────────────────────────────────┐
                              │           API GATEWAY / K8S INGRESS          │
                              └──────┬────────────────────────────────┬──────┘
                                     │                                │
                     /api/v1/pharmacies/*                     /api/v1/orders/*
                                     │                                │
                                     ▼                                ▼
                     ┌──────────────────────────────┐ ┌──────────────────────────────┐
                     │       pharmacy-service       │ │        order-service         │
                     │         (Port 5001)          │ │         (Port 5002)          │
                     └──────┬────────────────┬──────┘ └──────────────┬───────────────┘
                            │                │                       │
                            │ (Geo Index)    │ (Sync Stock Verification)
                            ▼                │                       │
                     ┌─────────────┐         └───────────────┐       │
                     │    Redis    │                         ▼       ▼
                     │ (Port 6379) │                   ┌─────────────┐
                     └─────────────┘                   │ PostgreSQL  │
                                                       │ (Port 5432) │
                                                       └─────────────┘
```

---

## 2. Microservice 1: `pharmacy-service` (Port 5001)

### 2.1 Role & Responsibilities
- Pharmacy onboarding & geolocation registry.
- Drug inventory catalog & real-time stock levels.
- Low-latency (<10ms) proximity searches within a customer's radius.

### 2.2 Data Store Connections
1. **Redis (Port 6379)**:
   - **Connection Client**: `ioredis`.
   - **Configuration**: `REDIS_URL=redis://localhost:6379` (local docker) or cluster DNS (`redis.medigrid.svc.cluster.local:6379`).
   - **Geospatial Commands**:
     - `GEOADD pharmacies:locations <longitude> <latitude> <pharmacyId>`
     - `GEOSEARCH pharmacies:locations FROMLONLAT <lng> <lat> BYRADIUS <radiusKm> KM WITHDIST WITHCOORD`
   - **Resilience Strategy**: If Redis is offline or during isolated unit tests, an in-memory **Haversine Formula** calculates distance seamlessly without crashing.
2. **PostgreSQL (Port 5432)**:
   - Stores persistent pharmacy metadata (License number, address, phone, verified status).

### 2.3 API Contract
| Method | Path | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/healthz` | Kubernetes Liveness Probe | None (`200 { status: "UP" }`) |
| `GET` | `/ready` | Kubernetes Readiness Probe | Verifies Redis ping (`200 Ready` or `503`) |
| `POST` | `/api/v1/pharmacies` | Register pharmacy + inventory | `{ name, address, lat, lng, inventory: [{ medicine, stock, price }] }` |
| `GET` | `/api/v1/pharmacies/nearby`| Proximity search | Query: `?lat=12.97&lng=77.59&radius=5&medicine=Amoxicillin` |
| `GET` | `/api/v1/pharmacies/:id` | Pharmacy profile & stock | Returns inventory for checkout validation |
| `PATCH`| `/api/v1/pharmacies/:id/stock`| Reserve/Deduct stock | `{ medicine: "Amoxicillin", quantity: 2, action: "DEDUCT" }` |

---

## 3. Microservice 2: `order-service` (Port 5002)

### 3.1 Role & Responsibilities
- Customer prescription checkout & order orchestration.
- ACID-compliant transaction processing to prevent duplicate drug reservations.
- State machine management (`PENDING` ➔ `RESERVED` ➔ `CONFIRMED` / `CANCELLED`).

### 3.2 Data Store Connections
1. **PostgreSQL (Port 5432)**:
   - **Connection Client**: `pg` (Connection Pooling with `Pool`).
   - **Configuration**: `DATABASE_URL=postgres://user:password@localhost:5432/medigrid_orders`.
   - **ACID Transaction Pattern**:
     ```javascript
     const client = await pool.connect();
     try {
       await client.query('BEGIN');
       // 1. Insert order record
       // 2. Lock inventory / state
       // 3. Commit
       await client.query('COMMIT');
     } catch (e) {
       await client.query('ROLLBACK');
       throw e;
     } finally {
       client.release();
     }
     ```
   - **Test Mocking Strategy**: In-memory repository pattern for fast local unit testing without running database containers.

### 3.3 API Contract
| Method | Path | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/healthz` | Kubernetes Liveness Probe | None (`200 { status: "UP" }`) |
| `GET` | `/ready` | Kubernetes Readiness Probe | Checks PostgreSQL pool connection |
| `POST` | `/api/v1/orders` | Place a medication order | `{ customerId, pharmacyId, items: [{ medicine, quantity }], deliveryAddress }` |
| `GET` | `/api/v1/orders/:id` | Fetch order details & status | None |
| `PATCH`| `/api/v1/orders/:id/cancel`| Cancel order & release stock| Reason for cancellation |

---

## 4. End-to-End Business Flow: Prescription Order & Fulfillment

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Frontend as Next.js Web App
    participant PharmacySvc as pharmacy-service (:5001)
    participant Redis as Redis Cache
    participant OrderSvc as order-service (:5002)
    participant Postgres as PostgreSQL DB

    Note over Customer, Redis: 1. Pharmacy Discovery & Proximity Search
    Customer->>Frontend: Enter location & Medicine ("Amoxicillin")
    Frontend->>PharmacySvc: GET /api/v1/pharmacies/nearby?lat=...&lng=...&medicine=Amoxicillin
    PharmacySvc->>Redis: GEOSEARCH (Radius 5km)
    Redis-->>PharmacySvc: Sorted list of nearby pharmacy IDs & distance
    PharmacySvc-->>Frontend: Return available pharmacies & stock counts
    Frontend-->>Customer: Display map with nearby pharmacies & prices

    Note over Customer, Postgres: 2. Order Placement & Transactional Reservation
    Customer->>Frontend: Select Pharmacy & Click "Order Now"
    Frontend->>OrderSvc: POST /api/v1/orders { customerId, pharmacyId, items }
    OrderSvc->>OrderSvc: Create order with status = "PENDING"
    
    Note over OrderSvc, PharmacySvc: 3. Inter-Service Inventory Verification
    OrderSvc->>PharmacySvc: PATCH /api/v1/pharmacies/:id/stock (Deduct Stock)
    alt Stock Available
        PharmacySvc-->>OrderSvc: HTTP 200 { success: true }
        OrderSvc->>Postgres: BEGIN Transaction -> Status = "CONFIRMED" -> COMMIT
        OrderSvc-->>Frontend: HTTP 201 { orderId, status: "CONFIRMED" }
        Frontend-->>Customer: "Order Placed Successfully! Delivery in 30 mins."
    else Stock Depleted / Insufficient
        PharmacySvc-->>OrderSvc: HTTP 409 { error: "Insufficient stock" }
        OrderSvc->>Postgres: Status = "CANCELLED"
        OrderSvc-->>Frontend: HTTP 409 { error: "Medicine out of stock at this pharmacy" }
        Frontend-->>Customer: "Item sold out. Showing alternative nearby pharmacies."
    end
```

---

## 5. Local Database Execution Strategy (DevOps Transition)

In **Phase 2 (DevSecOps Containerization)**, we spin up local databases via Docker Compose rather than installing them on the host operating system:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: medigrid
      POSTGRES_PASSWORD: medigrid_password
      POSTGRES_DB: medigrid_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Environment Variables Matrix
| Variable | `pharmacy-service` | `order-service` | Default (Local Test) | Production (K8s / AWS) |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | `5001` | `5002` | Service default | Configured via K8s Service |
| `REDIS_URL` | Required | Optional | `redis://localhost:6379` | AWS ElastiCache / Redis Pod |
| `DATABASE_URL`| Optional | Required | In-memory mock | AWS RDS PostgreSQL / Postgres Pod |
| `PHARMACY_SERVICE_URL` | N/A | Required | `http://localhost:5001` | `http://pharmacy-service:5001` (K8s DNS) |

---

## 6. Testing Hierarchy (TDD Mandate)

```text
Level 1: Pure Unit Tests (Jest)
         - No network calls, no real databases.
         - Runs in < 1 second.
         - Tests business rules, Haversine formulas, order state transitions.

Level 2: API Integration Tests (Supertest)
         - Tests Express router, input validation, HTTP status codes, error middleware.
         - Runs against in-memory stubs or local Docker test DBs.

Level 3: End-to-End Tests (Playwright / Cypress)
         - Runs against running containers (Frontend + Services + Redis + Postgres).
         - Simulates customer searching for drugs and completing checkout.
```
