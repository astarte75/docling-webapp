# Phase 9: Multi-arch Docker Compose Production Build - Research

**Researched:** 2026-03-04
**Domain:** Docker multi-architecture builds, nginx reverse proxy, multi-stage Dockerfiles
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Container structure:** 2 separate containers — `backend` (FastAPI/uvicorn) + `frontend` (nginx). No single-container approach.
- **Frontend build:** React (Vite) compiles inside Docker during `docker compose build` — multi-stage Dockerfile. Stage 1 (node): runs `npm run build`. Stage 2 (nginx): copies `dist/` into nginx html root. No pre-built `dist/` required on host.
- **nginx routing:** Static files (`/`) served directly from nginx; API calls (`/api/`) reverse-proxied to backend container; SSE requires `proxy_buffering off`; no HTTPS in nginx (TLS terminated by Traefik upstream).
- **Multi-arch build:** Built locally with `docker buildx` (Mac Apple Silicon cross-compiles amd64 via QEMU). Platforms: `linux/amd64` and `linux/arm64`. `docker-compose.yml` uses `build:` sections — build on deploy.
- **Registry:** No registry in this phase — images built on target server or transferred manually.
- **Production configuration (.env):** Only two user-facing variables: `PORT` (default: 3000) and `MAX_UPLOAD_SIZE_MB` (default: 50). `TESSDATA_PREFIX` stays in Dockerfile.
- **Reverse proxy / HTTPS:** Traefik (or similar) in front; compose exposes plain HTTP on `PORT`.
- **Production mode vs dev:** Remove `--reload` from uvicorn; remove `volumes: ./backend:/app`; no Vite dev proxy; `restart: unless-stopped` on both services.

### Claude's Discretion

- Exact nginx.conf structure (upstream naming, location blocks)
- Whether to use a separate `docker-compose.prod.yml` or replace the existing one
- Vite build args if any (e.g. VITE_API_URL — likely not needed since nginx proxies)
- `healthcheck` definitions for both containers

### Deferred Ideas (OUT OF SCOPE)

