---
phase: 06-cancel-and-ux-fixes
verified: 2026-03-03T20:30:00Z
status: human_needed
score: 4/4 must-haves verified (code); 4 UX flows require browser confirmation
re_verification: false
human_verification:
  - test: "Cancel single-file conversion: upload a PDF, click 'Annulla' while spinner is visible"
    expected: "Spinner disappears; full hero UploadZone is restored (not compact strip); app returns to idle"
    why_human: "State transition to idle and DOM rendering cannot be verified statically"
  - test: "Cancel batch item: upload 3+ files, click the X button on a 'Conversione' row"
    expected: "That row's badge changes to 'Annullato' (muted gray); all other rows continue converting normally"
    why_human: "Concurrent SSE behaviour and badge rendering require live browser testing"
  - test: "Header navigation — single-file: click 'Docling Webapp' while spinner is visible"
    expected: "App returns to idle; full hero UploadZone restored"
    why_human: "Visual state transition cannot be verified statically"
  - test: "Header navigation — batch: click 'Docling Webapp' while batch list is visible"
    expected: "Batch list clears; full hero UploadZone restored"
    why_human: "clearFiles + setState idle side-effect verified in code but DOM rendering needs browser"
  - test: "'Nuova conversione' button: convert a file to completion, click button in success header"
    expected: "Result disappears; full hero UploadZone restored (not compact strip)"
    why_human: "State reset and DOM rendering cannot be verified statically"
---

# Phase 6: cancel-and-ux-fixes — Verification Report

