# Phase 9: UI Improvements - Research

**Researched:** 2026-03-04
**Domain:** React + Tailwind v4 CSS Grid layout, split-view pattern, state-driven layout switching
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### OCR Mode / Engine consistency (bug fix)
- Already implemented in this session: selecting a specific engine while OCR Mode is "Auto" → Mode switches to "On" automatically
- Selecting OCR Mode "Auto" → ocrEngine resets to "auto"
- Fix lives in `OptionsPanel.tsx`: `handleEngineChange` and the `onValueChange` for the ToggleGroup

#### Background
- Dot grid pattern (24px spacing) — subtle, professional, not distracting
- Emerald radial glow at top-center (`70% 28%` ellipse, `oklch(primary / 0.10-0.18)`)
- Light mode: dark dots at 5.5% opacity; dark mode: white dots at 5% opacity
- Already implemented in `index.css` as `.app-bg` class

#### Docling Logo
- SVG mark (40×48 viewBox): document shape with folded corner + markdown heading indicator
- `#` mark in `var(--primary)` emerald inside the document — visually narrates "document → markdown"
- Uses `currentColor` for the document body (adapts to dark/light theme)
- Placed above the wordmark in the header, centered
- Component: `frontend/src/components/DoclingLogo.tsx`

#### Entry Animations
- Keyframe `fadeSlideUp`: `opacity 0→1` + `translateY 14px→0`, duration 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out spring)
- Staggered: header at 0ms, options panel at 120ms, upload zone at 220ms
- CSS class `.animate-fade-up` in `index.css`
- These are already implemented in `App.tsx`

#### Header Layout
- Logo mark (DoclingLogo) centered above the "Docling Webapp" title
- Title remains clickable (resets app state) — extracted to `resetApp` callback
- Subtitle "Convert documents to Markdown" unchanged
- ModeToggle stays top-right

#### Split layout on success state
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

### Deferred Ideas (OUT OF SCOPE)
- Font change / typography improvements — could be added but not requested
- More complex animations (state-transition morphing, drag hover glow pulse) — evaluate after seeing live result
- Additional visual polish on ResultViewer, BatchList — not in scope for this phase
</user_constraints>

---

## Summary

La fase 9 ha 3 parti distinte: due sono **già completamente implementate** (bug fix OCR e tutte le decorazioni visive — background, logo, animazioni), e **una sola rimane da implementare**: il split layout a due colonne nello stato `success`.

Lo stato corrente del codice è chiaro: `App.tsx` usa un wrapper `max-w-3xl` fisso per tutte le fasi. Nello stato `success`, il contenuto mostra un `<div className="rounded-lg border">` che contiene header con badge OCR e `<ResultViewer>`. La trasformazione richiesta è: quando `state.phase === 'success'`, rimuovere il `max-w-3xl` dall'outer container e dividere il contenuto in due colonne CSS Grid — sinistra (340px) con logo+opzioni+UploadZone per "converti un altro file", destra (flex-1) con ResultViewer.

La scelta tecnica principale è se gestire il layout split dentro `App.tsx` come condizionale inline o estrarlo in un componente `SuccessLayout`. Data la complessità moderata (non richiede stato proprio, è solo layout), un wrapper condizionale in `App.tsx` è la soluzione più semplice e mantenibile.

**Primary recommendation:** Modifica `App.tsx` per condizionare il container wrapper in base allo stato, aggiungendo un blocco `success`-specific che usa `grid grid-cols-[340px_1fr]` senza `max-w-3xl`, con header compresso nella sidebar sinistra.

---

## Standard Stack

### Core (già installato nel progetto)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4.2.1 | CSS utility framework con arbitrary values | `grid-cols-[340px_1fr]` supportato nativamente |
| react | ^19.2.0 | UI rendering e state management | AppPhase discriminated union già in uso |
| tw-animate-css | ^1.4.0 | Animazioni CSS pre-costruite | Già importato in index.css, disponibile subito |

