---
phase: 06-cancel-and-ux-fixes
plan: "01"
subsystem: ui

tags: [react, typescript, ux, cancel, batch, sse]

# Dependency graph
requires:
  - phase: 04-options-panel-batch-conversion
    provides: useBatchUpload hook, BatchFileRow, BatchList, App.tsx batch flow, ConversionProgress

provides:
  - Cancel button in single-file ConversionProgress (onCancel prop resets to idle)
  - Per-item X cancel button in BatchFileRow for converting status
  - cancelFile(id) function in useBatchUpload with functional setFiles guard
  - Clickable header h1 for global app reset from any phase
  - "Nuova conversione" button in success state header
  - cancelled status in BatchFileStatus union + STATUS_BADGE entry

affects: [07-visual-redesign-frontend-design]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Functional setFiles form with guard avoids stale closure in concurrent SSE cancel"
    - "setState({ phase: 'idle' }) as universal reset — triggers useJobStream useEffect cleanup automatically"
    - "role=button + tabIndex + onKeyDown on h1 for accessible clickable heading"

key-files:
  created: []
  modified:
    - frontend/src/types/job.ts
    - frontend/src/hooks/useBatchUpload.ts
    - frontend/src/components/ConversionProgress.tsx
    - frontend/src/components/BatchFileRow.tsx
    - frontend/src/components/BatchList.tsx
    - frontend/src/App.tsx

key-decisions:
  - "cancelFile uses functional setFiles + guard to avoid overwriting 'done' in race condition with SSE completed event"
  - "setState({ phase: 'idle' }) closes SSE stream implicitly via useJobStream useEffect cleanup — no manual es.close() needed in App.tsx"
  - "Clickable header resets both batch and single-file state atomically (clearFiles + setState idle)"

patterns-established:
  - "Cancel = close EventSource + update status via functional setFiles with guard"
  - "Global reset = clearFiles() + setState idle — works from any app phase"

requirements-completed: [UX-CANCEL-SINGLE, UX-CANCEL-BATCH, UX-HEADER-NAV, UX-RESET-SUCCESS]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 06 Plan 01: Cancel and UX Fixes Summary

**Cancel controls and reset affordances wired across all app phases: single-file cancel, per-batch-item cancel, clickable logo for global reset, and "Nuova conversione" button in success state.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T19:59:24Z
- **Completed:** 2026-03-03T20:01:32Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `'cancelled'` to `BatchFileStatus` union and STATUS_BADGE entry in BatchFileRow (prevents runtime crash on cancelled status)
- Implemented `cancelFile(id)` in `useBatchUpload` with functional `setFiles` guard preventing race condition with SSE completed event
- Wired `onCancel` prop through `ConversionProgress`, `BatchFileRow`, `BatchList` and up to `App.tsx`
- Made header `<h1>` clickable with `onClick`, `role="button"`, `tabIndex`, `onKeyDown` for accessible global reset
- Added "Nuova conversione" button in success state header restoring full hero UploadZone

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BatchFileStatus and add cancelFile** - `91b4033` (feat)
2. **Task 2: Update leaf components with cancel controls** - `36b7136` (feat)
3. **Task 3: Wire all UX controls in App.tsx** - `94d2d40` (feat)

## Files Created/Modified

- `frontend/src/types/job.ts` - Added `'cancelled'` to `BatchFileStatus` union
- `frontend/src/hooks/useBatchUpload.ts` - Added `cancelFile(id)` with functional setFiles guard; exported in return object
- `frontend/src/components/ConversionProgress.tsx` - Added `onCancel` prop and Annulla button
- `frontend/src/components/BatchFileRow.tsx` - Added `cancelled` to STATUS_BADGE, `onCancel` prop, X cancel button for converting status
- `frontend/src/components/BatchList.tsx` - Added `onCancel` prop, passed to BatchFileRow
- `frontend/src/App.tsx` - Clickable h1 header, ConversionProgress onCancel, "Nuova conversione" button, BatchList onCancel

## Decisions Made

- `cancelFile` uses functional `setFiles` form with guard (`status !== 'converting'`) to prevent overwriting `'done'` status in a race condition where the SSE `completed` event arrives just before cancel
- `setState({ phase: 'idle' })` in `onCancel` is sufficient — `useJobStream` already has a `useEffect` cleanup that calls `es.close()` when `jobId` becomes null; no manual SSE closure needed in App.tsx
- Header reset calls both `batchHook.clearFiles()` (closes all batch EventSources) and `setState({ phase: 'idle' })` atomically to handle any app phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled clean on first attempt for all three tasks. Vite production build succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All cancel/reset UX controls implemented and verified via TypeScript + Vite build
- App is fully recoverable from any state without page refresh
- Ready for Phase 07: visual-redesign-frontend-design

## Self-Check: PASSED

All 6 source files verified present. All 3 task commits verified in git history.

---
*Phase: 06-cancel-and-ux-fixes*
*Completed: 2026-03-03*
