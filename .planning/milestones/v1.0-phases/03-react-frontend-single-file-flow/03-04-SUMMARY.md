---
phase: 03-react-frontend-single-file-flow
plan: "04"
subsystem: ui
tags: [react, typescript, vite, shadcn-ui, state-machine, sse]

# Dependency graph
requires:
  - phase: 03-react-frontend-single-file-flow
    provides: "UploadZone, useUpload, useJobStream, ConversionProgress, ResultViewer components and hooks (plans 03-02, 03-03)"
provides:
  - "Complete App.tsx state machine integrating all components into a working end-to-end frontend"
  - "AppPhase discriminated union driving UI transitions: idle → uploading → converting → success | error"
  - "Vite proxy correctly targeting docker-compose port mapping (3000:8000)"
affects: [04-deployment, 05-nginx-production]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AppPhase discriminated union state machine — exhaustive UI state modeling in React"
    - "useCallback memoization for SSE callbacks — prevents re-renders and EventSource reconnects"
    - "Compact strip pattern — upload zone persists in collapsed form after success (no UX interruption)"

key-files:
  created: []
  modified:
    - frontend/src/App.tsx
    - frontend/vite.config.ts

key-decisions:
  - "Vite proxy target corrected from localhost:8000 to localhost:3000 — docker-compose maps 3000:8000, not a direct passthrough"
  - "isConverting = uploading || converting — both phases disable UploadZone to prevent parallel submissions"
  - "jobId=null passed to useJobStream when not converting — prevents phantom SSE connections in idle/error/success states"
  - "startUpload reuses state.file in error state — Retry button works without reselect"

patterns-established:
  - "State machine in App root: owns AppPhase union, passes derived props to children — no prop drilling of state"
  - "useCallback on SSE callbacks passed to useJobStream — avoids infinite re-renders from stale closure recreations"

requirements-completed: [UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, OUTP-01, OUTP-02, OUTP-03]

# Metrics
duration: ~20min
completed: 2026-03-03
---

# Phase 3 Plan 04: App.tsx State Machine Integration Summary

**React App.tsx state machine wiring UploadZone + useUpload + useJobStream + ConversionProgress + ResultViewer into a complete idle → uploading → converting → success | error flow, human-verified end-to-end in browser**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- App.tsx state machine with AppPhase discriminated union managing all 5 phases
- Full end-to-end conversion flow verified in browser: PDF drop → spinner → Markdown preview with Download/Copy
- Error state with Retry button (no file reselect needed), success state with compact upload strip at top
- Fixed Vite proxy target (3000 not 8000) discovered during human verification — frontend can now reach backend through docker-compose port mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx — state machine wiring all components** - `d3005a7` (feat)
2. **Fix: Vite proxy port correction** - `b320813` (fix — applied during human verification)

## Files Created/Modified
- `frontend/src/App.tsx` - Complete state machine with AppPhase union, all component integrations, idle/uploading/converting/success/error rendering
- `frontend/vite.config.ts` - Proxy target corrected from localhost:8000 to localhost:3000

## Decisions Made
- Vite proxy target must be `localhost:3000` (docker-compose host port) not `localhost:8000` (container internal port)
- `isConverting` flag spans both `uploading` and `converting` phases to disable UploadZone during the full upload+conversion window
- `jobId=null` passed to `useJobStream` in all non-converting phases — prevents spurious SSE connections

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vite proxy target pointed to wrong port**
- **Found during:** Task 2 (end-to-end browser verification)
- **Issue:** `vite.config.ts` had proxy target `http://localhost:8000` but docker-compose maps `3000:8000` — frontend requests were failing to reach the backend
- **Fix:** Changed proxy target to `http://localhost:3000`
- **Files modified:** `frontend/vite.config.ts`
- **Verification:** Human confirmed full upload flow worked correctly in browser after fix
- **Committed in:** `b320813` (fix applied during human verification phase)

---

**Total deviations:** 1 auto-fixed (1 bug — wrong port in Vite proxy)
**Impact on plan:** Essential fix for connectivity; no scope creep.

## Issues Encountered
- Vite proxy misconfiguration prevented frontend from reaching backend through docker-compose. Discovered during browser verification checkpoint and corrected immediately.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 complete — full frontend single-file conversion flow working end-to-end
- All UPLD and OUTP requirements verified by human checkpoint
- Ready for Phase 4 (deployment) or Phase 5 (nginx production)
- Known concern for Phase 5: SSE buffering with nginx requires `X-Accel-Buffering: no` header

---
*Phase: 03-react-frontend-single-file-flow*
*Completed: 2026-03-03*