### Nessuna dipendenza aggiuntiva necessaria
Il progetto ha già tutto il necessario. Nessun `npm install` richiesto per questa fase.

---

## Architecture Patterns

### Stato corrente di App.tsx (rilevante)

```tsx
// Outer wrapper — max-w-3xl FISSO per tutti gli stati
<div className="min-h-screen bg-background text-foreground app-bg">
  <div className="mx-auto max-w-3xl px-4 py-8">
    <header>...</header>
    {/* Options panel — solo in idle/batch */}
    {/* Upload zone — sempre (compact in batch) */}
    {/* Success state — inline nel wrapper max-w-3xl */}
    {state.phase === 'success' && (
      <div className="rounded-lg border">...</div>
    )}
  </div>
</div>
```

### Pattern 1: Conditional Container Width

**What:** L'outer wrapper `max-w-3xl` viene reso condizionale in base a `state.phase`. In `success`, viene eliminato il `max-w-3xl` e il layout passa a full-width.

**When to use:** Quando la stessa page ha layout radicalmente diversi per stati diversi.

**Example:**
```tsx
// Source: ispezione diretta App.tsx + Tailwind v4 docs pattern
const isSuccess = state.phase === 'success';

return (
  <ThemeProvider defaultTheme="system" storageKey="docling-theme">
    <div className="min-h-screen bg-background text-foreground app-bg">
      {isSuccess ? (
        // Full-width two-column layout
        <SuccessLayout ... />
      ) : (
        // Standard centered single-column
        <div className="mx-auto max-w-3xl px-4 py-8">
          ...
        </div>
      )}
    </div>
  </ThemeProvider>
);
```

### Pattern 2: CSS Grid con arbitrary values (Tailwind v4)

**What:** Tailwind v4 supporta `grid-cols-[340px_1fr]` come classe arbitraria. In v4 (diverso da v3), le arbitrary values usano la stessa sintassi `[value]` ma con il nuovo engine JIT che le gestisce senza configurazione aggiuntiva.

**Verified:** Tailwind v4 con Vite plugin (`@tailwindcss/vite`) genera le classi arbitrarie al volo — nessuna configurazione `safelist` necessaria.

**Example:**
```tsx
// Source: Tailwind v4 arbitrary values — verificato nelle docs ufficiali
<div className="grid grid-cols-[340px_1fr] gap-6 px-6 py-8">
  <aside>
    {/* Left sidebar: header + options + upload zone */}
  </aside>
  <main>
    {/* Right: ResultViewer */}
  </main>
</div>
```

### Pattern 3: Header compresso nella sidebar in success state

**What:** In success state, il header normale (centrato, grande) viene sostituito da una versione compatta nella sidebar sinistra. Il logo e il titolo rimangono ma in layout verticale compatto, e il `ModeToggle` va spostato in cima alla sidebar o nel header overall.

**Opzione A (raccomandata):** Header rimane SOPRA entrambe le colonne (non duplicato), e il pannello sinistro contiene solo OptionsPanel + UploadZone per "prossimo file".

```tsx
// Source: ispezione CONTEXT.md — "Claude's Discretion" sull'header in split mode
<div className="px-6 py-8">
  {/* Header compatto sopra entrambe le colonne */}
  <header className="mb-6 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <DoclingLogo className="h-8 w-7 text-foreground" />
      <span className="font-semibold cursor-pointer" onClick={resetApp}>Docling Webapp</span>
    </div>
    <ModeToggle />
  </header>
  {/* Two-column grid */}
  <div className="grid grid-cols-[340px_1fr] gap-6">
    <aside>
      {/* OptionsPanel + UploadZone compact */}
    </aside>
    <main>
      <ResultViewer ... />
    </main>
  </div>
</div>
```

**Opzione B:** Sidebar sinistra contiene logo+titolo+ModeToggle+opzioni. Header originale non mostrato. Più radicale, meno continuità visiva.

**Raccomandazione:** Opzione A — mantiene la continuità visiva del brand, evita di duplicare il ModeToggle, e separa chiaramente le responsabilità.

### Pattern 4: UploadZone in success sidebar