- Docker Hub / GHCR registry publish — future todo
- CI/CD pipeline (Gitea Actions) for automated multi-arch builds — future phase
- HTTPS inside compose (Traefik config, Let's Encrypt) — handled externally by user
</user_constraints>

---

## Summary

This phase produces a production `docker-compose.yml` with two services: a FastAPI backend (existing Dockerfile, production-hardened) and a new frontend service using a multi-stage nginx Dockerfile. The key challenge is that the existing backend Dockerfile is already production-quality, so the work is mainly: (1) creating the frontend Dockerfile with a Node build stage + nginx serve stage, (2) writing an nginx.conf that serves static files and reverse-proxies `/api/` with SSE support, and (3) wiring both into a clean `docker-compose.yml`.

Multi-arch is a critical constraint: Docker's `--platform linux/amd64,linux/arm64` flag requires the `docker-container` buildx driver. Multi-platform images cannot be loaded locally (`--load` is limited to single-platform) — they must either be pushed to a registry OR built directly on the target server using `docker compose build`. Since this phase explicitly forbids registry use, the deployment model is: copy source code to server, run `docker compose up --build` on the target arch. This is simpler than cross-compilation and avoids QEMU slowness for the 5GB+ backend image.

The nginx.conf for SSE is non-negotiable: without `proxy_buffering off` and `proxy_read_timeout` set high enough, the SSE job-progress stream will silently break. The existing backend already sends `X-Accel-Buffering: no` (to check) or nginx must be told explicitly. The `try_files` SPA fallback pattern ensures React Router works correctly.

**Primary recommendation:** Build on the target server (no cross-compilation for the heavy backend image), use a clean `docker-compose.yml` that replaces the dev one, with a `docker-compose.dev.yml` override for local development.

---

## Standard Stack

### Core

| Tool/Image | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| docker buildx | bundled with Docker Engine 23.0+ | Multi-platform builds | Official Docker tool, ships by default |
| nginx | `nginx:alpine` (1.27.x) | Serve React static files + reverse-proxy API | Minimal image, production-proven |
| node | `node:22-alpine` | Build stage for React/Vite | Current LTS, alpine keeps image small |
| python | `python:3.12-slim-bookworm` | Backend (already in use) | Locked in previous phases |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `docker-container` buildx driver | Required for multi-platform builds | Any time `--platform` with multiple targets is used |
| QEMU (binfmt) | CPU emulation for cross-arch builds | Automatically used by Docker Desktop on Mac |
| `.dockerignore` | Exclude `node_modules`, `dist`, `__pycache__` from build context | Always |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Build on server (native) | Cross-compile with buildx on Mac + OCI export | Cross-compile avoids server ssh, but 5GB+ QEMU build for the Python/PyTorch image is impractically slow (hours). Build-on-server is simpler and reliable. |
| Separate `docker-compose.prod.yml` | Single `docker-compose.yml` + `docker-compose.dev.yml` override | Dev override pattern is cleaner: prod file is authoritative, dev overrides add volumes/reload/ports |
| `nginx:alpine` | `nginx:1.25-alpine` (pinned) | Pinned version is more reproducible; alpine latest is convenient. Use pinned for production. |

---

## Architecture Patterns

### Recommended Project Structure

```
docling-webapp/
├── Dockerfile                  # Backend (FastAPI) — already exists
├── Dockerfile.frontend         # Frontend (node build + nginx serve) — NEW
├── nginx.conf                  # nginx config for production — NEW
├── docker-compose.yml          # Production compose (replaces current dev one) — REWRITE
├── docker-compose.dev.yml      # Dev overrides: volumes, --reload, vite dev server — NEW
├── .dockerignore               # Already exists or needs creating
├── backend/                    # FastAPI source (already exists)
└── frontend/                   # React/Vite source (already exists)
```

### Pattern 1: Multi-Stage Frontend Dockerfile

**What:** Two-stage build — Node compiles Vite assets, nginx serves them
**When to use:** Always for React/Vite in production Docker

```dockerfile
# Source: https://docs.docker.com/build/building/multi-platform/ + community pattern
# Stage 1: Build React app
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Key detail:** `npm ci` (not `npm install`) for reproducible builds in CI/Docker. Use `--prefer-offline` to leverage cached packages.

### Pattern 2: nginx.conf for SPA + API Reverse Proxy + SSE

**What:** Single nginx config handling static files, SPA routing, API proxy, and SSE streaming
**When to use:** Any nginx container fronting a React SPA with a backend API

```nginx
# Source: https://docs.docker.com/build/building/multi-platform/ patterns +
#         https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # React SPA — serve static files, fallback to index.html for client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API reverse proxy — strip /api prefix, forward to backend
        location /api/ {
            proxy_pass http://backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # SSE endpoint — CRITICAL: disable buffering for real-time streaming
        # Matches /jobs/{id}/stream which the backend uses for SSE progress
        location ~ ^/api/jobs/[^/]+/stream$ {
            proxy_pass http://backend;
            rewrite ^/api(.*)$ $1 break;
            proxy_set_header Host $host;
            proxy_set_header Connection '';
            proxy_http_version 1.1;
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 86400s;
            chunked_transfer_encoding off;
        }
    }
}
```

**Critical note:** The SSE location block MUST come before the general `/api/` block in nginx to match first (or use regex with higher priority). Alternatively, configure `proxy_buffering off` globally on the `/api/` block — simpler and safer.

**Simpler alternative (recommended):** Apply `proxy_buffering off` to the entire `/api/` block. There is no performance downside for a low-traffic self-hosted app, and it avoids ordering mistakes.

### Pattern 3: Production docker-compose.yml

**What:** Two services, no dev volumes, no --reload, both restart always
**When to use:** Production deployment on server

```yaml
# Source: https://docs.docker.com/reference/compose-file/build/ + project patterns
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
      platforms:
        - linux/amd64
        - linux/arm64
    environment:
      - MAX_UPLOAD_SIZE_MB=${MAX_UPLOAD_SIZE_MB:-50}
      - TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
    restart: unless-stopped
    # No ports exposed — nginx talks to backend via Docker network
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s   # Backend loads large ML models at startup

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      platforms:
        - linux/amd64
        - linux/arm64
    ports:
      - "${PORT:-3000}:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80/"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**Key detail:** `depends_on` with `condition: service_healthy` ensures nginx doesn't start proxying before the backend ML models are loaded. The backend `start_period: 60s` is important — Docling model loading takes 30-60 seconds.

