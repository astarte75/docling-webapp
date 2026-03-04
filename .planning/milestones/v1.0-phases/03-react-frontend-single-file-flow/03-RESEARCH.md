# Phase 3: React Frontend — Single File Flow - Research

**Researched:** 2026-03-03
**Domain:** React 18 + Vite + shadcn/ui + TanStack Query + react-dropzone + SSE client
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Layout:**
- Hero-style upload area centered and prominent on initial load
- After conversion completes: upload area shrinks to a compact form at the top (stays visible — user can immediately drop another file without scrolling)
- Result section appears below: generic "Conversion complete" message + prominent download button + full-width Markdown preview
- No split view — single-column flow

**Conversion state:**
- No upload progress bar — transition directly from file selected to "Converting..." state (UPLD-05 is technically a requirement but user confirmed it adds no value for typical PDF sizes; Claude can implement a minimal/instant progress if needed to satisfy the requirement without visual noise)
- Converting state: animated spinner + static text "Converting your document..."
- No fake progress steps or changing messages — honest minimal UI
- Error state: error message displayed + file remains selected + retry button — user can retry without reselecting the file
- Success state: upload area compresses to top, result section appears below

**Result viewer:**
- Full-width preview area below the action bar
- Tab switcher: "Preview" (rendered Markdown via react-markdown, default) | "Raw" (monospace source)
- Sticky action bar at the top of the preview area — always visible when scrolling long results
- Action bar contains: "Download .md" button (primary) + "Copy to clipboard" button
- Copy feedback: button text changes to "Copied!" for 2 seconds, then reverts — no toast

### Claude's Discretion
- Exact spacing, typography, and color palette within shadcn/ui + Tailwind constraints
- Upload area visual design (border style, icon, helper text)
- Exact compact layout of upload area after conversion (height, visibility of dropzone vs just a button)
- Loading skeleton or transition animations between states
- Error message formatting and iconography

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLD-01 | User can drag-and-drop one or more files onto the upload area | react-dropzone `useDropzone` with `getRootProps`/`getInputProps`/`isDragActive` |
| UPLD-02 | User can click to browse and select files from the file system | react-dropzone `getInputProps` provides a hidden `<input type="file">` — click on zone opens dialog |
| UPLD-03 | System validates file format client-side (PDF only in Phase 3) and rejects unsupported types with a clear error message | react-dropzone `accept` prop: `{ 'application/pdf': ['.pdf'] }` + `onDropRejected` callback for error messages |
| UPLD-04 | System enforces 50MB per-file size limit and shows rejection message | react-dropzone `maxSize: 50 * 1024 * 1024` + `onDropRejected` callback includes `FileRejection[]` with error codes |
| UPLD-05 | User sees a progress bar during file upload (minimal/instant per user decision) | User confirmed visual noise not worth it — implement as instant transition to "Converting..." state; OR use XHR `onprogress` silently behind the scenes |
| OUTP-01 | User sees rendered Markdown preview inline | react-markdown v10 + remark-gfm v4 — wrap in `<div className="prose">` since v10 removed `className` prop |
| OUTP-02 | User can download the converted document as a `.md` file | Native browser: create `<a href={blobUrl} download="filename.md">` and trigger programmatic click |
| OUTP-03 | User can copy full Markdown to clipboard with one click | `navigator.clipboard.writeText(text)` — async, returns Promise; show "Copied!" state for 2 seconds via `useState` |
</phase_requirements>

---

## Summary

Phase 3 builds the complete React frontend starting from scratch. The stack is locked: Vite + React 18 + TypeScript + Tailwind CSS (via `@tailwindcss/vite`) + shadcn/ui + TanStack Query v5 + react-dropzone + react-markdown. The shadcn/ui installation path for Vite changed in late 2024 — Tailwind v4 integration is now done via the `@tailwindcss/vite` plugin instead of the legacy `tailwind.config.js` approach. This is the current documented setup (verified from official shadcn/ui docs 2025).

The key integration challenge is the two-phase async flow: (1) POST file → receive `job_id`, (2) open `EventSource` to `/jobs/{job_id}/stream` and listen for `completed`/`failed` events. TanStack Query v5 handles phase 1 via `useMutation`. Phase 2 is best handled with a custom `useJobStream` hook that manages `EventSource` lifecycle inside `useEffect` with proper cleanup on unmount. react-markdown v10 introduces one breaking change: the `className` prop was removed — render output must be wrapped in a parent `<div>`.

