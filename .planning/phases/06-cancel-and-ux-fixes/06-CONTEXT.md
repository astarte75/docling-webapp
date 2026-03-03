# Phase 6: cancel-and-ux-fixes - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add cancellation support for in-progress conversions, make the header title clickable to navigate home, and add explicit reset controls to return the app to its initial idle state. No new conversion capabilities — only UX controls and navigation.

</domain>

<decisions>
## Implementation Decisions

### Cancel — single-file flow
- Cancel button appears inside `ConversionProgress` component (below the spinner)
- Cancel is frontend-only: closes the SSE stream and resets state to `idle`
- No backend abort endpoint needed — the backend job may complete in the background but its result is ignored
- After cancel: full UploadZone hero is restored (not compact strip)

### Cancel — batch flow
- Each `BatchFileRow` in `converting` status gets a cancel (X) button alongside the status badge
- Cancel closes the EventSource for that item and marks it as `cancelled` (new BatchFile status)
- Other files in the batch are unaffected
- A cancelled row shows a "Annullato" badge (neutral color, not red/error)

### Logo / header navigation
- The `<h1>Docling Webapp</h1>` becomes a clickable element (styled as a link, no underline)
- Click resets app state to `idle` from any phase
- No confirmation dialog — cancel is immediate (converting job just stops being watched)
- Logo click during batch mode: clears the batch and returns to idle

### Reset post-conversione (single-file)
- After success, the compact strip already allows dropping a new file
- Add a "Nuova conversione" button (ghost/outline variant) in the success state that explicitly resets to `idle` (restores full hero UploadZone)
- This is distinct from the compact strip: compact strip = add another file quickly; "Nuova conversione" = full reset

### Claude's Discretion
- Exact styling of cancel button (icon-only vs text, placement within ConversionProgress)
- Cancelled batch status badge color (muted gray suggested, not red)
- Whether header title cursor changes to pointer or has any hover effect

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` (shadcn/ui): cancel button in ConversionProgress, "Nuova conversione" in success state
- `useBatchUpload.clearFiles()`: already closes all EventSources — reusable for "cancel all"
- `streamsRef` (Map in useBatchUpload): cancel single file by calling `.close()` on the specific EventSource entry
- `BatchFileRow`: add cancel button alongside existing retry button (same pattern)
- `ConversionProgress`: currently just spinner — add cancel button below it

### Established Patterns
- State reset to `idle`: `setState({ phase: 'idle' })` — already done in error recovery
- `BatchFile.status` union type: add `'cancelled'` to the existing union in `types/job.ts`
- SSE close: `es.close()` pattern already used in `retryFile()` and `clearFiles()`

### Integration Points
- `App.tsx`: header `<h1>` → make clickable, call `setState({ phase: 'idle' })` + `batchHook.clearFiles()`
- `ConversionProgress`: receives `onCancel` prop → calls setState in App.tsx
- `useBatchUpload`: add `cancelFile(id: string)` alongside existing `retryFile` and `clearFiles`
- `BatchList`: pass `onCancel` down to `BatchFileRow` (same pattern as `onRetry`)

</code_context>

<specifics>
## Specific Ideas

- Cancel in ConversionProgress should feel lightweight — no modal/dialog, just a button below the spinner
- The header title click should be the only "go home" mechanism — no separate "Home" nav link needed

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-cancel-and-ux-fixes*
*Context gathered: 2026-03-03*
