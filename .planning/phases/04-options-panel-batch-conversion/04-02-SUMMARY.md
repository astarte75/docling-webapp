---
phase: 04-options-panel-batch-conversion
plan: "02"
subsystem: ui
tags: [typescript, react, jszip, shadcn, types]

# Dependency graph
requires:
  - phase: 03-react-frontend-single-file-flow
    provides: AppPhase discriminated union and existing SSE event types in types/job.ts

provides:
  - ConversionOptions interface with OcrMode, tableDetection, pageRange, ocrLanguages
  - BatchFile interface with id, file, options snapshot, status, jobId, markdown, errorMessage
  - BatchFileStatus type (pending | converting | done | error)
  - OcrMode type (auto | on | off)
  - DEFAULT_CONVERSION_OPTIONS constant
  - SUPPORTED_OCR_LANGUAGES constant (15 EasyOCR languages)
  - AppPhase extended with batch-active and batch-complete variants
  - jszip npm dependency for ZIP download
  - shadcn components: toggle-group, collapsible, switch, select, toggle

affects:
  - 04-options-panel-batch-conversion (all remaining plans: 04-03, 04-04, 04-05 depend on these types)

# Tech tracking
tech-stack:
  added:
    - jszip ^3.10.1 (ZIP bundle download for batch results)
    - "@types/jszip ^3.4.0"
    - "@radix-ui/react-toggle-group (via shadcn toggle-group)"
    - "@radix-ui/react-collapsible (via shadcn collapsible)"
    - "@radix-ui/react-switch (via shadcn switch)"
    - "@radix-ui/react-select (via shadcn select)"
  patterns:
    - "ConversionOptions snapshot pattern: options captured at file-drop time, immutable per BatchFile"
    - "Discriminated union extension: AppPhase extended without breaking existing switch handlers"

key-files:
  created:
    - frontend/src/components/ui/toggle-group.tsx
    - frontend/src/components/ui/collapsible.tsx
    - frontend/src/components/ui/switch.tsx
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/ui/toggle.tsx
  modified:
    - frontend/src/types/job.ts (added Phase 4 type contracts)
    - frontend/package.json (jszip + @types/jszip added)

key-decisions:
  - "ConversionOptions uses null for pageFrom/pageTo to represent 'use default' (first/last page) — avoids magic numbers"
  - "Options snapshot captured at drop time (not at conversion start) — each BatchFile carries its own immutable config"
  - "SUPPORTED_OCR_LANGUAGES curated to 15 languages covering major EasyOCR-supported locales"

patterns-established:
  - "BatchFile.id uses crypto.randomUUID() client-generated — no server round-trip needed for list key"
  - "ConversionOptions snapshot at drop time: immutable per file, consistent with how OptionsPanel state flows into BatchFile"

requirements-completed:
  - BTCH-01
  - BTCH-02
  - BTCH-04

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 4 Plan 02: Types + Dependencies Summary

**TypeScript type contracts for batch conversion: ConversionOptions, BatchFile, OcrMode, extended AppPhase, plus jszip and shadcn UI component installation**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T07:16:08Z
- **Completed:** 2026-03-03T07:21:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed jszip (^3.10.1) and @types/jszip for ZIP download in batch flow
- Installed 5 shadcn components: toggle-group, collapsible, switch, select, toggle
- Extended types/job.ts with all Phase 4 type contracts without breaking existing compilation
- AppPhase discriminated union now includes batch-active and batch-complete variants

## Task Commits

Each task was committed atomically:

1. **Task 1: Installa dipendenze frontend** - `c617062` (chore)
2. **Task 2: Estendi types/job.ts con tipi Phase 4** - `cc4266d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/types/job.ts` - Extended with ConversionOptions, BatchFile, OcrMode, BatchFileStatus, DEFAULT_CONVERSION_OPTIONS, SUPPORTED_OCR_LANGUAGES, and batch-* AppPhase variants
- `frontend/package.json` - Added jszip + @types/jszip
- `frontend/src/components/ui/toggle-group.tsx` - Shadcn toggle group component
- `frontend/src/components/ui/collapsible.tsx` - Shadcn collapsible component
- `frontend/src/components/ui/switch.tsx` - Shadcn switch component
- `frontend/src/components/ui/select.tsx` - Shadcn select component
- `frontend/src/components/ui/toggle.tsx` - Shadcn toggle component (installed as peer by toggle-group)

## Decisions Made
- `ConversionOptions` uses `null` for `pageFrom`/`pageTo` to represent "use default" (first/last page) rather than magic numbers like 0 or -1
- Options snapshot is captured at file-drop time, making each `BatchFile.options` immutable — this ensures conversion uses the settings active when the user added the file
- `SUPPORTED_OCR_LANGUAGES` curated to 15 major EasyOCR-supported locales, covering the most common use cases

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - npm install and shadcn add completed without errors. TypeScript compilation passed with zero errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 type contracts are in place — OptionsPanel (04-03), useBatchUpload (04-04), and BatchList (04-05) can import from types/job.ts
- jszip ready for use in batch download functionality
- shadcn components available for OptionsPanel UI construction
- No blockers for remaining Phase 4 plans

---
*Phase: 04-options-panel-batch-conversion*
*Completed: 2026-03-03*
