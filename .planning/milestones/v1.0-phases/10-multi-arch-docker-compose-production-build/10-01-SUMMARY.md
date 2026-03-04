---
phase: 10-multi-arch-docker-compose-production-build
plan: "01"
subsystem: infrastructure
tags: [docker, nginx, multi-stage-build, sse, production, compose]
dependency_graph:
  requires: []
  provides: [docker-compose-prod, docker-compose-dev, dockerfile-frontend, nginx-proxy]
  affects: [deployment, frontend-serve, backend-proxy]
tech_stack:
  added: [nginx:1.27-alpine, node:22-alpine, multi-stage-docker-build]
  patterns: [nginx-reverse-proxy, sse-safe-proxy, docker-compose-override, healthcheck-depends-on]
key_files:
  created:
    - Dockerfile.frontend
    - nginx.conf
    - docker-compose.dev.yml
    - .dockerignore
  modified:
    - docker-compose.yml
decisions:
  - "nginx proxy_buffering off on /api/ block covers SSE streams without a separate location block"
  - "start_period 90s on backend healthcheck — Docling ML model loading takes 30-60s"
  - "depends_on condition: service_healthy ensures nginx starts only after backend passes health check"
  - "TESSDATA_PREFIX removed from compose environment — already set in Dockerfile ENV, no duplication"
  - "npm ci (not npm install) for reproducible frontend builds in CI/Docker"
metrics:
  duration_seconds: 95
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 10 Plan 01: Multi-arch Docker Compose Production Build Summary

**One-liner:** Multi-stage Dockerfile.frontend (node:22-alpine build + nginx:1.27-alpine serve) with SSE-safe nginx reverse proxy and production/dev docker-compose split via override pattern.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Dockerfile.frontend and nginx.conf | cbdc995 | Dockerfile.frontend, nginx.conf, .dockerignore |
| 2 | Rewrite docker-compose.yml (prod) and create docker-compose.dev.yml | 545318e | docker-compose.yml, docker-compose.dev.yml |

## What Was Built

### Dockerfile.frontend

Multi-stage build:
- Stage 1 (builder): `node:22-alpine` — copies `frontend/package*.json` first for layer cache, runs `npm ci`, copies source, runs `npm run build`
- Stage 2 (serve): `nginx:1.27-alpine` — copies `/app/dist` from builder, uses custom `nginx.conf`

### nginx.conf

- `include /etc/nginx/mime.types` — mandatory for correct JS/CSS Content-Type headers
- SPA fallback: `try_files $uri $uri/ /index.html` for React Router
- `/api/` reverse proxy to `http://backend:8000/` with trailing slash (strips prefix)
- `proxy_buffering off` on entire `/api/` block — covers SSE streams at `/jobs/{id}/stream`
- `proxy_read_timeout 86400s` — long-lived SSE connections

### docker-compose.yml (production)

- Backend: no `--reload`, no volume mounts, healthcheck with `start_period: 90s`
- Frontend: `depends_on backend condition: service_healthy`, port `${PORT:-3000}:80`
- Both services: `restart: unless-stopped`

### docker-compose.dev.yml (override)

- Backend override: adds `--reload`, mounts `./backend:/app`, exposes port 8000
- Healthcheck `start_period: 30s` for faster dev iteration

## Verification

All criteria passed:
- `docker compose config --quiet` — valid
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet` — valid
- `Dockerfile.frontend` builds successfully (`docker build --no-cache`)
- `nginx.conf` contains `proxy_buffering off` and `include /etc/nginx/mime.types`
- `.dockerignore` excludes `frontend/node_modules`
- `docker-compose.yml` has no `--reload` and no volume mounts
- Backend healthcheck has `start_period: 90s`
- Frontend `depends_on` uses `condition: service_healthy`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files created/modified:
- FOUND: /Users/ricky/MyProjects/docling-webapp/Dockerfile.frontend
- FOUND: /Users/ricky/MyProjects/docling-webapp/nginx.conf
- FOUND: /Users/ricky/MyProjects/docling-webapp/.dockerignore
- FOUND: /Users/ricky/MyProjects/docling-webapp/docker-compose.yml
- FOUND: /Users/ricky/MyProjects/docling-webapp/docker-compose.dev.yml

Commits:
- FOUND: cbdc995 feat(10-01): add Dockerfile.frontend, nginx.conf, and .dockerignore
- FOUND: 545318e feat(10-01): rewrite docker-compose.yml (prod) and add docker-compose.dev.yml
