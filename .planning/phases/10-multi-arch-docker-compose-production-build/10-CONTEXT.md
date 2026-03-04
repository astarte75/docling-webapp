# Phase 9: Multi-arch Docker Compose Production Build - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a production-ready `docker-compose.yml` that builds and runs the full stack (FastAPI backend + React frontend via nginx) with multi-architecture support (linux/amd64 + linux/arm64). Goal: one-command deployment (`docker compose up --build`) on any Linux server with no manual steps. No registry publishing in this phase.

</domain>

<decisions>
## Implementation Decisions

### Container structure
- 2 separate containers: `backend` (FastAPI/uvicorn) + `frontend` (nginx)
- nginx serves React static files and reverse-proxies API calls to the backend
- No combined single-container approach

### Frontend build
- React (Vite) compiles inside Docker during `docker compose build` — multi-stage Dockerfile
- Stage 1 (node): runs `npm run build`, produces `dist/`
- Stage 2 (nginx): copies `dist/` into nginx's html root
- No pre-built `dist/` required on the host machine

### nginx routing
- Static files (`/`): served directly from nginx
- API calls (`/api/` or all non-static): reverse-proxied to backend container
- SSE (Server-Sent Events): `proxy_buffering off` required — backend streams SSE for job progress
- No HTTPS in nginx — TLS terminated upstream by Traefik

### Multi-arch build
- Built locally with `docker buildx` (Mac Apple Silicon cross-compiles amd64 via QEMU)
- Target platforms: `linux/amd64` and `linux/arm64`
- `docker-compose.yml` uses `build:` sections, not pre-pulled images — build on deploy

### Registry
- No registry in this phase — images built directly on the target server or transferred manually
- Future todo: publish to Docker Hub (noted for post-project)

### Production configuration (.env)
- `.env` file on server, optional — defaults cover standard deployments
- Only two user-facing variables:
  - `PORT` (default: 3000) — host port exposed by nginx container
  - `MAX_UPLOAD_SIZE_MB` (default: 50) — upload file size limit
- `TESSDATA_PREFIX` stays in Dockerfile (internal, not user-configurable)
- No secrets, no API keys

### Reverse proxy / HTTPS
- Traefik (or similar) sits in front — handles SSL termination, domain routing
- The compose stack exposes plain HTTP on `PORT`
- No SSL config inside compose

### Production mode differences vs current dev setup
- Remove `--reload` from uvicorn command
- Remove `volumes: ./backend:/app` mount (code baked into image)
- No dev proxy in Vite (nginx handles routing)
- `restart: unless-stopped` on both services

### Claude's Discretion
- Exact nginx.conf structure (upstream naming, location blocks)
- Whether to use a separate `docker-compose.prod.yml` or replace the existing one
- Vite build args if any (e.g. VITE_API_URL — likely not needed since nginx proxies)
- `healthcheck` definitions for both containers

</decisions>

<specifics>
## Specific Ideas

- One-command goal: `docker compose up --build -d` on the server, everything works
- Traefik as external reverse proxy — compose exposes only HTTP, no SSL config needed inside
- Multi-arch is for deploying on a Linux x86 server from a Mac Apple Silicon dev machine

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dockerfile` (backend): already production-quality — models pre-downloaded, TESSDATA_PREFIX set, system deps installed. Needs: remove dev volume mount hint in compose.
- `frontend/vite.config.ts`: proxy config is dev-only; nginx replaces it in production
- `frontend/package.json`: has `build` script (`vite build`) — used in frontend Dockerfile stage 1
- `docker-compose.yml`: current file is dev-only (--reload, volume mount). Will be replaced/extended.

### Established Patterns
- Backend already uses `restart: unless-stopped`
- ENV vars use `${VAR:-default}` syntax in compose — keep this pattern
- `DOCLING_ARTIFACTS_PATH` and `OMP_NUM_THREADS` are set in Dockerfile ENV — stay there

### Integration Points
- Vite dev proxy (`/api → localhost:3000`) must be replaced by nginx proxy in production
- SSE endpoint `GET /jobs/{id}/stream` needs `proxy_buffering off` in nginx — critical for job progress
- Backend listens on port 8000 inside container; nginx talks to it via Docker network (service name)

</code_context>

<deferred>
## Deferred Ideas

- Docker Hub / GHCR registry publish — future todo after project completion
- CI/CD pipeline (Gitea Actions) for automated multi-arch builds — future phase
- HTTPS inside compose (Traefik config, Let's Encrypt) — handled externally by user

</deferred>

---

*Phase: 09-multi-arch-docker-compose-production-build*
*Context gathered: 2026-03-04*
