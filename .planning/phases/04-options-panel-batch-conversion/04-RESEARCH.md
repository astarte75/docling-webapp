# Phase 4: Options Panel + Batch Conversion - Research

**Researched:** 2026-03-03
**Domain:** React UI controls (ToggleGroup, Collapsible), concurrent asyncio workers, Docling PipelineOptions, client-side ZIP generation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### OCR control placement
- OCR toggle (Auto/On/Off) lives **above** the upload zone — user configures before dropping files
- Presented as a **segmented button** (ToggleGroup): `[Auto] [On] [Off]` — all three options visible at once, no click to reveal
- Default: Auto
- Below the OCR toggle: a collapsible `[▼ Opzioni avanzate]` trigger

#### Advanced panel
- Opens as **accordion inline** — expands downward in the same column, above the upload zone
- Contents: Table detection toggle, Page range (from/to), OCR language selector
- Page range: `from` and `to` fields; `to` empty = convert until last page (no validation error for empty `to`)

#### Options binding
- Options are **baked in at drop time** — when user drops files, current OCR/advanced settings are sent to the backend for those files
- Changing options after dropping does NOT affect already-queued files
- This enables per-file option variance: drop doc1 with Auto, change to OCR On, drop doc2 → different options per file

#### Batch mode activation
- **Transparent / native multi-file** — no "batch mode" toggle; upload zone always accepts multiple files
- 1 file dropped → single-file flow (as today, result shown inline)
- 2+ files dropped → batch list appears automatically
- User can add more files mid-batch via `[+ Aggiungi altri file]` button

#### Batch layout
- When files are processing: upload zone compacts to a strip at top (`[+ Aggiungi altri file]`) — same pattern as single-file success state in Phase 3
- Batch list occupies the center: **compact rows** — filename + status badge per row
- Status values: `pending` / `converting` / `done` / `error`
- Below the list: `[Scarica ZIP (N file)]` button — appears as soon as ≥1 file is done (disabled if 0 done), shows count of successful files

#### Error handling in batch
- Each error row has an inline `[Riprova]` button for per-file retry
- Retry re-queues that single file with its original options

#### Settings persistence
- Options are **sticky for the session** — remain set until user changes them explicitly
- Reset to defaults (Auto, no advanced options) on page refresh
- No localStorage persistence

### Claude's Discretion
- Exact styling/colors for status badges (pending/converting/done/error)
- Animation for the converting state (spinner inline in the row)
- ZIP button disabled state styling while conversions are in progress
- Error message display for failed files (tooltip vs inline text)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONF-01 | User can set OCR mode (auto / on / off) from the main interface with a simple control | ToggleGroup (radix-ui, already in dependencies) renders 3 options; maps to `do_ocr` + `force_full_page_ocr` in PdfPipelineOptions |
| CONF-02 | User can expand/collapse an advanced options panel for additional Docling settings | Collapsible component (shadcn via `npx shadcn add collapsible`); single trigger + content pattern |
| CONF-03 | User can toggle table detection on/off in the advanced panel | Checkbox or Switch mapped to `PdfPipelineOptions.do_table_structure: bool` |
| CONF-04 | User can set a page range (from / to) for PDF documents in the advanced panel | Two number inputs; passed as `page_range=(from, to)` tuple to `converter.convert()` — one-based inclusive |
| CONF-05 | User can select OCR language from a list of supported EasyOCR languages in the advanced panel | Select/Combobox mapped to `EasyOcrOptions.lang: list[str]`; EasyOCR supports 80+ languages |
| BTCH-01 | User can upload multiple files in a single session from the same upload area | UploadZone `maxFiles: 1` → `multiple` + `onFilesSelected(files: File[])`; react-dropzone supports multiple natively |
| BTCH-02 | User sees individual conversion status for each file in the batch (pending / converting / done / error) | New `BatchFileItem` type in job.ts; `Map<string, BatchFile>` state keyed by client-generated UUID |
| BTCH-03 | System converts batch files in parallel up to a maximum of 2 concurrent jobs (configurable via env var) | `asyncio.Semaphore(MAX_CONCURRENT_JOBS)` replaces single FIFO worker; env var `MAX_CONCURRENT_JOBS` default 2 |
| BTCH-04 | User can download all successfully converted files as a single `.zip` archive | JSZip + client-side blob download; no server-side ZIP needed |
</phase_requirements>

