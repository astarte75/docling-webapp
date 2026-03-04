# Phase 11: DockerHub Multi-arch Publish - Research

**Researched:** 2026-03-04
**Domain:** Docker buildx multi-platform image build and publish
**Confidence:** HIGH

## Summary

Phase 11 publishes the existing v1.0 Docker images to DockerHub as multi-arch manifests (linux/amd64 + linux/arm64) so users can `docker compose up -d` without building locally. The standard tool is `docker buildx` with a `docker-container` driver builder — the default `docker` driver does NOT support multi-arch builds. On this machine, the existing `desktop-linux` builder uses the `docker` driver and cannot build multi-arch; a new `docker-container` driver builder must be created first.

The backend image (`python:3.12-slim-bookworm` + Docling ML models + tesserocr compilation) is heavy: expect 20-60 minutes to build the amd64 variant via QEMU emulation on Apple Silicon. The amd64 build runs natively in QEMU; arm64 is already native on the M-series Mac. Registry cache (`--cache-to type=registry`) can speed up subsequent rebuilds but the first push will be a full build. The frontend image (Node 22-alpine → nginx:1.27-alpine) is lightweight (~50 MB) and builds quickly on both arches.

The `docker-compose.prod.yml` pattern is straightforward: replace `build:` blocks with `image: ricky75/repo:tag`. DockerHub auto-selects the correct platform manifest on `docker pull`. Users only need Docker Engine 24+ with Compose v2; no build tools needed on their machines.

**Primary recommendation:** Create a new `docker buildx create --driver docker-container --bootstrap --use` builder, then build and push both images with a single `docker buildx build --platform linux/amd64,linux/arm64 --push` per Dockerfile. Wrap in a Makefile with `push-backend`, `push-frontend`, and `push` composite targets.

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| docker buildx | 0.31.1 (already installed) | Multi-arch image builder | Official Docker multi-platform tool; bundled with Docker Desktop |
| docker-container driver | BuildKit v0.27.1 | Build backend that supports multi-arch | Only driver supporting `--platform` with multiple arches; docker driver cannot |
| QEMU (via Docker Desktop) | Already present in Docker Desktop | Emulate linux/amd64 on arm64 host | Docker Desktop pre-installs QEMU emulation; no manual setup needed |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Registry cache (`--cache-to type=registry`) | built-in buildx | Speed up re-builds by caching layers in DockerHub | Useful after first push; saves 60%+ build time on subsequent pushes |
| `.env` file | — | Supply `DOCKERHUB_USER`, `TAG` to Makefile | Keep image names configurable without hardcoding |
| `docker-compose.prod.yml` | Compose v2 | End-user deploy file with `image:` references | Separate from `docker-compose.yml` which still has `build:` for dev/contributors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single `docker buildx build` with `--platform linux/amd64,linux/arm64` | Two separate builds per platform then `docker manifest push` | Old manifest approach is deprecated; unified buildx `--push` is simpler and the current standard |
| Registry cache | No cache | Slower rebuilds; fine for one-time publish but annoying for iterating |
| Custom `docker-container` builder | Docker Build Cloud | Build Cloud is faster for QEMU-heavy builds but costs money; overkill for a personal project |

**No npm/pip install needed** — this is pure Docker tooling.

## Architecture Patterns

### Recommended File Structure
```
docling-webapp/
├── Dockerfile                  # Backend (unchanged)
├── Dockerfile.frontend         # Frontend (unchanged)
├── docker-compose.yml          # Dev/build: uses build: blocks (existing)
├── docker-compose.prod.yml     # NEW: uses image: blocks pointing to DockerHub
├── Makefile                    # NEW: push-backend, push-frontend, push targets
└── README.md                   # Updated: add DockerHub Quick Start section
```

### Pattern 1: Create a docker-container Builder Once

**What:** The default `docker` driver cannot build multi-platform images. You must create a `docker-container` driver builder. This is a one-time local setup step.

**When to use:** Before any `buildx build --platform` command. The builder persists across sessions.