**What:** Nella sidebar sinistra dello stato success, l'UploadZone permette di convertire un altro file. Si usa la prop `compact` già esistente nell'UploadZone, oppure si usa quella normale con dimensioni ridotte.

**Verificato nel codice:** `UploadZone` ha già `compact?: boolean` che mostra una strip orizzontale invece della hero zone. Questo è perfetto per la sidebar.

```tsx
// Source: ispezione diretta UploadZone.tsx
<UploadZone
  onFilesSelected={handleFilesSelected}
  disabled={false}
  compact  // usa la strip mode già implementata
/>
```

### Anti-Patterns da Evitare

- **Estrarre un componente SuccessLayout separato senza motivo:** Il layout condizionale in App.tsx è già abbastanza leggibile. Estrarlo non aggiunge valore e aumenta la frammentazione del codice.
- **Usare `position: absolute/fixed` per il split layout:** CSS Grid è la soluzione corretta; è già nel toolkit Tailwind.
- **Applicare `animate-fade-up` allo stato success senza `animation-fill-mode: both`:** La classe `.animate-fade-up` usa `animation: ... both` — è già corretto; non rimuoverlo.
- **Rimuovere il wrapper `app-bg` in success state:** Il background dot-grid deve rimanere visibile — `app-bg` appartiene all'outer `min-h-screen` div, non al `max-w-3xl`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grid a due colonne con larghezza fissa | CSS custom con calc() | `grid-cols-[340px_1fr]` Tailwind | Tailwind v4 gestisce arbitrary values JIT |
| Transizione layout single→split | JS animation con requestAnimationFrame | CSS `transition` su `grid-template-columns` | CSS transitions gestiscono gli intermediari automaticamente |
| Header compresso in success | Nuovo componente HeaderCompact | Riuso condizionale del JSX header esistente | Il JSX header è semplice, duplicare con condizionale inline è leggibile |

**Key insight:** Il cambio di layout è puramente CSS condizionale — non serve stato aggiuntivo, non serve un'animazione JS custom.

---

## Common Pitfalls

### Pitfall 1: Transizione CSS Grid non funziona con classi arbitrarie dinamiche
**What goes wrong:** `grid-template-columns` non è animabile con CSS transitions standard in tutti i browser.
**Why it happens:** `grid-template-columns` non è una proprietà interpolabile nativamente (anche se Chrome 107+ la supporta parzialmente).
**How to avoid:** Non tentare di animare il cambiamento di layout con `transition`. Usare invece un fade-in dell'intera sezione success (`.animate-fade-up` già disponibile) che maschera la transizione layout.
**Warning signs:** Se si vede un "salto" invece di una transizione fluida.

### Pitfall 2: `max-w-3xl` wrapper applicato a entrambi i rami
**What goes wrong:** Il ResultViewer risulta troppo stretto nel pannello destro perché il `max-w-3xl` viene ereditato.
**Why it happens:** Dimenticare di rimuovere il constraint dal branch success.
**How to avoid:** Il branch success deve avere il proprio wrapper che NON include `max-w-3xl`. Struttura: `min-h-screen` > `px-6 py-8` (padding solo) > `grid grid-cols-[340px_1fr]`.

### Pitfall 3: OptionsPanel in success sidebar mostra il collapsible aperto
**What goes wrong:** In success state, l'OptionsPanel nella sidebar può mostrare le opzioni avanzate aperte, occupando troppo spazio verticale.
**Why it happens:** Lo stato `advancedOpen` nell'OptionsPanel è locale al componente e persiste tra i render.
**How to avoid:** Accettabile se l'utente ha scelto di aprirlo. Non occorre forzare la chiusura — l'OptionsPanel ha già il suo scroll in sidebar.

