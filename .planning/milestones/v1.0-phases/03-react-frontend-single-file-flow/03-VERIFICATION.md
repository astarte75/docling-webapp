---
phase: 03-react-frontend-single-file-flow
verified: 2026-03-03T00:00:00Z
status: gaps_found
score: 16/17 must-haves verified
re_verification: false
gaps:
  - truth: "Preview tab renders Markdown using react-markdown + remark-gfm inside a prose div"
    status: partial
    reason: "@tailwindcss/typography is not installed and not registered in index.css. The prose and prose-sm CSS classes are referenced in ResultViewer.tsx but produce zero styling in the built CSS. Markdown content will render as structurally correct HTML (headings, lists, code blocks) but with no typography styles — no font scaling, no spacing, no visual hierarchy."
    artifacts:
      - path: "frontend/src/components/ResultViewer.tsx"
        issue: "Uses `<div className=\"prose prose-sm max-w-none\">` but prose classes emit no CSS — @tailwindcss/typography not installed"
      - path: "frontend/src/index.css"
        issue: "Missing `@plugin \"@tailwindcss/typography\"` directive"
      - path: "frontend/package.json"
        issue: "@tailwindcss/typography absent from dependencies"
    missing:
      - "Run: npm install @tailwindcss/typography inside frontend/"
      - "Add `@plugin \"@tailwindcss/typography\";` to frontend/src/index.css after `@import \"tailwindcss\";`"
human_verification:
  - test: "Drop a PDF and verify rendered Markdown preview shows formatted output (headings, lists, code blocks styled)"
    expected: "Preview tab shows visually formatted Markdown with font hierarchy, spacing, and code block styling"
    why_human: "Even with the typography plugin installed, visual quality requires human inspection — automated checks can only confirm CSS class presence"
  - test: "Drag a file over the upload zone and verify visual drag-active feedback (border and background change)"
    expected: "Zone border turns primary color, background tint appears while dragging"
    why_human: "isDragActive visual feedback requires interactive browser testing"
  - test: "Click Download .md and verify the downloaded file is named correctly after the source PDF"
    expected: "File named source-document.md (strips PDF extension, appends .md)"
    why_human: "Browser download behavior requires manual verification"
  - test: "Click Copy to clipboard — verify text changes to Copied! then reverts after 2 seconds"
    expected: "Button text changes to Copied! and reverts automatically after 2 seconds"
    why_human: "Timer-based UI feedback requires interactive observation"
---

# Phase 3: React Frontend — Single File Flow Verification Report

