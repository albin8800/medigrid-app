# ADR 0001: MediGrid Lean Microservices Architecture & Stack

## Status
Accepted

## Context
MediGrid is an enterprise B2B2C Pharmacy Aggregator platform connecting retail consumers, independent pharmacies, and pharmaceutical distributors.

To master enterprise cloud and DevOps principles (independent CI/CD matrix builds, Kubernetes inter-service networking, Ingress path routing, and ArgoCD GitOps reconciliation), the system is architected as a **Lean Microservices Architecture**.

## Architecture & Service Boundaries

### 1. Repository Structure (Two-Repo Enterprise Model)
- `medigrid-app`: Microservices source code, frontend, multi-stage Dockerfiles, and test suites.
- `medigrid-infra`: Terraform AWS IaC, Kubernetes Helm/Kustomize manifests, ArgoCD GitOps, and Prometheus/Grafana configs.

### 2. Core Services
```
                                  ┌───► [ pharmacy-service:5001 ] ───► Redis (Geo) & PostgreSQL
[ Next.js Frontend ] ──(Ingress)──┤
                                  └───► [ order-service:5002 ]    ───► PostgreSQL (ACID)
```

- **`frontend` (Next.js 14 + Tailwind CSS)**:
  - Consumer drug search & pharmacy portal.
- **`services/pharmacy-service` (Node.js/Express, Port 5001)**:
  - Pharmacy management, drug catalog, inventory levels.
  - **Redis Geospatial Indexing** (`GEOADD`, `GEOSEARCH`) for low-latency pharmacy proximity lookups (< 5km radius).
- **`services/order-service` (Node.js/Express, Port 5002)**:
  - Prescription orders, checkout, reservation state machine.
  - **PostgreSQL ACID transactions** preventing overselling of critical pharmaceuticals.
  - Inter-service communication with `pharmacy-service` for inventory verification.

### 3. Golden Path DevOps Standards
- **Containerization**: Separate, optimized multi-stage Dockerfile per service with non-root security contexts.
- **CI Pipelines**: GitHub Actions workflow running matrix tests and building images only for modified services.
- **Kubernetes Networking**: Separate ClusterIP services, ConfigMaps, and an NGINX Ingress routing `/api/v1/pharmacies` and `/api/v1/orders`.
- **GitOps**: ArgoCD tracking `medigrid-infra` deploying via App-of-Apps pattern.
- **Observability**: Prometheus scraping independent `/metrics` endpoints.