```bash
# Source: https://docs.docker.com/build/builders/drivers/docker-container/
docker buildx create \
  --name multiarch \
  --driver docker-container \
  --bootstrap \
  --use
```

After creation, `docker buildx ls` will show the new builder as active (`*`).

**Important:** Docker Desktop on Mac already has QEMU registered via `binfmt_misc`. No separate `tonistiigi/binfmt` step needed. Verified: `desktop-linux` builder already shows `linux/amd64` in its supported platforms, meaning emulation is active.

### Pattern 2: Build and Push Multi-arch Image

**What:** Single command builds for both platforms and pushes a multi-arch manifest list to DockerHub. The `--push` flag is mandatory; `--load` is unsupported for multi-arch.

```bash
# Source: https://docs.docker.com/build/building/multi-platform/
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ricky75/docling-webapp-backend:latest \
  --push \
  --file Dockerfile \
  .
```

### Pattern 3: Makefile Targets

**What:** A Makefile that wraps buildx commands with configurable variables.

```makefile
# Source: Docker multi-arch pattern (verified against docs.docker.com)
REGISTRY   := docker.io
NAMESPACE  := ricky75
TAG        := latest
PLATFORMS  := linux/amd64,linux/arm64

BACKEND_IMAGE  := $(REGISTRY)/$(NAMESPACE)/docling-webapp-backend:$(TAG)
FRONTEND_IMAGE := $(REGISTRY)/$(NAMESPACE)/docling-webapp-frontend:$(TAG)

.PHONY: push-backend push-frontend push builder

builder:
	docker buildx create --name multiarch --driver docker-container --bootstrap --use 2>/dev/null || \
	docker buildx use multiarch

push-backend: builder
	docker buildx build \
	  --platform $(PLATFORMS) \
	  --tag $(BACKEND_IMAGE) \
	  --file Dockerfile \
	  --push \
	  .

push-frontend: builder
	docker buildx build \
	  --platform $(PLATFORMS) \
	  --tag $(FRONTEND_IMAGE) \
	  --file Dockerfile.frontend \
	  --push \
	  .

push: push-backend push-frontend
```

**TAG override at call time:** `make push TAG=v1.3.0`

### Pattern 4: docker-compose.prod.yml with Pre-built Images

**What:** Replace `build:` blocks with `image:` references. No source code needed on the deployment server.