### Pattern 4: Dev Override File

**What:** `docker-compose.dev.yml` overrides for local development
**When to use:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

```yaml
services:
  backend:
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"   # Direct access for dev

  frontend:
    # In dev, use Vite dev server instead of nginx container
    # Or keep nginx but mount local dist for hot-reload
```

### Anti-Patterns to Avoid

- **Using `--load` with multi-platform builds:** Docker cannot load a multi-platform manifest into the local image store. `--load` only works with a single `--platform`. Don't attempt `docker buildx build --platform linux/amd64,linux/arm64 --load .`
- **QEMU cross-building the backend image on Mac:** The backend image (~5GB with PyTorch + ML models) built via QEMU for `linux/amd64` on an Apple Silicon Mac will take 2-4 hours due to emulation overhead. Build directly on the target server instead.
- **Forgetting `proxy_buffering off` for SSE:** Without this, nginx buffers the entire SSE stream and clients never receive progress events. Silent failure mode.
- **Using `proxy_pass http://backend:8000/` with trailing slash pitfall:** If you write `location /api/ { proxy_pass http://backend:8000/; }`, nginx strips the `/api/` prefix correctly. Without trailing slash in proxy_pass, the `/api/` is forwarded as-is to backend. Be consistent.
- **`try_files` without the index.html fallback:** SPA routes like `/app/convert` return 404 without `try_files $uri $uri/ /index.html;`
- **Putting COPY before npm ci in the Dockerfile:** Copying source before `npm ci` invalidates the layer cache on every code change. Always `COPY package*.json ./` then `RUN npm ci` then `COPY . .`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE proxy configuration | Custom buffering toggle logic | `proxy_buffering off` in nginx.conf | nginx handles chunked streaming correctly; hand-rolled workarounds break with nginx version changes |
| SPA routing fallback | Custom nginx Lua scripting | `try_files $uri $uri/ /index.html` | Built-in directive, one line, handles all edge cases |
| Multi-platform manifests | Custom manifest JSON | `docker buildx` with `--platform` | OCI manifest merging is complex; buildx handles it correctly |
| Health checks for Python | Custom health endpoint script | `python -c "import urllib.request; ..."` | No extra dependencies needed; curl not always in slim images |
| Node dependency caching | Custom cache mount scripts | Layer-ordered `COPY package*.json + npm ci` | Docker layer cache does this naturally when ordered correctly |

**Key insight:** nginx's built-in directives cover all proxy/SPA/SSE needs for this stack. There is no problem in this phase that requires custom scripting.

---

## Common Pitfalls

### Pitfall 1: Multi-platform --load limitation

**What goes wrong:** Developer runs `docker buildx build --platform linux/amd64,linux/arm64 --load .` and gets error "docker exporter does not currently support exporting manifest lists".
**Why it happens:** Multi-platform images are OCI image index manifests (multiple image configs + layers). The local Docker daemon image store only supports single-platform images.
**How to avoid:** The deployment model for no-registry is: build on the target server natively with `docker compose up --build`. The target server is either amd64 or arm64, and Docker will build for its native platform. The `platforms:` field in compose is informational/optional when building locally on the server.
**Warning signs:** Any attempt to `docker buildx build --platform a,b --load` will fail.

### Pitfall 2: Backend start_period too short for health checks

**What goes wrong:** The `frontend` service starts and nginx begins forwarding requests to `backend:8000`, but the backend is still loading ML models (Docling, EasyOCR, RapidOCR). Requests timeout or get connection refused.
**Why it happens:** Docker considers a container "healthy" only after start_period has elapsed AND health check passes. If start_period is too short, Docker may declare backend unhealthy during normal startup.
**How to avoid:** Set `start_period: 60s` (or even 90s) on the backend health check. The Docling model loading phase takes 30-60 seconds in a freshly started container.
**Warning signs:** Frontend container starts, initial page loads, but `/api/` calls return 502 Bad Gateway in the first minute.

### Pitfall 3: SSE buffering silently breaks job progress

