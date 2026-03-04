# Roadmap: Docling Webapp

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-04)
- 🚧 **v1.3 DockerHub Release** — Phase 11 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-10) — SHIPPED 2026-03-04</summary>

- [x] Phase 1: Backend Core + Docker Foundation (2/2 plans) — completed 2026-03-02
- [x] Phase 2: Async Job System + SSE Progress (2/2 plans) — completed 2026-03-03
- [x] Phase 3: React Frontend — Single File Flow (4/4 plans) — completed 2026-03-03
- [x] Phase 4: Options Panel + Batch Conversion (5/5 plans) — completed 2026-03-03
- [x] Phase 6: Cancel + UX Fixes (2/2 plans) — completed 2026-03-03
- [x] Phase 7: Visual Redesign (3/3 plans) — completed 2026-03-04
- [x] Phase 8: OCR Engine Research and Selection (4/4 plans) — completed 2026-03-04
- [x] Phase 9: UI Improvements (2/2 plans) — completed 2026-03-04
- [x] Phase 10: Multi-arch Docker Compose Production Build (2/2 plans) — completed 2026-03-04

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.3 DockerHub Release

- [ ] **Phase 11: DockerHub Multi-arch Publish** — Build and publish multi-arch images (linux/amd64 + linux/arm64) to DockerHub so users can deploy with `docker compose up -d` without building locally. Includes Makefile with `buildx` push targets and `docker-compose.prod.yml` referencing pre-built images.

### Phase 11: DockerHub Multi-arch Publish

**Goal:** Build and publish multi-arch Docker images (linux/amd64 + linux/arm64) to DockerHub (ricky75/docling-webapp-backend and ricky75/docling-webapp-frontend) so that users can deploy the app with `docker compose up -d` without building locally.

**Deliverables:**
- Makefile with `make push` (or `make push-backend`, `make push-frontend`) targets using `docker buildx`
- `docker-compose.prod.yml` referencing pre-built DockerHub images
- Updated README.md with DockerHub deployment instructions

**Requirements:** DCKR-01, DCKR-02, DCKR-03, DCKR-04

**Plans:** 2 plans

Plans:
- [ ] 11-01-PLAN.md — Makefile (multi-arch buildx push targets) + docker-compose.prod.yml (pre-built image references)
- [ ] 11-02-PLAN.md — README.md update with pre-built images Quick Start section

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Core + Docker Foundation | v1.0 | 2/2 | Complete | 2026-03-02 |
| 2. Async Job System + SSE Progress | v1.0 | 2/2 | Complete | 2026-03-03 |
| 3. React Frontend — Single File Flow | v1.0 | 4/4 | Complete | 2026-03-03 |
| 4. Options Panel + Batch Conversion | v1.0 | 5/5 | Complete | 2026-03-03 |
| 6. Cancel + UX Fixes | v1.0 | 2/2 | Complete | 2026-03-03 |
| 7. Visual Redesign | v1.0 | 3/3 | Complete | 2026-03-04 |
| 8. OCR Engine Research and Selection | v1.0 | 4/4 | Complete | 2026-03-04 |
| 9. UI Improvements | v1.0 | 2/2 | Complete | 2026-03-04 |
| 10. Multi-arch Docker Compose Production Build | v1.0 | 2/2 | Complete | 2026-03-04 |
| 11. DockerHub Multi-arch Publish | v1.3 | 0/2 | In progress | - |