```yaml
# docker-compose.prod.yml
# Deploy with: docker compose -f docker-compose.prod.yml up -d
# Source: https://docs.docker.com/reference/compose-file/services/#image

services:
  backend:
    image: ricky75/docling-webapp-backend:latest
    environment:
      - MAX_UPLOAD_SIZE_MB=${MAX_UPLOAD_SIZE_MB:-50}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c",
             "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 90s

  frontend:
    image: ricky75/docling-webapp-frontend:latest
    ports:
      - "${PORT:-3000}:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:80/"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

**Key change:** Remove all `build:` stanzas. DockerHub pulls the correct arch automatically via manifest list.

### Anti-Patterns to Avoid

- **Using the `docker` driver for multi-arch:** The default `desktop-linux` builder uses the `docker` driver — it will error with "multiple platforms feature is currently not supported for docker driver." Always use a `docker-container` driver builder.
- **Using `--load` with multi-arch:** You cannot load a multi-arch image into the local Docker store. Use `--push` directly to the registry. For local testing, build single-platform: `docker buildx build --platform linux/arm64 --load -t test:local .`
- **Using `latest` as the only tag:** Tag both `latest` AND a versioned tag (e.g., `v1.3.0`) in the same push. Users pinning versions will need a semver tag.
- **Forgetting `DOCLING_ARTIFACTS_PATH` in runtime env:** The pre-baked models are in `/root/.cache/docling/models` inside the image. `ENV DOCLING_ARTIFACTS_PATH` is already set in the Dockerfile — this carries through to the published image. No change needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-arch manifest list | Manual `docker manifest create/push` | `docker buildx build --push` | Buildx creates the manifest list automatically; the old manifest approach requires separate per-arch builds and manual manifest assembly |
| Cross-arch QEMU setup | Installing QEMU binaries manually | Docker Desktop (already present) | Docker Desktop pre-registers QEMU `binfmt_misc` handlers; no setup needed on Mac |
| Layer cache between builds | Custom scripts | `--cache-from`/`--cache-to type=registry` | BuildKit handles incremental layer caching natively |
| Platform-specific Dockerfile variants | Separate Dockerfiles per arch | Single Dockerfile with `BUILDPLATFORM`/`TARGETPLATFORM` args | Already not needed here — the Python image base and apt packages all have multi-arch support |

**Key insight:** `docker buildx` with `--push` is a one-command solution for the entire publish workflow. The complexity is in the builder setup (one-time) and build time (QEMU for amd64).

## Common Pitfalls

### Pitfall 1: Using the Default `docker` Driver Builder

**What goes wrong:** `ERROR: multiple platforms feature is currently not supported for docker driver. Please switch to a different driver (e.g. "docker buildx create --use")`

**Why it happens:** The `desktop-linux` and `default` builders both use the `docker` driver. The `docker` driver only supports native single-arch builds.

**How to avoid:** Always run `docker buildx create --driver docker-container --use` before multi-arch builds. Add a `builder:` target in the Makefile that creates the builder if it doesn't exist or switches to it.

**Warning signs:** Error message mentions "docker driver" or "not supported for docker driver."

### Pitfall 2: QEMU Crash / OOM During amd64 pip Install

**What goes wrong:** Build hangs or segfaults during `pip install` for the backend — particularly during tesserocr (C++ compilation) or PyTorch wheel extraction under QEMU emulation.

**Why it happens:** QEMU emulation for amd64 on arm64 is ~4-5x slower and memory-hungry. Large C++ compilations and wheel extractions can exhaust memory or trigger QEMU segfaults.

**How to avoid:** Ensure Docker Desktop has sufficient RAM assigned (at least 8 GB recommended; 12+ GB for the backend build). In Docker Desktop settings → Resources → Memory. The Dockerfile already uses CPU-only PyTorch wheels (`--extra-index-url https://download.pytorch.org/whl/cpu`) — this is the right approach and avoids large CUDA wheel downloads.

**Warning signs:** Build process hanging for >15 minutes on a single `RUN pip install` step, then disappearing; `exec format error` in build logs.

### Pitfall 3: `--push` Requires Prior `docker login`

**What goes wrong:** Build succeeds but push fails with `denied: requested access to the resource is denied`.

**Why it happens:** The builder runs in its own BuildKit container and inherits Docker credential helpers from the host, but only if configured correctly.

**How to avoid:** Run `docker login` before `make push`. The user is already logged in (per project context) — document this in the Makefile help or README.

**Warning signs:** Build completes but push step errors with HTTP 401/403.

### Pitfall 4: `docker-compose.prod.yml` Missing `pull_policy`

**What goes wrong:** Users who have an old version of the image cached locally run `docker compose -f docker-compose.prod.yml up -d` and get the stale image instead of the latest from DockerHub.

**Why it happens:** Compose default `pull_policy` is `missing` — it only pulls if no local image exists.

**How to avoid:** Add `pull_policy: always` to both services in `docker-compose.prod.yml`, OR document that users should run `docker compose -f docker-compose.prod.yml pull` before `up -d`. The `pull_policy: always` approach is more foolproof.

**Warning signs:** User reports running old version despite `latest` tag being updated.

### Pitfall 5: Duplicate Builder Creation

**What goes wrong:** `make push` called twice creates a second builder named `multiarch2` or errors on `docker buildx create`.

**Why it happens:** `docker buildx create` fails if a builder with that name already exists.

**How to avoid:** In the Makefile `builder:` target, use: `docker buildx create --name multiarch --driver docker-container --bootstrap --use 2>/dev/null || docker buildx use multiarch`. The `|| docker buildx use multiarch` fallback switches to the existing builder if creation fails.

### Pitfall 6: Build Context Too Large (Slow Transfers to BuildKit)