**Phase Goal:** Add cancellation controls for in-progress conversions, clickable header for global reset, and "Nuova conversione" button in success state — pure frontend UX controls, no backend changes
**Verified:** 2026-03-03T20:30:00Z
**Status:** human_needed (all code checks pass; browser confirmation pending)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking 'Annulla' in ConversionProgress cancels the single-file conversion and restores the full hero UploadZone | VERIFIED (code) | `ConversionProgress` receives `onCancel={() => setState({ phase: 'idle' })}` in `App.tsx:135`; `isConverting` becomes false; hero `UploadZone` is rendered when `isBatch` is false and `isConverting` is false — App.tsx:124-129 |
| 2 | Each BatchFileRow in 'converting' status shows an X cancel button; clicking it marks the file as 'Annullato' without affecting other files | VERIFIED (code) | X button rendered at `BatchFileRow.tsx:40-50` (guard: `item.status === 'converting'`); `cancelFile` uses functional `setFiles` with guard `status !== 'converting'` — `useBatchUpload.ts:119-129`; `cancelled` entry in `STATUS_BADGE` — `BatchFileRow.tsx:12` |
| 3 | Clicking 'Docling Webapp' header resets app to idle from any phase (including mid-conversion and batch) | VERIFIED (code) | `h1` has `onClick` calling both `batchHook.clearFiles()` and `setState({ phase: 'idle' })` — `App.tsx:82-95`; also has `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space keys |
| 4 | After single-file success, a 'Nuova conversione' button resets to idle and restores the full hero UploadZone | VERIFIED (code) | Button rendered inside `state.phase === 'success'` block with `onClick={() => setState({ phase: 'idle' })}` — `App.tsx:161-167`; hero UploadZone renders at idle phase — `App.tsx:124-129` |

**Score:** 4/4 truths verified in code

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/types/job.ts` | `BatchFileStatus` union includes `'cancelled'` | VERIFIED | Line 70: `export type BatchFileStatus = 'pending' \| 'converting' \| 'done' \| 'error' \| 'cancelled';` |
| `frontend/src/hooks/useBatchUpload.ts` | `cancelFile(id)` exported from hook | VERIFIED | Function defined at line 119; exported in return at line 138: `return { files, addFiles, retryFile, cancelFile, clearFiles };` |
| `frontend/src/components/ConversionProgress.tsx` | `onCancel` prop wired to cancel button | VERIFIED | Interface at lines 3-5; `onClick={onCancel}` on Button at line 12; 17 lines total — substantive implementation |
| `frontend/src/components/BatchFileRow.tsx` | Cancel button for `converting` status + `cancelled` in STATUS_BADGE | VERIFIED | `cancelled` in STATUS_BADGE at line 12; X button at lines 40-50 gated on `item.status === 'converting'` |
| `frontend/src/components/BatchList.tsx` | `onCancel` prop drilled to BatchFileRow | VERIFIED | Interface at line 9; passed to `BatchFileRow` at line 40 |
| `frontend/src/App.tsx` | Header onClick, ConversionProgress onCancel, 'Nuova conversione' button, BatchList onCancel | VERIFIED | All four wiring points confirmed: h1 onClick (82-95), ConversionProgress onCancel (134-137), 'Nuova conversione' button (161-167), BatchList onCancel (181) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx` header `onClick` | `setState({ phase: 'idle' }) + batchHook.clearFiles()` | `onClick` handler on `h1` | WIRED | Both calls present at App.tsx:83-85; `onKeyDown` at lines 88-93 also fires them |
| `ConversionProgress onCancel` | `setState({ phase: 'idle' })` (triggers `useJobStream` cleanup) | `onCancel` prop in App.tsx | WIRED | App.tsx:135: `onCancel={() => setState({ phase: 'idle' })}`; `useJobStream` uses `jobId` derived from `state.phase === 'converting'` — goes to null on idle, triggering `useEffect` cleanup |
| `BatchFileRow` cancel button | `useBatchUpload.cancelFile` | `onCancel` prop through `BatchList` | WIRED | BatchList passes `onCancel={onCancel}` to `BatchFileRow:40`; App.tsx:181 wires `onCancel={batchHook.cancelFile}` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-CANCEL-SINGLE | 06-01, 06-02 | Cancel in-progress single-file conversion | SATISFIED | `ConversionProgress.onCancel` → `setState(idle)` in App.tsx:135; user confirmed in 06-02 |
| UX-CANCEL-BATCH | 06-01, 06-02 | Per-item cancel in batch flow | SATISFIED | `cancelFile` in `useBatchUpload`; X button in `BatchFileRow`; wired via `BatchList.onCancel`; user confirmed in 06-02 |
| UX-HEADER-NAV | 06-01, 06-02 | Clickable header for global reset | SATISFIED | `h1` onClick + onKeyDown in App.tsx:80-96 calling `clearFiles + setState(idle)`; user confirmed in 06-02 |
| UX-RESET-SUCCESS | 06-01, 06-02 | 'Nuova conversione' button resets after success | SATISFIED | Button at App.tsx:161-167 with `onClick={() => setState({ phase: 'idle' })}`; user confirmed in 06-02 |

**Note on requirement definitions:** The four requirement IDs (UX-CANCEL-SINGLE, UX-CANCEL-BATCH, UX-HEADER-NAV, UX-RESET-SUCCESS) appear only in the REQUIREMENTS.md traceability table and in ROADMAP.md — they are not defined as formal requirement entries in the v1 or v2 sections. This is a documentation gap in REQUIREMENTS.md, not an implementation gap. The behaviors are fully implemented.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned all six modified files for TODO/FIXME, placeholder returns, empty handlers, and stub implementations. None found.

**Specific checks:**
- `ConversionProgress.tsx`: No `return null` or placeholder — real spinner + button rendered (17 lines)
- `useBatchUpload.ts:cancelFile`: Closes EventSource AND updates state via functional form with guard — not a stub
- `App.tsx` header `onKeyDown`: Full implementation with Enter/Space, not `() => {}`
- `BatchFileRow.tsx` X button: `onClick={() => onCancel(item.id)}` — real handler, not console.log

---

### Human Verification Required

The 06-02-SUMMARY.md documents that the user typed "approved" confirming all four browser tests passed. However, since this is a code verification pass (not relying on SUMMARY claims), the following browser tests should be re-confirmed if there is any doubt:

#### 1. Cancel Single-File Conversion

**Test:** Upload a PDF or DOCX, then click "Annulla" while the spinner is visible
**Expected:** Spinner disappears; full hero UploadZone is restored (not the compact batch strip); app is in idle state
**Why human:** The `setState({ phase: 'idle' })` call is correct in code, but visual restoration of the hero UploadZone (vs. compact strip) depends on the `isBatch` flag being false and `isConverting` being false — runtime verification confirms the DOM matches the logic

#### 2. Cancel Batch Item

**Test:** Upload 3+ files, wait for at least one to show "Conversione" status, click the X button
**Expected:** That file's badge changes to "Annullato" (muted gray, same as "In attesa"), other files continue
**Why human:** The `cancelFile` guard (`status !== 'converting'`) handles race conditions — browser testing with real SSE confirms the guard fires correctly and badge color matches the `bg-muted text-muted-foreground` class

#### 3. Header Navigation (both scenarios)

**Test a:** During single-file conversion (spinner visible), click "Docling Webapp"
**Expected:** Returns to idle; full hero UploadZone restored

**Test b:** During batch mode (list visible), click "Docling Webapp"
**Expected:** Batch list clears; full hero UploadZone restored
**Why human:** `clearFiles()` closes all EventSources — this is a side-effect-heavy operation verified only at runtime

#### 4. "Nuova conversione" Button

**Test:** Upload and convert a file to completion; when result is shown click "Nuova conversione"
**Expected:** Result disappears; full hero UploadZone is restored (not compact strip)
**Why human:** Verifies that `setState(idle)` with `isBatch=false` and `isConverting=false` correctly triggers the hero UploadZone render path

---

### Gaps Summary

No code gaps found. All four UX controls are fully implemented, wired, and non-stub. The `human_needed` status reflects that interactive browser flows (SSE cancellation, DOM transitions, visual badge appearance) cannot be verified by static code analysis alone.

The 06-02-SUMMARY.md records user approval of all four browser tests on 2026-03-03, which satisfies the human verification requirement documented in 06-02-PLAN.md.

---

*Verified: 2026-03-03T20:30:00Z*
*Verifier: Claude (gsd-verifier)*
