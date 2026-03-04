---
phase: 03-react-frontend-single-file-flow
plan: "02"
subsystem: ui
tags: [react, typescript, tanstack-query, react-dropzone, eventSource, sse, hooks]

requires:
  - phase: 03-react-frontend-single-file-flow
    plan: "01"
    provides: Vite+React+TS scaffold, types/job.ts type contracts, TanStack Query QueryClientProvider

provides:
  - useUpload hook: TanStack Query v5 useMutation wrapping POST /api/convert with FormData
  - useJobStream hook: EventSource SSE lifecycle — opens, listens for terminal events, always closes
  - UploadZone component: drag-and-drop PDF upload with validation and visual feedback

affects:
  - 03-03-upload-ui
  - 03-04-app-assembly

tech-stack:
  added: []
  patterns:
    - "Callbacks stored in useRef to avoid EventSource useEffect re-runs from inline function props"
    - "react-dropzone v14 object accept format: { 'application/pdf': ['.pdf'] } — string format silently fails"
    - "EventSource closed in terminal event handlers AND in useEffect cleanup to prevent auto-reconnect leak"

key-files:
  created:
    - frontend/src/hooks/useUpload.ts
    - frontend/src/hooks/useJobStream.ts
    - frontend/src/components/UploadZone.tsx
  modified: []

key-decisions:
  - "Callbacks via useRef in useJobStream — avoids infinite re-renders when parent passes inline functions as props"
  - "No upload progress bar (UPLD-05 as instant transition) — UploadZone hands file to parent via onFileSelected; uploading state managed by App"

requirements-completed: [UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05]

duration: 1min
completed: 2026-03-03
---

# Phase 03 Plan 02: Custom Hooks and UploadZone Component Summary

**useUpload (TanStack Query mutation for POST /api/convert) + useJobStream (EventSource SSE lifecycle) + UploadZone (drag-and-drop PDF input with validation)**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-03T06:52:52Z
- **Completed:** 2026-03-03T06:53:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- useUpload hook created: wraps POST /api/convert with FormData, uses TanStack Query v5 `useMutation` object API, extracts `data.error` from non-2xx responses
- useJobStream hook created: manages EventSource lifecycle — closes connection after `completed`/`failed` events AND in useEffect cleanup to prevent auto-reconnect; uses `useRef` for callbacks to avoid infinite re-renders
- UploadZone component created: react-dropzone v14 with object `accept` format, validates file size (50MB) and type, renders distinct error messages per ErrorCode, supports `disabled` prop for non-interactive state during conversion

## Task Commits

Each task was committed atomically:

1. **Task 1: useUpload and useJobStream hooks** - `c0aec8d` (feat)
2. **Task 2: UploadZone component** - `92c499a` (feat)

## Files Created/Modified

- `frontend/src/hooks/useUpload.ts` - TanStack Query v5 mutation for file upload to POST /api/convert
- `frontend/src/hooks/useJobStream.ts` - EventSource SSE hook with ref-based callback pattern
- `frontend/src/components/UploadZone.tsx` - Drag-and-drop PDF upload zone with validation

## Decisions Made

- **Callbacks via useRef in useJobStream:** If the parent component passes inline arrow functions as `onCompleted`/`onFailed`, they would be recreated on every render — causing the useEffect to re-run endlessly. Storing them in a ref decouples the effect from the callback identity.
- **No upload progress bar:** UPLD-05 implemented as instant transition. UploadZone simply calls `onFileSelected(file)` when a valid file is dropped; the App component handles the uploading/converting state machine. No XHR progress tracking needed.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files confirmed present:
- frontend/src/hooks/useUpload.ts - FOUND
- frontend/src/hooks/useJobStream.ts - FOUND
- frontend/src/components/UploadZone.tsx - FOUND

Commits confirmed:
- c0aec8d: feat(03-02): add useUpload and useJobStream hooks
- 92c499a: feat(03-02): add UploadZone drag-and-drop component with PDF validation

TypeScript: npx tsc --noEmit exits 0 — zero errors across all three files.

---
*Phase: 03-react-frontend-single-file-flow*
*Completed: 2026-03-03*