**What goes wrong:** The `docker buildx build .` command transfers the entire build context (including `frontend/node_modules`, `.git`, any large local artifacts) to the BuildKit daemon before building, causing a slow start.

**Why it happens:** The `docker-container` driver runs BuildKit in a separate container. The build context is sent over a socket. Large contexts add minutes.

**How to avoid:** Ensure `.dockerignore` exists and excludes `frontend/node_modules`, `.git`, `.planning`, `__pycache__`, etc. This is the same optimization as any Docker build.

**Warning signs:** Build log shows "transferring context: X.XGB" at the start.

## Code Examples

### Complete Makefile
```makefile
# Source: verified against https://docs.docker.com/build/builders/drivers/docker-container/
# and https://docs.docker.com/build/building/multi-platform/

REGISTRY   := docker.io
NAMESPACE  := ricky75
TAG        ?= latest
PLATFORMS  := linux/amd64,linux/arm64

BACKEND_IMAGE  := $(REGISTRY)/$(NAMESPACE)/docling-webapp-backend:$(TAG)
FRONTEND_IMAGE := $(REGISTRY)/$(NAMESPACE)/docling-webapp-frontend:$(TAG)

.PHONY: help builder push-backend push-frontend push

help:
	@echo "Targets:"
	@echo "  push-backend   Build and push backend multi-arch image"
	@echo "  push-frontend  Build and push frontend multi-arch image"
	@echo "  push           Build and push both images"
	@echo ""
	@echo "Variables:"
	@echo "  TAG=$(TAG)  (override with: make push TAG=v1.3.0)"

builder:
	@docker buildx create --name multiarch --driver docker-container --bootstrap --use 2>/dev/null || \
	 docker buildx use multiarch

push-backend: builder
	docker buildx build \
	  --platform $(PLATFORMS) \
	  --tag $(BACKEND_IMAGE) \
	  --file Dockerfile \
	  --push \
	  .

push-frontend: builder
	docker buildx build \
	  --platform $(PLATFORMS) \
	  --tag $(FRONTEND_IMAGE) \
	  --file Dockerfile.frontend \
	  --push \
	  .

push: push-backend push-frontend
	@echo "Done. Images available:"
	@echo "  $(BACKEND_IMAGE)"
	@echo "  $(FRONTEND_IMAGE)"
```

### Verify Multi-arch Manifest After Push
```bash
# Source: https://docs.docker.com/build/building/multi-platform/
# Verify the manifest list was published correctly
docker buildx imagetools inspect ricky75/docling-webapp-backend:latest
docker buildx imagetools inspect ricky75/docling-webapp-frontend:latest
# Expected output shows both linux/amd64 and linux/arm64 manifests
```

### Check Existing Builder State
```bash
# Shows current builders and their platform support
docker buildx ls
# desktop-linux builder: docker driver — does NOT support multi-arch
# multiarch builder (after creation): docker-container driver — supports multi-arch
```

### Cache-Enabled Build (for faster re-pushes)
```bash
# Add cache flags after initial push to speed up subsequent rebuilds
# Source: https://docs.docker.com/build/cache/backends/registry/
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ricky75/docling-webapp-backend:latest \
  --cache-from type=registry,ref=ricky75/docling-webapp-backend:buildcache \
  --cache-to   type=registry,ref=ricky75/docling-webapp-backend:buildcache,mode=max \
  --file Dockerfile \
  --push \
  .
```