The biggest pitfalls are: (a) forgetting to close the `EventSource` after `completed`/`failed` events (connection stays open forever), (b) the react-dropzone `accept` prop format changed in v11+ from a string to an object keyed by MIME type — using the old string format silently fails, (c) Vite proxy is required in dev since frontend and backend run on separate ports.

**Primary recommendation:** Scaffold with `npm create vite@latest`, add shadcn/ui via `pnpm dlx shadcn@latest init`, build four focused components: `UploadZone`, `ConversionProgress`, `ResultViewer`, and wire them with a top-level `App` state machine that moves through: `idle → uploading → converting → success | error`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Locked by project decision |
| TypeScript | 5.x | Type safety | Locked by project decision |
| Vite | 6.x | Build tool + dev server | Fastest DX, official shadcn target |
| Tailwind CSS | 4.x (via `@tailwindcss/vite`) | Utility styling | shadcn/ui dependency; new plugin model in v4 |
| shadcn/ui | latest | UI component library | Locked by project decision |
| TanStack Query | 5.x | Server state + mutations | Locked by project decision |
| react-dropzone | 14.3.x | Drag-and-drop file input | Locked by project decision |
| react-markdown | 10.x | Render Markdown in browser | Locked by project decision |
| remark-gfm | 4.x | GFM tables, strikethrough, tasklists | Required plugin for react-markdown |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/node` | latest | Node types for Vite path aliases | Needed for `path.resolve` in vite.config.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native EventSource | `@react-nano/use-event-source` | Native is simpler; no auth headers needed (no credentials on SSE endpoint) |
| Native `navigator.clipboard` | `use-copy-to-clipboard` lib | Native API is 2 lines; no dependency needed |
| Native Blob download | A download library | Native `URL.createObjectURL` is sufficient |

**Installation:**
```bash
# 1. Scaffold
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# 2. shadcn/ui + Tailwind v4
npm install tailwindcss @tailwindcss/vite
npm install -D @types/node
npx shadcn@latest init

# 3. Application dependencies
npm install @tanstack/react-query react-dropzone react-markdown remark-gfm

# 4. shadcn components needed
npx shadcn@latest add button card tabs progress
```

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── UploadZone.tsx         # react-dropzone + validation
│   │   ├── ConversionProgress.tsx # spinner + "Converting..." text
│   │   ├── ResultViewer.tsx       # tabs: Preview | Raw + action bar
│   │   └── ui/                   # shadcn generated components
│   ├── hooks/
│   │   ├── useUpload.ts          # useMutation wrapping POST /api/convert
│   │   └── useJobStream.ts       # EventSource lifecycle hook
│   ├── lib/
│   │   ├── api.ts                # fetch helpers, base URL
│   │   └── utils.ts              # shadcn cn() utility (auto-generated)
│   ├── types/
│   │   └── job.ts                # JobStatus, SSEEvent types
│   ├── App.tsx                   # top-level state machine
│   └── main.tsx                  # QueryClientProvider root
├── vite.config.ts                # proxy /api → backend
├── components.json               # shadcn config (auto-generated)
└── index.html
```

### Pattern 1: App-Level State Machine
**What:** Single `useState` with a union type drives which UI section renders. No complex state library needed.
**When to use:** Linear flows with clear states — exactly what this phase requires.
**Example:**
```typescript
// App.tsx
type AppState =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string }
  | { phase: 'error'; message: string; file: File };

const [state, setState] = useState<AppState>({ phase: 'idle' });
```

### Pattern 2: useMutation for File Upload
**What:** TanStack Query v5 `useMutation` wraps the POST to `/api/convert`.
**When to use:** Any server write operation where you need loading/error states.
**Example:**
```typescript
// hooks/useUpload.ts
// Source: https://tanstack.com/query/v5/docs/framework/react/guides/mutations
import { useMutation } from '@tanstack/react-query';

export function useUpload() {
  return useMutation({
    mutationFn: async (file: File): Promise<{ job_id: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Upload failed');
      }
      return res.json();
    },
  });
}
```

