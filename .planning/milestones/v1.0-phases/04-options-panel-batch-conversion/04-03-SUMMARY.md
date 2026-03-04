---
phase: 04-options-panel-batch-conversion
plan: "03"
subsystem: frontend-components
tags: [react, shadcn, options-panel, ocr, collapsible, toggle-group]
dependency_graph:
  requires:
    - "04-02"  # TypeScript types (ConversionOptions, OcrMode, SUPPORTED_OCR_LANGUAGES) and shadcn components
  provides:
    - "OptionsPanel component ready for integration in App.tsx"
  affects:
    - "04-05"  # App.tsx integration will import OptionsPanel
tech_stack:
  added: []
  patterns:
    - "shadcn ToggleGroup with single-selection type and deselection guard"
    - "Radix Collapsible for animated expand/collapse panel"
    - "Sentinel value strategy for Radix Select (empty string not allowed as item value)"
    - "Controlled number inputs with null coercion (empty string → null, not NaN)"
key_files:
  created:
    - frontend/src/components/OptionsPanel.tsx
  modified: []
decisions:
  - "Use __none__ sentinel instead of empty string for Select 'any language' option — Radix Select.Item does not accept empty string as value"
  - "LANG_NONE constant defined inside component scope — no need to export it, it is an implementation detail"
  - "Single language select (not multi-select) — simpler UX, ocrLanguages stored as array for backend compatibility"
metrics:
  duration: "~6 min"
  completed: "2026-03-03"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 4 Plan 03: OptionsPanel Component Summary

**One-liner:** React OptionsPanel with shadcn OCR ToggleGroup and collapsible advanced panel (table detection switch, page range inputs, language select).

## What Was Built

`frontend/src/components/OptionsPanel.tsx` — autonomous controlled component that exposes conversion options to the user before file drop. Props: `value: ConversionOptions`, `onChange: (opts: ConversionOptions) => void`.

### Component Layout (top to bottom)

1. **OCR Mode row** — `ToggleGroup` (type="single", variant="outline") with three items: Auto / On / Off. Guard `if (v)` prevents deselection when user clicks the already-active item.

2. **Collapsible trigger** — "Opzioni avanzate" text with ChevronDown icon that rotates 180° when open. Uses `React.useState` for `advancedOpen`.

3. **CollapsibleContent** (expands downward, `space-y-3`):
   - **Table detection** — `Switch` component, label left / switch right
   - **Page range** — two `<input type="number">` (from / to), both optional; empty value → `null` (not `NaN`)
   - **OCR language** — `Select` with 15 languages from `SUPPORTED_OCR_LANGUAGES` plus "Qualsiasi (default)" sentinel item

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OptionsPanel — OCR ToggleGroup + Collapsible advanced panel | f7a0b6d | frontend/src/components/OptionsPanel.tsx |

## Verification Results

- `npx tsc --noEmit` — passed, zero errors
- `npm run build` — passed, 2170 modules transformed, built in 1.65s

## Decisions Made

### Sentinel value for Radix Select

**Context:** Radix UI `Select.Item` does not allow `value=""` (empty string). Needed a "reset to default" option.

**Decision:** Use `__none__` as sentinel value internally. When user selects it, `ocrLanguages` is set to `[]`. When `ocrLanguages` is empty, selected value is `__none__`. Sentinel is never exposed outside the component.

### Single language select

**Context:** Plan specified "Valore singolo (non multi-select per semplicità)".

**Decision:** `ocrLanguages` is a `string[]` in the type (backend compatibility), but the UI exposes a single-select. Array contains 0 or 1 elements.

## Deviations from Plan

None — plan executed exactly as written. The sentinel value fix for Radix Select was a proactive correctness improvement (Rule 2) — using empty string would have caused a Radix console error at runtime.

## Self-Check: PASSED

- [x] `frontend/src/components/OptionsPanel.tsx` exists
- [x] Commit `f7a0b6d` exists in git log
- [x] TypeScript: no errors
- [x] Vite build: clean