**What goes wrong:** Users upload a file, conversion starts, but the progress bar never updates. The SSE connection opens but no events arrive until the job completes (or nginx times out).
**Why it happens:** nginx's default `proxy_buffering on` buffers the upstream response. SSE uses chunked streaming; buffering holds chunks until the buffer fills or the response ends.
**How to avoid:** Set `proxy_buffering off` (and optionally `proxy_read_timeout 86400s`) in the nginx location block for `/api/`. The backend should also send `X-Accel-Buffering: no` header as a belt-and-suspenders measure.
**Warning signs:** SSE events work fine in dev (Vite proxy) but not in production (nginx). The `EventSource` connection establishes successfully but `onmessage` never fires until job completion.

### Pitfall 4: Build context size with node_modules

**What goes wrong:** `docker compose build` is slow because it sends the entire `frontend/node_modules` (500MB+) as build context to Docker daemon.
**Why it happens:** No `.dockerignore` file, or the Dockerfile COPY instruction copies everything.
**How to avoid:** Create `.dockerignore` at project root with:
```
frontend/node_modules
frontend/dist
backend/__pycache__
backend/*.pyc
.git
```
**Warning signs:** Build context upload takes 30+ seconds before the first Dockerfile step runs.

### Pitfall 5: nginx mime types not included

**What goes wrong:** React app loads but JavaScript/CSS files return `Content-Type: text/plain` instead of `application/javascript`. Browser refuses to execute scripts.
**Why it happens:** Custom nginx.conf doesn't include the default mime types file.
**How to avoid:** Always include `include /etc/nginx/mime.types;` in the `http {}` block of a custom nginx.conf.
**Warning signs:** Browser console shows "MIME type mismatch" or "refused to execute script".

### Pitfall 6: The proxy_pass trailing slash difference

**What goes wrong:** Backend receives `/api/convert` instead of `/convert` (or vice versa), causing 404 from FastAPI.
**Why it happens:** `proxy_pass http://backend:8000` (no trailing slash) preserves the full URI including `/api/`. `proxy_pass http://backend:8000/` (trailing slash) strips the matched location prefix.
**How to avoid:** Use `location /api/ { proxy_pass http://backend/; }` — both have trailing slash. nginx strips `/api/` prefix and forwards the rest to backend. Backend API routes are at `/convert`, `/jobs/{id}`, etc. (no `/api/` prefix).
**Warning signs:** All API calls return 404; or FastAPI logs show requests with unexpected path prefixes.

---

## Code Examples

Verified patterns from official sources and community best practices:

### Create buildx builder (one-time, on developer machine)

```bash
# Source: https://docs.docker.com/build/building/multi-platform/
docker buildx create \
  --name multiarch-builder \
  --driver docker-container \
  --bootstrap --use
```

### Build and run on target server (recommended deployment model)

```bash
# On the target server (amd64 or arm64):
# 1. Transfer source code (git clone, scp, rsync)
# 2. Run directly — Docker builds for native arch
docker compose up --build -d
```

### Build multi-arch images locally and transfer via OCI tar (alternative if no ssh build access)

```bash
# Source: https://docs.docker.com/build/exporters/oci-docker/
# Export both platforms as OCI tar (does NOT require registry)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --output type=oci,dest=./backend.tar \
  --tag docling-backend:latest \
  -f Dockerfile .

# Transfer to server
scp backend.tar user@server:/opt/docling/

# Load on server (skopeo or crane, not docker load which doesn't support OCI index)
# NOTE: docker load does NOT support multi-arch OCI tars directly
# Server-side: build natively instead (recommended)
```

**IMPORTANT:** `docker load` does not support OCI image index (multi-arch) format. To avoid this complexity entirely, build on the server natively.

### nginx.conf — minimal production-ready for this stack

```nginx
# Source: nginx official docs + SSE pattern from
# https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;

        # SPA routing fallback
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API + SSE proxy — buffering off covers SSE without extra location block
        location /api/ {
            proxy_pass         http://backend:8000/;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   Connection '';
            proxy_buffering    off;
            proxy_read_timeout 86400s;
        }
    }
}
```

### FastAPI health endpoint (add to backend if not exists)