### Pattern 3: useJobStream Hook (EventSource lifecycle)
**What:** Custom hook opens an `EventSource`, listens for `completed`/`failed`, then closes it.
**When to use:** Any SSE stream with a finite completion event.
**Example:**
```typescript
// hooks/useJobStream.ts
import { useEffect } from 'react';

type StreamCallbacks = {
  onCompleted: (markdown: string) => void;
  onFailed: (message: string) => void;
};

export function useJobStream(jobId: string | null, callbacks: StreamCallbacks) {
  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/jobs/${jobId}/stream`);

    es.addEventListener('completed', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      callbacks.onCompleted(data.markdown);
      es.close(); // CRITICAL: close after terminal event
    });

    es.addEventListener('failed', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      callbacks.onFailed(data.message);
      es.close(); // CRITICAL: close after terminal event
    });

    es.onerror = () => {
      callbacks.onFailed('Connection error');
      es.close();
    };

    return () => es.close(); // cleanup on unmount
  }, [jobId]);
}
```

### Pattern 4: react-dropzone with Validation
**What:** `useDropzone` hook with `accept` object and `maxSize` props.
**When to use:** Any file input requiring type/size validation.
**Example:**
```typescript
// components/UploadZone.tsx
// Source: https://react-dropzone.js.org (v14.3.x)
import { useDropzone, FileRejection } from 'react-dropzone';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: {
    'application/pdf': ['.pdf'],
  },
  maxSize: MAX_SIZE,
  maxFiles: 1,
  onDropAccepted: (files) => onFileSelected(files[0]),
  onDropRejected: (rejections: FileRejection[]) => {
    const first = rejections[0];
    const code = first.errors[0].code;
    if (code === 'file-too-large') setError('File exceeds 50MB limit');
    else if (code === 'file-invalid-type') setError('Only PDF files are supported');
    else setError('File rejected');
  },
});
```

### Pattern 5: react-markdown v10 Rendering
**What:** Wrap `<Markdown>` in a container div; use `remark-gfm` for GFM tables.
**When to use:** Displaying converted Markdown output.
**Example:**
```typescript
// Source: https://github.com/remarkjs/react-markdown (v10.x)
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// v10 BREAKING CHANGE: className prop removed — wrap in div instead
<div className="prose prose-sm max-w-none">
  <Markdown remarkPlugins={[remarkGfm]}>
    {markdownContent}
  </Markdown>
</div>
```

### Pattern 6: Download .md File (native)
**What:** Create an object URL from a Blob and trigger a click.
**When to use:** Any client-side file download from string content.
**Example:**
```typescript
function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, '') + '.md';
  a.click();
  URL.revokeObjectURL(url); // cleanup immediately
}
```

### Pattern 7: Copy to Clipboard
**What:** `navigator.clipboard.writeText` + 2-second feedback state.
**When to use:** Copy content to clipboard with temporal visual feedback.
**Example:**
```typescript
const [copied, setCopied] = useState(false);