### Pitfall 4: UploadZone `compact` in sidebar non chiama `resetApp` prima
**What goes wrong:** L'utente droppa un nuovo file nella sidebar quando siamo in `success`, ma lo state non viene resettato — si sovrappongono success e converting.
**Why it happens:** `handleFilesSelected` in App.tsx fa `setState({ phase: 'uploading', file })` senza pulire il success state, ma in realtà **funziona correttamente** perché `setState` sostituisce tutto lo stato (AppPhase discriminated union).
**How to avoid:** Non è un vero problema — verificare che `handleFilesSelected` sia passato direttamente alla UploadZone nella sidebar, non una versione che prima chiama `resetApp`.

---

## Code Examples

### Struttura completa del branch success in App.tsx (raccomandazione)

```tsx
// Source: analisi diretta App.tsx + CONTEXT.md decisions

// In App.tsx — sostituire il success state attuale

{state.phase === 'success' && (
  // Full-width wrapper — no max-w-3xl
  <div className="animate-fade-up">
    {/* Compact header for success layout */}
    <div className="mb-6 flex items-center justify-between">
      <button
        className="flex items-center gap-3 hover:opacity-70 transition-opacity"
        onClick={resetApp}
        aria-label="Reset to home"
      >
        <DoclingLogo className="h-8 w-7 text-foreground" />
        <span className="font-semibold text-lg">Docling Webapp</span>
      </button>
      <ModeToggle />
    </div>

    {/* Two-column grid */}
    <div className="grid grid-cols-[340px_1fr] gap-6 items-start">
      {/* Left sidebar */}
      <aside className="space-y-4">
        <OptionsPanel value={currentOptions} onChange={setCurrentOptions} />
        <div>
          <p className="text-xs text-muted-foreground mb-2">Converti un altro file</p>
          <UploadZone
            onFilesSelected={handleFilesSelected}
            disabled={false}
            compact
          />
        </div>
      </aside>

      {/* Right: result */}
      <main className="min-w-0">
        {/* OCR badge row */}
        <div className="mb-3 flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">Conversione completata</p>
          {state.ocrEngineRequested ? (
            <span className="inline-flex items-center rounded-full border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngineRequested)?.label ?? state.ocrEngineRequested} → {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine}
            </span>
          )}
        </div>
        <div className="rounded-lg border">
          <ResultViewer
            markdown={state.markdown}
            filename={state.filename}
          />
        </div>
      </main>
    </div>
  </div>
)}
```

### Aggiornamento dell'outer wrapper in App.tsx

```tsx
// Source: analisi diretta App.tsx
// Il wrapper esterno va modificato per rimuovere max-w-3xl in success state

const isSuccess = state.phase === 'success';

return (
  <ThemeProvider defaultTheme="system" storageKey="docling-theme">
    <div className="min-h-screen bg-background text-foreground app-bg">
      {isSuccess ? (
        // Success: full-width, no max-w-3xl
        <div className="px-6 py-8">
          {/* Success layout inline (see above) */}
        </div>
      ) : (
        // All other states: centered max-w-3xl
        <div className="mx-auto max-w-3xl px-4 py-8">
          <header>...</header>
          {/* Options panel, upload zone, converting, error, batch */}
        </div>
      )}
    </div>
  </ThemeProvider>
);
```

### Tailwind v4 — arbitrary grid columns (verificato)

```css
/* Tailwind v4 genera questa regola CSS dal className "grid-cols-[340px_1fr]" */
/* Source: Tailwind v4 docs — arbitrary values */
.grid-cols-\[340px_1fr\] {
  grid-template-columns: 340px 1fr;
}
```

Nessuna configurazione aggiuntiva in `tailwind.config` necessaria — Tailwind v4 usa il Vite plugin (`@tailwindcss/vite`) che scansiona i file sorgente JIT.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `safelist` per classi dinamiche | JIT scanning automatico | Tailwind v3 → v4 | Nessun `safelist` necessario per `grid-cols-[340px_1fr]` |
| `grid-template-columns` inline style | Classe arbitraria Tailwind | — | Mantiene la coerenza Tailwind, no style prop |

**Deprecated/outdated:**
- `tailwind.config.js` con `theme.extend.gridTemplateColumns`: non necessario in v4 per valori arbitrari.

---

