---
phase: 11-dockerhub-multi-arch-publish
plan: 01
subsystem: infra
tags: [docker, buildx, multi-arch, dockerhub, makefile, docker-compose]

requires:
  - phase: 10-multi-arch-docker-compose-production-build
    provides: Dockerfile and Dockerfile.frontend tested and working for multi-arch builds

provides:
  - Makefile with builder/push-backend/push-frontend/push targets for DockerHub publishing
  - docker-compose.prod.yml for end-user deployment using pre-built DockerHub images

affects: [deployment, release-workflow, dockerhub]

tech-stack:
  added: [docker buildx, docker-container driver, multi-arch manifest]
  patterns:
    - Double-tag pattern (--tag :VERSION --tag :latest) in single buildx command
    - Idempotent builder creation via 2>/dev/null || docker buildx use
    - pull_policy always to prevent stale cached images

key-files:
  created:
    - Makefile
    - docker-compose.prod.yml
  modified: []

key-decisions:
  - "Double-tag in single buildx command: --tag :TAG + --tag :latest — avoids two separate build+push cycles"
  - "Builder target is idempotent: docker buildx create ... 2>/dev/null || docker buildx use multiarch"
  - "docker-compose.prod.yml uses pull_policy: always on both services to prevent stale cached images"
  - "docker-compose.prod.yml has no build: blocks — pure image reference file for end-user deployment"

patterns-established:
  - "Pattern: make push TAG=v1.x — standard release command, builds+pushes both images with versioned and latest tags"
  - "Pattern: docker-compose.prod.yml as separate deployment file — users need no source code or build tools"

requirements-completed: [DCKR-01, DCKR-02, DCKR-03]

duration: 8min
completed: 2026-03-04
---

# Phase 11 Plan 01: DockerHub Multi-Arch Publish Summary

**Makefile con `make push TAG=v1.x` e docker-compose.prod.yml per deploy senza source code, entrambi multi-arch (linux/amd64+linux/arm64) via docker buildx**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-04T08:00:00Z
- **Completed:** 2026-03-04T08:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Makefile con target `builder`, `push-backend`, `push-frontend`, `push` per pubblicazione multi-arch su DockerHub
- Double-tag pattern in singolo buildx command: sia `:TAG` che `:latest` in una sola esecuzione
- docker-compose.prod.yml senza `build:` blocks — solo `image:` references a `ricky75/docling-webapp-*`
- `pull_policy: always` su entrambi i servizi per garantire sempre l'immagine più recente

## Task Commits

Ogni task committato atomicamente:

1. **Task 1: Create Makefile with multi-arch build+push targets** - `43f89a8` (feat)
2. **Task 2: Create docker-compose.prod.yml with pre-built image references** - `6866935` (feat)

## Files Created/Modified

- `Makefile` - Target make per build+push multi-arch: builder, push-backend, push-frontend, push con TAG override
- `docker-compose.prod.yml` - File deploy end-user con image: references, pull_policy: always, no build: blocks

## Decisions Made

- Double-tag in singolo buildx command (`--tag :TAG --tag :latest`) evita due cicli separati di build+push
- Builder target idempotente via `2>/dev/null || docker buildx use multiarch` — primo run crea, successivi riusano
- `pull_policy: always` su entrambi i servizi in docker-compose.prod.yml per prevenire cache stale (Pitfall 4 da research)
- `docker-compose.prod.yml` separato da `docker-compose.yml` — gli utenti finali non toccano il file di sviluppo

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Prima di eseguire `make push`, l'utente deve:
1. `docker login` con credenziali DockerHub dell'account `ricky75`
2. Docker Desktop (o Docker Engine con buildx plugin) deve essere installato

## Next Phase Readiness

- Makefile pronto: `make push TAG=v1.3` pubblicherà entrambe le immagini multi-arch su DockerHub
- docker-compose.prod.yml pronto per distribuzione agli utenti finali
- Il server di produzione potrà eseguire `docker compose -f docker-compose.prod.yml up -d` senza source code

---
*Phase: 11-dockerhub-multi-arch-publish*
*Completed: 2026-03-04*