async function handleCopy() {
  await navigator.clipboard.writeText(markdownContent);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

// Button label: copied ? 'Copied!' : 'Copy to clipboard'
```

### Pattern 8: Vite Dev Proxy
**What:** Forward `/api/*` to FastAPI backend during development.
**When to use:** Dev only — production uses nginx proxy (Phase 5).
**Example:**
```typescript
// vite.config.ts
// Source: https://vite.dev/config/server-options
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

### Anti-Patterns to Avoid
- **Using `useQuery` for the SSE stream:** TanStack Query is not designed for streaming responses. Use a plain `useEffect` with native `EventSource`.
- **Not closing EventSource after terminal events:** Without explicit `es.close()` on `completed`/`failed`, the browser keeps the connection open indefinitely. The SSE `started` → `completed|failed` flow is finite — always close.
- **Using react-dropzone `accept` as a string:** The old string format (`accept="application/pdf"`) was deprecated in v11 and removed. Use the object format `{ 'application/pdf': ['.pdf'] }`.
- **Passing `className` to `<Markdown>` in v10:** Removed in react-markdown v10 — use a wrapping `<div>` instead.
- **Forgetting `URL.revokeObjectURL` after download:** Creates memory leaks from lingering object URLs.
- **Reading `file.name` for extension filtering during drag:** react-dropzone cannot read filenames during drag events — only MIME types are available. The `accept` object keys (MIME types) are what's checked at drag time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop file input | Custom drag event listeners | react-dropzone `useDropzone` | Handles drag enter/leave/over/drop, file dialog, touch events, keyboard accessibility, `dataTransfer` quirks |
| File type and size validation | Manual `file.type` checks | react-dropzone `accept` + `maxSize` props | Consistent error codes (`file-too-large`, `file-invalid-type`), handles browser MIME type inconsistencies |
| Upload loading/error state | `useState` + manual fetch | TanStack Query `useMutation` | Deduplication, retry logic, consistent `isPending`/`isError` states |
| Markdown rendering | Custom Markdown parser | react-markdown + remark-gfm | Handles GFM, XSS-safe by default (no `dangerouslySetInnerHTML`) |
| UI components (button, tabs, progress) | Custom CSS components | shadcn/ui | Accessible by default (Radix primitives), consistent design tokens |

**Key insight:** react-dropzone handles dozens of browser edge cases in drag-and-drop that are invisible until they break in production (Firefox vs Chrome drag behavior, macOS Finder dropping multiple items, etc.).

---

## Common Pitfalls

### Pitfall 1: EventSource Left Open After Job Completes
**What goes wrong:** The SSE connection stays open in the browser Network tab indefinitely, consuming server resources and potentially triggering backend errors when the backend tries to GC the job.
**Why it happens:** EventSource auto-reconnects by default and doesn't auto-close when the server stream ends.
**How to avoid:** Always call `es.close()` inside the `completed` and `failed` event handlers AND in the `onerror` handler, before the `useEffect` cleanup return.
**Warning signs:** Network tab shows an SSE connection that never terminates; server logs show repeated reconnect attempts.

### Pitfall 2: react-dropzone Accept Prop Format
**What goes wrong:** Dropzone accepts all file types silently — no rejection for wrong types.
**Why it happens:** Using the old string format `accept="application/pdf"` which was valid in v10 but was changed to an object in v11+. Silent failure — no error thrown.
**How to avoid:** Use `accept: { 'application/pdf': ['.pdf'] }` (object format required in v14).
**Warning signs:** Users can drop DOCX files onto the zone without getting an error.

### Pitfall 3: Vite Proxy Missing in Dev
**What goes wrong:** All `/api/*` fetch requests fail with CORS errors or 404s in development.
**Why it happens:** Frontend at `:5173` and backend at `:8000` are different origins; no proxy configured.
**How to avoid:** Configure `server.proxy` in `vite.config.ts` pointing `/api` to `http://localhost:8000` with `rewrite` to strip the `/api` prefix (backend routes are at `/convert`, `/jobs/*`).
**Warning signs:** Browser console shows `CORS policy` blocked or `Failed to fetch` on any API call.

### Pitfall 4: react-markdown v10 className Removed
**What goes wrong:** TypeScript type error: `Property 'className' does not exist on type...`; or if using JS, the className is silently ignored and prose styling never applies.
**Why it happens:** react-markdown v10 (released Feb 2025) removed the `className` prop from `<Markdown>`.
**How to avoid:** Wrap `<Markdown>` in a `<div className="prose ...">` parent element.
**Warning signs:** Markdown renders without any styling; TypeScript errors on the Markdown component.

### Pitfall 5: shadcn Tailwind v4 Setup Differences
**What goes wrong:** Tailwind styles don't apply; `tailwind.config.js` not found errors; PostCSS config conflicts.
**Why it happens:** shadcn/ui with Tailwind v4 uses `@tailwindcss/vite` plugin — NOT the old `tailwind.config.js` + `postcss.config.js` setup. Old tutorials still show the v3 approach.
**How to avoid:** Follow the official shadcn/ui Vite 2025 docs. `src/index.css` should contain `@import "tailwindcss";` — no `@tailwind base/components/utilities` directives.
**Warning signs:** No styles applied; console warning about missing PostCSS plugin.

### Pitfall 6: TanStack Query v5 API Changes
**What goes wrong:** Build errors or runtime failures if using v4 patterns.
**Why it happens:** In v5, `useQuery(key, fn, options)` was changed to `useQuery({ queryKey, queryFn, ...options })`. `onSuccess`/`onError` callbacks were removed from `useQuery`.
**How to avoid:** Use v5 object syntax throughout. For side effects after `useMutation`, use `onSuccess`/`onError` in the `useMutation` options (still supported there) or the `mutation.isSuccess` state in `useEffect`.
**Warning signs:** TypeScript errors about too many arguments to `useQuery`.

---

## Code Examples

### Full useDropzone with validation and error messages
```typescript
// Source: https://react-dropzone.js.org (v14.3.x verified)
import { useDropzone, FileRejection, ErrorCode } from 'react-dropzone';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

function getRejectionMessage(rejections: FileRejection[]): string {
  if (!rejections.length) return '';
  const error = rejections[0].errors[0];
  switch (error.code) {
    case ErrorCode.FileTooLarge:
      return 'File exceeds the 50MB limit';
    case ErrorCode.FileInvalidType:
      return 'Only PDF files are supported';
    case ErrorCode.TooManyFiles:
      return 'Please select one file at a time';
    default:
      return error.message;
  }
}

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: { 'application/pdf': ['.pdf'] },
  maxSize: MAX_FILE_SIZE,
  maxFiles: 1,
  onDropAccepted: ([file]) => handleFileAccepted(file),
  onDropRejected: (rejections) => setError(getRejectionMessage(rejections)),
});
```

### QueryClient setup at root
```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/quick-start
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
```

### Sticky action bar with Tabs (shadcn/ui)
```typescript
// ResultViewer.tsx — action bar stays visible while scrolling long output
<div className="flex flex-col h-full">
  {/* Sticky action bar */}
  <div className="sticky top-0 z-10 bg-background border-b flex items-center justify-between p-3">
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="raw">Raw</TabsTrigger>
      </TabsList>
    </Tabs>
    <div className="flex gap-2">
      <Button onClick={handleDownload}>Download .md</Button>
      <Button variant="outline" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </Button>
    </div>
  </div>

  {/* Scrollable content */}
  <div className="overflow-auto p-4">
    {tab === 'preview' ? (
      <div className="prose prose-sm max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
      </div>
    ) : (
      <pre className="font-mono text-sm whitespace-pre-wrap">{markdown}</pre>
    )}
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `tailwind.config.js` + PostCSS | `@tailwindcss/vite` plugin, `@import "tailwindcss"` | Tailwind v4 / late 2024 | All old setup tutorials are wrong; use official shadcn Vite docs |
| `useQuery(key, fn, opts)` (TanStack v4) | `useQuery({ queryKey, queryFn, ...opts })` | TanStack Query v5 / Oct 2023 | Old examples cause TypeScript errors in v5 |
| `<Markdown className="...">` (react-markdown v9) | Wrap in `<div className="..."><Markdown>` (v10) | react-markdown v10 / Feb 2025 | Minor migration step; v10 is current |
| react-dropzone `accept="application/pdf"` string | `accept: { 'application/pdf': ['.pdf'] }` object | react-dropzone v11+ | Old string format silently fails |