Note: Cache is optional for v1.3. First build has no cache to read from; it only benefits subsequent pushes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker manifest create` + `docker manifest push` (manual assembly) | `docker buildx build --push --platform` (unified) | Docker 19.03 / buildx v0.5 | Single command handles build + manifest list creation + push |
| QEMU manual install (`apt-get install qemu-user-static`) | Bundled in Docker Desktop | Docker Desktop 4.x | No setup needed on Mac |
| `docker build` (single arch) | `docker buildx build` (multi-arch) | Docker 19.03 | `buildx` is the new standard; `docker build` still works but is single-arch only |

**Deprecated/outdated:**
- `docker manifest`: Still works but is experimental and requires separate per-arch builds. Replaced by buildx `--push` in all modern workflows.
- `--platform` flag on `docker build` (non-buildx): Does not exist — must use `docker buildx build`.

## Open Questions

1. **Build time for backend amd64 via QEMU**
   - What we know: QEMU emulation is 4-5x slower. Backend has heavy deps (PyTorch, tesserocr C++ compile, model download ~1.5 GB). Docker Desktop on this Mac has 8 GB RAM allocated by default.
   - What's unclear: Actual expected build time. Tesserocr C++ compilation via QEMU is a known pain point. Could take 30-90 minutes on first build.
   - Recommendation: Allocate 12+ GB RAM to Docker Desktop for the build. Consider running push-backend overnight on first publish. After the first build, registry cache speeds up subsequent pushes significantly.

2. **Versioned tags vs `latest` only**
   - What we know: DockerHub best practice is to push both `latest` and a semver tag simultaneously.
   - What's unclear: Whether the Makefile should push two tags per build (`:latest` and `:v1.3.0`) or just `latest`.
   - Recommendation: Support both. Extend Makefile to tag both `$(TAG)` and `latest` in the same buildx command using two `--tag` flags when `TAG != latest`.

3. **`.dockerignore` status**
   - What we know: A `.dockerignore` is critical for build context size (especially `frontend/node_modules`).
   - What's unclear: Whether a `.dockerignore` already exists in the project.
   - Recommendation: Check during Wave 0 of planning. If missing, create it as the first task.

4. **GitHub Actions for automated publishing (v1.3+)**
   - What we know: Phase 11 deliverables do not include CI. The roadmap notes "optional for v1.3."
   - What's unclear: Whether user wants a GitHub Actions workflow stub in this phase.
   - Recommendation: Out of scope for Phase 11. Document as a future enhancement in README.

## Sources

### Primary (HIGH confidence)
- https://docs.docker.com/build/building/multi-platform/ — multi-platform build workflow, driver requirements, QEMU, --push semantics
- https://docs.docker.com/build/builders/drivers/docker-container/ — docker-container driver, how to create, multi-arch support
- https://docs.docker.com/build/builders/drivers/ — driver comparison table (docker vs docker-container vs kubernetes)
- https://docs.docker.com/reference/compose-file/services/#image — image: field syntax `[registry/][project/]image[:tag]`
- `docker buildx inspect desktop-linux` (local) — confirmed driver=docker, platforms listed, BuildKit v0.27.1

### Secondary (MEDIUM confidence)
- https://www.docker.com/blog/multi-arch-images/ — Apple Silicon multi-arch pattern, no code changes needed
- https://docs.docker.com/build/cache/backends/registry/ — registry cache backend for buildx
- https://deepwiki.com/docling-project/docling-serve/6.1-container-images — confirmed upstream docling-serve builds multi-arch (amd64 + arm64) using same approach

### Tertiary (LOW confidence)
- https://medium.com/@DougDonohoe/faster-multi-architecture-docker-builds-on-google-cloud-build-using-arm64-vms-and-buildx-63c7b5ac017b — QEMU performance benchmarks (4-5x slowdown; context: GCP but applicable generally)
- https://forums.docker.com/t/docker-buildx-taking-so-much-time-for-arm64/128407 — community reports on build time for large images under QEMU

## Metadata

**Confidence breakdown:**
- Standard stack (buildx, docker-container driver): HIGH — verified against official Docker docs and local environment
- Architecture patterns (Makefile, docker-compose.prod.yml): HIGH — standard patterns verified against official Compose spec
- Pitfalls (QEMU crash, driver error): MEDIUM — driver error confirmed from official docs; QEMU crash timing is from community reports (LOW individual; raised to MEDIUM by multiple sources)
- Build time estimates: LOW — highly variable; depends on Docker Desktop RAM, CPU, and network speed

**Research date:** 2026-03-04
**Valid until:** 2026-09-04 (buildx API stable; 6-month window reasonable for tooling this mature)