## Summary

Phase 4 adds two orthogonal features: a configuration panel (OCR mode + advanced options) and batch conversion with ZIP download. The frontend work centers on three React primitives — ToggleGroup for the OCR segmented button, Collapsible for the advanced panel, and JSZip for client-side ZIP generation. All three integrate cleanly with the existing shadcn/Tailwind stack.

The backend change is a targeted refactor of `job_store.py`: the current single FIFO `conversion_worker` function is replaced with a semaphore-controlled pool of N concurrent workers. This is the standard Python asyncio concurrency pattern (`asyncio.Semaphore`) and does not require Celery or any new infrastructure. The `DoclingAdapter.convert_file()` signature gains a `PipelineOptions` parameter; the internal `asyncio.Lock` already serializes actual Docling calls, so the concurrency limit is an additional outer guard for queue throughput.

The trickiest integration point is "options baked at drop time": frontend must snapshot current settings when files are dropped and attach them to each `BatchFile` item, then send them as form fields alongside the file in the POST request. The backend `Job` dataclass must carry these options through to the worker.

**Primary recommendation:** Add ToggleGroup + Collapsible via `npx shadcn add toggle-group collapsible`, use `asyncio.Semaphore` for concurrency cap in the backend, and JSZip for client-side ZIP — no new infrastructure needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| radix-ui (ToggleGroup) | ^1.4.3 (already installed) | Segmented OCR mode selector | Already in project as `radix-ui` monorepo package; ToggleGroup is part of it |
| shadcn Collapsible | via `npx shadcn add collapsible` | Expandable advanced panel | Consistent with existing shadcn components (button, card, tabs) |
| shadcn Switch | via `npx shadcn add switch` | Table detection toggle | Single boolean UI control; accessible, matches design system |
| shadcn Select | via `npx shadcn add select` | OCR language selector | Dropdown with search; fits within advanced panel |
| JSZip | ^3.10.1 | Client-side ZIP generation | De-facto standard for in-browser ZIP; no server round-trip needed |
| asyncio.Semaphore | stdlib | Backend concurrency cap | Built-in Python; zero-dependency solution for limiting concurrent workers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.576.0 (already installed) | ChevronDown icon for collapsible trigger, Loader2 for spinner | Already in project |
| uuid (crypto.randomUUID) | browser built-in | Client-side batch item IDs | No library needed — `crypto.randomUUID()` available in all modern browsers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSZip (client-side) | Server-side ZIP endpoint | Server-side adds a new backend endpoint + temp file management; client-side is simpler and avoids downloading large files twice |
| asyncio.Semaphore | Multiple worker tasks | Multiple tasks pattern also works but is more complex; semaphore-inside-single-pool is cleaner for variable concurrency |
| shadcn Select | Combobox with search | Combobox enables filtering 80+ languages; can be swapped in if UX testing shows users need it (discretionary) |

**Installation:**
```bash
# Frontend: shadcn components not yet installed
npx shadcn add toggle-group collapsible switch select

# Frontend: JSZip
npm install jszip
npm install --save-dev @types/jszip

# Backend: no new dependencies — asyncio.Semaphore is stdlib
```

## Architecture Patterns

### Recommended Project Structure Changes
```
frontend/src/
├── components/
│   ├── OptionsPanel.tsx       # OCR ToggleGroup + Collapsible advanced panel
│   ├── BatchList.tsx          # List of BatchFile rows with status badges
│   ├── BatchFileRow.tsx       # Single row: filename, status badge, retry button
│   └── UploadZone.tsx         # Extended: maxFiles=multiple, onFilesSelected
├── hooks/
│   ├── useUpload.ts           # Unchanged (single file upload)
│   ├── useBatchUpload.ts      # New: manages array of uploads, concurrency optional
│   └── useJobStream.ts        # Unchanged (per-job SSE — reused per batch item)
├── types/
│   └── job.ts                 # Extended: BatchFile type, BatchAppPhase variants

backend/
├── job_store.py               # conversion_worker → semaphore-based pool
├── adapter.py                 # convert_file gains PipelineOptions param
├── config.py                  # Add MAX_CONCURRENT_JOBS env var
└── main.py                    # POST /convert: read options form fields, pass to Job
```

