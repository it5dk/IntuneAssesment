# Drift Control

Configuration drift monitoring for Microsoft Entra ID and Microsoft Intune. Single-tenant, dark-themed dashboard for internal admins.

## Prerequisites

- Docker & Docker Compose
- Microsoft Entra ID app registration (single-tenant)

## Entra App Registration

1. Go to **Azure Portal** > **Microsoft Entra ID** > **App registrations** > **New registration**
2. Name: `Drift Control`
3. Supported account types: **Single tenant**
4. Register, then note the **Application (client) ID** and **Directory (tenant) ID**
5. Go to **Certificates & secrets** > **New client secret** > copy the **Value**
6. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Application permissions**
7. Add these permissions (see `apps/backend/docs/permissions.md` for details):
   - `User.Read.All`
   - `Group.Read.All`
   - `GroupMember.Read.All`
   - `Policy.Read.All`
   - `DeviceManagementRBAC.Read.All`
   - `DeviceManagementConfiguration.Read.All`
8. Click **Grant admin consent for [your org]**

## Quick Start (Docker Compose)

```bash
# 1. Create .env for backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your TENANT_ID, CLIENT_ID, CLIENT_SECRET

# 2. Run everything
cd infra
docker compose up --build -d

# 3. Wait for services to be healthy, then seed templates
curl -X POST http://localhost:8000/templates/seed
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Monorepo Layout

```
apps/
  backend/         Python FastAPI + Celery
  frontend/        Next.js + TypeScript + Tailwind
infra/
  docker-compose.yml
```

## curl Examples

### 1. Seed Templates

```bash
curl -X POST http://localhost:8000/templates/seed | python -m json.tool
```

### 2. List Templates

```bash
curl http://localhost:8000/templates | python -m json.tool
```

### 3. Create Monitor from Template

```bash
# Get template ID from the templates list, then:
curl -X POST http://localhost:8000/monitors \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "<TEMPLATE_ID>",
    "name": "My Entra Users Monitor",
    "schedule_hours": 24
  }' | python -m json.tool
```

### 4. Run Monitor

```bash
curl -X POST http://localhost:8000/monitors/<MONITOR_ID>/run | python -m json.tool
```

### 5. View Overview

```bash
curl http://localhost:8000/overview | python -m json.tool
```

### 6. List Active Drifts

```bash
curl "http://localhost:8000/drifts?status=active" | python -m json.tool
```

### 7. Resolve a Drift

```bash
curl -X POST http://localhost:8000/drifts/<DRIFT_ID>/resolve | python -m json.tool
```

### 8. Set Baseline Snapshot

```bash
curl -X POST http://localhost:8000/snapshots/<SNAPSHOT_ID>/baseline | python -m json.tool
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check (includes DB) |
| GET | `/overview` | Dashboard overview data |
| GET | `/templates` | List templates |
| POST | `/templates/seed` | Seed default templates |
| GET | `/monitors` | List monitors |
| POST | `/monitors` | Create monitor |
| GET | `/monitors/{id}` | Get monitor detail |
| PATCH | `/monitors/{id}` | Update monitor |
| POST | `/monitors/{id}/run` | Trigger manual run |
| GET | `/snapshots` | List snapshots |
| GET | `/snapshots/{id}` | Get snapshot with items |
| POST | `/snapshots/{id}/baseline` | Set as baseline |
| GET | `/drifts` | List drifts (filter: status, monitorId, severity) |
| GET | `/drifts/{id}` | Get drift with items |
| POST | `/drifts/{id}/resolve` | Resolve drift |

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Celery + Redis, httpx
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **Database**: PostgreSQL 16
- **Queue**: Redis 7

## Future: MSAL Authentication

The MVP ships without user authentication. To add MSAL-based auth later:

1. Add `msal` Python package to backend
2. Create `/auth/login` and `/auth/callback` endpoints using MSAL confidential client
3. Add session middleware (JWT or server-side sessions)
4. On frontend, add MSAL.js provider and protect routes
5. Add `Authorization` header to API calls