```python
# Source: FastAPI docs pattern
@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Docker Compose healthcheck for backend (handles long model loading)

```yaml
# Source: Docker docs + FastAPI deployment guides
healthcheck:
  test: ["CMD", "python", "-c",
         "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker build` single-platform | `docker buildx build --platform` multi-arch | Docker Engine 23.0 (2023) | buildx now ships by default, no separate install |
| Registry required for multi-arch | OCI export (`--output type=oci`) | BuildKit 0.11+ | Can build multi-arch without pushing to registry |
| `docker-compose up` (v1, Python) | `docker compose up` (v2, Go plugin) | Docker Compose v2 (2022) | `docker-compose` (hyphen) is deprecated; use `docker compose` |
| nginx:latest in Dockerfile | nginx:1.27-alpine (pinned) | Best practice | Reproducible builds; alpine saves ~100MB vs full debian |

**Deprecated/outdated:**
- `docker-compose` (hyphen, v1 Python): Deprecated. Use `docker compose` (space, v2 Go plugin).
- `docker build` for multi-platform: Replaced by `docker buildx build` for multi-arch support.

---

## Open Questions

1. **Does the backend already have a `/health` endpoint?**
   - What we know: The Dockerfile exposes port 8000, backend uses FastAPI. Previous phases added various routes.
   - What's unclear: Whether `/health` endpoint exists in main.py.
   - Recommendation: Check `backend/main.py`. If missing, add it as part of this phase — it's needed for `depends_on: condition: service_healthy`.

2. **Replace `docker-compose.yml` or add `docker-compose.prod.yml`?**
   - What we know: CONTEXT.md marks this as Claude's discretion. Current `docker-compose.yml` is dev-only.
   - What's unclear: User's preferred workflow.
   - Recommendation: Replace `docker-compose.yml` with production config; create `docker-compose.dev.yml` as a dev override. Rationale: production is the primary artifact; dev is the override. This matches Docker's documented override pattern. Users run `docker compose up` for prod, `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` for dev (or simpler alias).

3. **Vite `VITE_API_URL` build arg — needed?**
   - What we know: CONTEXT.md says "likely not needed since nginx proxies". The current vite.config.ts uses a dev proxy at `localhost:3000/api`.
   - What's unclear: Whether any frontend code hardcodes API URLs vs using relative paths.
   - Recommendation: Check if frontend uses relative `/api/` paths (correct) vs absolute URLs. If relative, no build arg needed. If absolute, `VITE_API_URL` build arg would be required.

4. **`platforms:` field in compose vs buildx separately?**
   - What we know: The Compose build spec supports `platforms:` under `build:`. Docker docs confirm this is used by `docker buildx bake` (invoked via Compose).
   - What's unclear: Whether `docker compose build` respects `platforms:` without explicit `docker buildx bake`.
   - Recommendation: The `platforms:` field in compose build spec is for `buildx bake` workflow. For simple `docker compose up --build`, Docker builds for the current machine's native platform regardless of `platforms:`. The `platforms:` field documents intent but doesn't change `docker compose build` behavior. Document this clearly in the compose file comments.

---

## Sources

### Primary (HIGH confidence)
- https://docs.docker.com/build/building/multi-platform/ — Multi-platform strategies, buildx driver setup, --load limitations
- https://docs.docker.com/reference/compose-file/build/ — Compose `platforms:` field spec, `build.args`
- https://docs.docker.com/build/exporters/oci-docker/ — OCI export format, multi-arch tar output

### Secondary (MEDIUM confidence)
- https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view — nginx SSE config (2025 article, consistent with nginx docs)
- https://fastapi.tiangolo.com/deployment/docker/ — FastAPI Docker deployment patterns
- https://docs.docker.com/build/bake/compose-file/ — Compose Bake integration

### Tertiary (LOW confidence)
- Multiple community articles on React/Vite nginx multi-stage Dockerfiles — patterns cross-verified across 5+ sources, consistent

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Docker buildx, nginx:alpine, node:22-alpine are official Docker recommendations
- Architecture patterns: HIGH — nginx config verified against nginx docs and current SSE guides; multi-stage Dockerfile is canonical pattern
- Multi-arch limitations: HIGH — verified against official Docker docs (--load limitation, buildx driver requirement)
- Pitfalls: HIGH — most pitfalls verified from official docs; SSE buffering verified from 2025 source

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (Docker/nginx are stable; buildx API unlikely to change in 90 days)