### Pattern 1: ToggleGroup for OCR Mode (Segmented Button)

**What:** Three-option single-select control using Radix ToggleGroup
**When to use:** Mutually exclusive choice among 2-4 options that should all be visible

```typescript
// Source: radix-ui ToggleGroup (already in dependencies as radix-ui monorepo)
import { ToggleGroup, ToggleGroupItem } from 'radix-ui';

type OcrMode = 'auto' | 'on' | 'off';

function OcrModeSelector({ value, onChange }: { value: OcrMode; onChange: (v: OcrMode) => void }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as OcrMode); }}
      className="inline-flex rounded-md border"
    >
      <ToggleGroup.Item value="auto" className="px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        Auto
      </ToggleGroup.Item>
      <ToggleGroup.Item value="on" className="border-x px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        On
      </ToggleGroup.Item>
      <ToggleGroup.Item value="off" className="px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        Off
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
```

**Key:** `onValueChange` only fires when a new value is selected; when clicking the already-selected item Radix returns `""` (empty string). Guard with `if (v)` to prevent deselection.

### Pattern 2: Collapsible Advanced Panel

**What:** Single-section expand/collapse using shadcn Collapsible
**When to use:** Panel with secondary options that should not clutter the main UI

```typescript
// Source: shadcn Collapsible (https://ui.shadcn.com/docs/components/radix/collapsible)
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

function AdvancedPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        Opzioni avanzate
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Pattern 3: Options Snapshot at Drop Time

**What:** Capture current settings into each batch file item when files are dropped
**When to use:** Options must not change for already-queued files

```typescript
// In App.tsx (or useBatch hook)
interface ConversionOptions {
  ocrMode: 'auto' | 'on' | 'off';
  tableDetection: boolean;
  pageFrom: number | null;
  pageTo: number | null;
  ocrLanguages: string[];
}

interface BatchFile {
  id: string;           // crypto.randomUUID()
  file: File;
  options: ConversionOptions;  // snapshot at drop time
  status: 'pending' | 'converting' | 'done' | 'error';
  jobId?: string;
  markdown?: string;
  errorMessage?: string;
}

// When files are dropped:
const handleFilesSelected = (files: File[]) => {
  const snapshot = { ...currentOptions };  // capture current settings
  const newItems: BatchFile[] = files.map(file => ({
    id: crypto.randomUUID(),
    file,
    options: snapshot,  // same snapshot for all files dropped together
    status: 'pending',
  }));
  setBatchFiles(prev => [...prev, ...newItems]);
};
```

### Pattern 4: Backend Semaphore-Controlled Concurrency

**What:** Replace single FIFO worker with semaphore-gated concurrent workers
**When to use:** Need bounded parallelism without Celery overhead

```python
# backend/job_store.py — replaces current conversion_worker
import asyncio
import os
import logging

logger = logging.getLogger(__name__)

MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))