**Deprecated/outdated:**
- `onSuccess`/`onError` on `useQuery`: Removed in TanStack Query v5 — use `useMutation` callbacks or `useEffect` watching `isSuccess`.
- react-markdown `className` prop: Removed in v10 — wrap in parent div.
- `create-react-app`: Dead project — Vite is the standard scaffold.

---

## Open Questions

1. **Tailwind prose plugin availability**
   - What we know: `@tailwindcss/typography` provides the `prose` classes used to style Markdown output
   - What's unclear: Whether `@tailwindcss/typography` works with Tailwind v4 plugin model the same way as v3
   - Recommendation: Check official docs during scaffold; if not available, fall back to manual prose styles via Tailwind utilities

2. **Backend CORS in dev**
   - What we know: Vite proxy rewrites `/api` → backend; `changeOrigin: true` avoids CORS during dev
   - What's unclear: Whether the FastAPI backend (Phase 2) already has CORS middleware configured for `localhost:5173`
   - Recommendation: Check Phase 2 backend code; if no CORS middleware, the Vite proxy approach is sufficient for dev without touching the backend

3. **react-markdown v10 ESM in Vite**
   - What we know: react-markdown v10 is ESM-only
   - What's unclear: Whether Vite handles ESM-only packages transparently without extra config
   - Recommendation: Vite natively handles ESM; no `optimizeDeps` override should be needed, but verify at install time

---

## Sources

### Primary (HIGH confidence)
- https://ui.shadcn.com/docs/installation/vite — Official shadcn/ui Vite install steps (Tailwind v4 path)
- https://vite.dev/config/server-options — Official Vite proxy configuration
- https://tanstack.com/query/v5/docs/framework/react/guides/mutations — TanStack Query v5 useMutation
- https://react-dropzone.js.org — Official react-dropzone docs (v14.3.x, Feb 2025 release)
- https://raw.githubusercontent.com/remarkjs/react-markdown/main/changelog.md — react-markdown v10 breaking change (className removal)

### Secondary (MEDIUM confidence)
- https://github.com/remarkjs/react-markdown — react-markdown GitHub (v10.0.0 confirmed, remark-gfm v4.0.1)
- Multiple WebSearch results confirming react-dropzone v14 object-format `accept` prop
- Multiple WebSearch results confirming TanStack Query v5 object API and removal of v4 positional args

### Tertiary (LOW confidence)
- `@tailwindcss/typography` compatibility with Tailwind v4 — not directly verified, marked as open question

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs or GitHub changelogs (2025 dates)
- Architecture: HIGH — patterns derived from official API documentation and library examples
- Pitfalls: HIGH — react-dropzone and react-markdown breaking changes verified from changelogs; EventSource pitfall is documented behavior; Vite proxy from official docs

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days — stable ecosystem, no expected breaking changes)
