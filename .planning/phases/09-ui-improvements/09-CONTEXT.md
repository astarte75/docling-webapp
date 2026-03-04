# Phase 9: UI Improvements - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual and UX improvements to the existing frontend interface. No new features or backend changes. Scope: bug fixes already applied in session, plus visual enhancements (background, logo, animations, layout polish).

</domain>

<decisions>
## Implementation Decisions

### OCR Mode / Engine consistency (bug fix)
- Already implemented in this session: selecting a specific engine while OCR Mode is "Auto" → Mode switches to "On" automatically
- Selecting OCR Mode "Auto" → ocrEngine resets to "auto"
- Fix lives in `OptionsPanel.tsx`: `handleEngineChange` and the `onValueChange` for the ToggleGroup

### Background
- Dot grid pattern (24px spacing) — subtle, professional, not distracting
- Emerald radial glow at top-center (`70% 28%` ellipse, `oklch(primary / 0.10-0.18)`)
- Light mode: dark dots at 5.5% opacity; dark mode: white dots at 5% opacity
- Already implemented in `index.css` as `.app-bg` class

### Docling Logo
- SVG mark (40×48 viewBox): document shape with folded corner + markdown heading indicator
- `#` mark in `var(--primary)` emerald inside the document — visually narrates "document → markdown"
- Uses `currentColor` for the document body (adapts to dark/light theme)
- Placed above the wordmark in the header, centered
- Component: `frontend/src/components/DoclingLogo.tsx`

### Entry Animations
- Keyframe `fadeSlideUp`: `opacity 0→1` + `translateY 14px→0`, duration 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out spring)
- Staggered: header at 0ms, options panel at 120ms, upload zone at 220ms
- CSS class `.animate-fade-up` in `index.css`
- These are already implemented in `App.tsx`

### Header Layout
- Logo mark (DoclingLogo) centered above the "Docling Webapp" title
- Title remains clickable (resets app state) — extracted to `resetApp` callback
- Subtitle "Convert documents to Markdown" unchanged
- ModeToggle stays top-right

### Split layout on success state
- **Idle / Converting / Error**: single column layout, unchanged (max-w-3xl centered)
- **Success**: two-column layout — left narrow sidebar (~340px) with logo + options + upload zone for next file; right wide panel with ResultViewer markdown
- Grid: `grid grid-cols-[340px_1fr]` or similar, full width (no max-w-3xl constraint in success state)
- Transition: when state switches to success the layout expands smoothly into two columns
- Batch mode: not affected by this change (batch has its own layout)

### Claude's Discretion
- Exact column widths and gap
- Transition animation between single-column and split layout
- How to handle the logo/header in split mode (keep centered above both columns, or collapse into left sidebar only)
- Spacing/sizing of the logo relative to the title

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tw-animate-css`: already imported in index.css — available for animation utilities
- `ThemeProvider` + `.dark` class on html element — dark mode via class, not media query
- `--primary`: oklch emerald (59.6% light / 76.5% dark) — use directly in SVG via `var(--primary)`
- `UploadZone`: already has emerald hover glow (`shadow-emerald-500/40`, `border-emerald-500`)
- `ModeToggle`: exists and works, stays in header

### Established Patterns
- Tailwind v4 with oklch color system — use oklch() directly in custom CSS
- Dark mode via `.dark` class: custom CSS dark overrides use `.dark .classname { }`
- `useCallback` for handlers in App.tsx — maintain pattern when adding `resetApp`
- All UI components are shadcn/ui primitives in `src/components/ui/`

### Integration Points
- `App.tsx` outer div: `className` change from `bg-background` to `bg-background app-bg`
- `App.tsx` header: import + render `<DoclingLogo>`
- `index.css`: append `.app-bg`, `.dark .app-bg`, `@keyframes fadeSlideUp`, `.animate-fade-up`

</code_context>

<specifics>
## Specific Ideas

- Logo concept: document with fold + emerald `#` heading inside → communicates "PDF → Markdown" at a glance
- Background inspiration: Linear, Vercel, Raycast — dark grid with a single soft accent glow
- Animations: discrete, professional, not bouncy — like a precision instrument settling into view
- Already implemented and verified (build passes): DoclingLogo.tsx, index.css additions, App.tsx changes

</specifics>

<deferred>
## Deferred Ideas

- Font change / typography improvements — could be added but not requested
- More complex animations (state-transition morphing, drag hover glow pulse) — evaluate after seeing live result
- Additional visual polish on ResultViewer, BatchList — not in scope for this phase

</deferred>

---

*Phase: 09-ui-improvements*
*Context gathered: 2026-03-04*