## What's Already Done vs What Remains

### Completato (non toccare)
| Feature | File | Status |
|---------|------|--------|
| OCR Mode/Engine bug fix | `frontend/src/components/OptionsPanel.tsx` | DONE — `handleEngineChange` e `onValueChange` corretti |
| Background dot grid + emerald glow | `frontend/src/index.css` | DONE — `.app-bg` e `.dark .app-bg` |
| Entry animations `fadeSlideUp` | `frontend/src/index.css` | DONE — keyframe + `.animate-fade-up` |
| Staggered animation in header/options/upload | `frontend/src/App.tsx` | DONE — `animationDelay` 0/120/220ms |
| DoclingLogo SVG component | `frontend/src/components/DoclingLogo.tsx` | DONE — documento con fold + `#` emerald |

### Da implementare (unico task rimanente)
| Feature | File | Change |
|---------|------|--------|
| Split layout in success state | `frontend/src/App.tsx` | Condizionale outer wrapper + grid a due colonne |

---

## Open Questions

1. **Header in success: sopra entrambe le colonne o nella sidebar?**
   - What we know: CONTEXT.md lascia a Claude's Discretion
   - What's unclear: Se il logo deve stare nella sidebar sinistra (dà senso alla sidebar come "pannello controllo") o sopra entrambe (continuità visiva)
   - Recommendation: Header compatto SOPRA entrambe le colonne (Opzione A). Motivo: il ModeToggle non si duplica, la gerarchia visiva è chiara (header > content), e il brand rimane visibile sopra tutta la pagina.

2. **Altezza ResultViewer nella colonna destra: scroll interno o page scroll?**
   - What we know: `ResultViewer` usa un `sticky top-0` per la tab bar delle azioni — funziona solo se c'è un ancestor con `overflow-y: auto` o se lo scroll è del viewport.
   - What's unclear: Con il grid layout, il `sticky` nel ResultViewer deve fare sticky rispetto al viewport — verificare che `main` nella colonna destra non abbia `overflow: hidden`.
   - Recommendation: Non aggiungere `overflow-y: auto` alla colonna destra — lasciare che il page scroll gestisca il tutto. Il `sticky top-0` in ResultViewer funzionerà rispetto al viewport.

3. **Gap tra colonne: 6 (1.5rem) o 8 (2rem)?**
   - What we know: Claude's Discretion
   - Recommendation: `gap-6` (24px) — consistente con il padding standard del progetto (`px-4 py-8` = 32px vertical, `px-6` adeguato per full-width).

---

## Sources

### Primary (HIGH confidence)
- Ispezione diretta `frontend/src/App.tsx` — struttura completa del render, AppPhase union, handlers
- Ispezione diretta `frontend/src/components/OptionsPanel.tsx` — bug fix OCR già presente e corretto
- Ispezione diretta `frontend/src/components/DoclingLogo.tsx` — componente esistente e completo
- Ispezione diretta `frontend/src/index.css` — `.app-bg`, `.dark .app-bg`, `@keyframes fadeSlideUp`, `.animate-fade-up` già presenti
- Ispezione diretta `frontend/src/components/UploadZone.tsx` — prop `compact` già implementata
- Ispezione diretta `frontend/src/components/ResultViewer.tsx` — struttura Tabs + sticky action bar
- Ispezione diretta `frontend/package.json` — tailwindcss ^4.2.1, tw-animate-css ^1.4.0

### Secondary (MEDIUM confidence)
- `.planning/phases/09-ui-improvements/09-CONTEXT.md` — decisioni e vincoli utente

### Tertiary (LOW confidence)
- Nessuna fonte low-confidence usata

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versioni verificate direttamente da package.json
- Architecture: HIGH — pattern derivati dall'ispezione diretta del codice sorgente
- Pitfalls: MEDIUM — derivati da conoscenza Tailwind v4 CSS Grid + ispezione codice; CSS Grid transitions non verificato su browser specifici ma comportamento documentato

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stack stabile; Tailwind v4 API non cambia frequentemente)