**Phase Goal:** A user can upload one document, watch it convert, and download or copy the Markdown result
**Verified:** 2026-03-03
**Status:** gaps_found — 1 gap blocking full goal achievement
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `npm run dev` inside frontend/ starts the Vite dev server without errors | ? HUMAN | Build passes (`npm run build` exits 0); dev server startup not verified programmatically |
| 2 | The page loads in the browser and shows content | ? HUMAN | Human confirmed in plan 03-04 SUMMARY; automated check verifies build produces dist/ |
| 3 | Requests to /api/* are proxied by Vite dev server | ✓ VERIFIED | vite.config.ts line 13-17: proxy `/api` → `http://localhost:3000` with rewrite |
| 4 | shadcn/ui Button imports and renders without TypeScript errors | ✓ VERIFIED | `npm run build` exits 0; button.tsx exists in components/ui/ |
| 5 | Tailwind utility classes apply correctly | ✓ VERIFIED | Build output: 28KB CSS generated; CSS variables defined in index.css |
| 6 | User can drag a PDF file onto the upload zone and see it accepted | ? HUMAN | Code confirmed correct; runtime behavior needs human verification |
| 7 | User can click the upload zone to open the file browser | ? HUMAN | `<input {...getInputProps()} />` wired in UploadZone; browser behavior is human-only |
| 8 | Dropping a non-PDF file shows 'Only PDF files are supported' error | ✓ VERIFIED | UploadZone.tsx line 13-15: ErrorCode.FileInvalidType → exact string match |
| 9 | Dropping a file over 50MB shows 'File exceeds the 50MB limit' error | ✓ VERIFIED | UploadZone.tsx line 12: ErrorCode.FileTooLarge → exact string match; maxSize=50*1024*1024 |
| 10 | useUpload hook sends POST /api/convert with multipart/form-data and returns {job_id} | ✓ VERIFIED | useUpload.ts line 8: `fetch('/api/convert', { method: 'POST', body: formData })` |
| 11 | useJobStream hook opens EventSource, fires onCompleted with markdown, and closes the connection | ✓ VERIFIED | useJobStream.ts line 17-36: EventSource opened, closed in completed/failed/onerror/cleanup |
| 12 | ConversionProgress renders an animated spinner with 'Converting your document...' text | ✓ VERIFIED | ConversionProgress.tsx: `animate-spin` div + static text, no props |
| 13 | ResultViewer shows a tab switcher with 'Preview' (default) and 'Raw' tabs | ✓ VERIFIED | ResultViewer.tsx: Tabs with defaultValue="preview", TabsTrigger for preview and raw |
| 14 | Preview tab renders Markdown using react-markdown + remark-gfm inside a prose div | ✗ FAILED | Markdown component and remark-gfm wired correctly, but prose classes produce NO CSS — @tailwindcss/typography not installed |
| 15 | Raw tab renders the Markdown source in a monospace preformatted block | ✓ VERIFIED | ResultViewer.tsx line 59: `<pre className="font-mono text-sm">` |
| 16 | Clicking Download triggers a browser file download of the .md content | ✓ VERIFIED | downloadMarkdown() uses Blob + URL.createObjectURL + a.download; URL.revokeObjectURL called |
| 17 | Clicking Copy changes button text to 'Copied!' for exactly 2 seconds then reverts | ✓ VERIFIED | handleCopy(): setCopied(true) + setTimeout(() => setCopied(false), 2000) |

**Score:** 13/17 truths verified automatically (3 need human confirmation, 1 failed)

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/vite.config.ts` | ✓ VERIFIED | Proxy `/api` → localhost:3000, @tailwindcss/vite plugin, @/ alias |
| `frontend/src/main.tsx` | ✓ VERIFIED | QueryClientProvider wraps App; StrictMode; imports index.css |
| `frontend/src/App.tsx` | ✓ VERIFIED | Full state machine: idle/uploading/converting/success/error; all 5 imports wired |
| `frontend/src/index.css` | ✓ VERIFIED | `@import "tailwindcss"` present; CSS variables defined; shadcn theme vars present |
| `frontend/components.json` | ✓ VERIFIED | shadcn config present: new-york style, Zinc-based, tsx=true |
| `frontend/src/types/job.ts` | ✓ VERIFIED | AppPhase, ConvertResponse, ApiError, SSEEvent all exported |
| `frontend/src/hooks/useUpload.ts` | ✓ VERIFIED | useMutation wrapping POST /api/convert; error extraction from {error: ...} format |
| `frontend/src/hooks/useJobStream.ts` | ✓ VERIFIED | EventSource lifecycle; callbacks via useRef; closes in terminal events AND cleanup |
| `frontend/src/components/UploadZone.tsx` | ✓ VERIFIED | react-dropzone v14 object accept format; 3 rejection error codes; disabled prop |
| `frontend/src/components/ConversionProgress.tsx` | ✓ VERIFIED | animate-spin spinner, static text, no props |
| `frontend/src/components/ResultViewer.tsx` | ⚠️ PARTIAL | Component correct; prose classes non-functional due to missing @tailwindcss/typography |
| `frontend/src/components/ui/button.tsx` | ✓ VERIFIED | shadcn Button present |
| `frontend/src/components/ui/tabs.tsx` | ✓ VERIFIED | shadcn Tabs present |
| `frontend/src/components/ui/card.tsx` | ✓ VERIFIED | shadcn Card present |
| `frontend/src/components/ui/progress.tsx` | ✓ VERIFIED | shadcn Progress present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vite.config.ts` | `http://localhost:3000` | server.proxy /api rewrite | ✓ WIRED | Line 13-17: proxy target is localhost:3000 (docker-compose host port) |
| `main.tsx` | QueryClientProvider | @tanstack/react-query import | ✓ WIRED | Lines 1, 11-13: imported and wraps App |
| `App.tsx` | useUpload | mutateAsync triggers state transition | ✓ WIRED | Lines 3, 17: imported and called in startUpload |
| `App.tsx` | useJobStream | jobId passed to hook drives SSE | ✓ WIRED | Lines 4, 30-47: jobId=null when not converting |
| `App.tsx` | UploadZone | onFileSelected callback triggers upload | ✓ WIRED | Lines 5, 71-83: onFileSelected={startUpload} |
| `App.tsx` | ResultViewer | rendered in success phase with props | ✓ WIRED | Lines 6, 112-115: markdown + filename passed |
| `useUpload.ts` | POST /api/convert | fetch with FormData | ✓ WIRED | Line 8: `fetch('/api/convert', {method: 'POST', body: formData})` |
| `useJobStream.ts` | GET /api/jobs/{jobId}/stream | EventSource constructor | ✓ WIRED | Line 17: `new EventSource(\`/api/jobs/${jobId}/stream\`)` |
| `UploadZone.tsx` | useDropzone | react-dropzone import | ✓ WIRED | Line 1: `import { useDropzone, ErrorCode } from 'react-dropzone'` |
| `ResultViewer.tsx` | react-markdown | import Markdown | ✓ WIRED | Line 2: `import Markdown from 'react-markdown'` |
| `ResultViewer.tsx` | remark-gfm | remarkPlugins={[remarkGfm]} | ✓ WIRED | Lines 3, 54: imported and applied |
| `ResultViewer.tsx` | Blob download | URL.createObjectURL | ✓ WIRED | Lines 15-20: Blob + createObjectURL + revokeObjectURL |
| `ResultViewer.tsx` | prose styling | @tailwindcss/typography | ✗ NOT WIRED | prose classes present in JSX but package not installed; zero prose CSS in build output |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UPLD-01 | 03-01, 03-02, 03-04 | Drag-and-drop file upload | ✓ SATISFIED | UploadZone with useDropzone; onDropAccepted wired |
| UPLD-02 | 03-01, 03-02, 03-04 | Click to browse and select | ✓ SATISFIED | `<input {...getInputProps()} />` enables file dialog |
| UPLD-03 | 03-02, 03-04 | Client-side file type validation | ✓ SATISFIED | accept: { 'application/pdf': ['.pdf'] }; FileInvalidType error message |
| UPLD-04 | 03-02, 03-04 | 50MB size limit with clear message | ✓ SATISFIED | maxSize=50*1024*1024; FileTooLarge error message |
| UPLD-05 | 03-02, 03-04 | Progress indicator during upload | ✓ SATISFIED (per user decision) | REQUIREMENTS.md says "progress bar" but ROADMAP Success Criteria (authoritative contract) says "spinner, no progress bar — per user decision". Spinner via ConversionProgress; instant transition implemented. User decision is locked. |
| OUTP-01 | 03-03, 03-04 | Rendered Markdown preview inline | ✗ BLOCKED | react-markdown + remark-gfm wired correctly; prose wrapper present in JSX — but @tailwindcss/typography not installed → prose classes emit no CSS → unstyled output |
| OUTP-02 | 03-03, 03-04 | Download as .md file | ✓ SATISFIED | Blob download with correct filename derivation; URL.revokeObjectURL cleanup |
| OUTP-03 | 03-03, 03-04 | Copy to clipboard | ✓ SATISFIED | navigator.clipboard.writeText; 2-second Copied! feedback |

**Note on UPLD-05:** REQUIREMENTS.md definition ("progress bar during file upload") conflicts with ROADMAP Phase 3 Success Criterion 4 ("spinner, no progress bar — per user decision"). The ROADMAP is the active project contract; the user explicitly decided against a progress bar. This is not a gap — it is a documented, locked user decision. REQUIREMENTS.md should be updated to reflect the decision but the implementation is correct.

---

## Anti-Patterns Scan

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ResultViewer.tsx` | 53 | `prose prose-sm max-w-none` classes with no typography plugin | ✗ Blocker | OUTP-01 renders structurally correct but visually unstyled Markdown |

No other anti-patterns found:
- No TODO/FIXME/placeholder comments in any source file
- No empty implementations (`return null`, `return {}`, `return []`)
- No console.log statements
- No stub patterns — all components and hooks are substantive implementations

---

## Human Verification Required

### 1. Markdown Preview Visual Quality

**Test:** Upload a PDF with mixed content (headings, bullet lists, code blocks, tables). Click the Preview tab.
**Expected:** Content displays with visual hierarchy — h1/h2 headers are larger/bolder, lists are indented, code blocks have monospace font and distinct background, paragraphs have proper spacing.
**Why human:** Requires @tailwindcss/typography to be installed first. Once installed, visual quality needs human inspection to confirm styles apply correctly.

### 2. Drag-Active Visual Feedback

**Test:** Drag a file over the upload zone but do not drop it.
**Expected:** Zone border changes to primary color, background shows a light tint while dragging is active.
**Why human:** isDragActive state requires interactive browser dragging; cannot be verified statically.

### 3. Download Filename

**Test:** Upload a file named "annual-report-2025.pdf". Click "Download .md".
**Expected:** Browser prompts to save a file named "annual-report-2025.md".
**Why human:** Browser download behavior (file save dialog, filename) requires interactive testing.

### 4. Copy-to-Clipboard Feedback Timing

**Test:** Click "Copy to clipboard".
**Expected:** Button text changes to "Copied!" immediately, then reverts to "Copy to clipboard" after exactly 2 seconds.
**Why human:** Timer behavior and state transition require interactive observation.

### 5. End-to-End Flow with Backend

**Test:** Start backend (`docker compose up`), start frontend (`npm run dev`), drop a PDF onto the upload zone.
**Expected:** Spinner appears during conversion; once complete, compact upload strip appears at top; result viewer shows rendered Markdown; download and copy both work.
**Why human:** Requires running backend + SSE stream; cannot be verified statically.

---

## Gaps Summary

**1 gap blocking full goal achievement:**

The Markdown preview (OUTP-01) uses `prose` Tailwind CSS classes from `@tailwindcss/typography` but the plugin is not installed (`npm install @tailwindcss/typography` not run) and not registered in `index.css` (`@plugin "@tailwindcss/typography"` missing). The built CSS contains zero prose-related styles. The rendered Markdown will display as unstyled HTML — structurally correct (headings are `<h1>/<h2>` elements, lists are `<ul>/<li>`) but with no visual typography formatting.

The fix is two-step: install the package and add the plugin directive to index.css. The PLAN explicitly documented this as an "if needed" step with exact instructions, but it was not applied.

**All other 16 must-haves are verified.** The core flow (upload, convert, stream, download, copy) is correctly implemented and was human-verified in the browser per plan 03-04. The typography gap affects visual quality of OUTP-01 but not functional correctness of the other requirements.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