async def conversion_worker(state) -> None:
    """Worker pool: processes jobs with MAX_CONCURRENT_JOBS concurrency cap."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

    async def process_job(job_id: str) -> None:
        job = state.jobs[job_id]
        async with semaphore:
            try:
                job.status = "converting"
                await job.events.put({"type": "started", "message": "Conversion started"})
                markdown = await state.converter.convert_file(job.tmp_path, job.options)
                job.status = "completed"
                await job.events.put({"type": "completed", "markdown": markdown})
            except RuntimeError as exc:
                job.status = "failed"
                await job.events.put({"type": "failed", "message": str(exc)})
            except Exception:
                logger.exception("Unexpected error processing job %s", job_id)
                job.status = "failed"
                await job.events.put({"type": "failed", "message": "Internal server error"})
            finally:
                if os.path.exists(job.tmp_path):
                    os.remove(job.tmp_path)
                state.dispatch_queue.task_done()

    while True:
        job_id = await state.dispatch_queue.get()
        # Fire-and-forget inside the loop; semaphore limits actual concurrency
        asyncio.create_task(process_job(job_id))
```

**Critical note:** `asyncio.create_task(process_job(job_id))` spawns tasks concurrently; the semaphore limits how many are in `convert_file` at once. The `DoclingAdapter._lock` still serializes the actual Docling calls — the semaphore controls queue throughput, the lock controls the converter itself.

### Pattern 5: Docling PipelineOptions from Job Options

**What:** Map frontend options to Docling PdfPipelineOptions
**When to use:** Each job carries its own conversion settings

```python
# backend/adapter.py
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions, EasyOcrOptions
from dataclasses import dataclass
from typing import Optional

@dataclass
class ConversionOptions:
    ocr_mode: str = "auto"          # "auto" | "on" | "off"
    table_detection: bool = True
    page_from: Optional[int] = None  # 1-based inclusive
    page_to: Optional[int] = None    # 1-based inclusive, None = last page
    ocr_languages: list[str] = None  # EasyOCR lang codes, None = default ["en"]

def build_pipeline_options(opts: ConversionOptions) -> PdfPipelineOptions:
    pipeline_options = PdfPipelineOptions()

    # OCR mode
    if opts.ocr_mode == "off":
        pipeline_options.do_ocr = False
    else:
        pipeline_options.do_ocr = True
        ocr_opts = EasyOcrOptions()
        if opts.ocr_mode == "on":
            ocr_opts.force_full_page_ocr = True
        if opts.ocr_languages:
            ocr_opts.lang = opts.ocr_languages
        pipeline_options.ocr_options = ocr_opts

    # Table detection
    pipeline_options.do_table_structure = opts.table_detection

    return pipeline_options

class DoclingAdapter:
    async def convert_file(self, file_path: str, opts: ConversionOptions) -> str:
        pipeline_options = build_pipeline_options(opts)
        converter = DocumentConverter(
            format_options={"application/pdf": PdfFormatOption(pipeline_options=pipeline_options)}
        )
        # NOTE: Lock still required — Docling PDF backend has shared state
        async with self._lock:
            kwargs = {}
            if opts.page_from is not None:
                page_to = opts.page_to if opts.page_to is not None else 99999
                kwargs["page_range"] = (opts.page_from, page_to)
            result = await asyncio.to_thread(converter.convert, file_path, **kwargs)
        # ...
```

**Warning:** Creating a new `DocumentConverter` per request (with custom options) means model weights must be loaded fresh each time, which is expensive. See "Common Pitfalls" section for the recommended solution.

### Pattern 6: Client-Side ZIP Download with JSZip

**What:** Bundle all successful markdown files into a ZIP and trigger browser download
**When to use:** User clicks "Scarica ZIP"

```typescript
// Source: https://stuk.github.io/jszip/
import JSZip from 'jszip';

async function downloadBatchZip(files: BatchFile[]): Promise<void> {
  const zip = new JSZip();

  for (const f of files) {
    if (f.status === 'done' && f.markdown) {
      const basename = f.file.name.replace(/\.[^.]+$/, '');
      zip.file(`${basename}.md`, f.markdown);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted.zip';
  a.click();
  URL.revokeObjectURL(url);
}
```

### Pattern 7: Sending Options as Form Fields to Backend

**What:** Attach conversion options alongside the file in multipart POST request
**When to use:** Each file upload carries its per-snapshot options

```typescript
// In useBatchUpload hook or upload function
async function uploadFileWithOptions(file: File, opts: ConversionOptions): Promise<ConvertResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ocr_mode', opts.ocrMode);
  formData.append('table_detection', String(opts.tableDetection));
  if (opts.pageFrom !== null) formData.append('page_from', String(opts.pageFrom));
  if (opts.pageTo !== null) formData.append('page_to', String(opts.pageTo));
  if (opts.ocrLanguages.length > 0) formData.append('ocr_languages', opts.ocrLanguages.join(','));

  const res = await fetch('/api/convert', { method: 'POST', body: formData });
  // ...
}
```

```python
# backend/main.py — updated /convert endpoint
from fastapi import Form
from typing import Optional

@app.post("/convert")
async def convert(
    request: Request,
    file: UploadFile,
    ocr_mode: str = Form(default="auto"),
    table_detection: bool = Form(default=True),
    page_from: Optional[int] = Form(default=None),
    page_to: Optional[int] = Form(default=None),
    ocr_languages: Optional[str] = Form(default=None),  # comma-separated
) -> JSONResponse:
    # ... existing file validation ...
    options = ConversionOptions(
        ocr_mode=ocr_mode,
        table_detection=table_detection,
        page_from=page_from,
        page_to=page_to,
        ocr_languages=ocr_languages.split(",") if ocr_languages else None,
    )
    job = Job(job_id=job_id, tmp_path=tmp_path, options=options)
    # ...
```

### Anti-Patterns to Avoid

- **Sharing one DocumentConverter singleton with per-request PipelineOptions:** The singleton is initialized with fixed options at startup. Options must be passed differently — see "Don't Hand-Roll" section for the correct approach.
- **Opening N SSE connections for N batch files simultaneously:** This can exhaust browser connection limits (typically 6 per domain). Start SSE connections lazily, only when a job transitions to `converting`.
- **Sending all batch files as one multipart request:** The current backend API accepts one file per request. Keep one-file-per-POST pattern; the frontend manages the batch loop.
- **Storing markdown in React state for large batches:** If many large documents are converted, storing all markdown in memory can cause memory pressure. For v1 batch sizes this is acceptable; note it as a v2 concern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP archive creation | Custom byte concatenation with ZIP spec | JSZip | ZIP format has CRC, compression, local/central headers — hand-rolling will corrupt archives |
| Segmented toggle control | `<div>` with manual active class management | radix-ui ToggleGroup | Keyboard nav, ARIA, focus management built-in |
| Expand/collapse panel | CSS height transition + manual `aria-expanded` | shadcn Collapsible | Animation, accessibility, ref management already handled |
| OCR language dropdown | `<select>` with 80 hardcoded `<option>` | shadcn Select | Accessible, consistent styling, searchable variant available |
| Concurrent job semaphore | Manual counter with `asyncio.Event` | `asyncio.Semaphore` | Built-in, correct, tested — semaphores are the canonical primitive |

**Key insight:** The ZIP and semaphore problems look simple but have correctness edge cases. JSZip handles compression, encoding, and streaming; `asyncio.Semaphore` handles acquire/release atomically.

## Common Pitfalls

### Pitfall 1: DocumentConverter Singleton vs. Per-Request Options

**What goes wrong:** The current `DoclingAdapter` creates one `DocumentConverter` at startup with default options. Phase 4 requires per-job options. If you try to pass options to the singleton, they may not apply or cause races.

**Why it happens:** Docling's `DocumentConverter` bundles pipeline options at construction time (format_options parameter). There is no documented API to change options on a live converter instance.

**How to avoid:** Two valid approaches:
1. Create a new `DocumentConverter` per job call (inside `asyncio.to_thread`). This is simpler but reloads model weights each time — acceptable only if models are pre-loaded/cached by Docling internally (verify).
2. Keep the singleton for the "auto" default case; create a new converter only when options differ from defaults. More complex but avoids per-call overhead.

**Recommended approach for v1:** Create converter inside `convert_file` when options are non-default; keep the singleton path for the common case (Auto OCR, table detection on, no page range). The `asyncio.Lock` must cover the entire creation+conversion block.

**Warning signs:** Conversion times suddenly spike (model reload), or options from one job bleed into another (race condition).

### Pitfall 2: ToggleGroup Empty-String onValueChange

**What goes wrong:** When a user clicks the already-selected ToggleGroup item, Radix fires `onValueChange("")` (empty string), which would reset OCR mode to undefined.

**Why it happens:** Radix ToggleGroup with `type="single"` allows deselection by default.

**How to avoid:** Guard the callback: `onValueChange={(v) => { if (v) onChange(v as OcrMode); }}`. This makes the control behave as a required single-select (like radio buttons).

**Warning signs:** OCR mode suddenly becomes empty string after user interaction.

### Pitfall 3: page_range Indexing Confusion

**What goes wrong:** UI shows 1-based page numbers (natural for users), but passing 0-based values to Docling's `convert()`.

**Why it happens:** Historical confusion in Docling docs; confirmed behavior is **1-based inclusive** (page 1 = first page). The `page_range=(1, 5)` converts pages 1 through 5 inclusive.

**How to avoid:** UI inputs are 1-based natural numbers. Pass directly to backend. Backend passes directly to `converter.convert(source, page_range=(from, to))`. No adjustment needed.

**Warning signs:** Page range off by one — first page missing or last page repeated.

### Pitfall 4: SSE Connection Limit in Batch Mode

**What goes wrong:** Browser enforces a limit of ~6 concurrent HTTP/1.1 connections per host. Opening 10 SSE streams simultaneously blocks all other requests.

**Why it happens:** EventSource holds a persistent connection; browsers cap concurrent connections.

**How to avoid:** Open SSE connection for a job only when its status transitions to `converting` (not `pending`). Since the backend limits concurrency to 2, at most 2 SSE connections are open at any time.

**Warning signs:** Network tab shows requests queued/stalled; UI feels frozen during batch.

### Pitfall 5: Race Condition in Batch Status Updates

**What goes wrong:** Multiple concurrent SSE callbacks updating shared `batchFiles` state using stale closures.

**Why it happens:** React state updates from callbacks use the closure's captured state if not using functional updates.

**How to avoid:** Always use functional `setState` form when updating batch items:
```typescript
setBatchFiles(prev => prev.map(f => f.id === itemId ? { ...f, status: 'done', markdown } : f));
```

**Warning signs:** Batch items showing wrong status, or status updates disappearing.

## Code Examples

Verified patterns from official sources:

### Docling PdfPipelineOptions — OCR Toggle
```python
# Source: https://docling-project.github.io/docling/reference/pipeline_options/
from docling.datamodel.pipeline_options import PdfPipelineOptions, EasyOcrOptions

# OCR off
pipeline_options = PdfPipelineOptions(do_ocr=False)

# OCR forced (full page)
pipeline_options = PdfPipelineOptions(do_ocr=True)
ocr_options = EasyOcrOptions(force_full_page_ocr=True, lang=["en", "fr"])
pipeline_options.ocr_options = ocr_options

# Table detection off
pipeline_options.do_table_structure = False
```

### Docling page_range (1-based inclusive)
```python
# Source: https://github.com/docling-project/docling/discussions/2744
# Convert pages 2 through 5 only
result = converter.convert(source, page_range=(2, 5))

# Convert page 3 only
result = converter.convert(source, page_range=(3, 3))

# Convert from page 2 to end of document
result = converter.convert(source, page_range=(2, 99999))
```

### asyncio.Semaphore — Bounded Concurrency
```python
# Source: https://docs.python.org/3/library/asyncio-sync.html#asyncio.Semaphore
semaphore = asyncio.Semaphore(2)  # max 2 concurrent

async def bounded_task():
    async with semaphore:
        await do_work()  # at most 2 coroutines here at once
```

### JSZip — Generate and Download ZIP
```typescript
// Source: https://stuk.github.io/jszip/documentation/examples/download-zip-file.html
import JSZip from 'jszip';

const zip = new JSZip();
zip.file("file1.md", "# Content 1");
zip.file("file2.md", "# Content 2");

const blob = await zip.generateAsync({ type: "blob" });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = "converted.zip";
a.click();
URL.revokeObjectURL(url);
```

### UploadZone Multi-File Extension
```typescript
// react-dropzone supports multiple files natively
// Source: https://react-dropzone.js.org/ (already in dependencies ^15.0.0)
const { getRootProps, getInputProps } = useDropzone({
  accept: { 'application/pdf': ['.pdf'] },
  maxSize: MAX_FILE_SIZE,
  multiple: true,          // remove maxFiles: 1
  onDropAccepted: (files) => {
    onFilesSelected(files); // new prop replacing onFileSelected
  },
});
```

### AppPhase Extension for Batch
```typescript
// Extend job.ts — batch phases alongside existing single-file phases
export type BatchFileStatus = 'pending' | 'converting' | 'done' | 'error';

export interface BatchFile {
  id: string;
  file: File;
  options: ConversionOptions;  // snapshot at drop time
  status: BatchFileStatus;
  jobId?: string;
  markdown?: string;
  errorMessage?: string;
}

export type AppPhase =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string }
  | { phase: 'error'; message: string; file: File }
  | { phase: 'batch-active'; files: BatchFile[] }
  | { phase: 'batch-complete'; files: BatchFile[] };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single FIFO worker | Semaphore-bounded concurrent pool | Phase 4 | Up to 2 jobs process in parallel without Celery |
| Single file upload (`maxFiles: 1`) | Multi-file upload (`multiple: true`) | Phase 4 | UploadZone always accepts N files |
| Fixed DocumentConverter (no options) | DocumentConverter with PipelineOptions | Phase 4 | Each job carries its own OCR/table settings |
| No ZIP capability | Client-side JSZip | Phase 4 | Single download action for all completed files |

**Note about Tailwind version:** Project uses Tailwind v4 (`tailwindcss: ^4.2.1`). The `@tailwindcss/vite` plugin is already configured. `tw-animate-css` is in devDependencies. Any Collapsible animation classes must use v4 syntax (no `@apply` with purge, just utility classes directly).

## Open Questions

1. **DocumentConverter per-request vs. singleton with options**
   - What we know: Singleton created at startup has fixed options; creating per-request loads models fresh
   - What's unclear: Whether Docling caches model weights internally so repeated instantiation is cheap (needs benchmarking)
   - Recommendation: Start with per-request `DocumentConverter` for correctness; if conversion time spikes are observed, refactor to a converter pool or pass options via a different mechanism

2. **page_range when `to` is empty**
   - What we know: User decision says `to` empty = convert until last page; `99999` is a reasonable large number
   - What's unclear: Docling's actual behavior when `page_range` exceeds document length (issue #1469 was fixed for exceeding range, but verify current version)
   - Recommendation: Use `sys.maxsize` or simply omit `page_range` when `to` is None

3. **EasyOCR language list for UI**
   - What we know: EasyOCR supports 80+ languages; `lang` takes list of ISO 639-1 codes
   - What's unclear: Which subset is meaningful to expose; whether all are installed in the Docker image
   - Recommendation: Expose a curated list of ~15 common languages; hardcode in frontend `SUPPORTED_OCR_LANGUAGES` constant

## Sources

### Primary (HIGH confidence)
- https://docling-project.github.io/docling/reference/pipeline_options/ — PdfPipelineOptions, EasyOcrOptions fields
- https://docling-project.github.io/docling/reference/document_converter/ — convert() signature, page_range parameter
- https://docs.python.org/3/library/asyncio-sync.html — asyncio.Semaphore API
- https://stuk.github.io/jszip/ — JSZip API and download example
- https://www.radix-ui.com/primitives/docs/components/toggle-group — ToggleGroup API
- Existing codebase: App.tsx, job_store.py, adapter.py, job.ts, UploadZone.tsx — verified directly

### Secondary (MEDIUM confidence)
- https://github.com/docling-project/docling/discussions/2744 — page_range 1-based indexing confirmed by community
- https://ui.shadcn.com/docs/components/radix/collapsible — Collapsible component pattern
- https://github.com/JaidedAI/EasyOCR — EasyOCR language codes list (80+ languages)

### Tertiary (LOW confidence)
- WebSearch results on DocumentConverter per-request cost — not directly benchmarked; marked as open question

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in official docs or already in project dependencies
- Architecture: HIGH — patterns derived from existing codebase + official API docs
- Pitfalls: MEDIUM — ToggleGroup and page_range pitfalls verified; DocumentConverter singleton pitfall is inferred from API structure (needs benchmarking to confirm severity)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Docling is actively developed; check changelog if >30 days)
