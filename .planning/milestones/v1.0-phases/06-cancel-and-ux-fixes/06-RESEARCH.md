# Phase 6: cancel-and-ux-fixes - Research

**Researched:** 2026-03-03
**Domain:** React UX patterns — SSE cancellation, state machine transitions, component prop drilling
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cancel — single-file flow**
- Cancel button appears inside `ConversionProgress` component (below the spinner)
- Cancel is frontend-only: closes the SSE stream and resets state to `idle`
- No backend abort endpoint needed — the backend job may complete in the background but its result is ignored
- After cancel: full UploadZone hero is restored (not compact strip)

**Cancel — batch flow**
- Each `BatchFileRow` in `converting` status gets a cancel (X) button alongside the status badge
- Cancel closes the EventSource for that item and marks it as `cancelled` (new BatchFile status)
- Other files in the batch are unaffected
- A cancelled row shows a "Annullato" badge (neutral color, not red/error)

**Logo / header navigation**
- The `<h1>Docling Webapp</h1>` becomes a clickable element (styled as a link, no underline)
- Click resets app state to `idle` from any phase
- No confirmation dialog — cancel is immediate (converting job just stops being watched)
- Logo click during batch mode: clears the batch and returns to idle

**Reset post-conversione (single-file)**
- After success, the compact strip already allows dropping a new file
- Add a "Nuova conversione" button (ghost/outline variant) in the success state that explicitly resets to `idle` (restores full hero UploadZone)
- This is distinct from the compact strip: compact strip = add another file quickly; "Nuova conversione" = full reset

### Claude's Discretion
- Exact styling of cancel button (icon-only vs text, placement within ConversionProgress)
- Cancelled batch status badge color (muted gray suggested, not red)
- Whether header title cursor changes to pointer or has any hover effect

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 6 è interamente frontend: nessuna modifica al backend Python. L'obiettivo è aggiungere controlli UX (cancel, reset, navigazione) che il codebase esistente quasi supporta già — i meccanismi di chiusura SSE e reset di stato sono già presenti, mancano solo i punti di ingresso UI e il collegamento dei prop.

Le modifiche sono chirurgiche: cinque file toccati (`types/job.ts`, `useBatchUpload.ts`, `BatchFileRow.tsx`, `BatchList.tsx`, `ConversionProgress.tsx`, `App.tsx`). Ogni modifica segue un pattern già stabilito nel codebase (es. `retryFile` per il cancel single-file batch, `clearFiles` per il reset logo).

Il rischio principale è il prop drilling per `onCancel` da `App.tsx` verso i componenti foglia, che però segue esattamente lo stesso pattern di `onRetry` già implementato. Non servono librerie nuove.

**Primary recommendation:** Implementare in ordine sequenziale — prima i tipi (`cancelled` status), poi i hook (`cancelFile`), poi i componenti foglia, poi il wiring in `App.tsx`. Ogni step ha dipendenze chiare sul precedente.

---

## Standard Stack

### Core (già nel progetto — nessuna nuova installazione)

| Library | Version | Purpose | Perché già standard |
|---------|---------|---------|---------------------|
| React | 18.x | State management, component tree | Progetto esistente |
| shadcn/ui Button | latest | Cancel button, "Nuova conversione" button | Già usato per Riprova e download ZIP |
| lucide-react | latest | Icona X per cancel batch row | Già usato (`Loader2` in `BatchFileRow`) |
| Tailwind CSS | 3.4 | Stili hover, cursor-pointer sull'header | Già tutto il progetto |

### Supporting

| Library | Version | Purpose | Quando usarlo |
|---------|---------|---------|---------------|
| EventSource (browser native) | - | Chiudere stream SSE su cancel | Già usato in `useBatchUpload` e `useJobStream` |

**Installation:** Nessun nuovo pacchetto necessario.

---

## Architecture Patterns

### Struttura file modificati

```
frontend/src/
├── types/
│   └── job.ts                    # ADD 'cancelled' to BatchFileStatus union
├── hooks/
│   └── useBatchUpload.ts         # ADD cancelFile(id: string) function
├── components/
│   ├── ConversionProgress.tsx    # ADD onCancel prop + cancel button
│   ├── BatchFileRow.tsx          # ADD onCancel prop + cancel button for 'converting' status
│   │                             # ADD 'cancelled' badge to STATUS_BADGE map
│   ├── BatchList.tsx             # PASS onCancel down to BatchFileRow
│   └── App.tsx                   # WIRE onCancel, header click, "Nuova conversione"
```

### Pattern 1: Aggiungere `cancelled` al tipo BatchFileStatus

**What:** Estendere il tipo union in `types/job.ts`
**When to use:** Prima di qualsiasi altra modifica — i componenti dipendono da questo tipo

```typescript
// Source: types/job.ts (codebase esistente, pattern già usato)
export type BatchFileStatus = 'pending' | 'converting' | 'done' | 'error' | 'cancelled';
```

### Pattern 2: `cancelFile` in `useBatchUpload`

**What:** Nuova funzione che chiude l'EventSource per un item e aggiorna il suo status
**When to use:** Segue esattamente il pattern di `retryFile` — close + delete stream + updateItem

```typescript
// Source: useBatchUpload.ts (pattern da retryFile, già nel codebase)
const cancelFile = useCallback((itemId: string) => {
  // Close existing stream (same as retryFile step 1)
  streamsRef.current.get(itemId)?.close();
  streamsRef.current.delete(itemId);

  // Mark as cancelled (NOT error — different visual treatment)
  updateItem(itemId, { status: 'cancelled', jobId: undefined });
}, [updateItem]);

// Return cancelFile alongside existing exports
return { files, addFiles, retryFile, cancelFile, clearFiles };
```

**Nota:** `cancelFile` NON deve fare upload/reconnect — solo close + mark. A differenza di `retryFile`.

### Pattern 3: Cancel nel single-file flow via `onCancel` prop

**What:** `ConversionProgress` riceve `onCancel: () => void` — lo stesso pattern di `onRetry` in `BatchFileRow`
**When to use:** App.tsx costruisce il callback, passa a ConversionProgress

```typescript
// Source: ConversionProgress.tsx (nuovo prop, pattern da BatchFileRow)
interface ConversionProgressProps {
  onCancel: () => void;
}

export function ConversionProgress({ onCancel }: ConversionProgressProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">Converting your document...</p>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Annulla
      </Button>
    </div>
  );
}
```

**Nota:** In `App.tsx`, il callback `onCancel` per `ConversionProgress` chiude l'SSE (implicito — `useJobStream` usa il cleanup di `useEffect` via `return () => es.close()`, quindi basta chiamare `setState({ phase: 'idle' })` che imposta `jobId = null`, triggering il cleanup automatico dell'effetto).

### Pattern 4: Header `<h1>` cliccabile

**What:** L'`<h1>` diventa un pulsante semantico o elemento con onClick + cursor-pointer
**When to use:** In `App.tsx`, header section

```typescript
// Source: App.tsx (pattern da Button ghost/link già nel codebase)
<header className="mb-8 text-center">
  <h1
    className="text-2xl font-semibold tracking-tight cursor-pointer hover:opacity-70 transition-opacity"
    onClick={() => {
      batchHook.clearFiles(); // closes all SSE + clears batch state
      setState({ phase: 'idle' });
    }}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        batchHook.clearFiles();
        setState({ phase: 'idle' });
      }
    }}
  >
    Docling Webapp
  </h1>
  <p className="mt-1 text-sm text-muted-foreground">
    Convert documents to Markdown
  </p>
</header>
```

**Alternativa (accessibilità più pulita):** Wrappare in `<button>` con stile reset e aggiungere le classi direttamente. Ma l'approccio `role="button"` su `<h1>` è accettabile per il contesto.

**Nota importante su `batchHook.clearFiles()`:** Questa funzione chiude tutti gli EventSource e pulisce lo state batch. Per il single-file flow, il SSE viene chiuso automaticamente quando `jobId` diventa `null` (cleanup di `useJobStream`). Il `setState({ phase: 'idle' })` fa già questo.

### Pattern 5: "Nuova conversione" nel success state

**What:** Button `variant="outline"` (o `ghost`) nel success state che fa reset completo a `idle`
**When to use:** Nel blocco JSX `state.phase === 'success'` in `App.tsx`

```typescript
// Source: App.tsx — success state block (pattern da Button outline già usato per Riprova)
{state.phase === 'success' && (
  <div className="rounded-lg border">
    <div className="border-b px-4 py-3 flex items-center justify-between">
      <p className="text-sm font-medium text-muted-foreground">
        Conversione completata
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setState({ phase: 'idle' })}
      >
        Nuova conversione
      </Button>
    </div>
    <ResultViewer
      markdown={state.markdown}
      filename={state.filename}
    />
  </div>
)}
```

### Pattern 6: Cancel button in `BatchFileRow` per status `converting`

**What:** Aggiungere cancel button (icona X) nella row quando status è `converting`
**When to use:** Accanto al badge status, stesso pattern del retry button per `error`

```typescript
// Source: BatchFileRow.tsx — pattern da onRetry esistente
interface BatchFileRowProps {
  item: BatchFile;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void; // NEW
}

// Aggiungere al STATUS_BADGE:
cancelled: { label: 'Annullato', className: 'bg-muted text-muted-foreground' },

// Aggiungere nella row dopo lo status badge:
{item.status === 'converting' && (
  <Button variant="ghost" size="icon-sm" onClick={() => onCancel(item.id)} aria-label="Annulla">
    <X className="h-3 w-3" />
  </Button>
)}
```

**Nota:** `X` è già disponibile da `lucide-react` (stesso package di `Loader2`).

### Pattern 7: Wiring `onCancel` attraverso `BatchList`

**What:** `BatchList` deve ricevere `onCancel` e passarlo a ogni `BatchFileRow`
**When to use:** Segue esattamente il pattern di `onRetry`

```typescript
// Source: BatchList.tsx — stesso pattern di onRetry
interface BatchListProps {
  files: BatchFile[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void; // NEW
}

// Nella render list:
<BatchFileRow key={item.id} item={item} onRetry={onRetry} onCancel={onCancel} />
```

### Anti-Patterns da Evitare

- **Non aggiungere dialog/modal di conferma:** La decisione utente è esplicita: cancel immediato, nessuna conferma.
- **Non aggiungere un endpoint backend per il cancel:** Il backend completa il job silenziosamente; il frontend ignora il risultato.
- **Non resettare il SSE manualmente nel single-file cancel:** `useJobStream` gestisce il cleanup via `useEffect` cleanup function — basta che `jobId` diventi `null`.
- **Non lasciare `cancelled` come stato finale senza badge:** Deve avere la sua entry in `STATUS_BADGE` altrimenti `STATUS_BADGE[item.status]` è `undefined` (runtime error).
- **Non dimenticare `tabIndex={0}` sull'header cliccabile:** Necessario per accessibilità keyboard navigation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Perché |
|---------|-------------|-------------|--------|
| Chiudere EventSource su cancel | Custom abort controller | `es.close()` già in `streamsRef.current` | Il pattern è identico a `retryFile` — già testato |
| Reset completo app state | Custom state manager | `setState({ phase: 'idle' })` + `batchHook.clearFiles()` | Già usato nel codebase per error recovery |
| Icona X per cancel | SVG inline custom | `lucide-react X` già importabile | Stessa lib di `Loader2` già presente |
| Button cancel | Div cliccabile custom | shadcn/ui `Button` già nel progetto | Gestisce focus, disabled, keyboard natively |

**Key insight:** Tutta la logica di cancellazione è già presente nel codebase come side effect di altri meccanismi (`clearFiles`, cleanup di `useEffect`). Phase 6 espone semplicemente questi meccanismi tramite UI.

---

## Common Pitfalls

### Pitfall 1: `STATUS_BADGE` non aggiornato per `cancelled`

**What goes wrong:** `BatchFileRow` legge `STATUS_BADGE[item.status]` — se `cancelled` non è nella mappa, `badge` è `undefined` e il template crasha con `Cannot read properties of undefined`.
**Why it happens:** Si aggiunge `'cancelled'` al tipo TypeScript ma ci si dimentica la costante runtime.
**How to avoid:** Aggiungere l'entry in `STATUS_BADGE` contestualmente alla modifica del tipo.
**Warning signs:** TypeScript non rileva questo bug perché la key del Record è `string`, non `BatchFileStatus`.

### Pitfall 2: SSE single-file non viene chiuso su header click

**What goes wrong:** L'utente clicca l'header durante una conversione — `batchHook.clearFiles()` chiude i batch stream, ma il single-file stream (gestito da `useJobStream`) non viene chiuso immediatamente.
**Why it happens:** `useJobStream` chiude il stream tramite cleanup di `useEffect` che si esegue DOPO il re-render. Ci può essere una finestra in cui l'SSE è ancora aperto.
**How to avoid:** Il meccanismo di cleanup di `useEffect` in React è affidabile: quando `jobId` diventa `null`, React esegue il cleanup sincronamente prima del prossimo ciclo. Questo è sufficiente per questo use case.
**Warning signs:** Se si notasse che `onCompleted`/`onFailed` vengono chiamati dopo il cancel, aggiungere un guard con ref.

### Pitfall 3: Doppio render durante transizione `converting → idle`

**What goes wrong:** Se `ConversionProgress` viene smontato mentre il SSE è ancora aperto, il callback di `onCompleted` potrebbe chiamare `setState` su un componente smontato.
**Why it happens:** React 18 ha strict mode che può causare double-invocation degli effetti in development.
**How to avoid:** `useJobStream` usa già il pattern corretto (`callbacksRef` via `useRef`) — i callback non causano stale closures. Il cleanup `return () => es.close()` viene eseguito prima del prossimo render.
**Warning signs:** Warnings "Warning: Can't perform a React state update on an unmounted component" in console dev.

### Pitfall 4: `cancelFile` chiamato su file già `done`/`error`

**What goes wrong:** Se la UI mostra il cancel button per `converting` ma l'utente è lento e il file finisce prima del click, `cancelFile` viene chiamato su un item già terminato.
**Why it happens:** Race condition tra SSE `completed` event e click dell'utente.
**How to avoid:** In `cancelFile`, verificare che lo stream esista prima di chiuderlo (`streamsRef.current.get(itemId)?.close()` — già usa optional chaining). Il `updateItem` con `status: 'cancelled'` sovrascrive `done`, che è indesiderato. Aggiungere un guard:

```typescript
const cancelFile = useCallback((itemId: string) => {
  const current = files.find(f => f.id === itemId);
  if (!current || current.status !== 'converting') return; // guard
  streamsRef.current.get(itemId)?.close();
  streamsRef.current.delete(itemId);
  updateItem(itemId, { status: 'cancelled' });
}, [files, updateItem]);
```

### Pitfall 5: `clearFiles` in `useBatchUpload` vs reset single-file su header click

**What goes wrong:** Header click chiama `batchHook.clearFiles()` anche in single-file mode, ma `clearFiles` opera solo su `streamsRef` (batch streams). Il single-file SSE è in `useJobStream` — non viene toccato da `clearFiles`.
**Why it happens:** I due flussi hanno state manager separati.
**How to avoid:** L'header click deve fare ENTRAMBE le cose: `batchHook.clearFiles()` (per batch mode) + `setState({ phase: 'idle' })` (che imposta `jobId = null`, triggering il cleanup di `useJobStream`). Il codice mostrato nel Pattern 4 fa già questo correttamente.

---

## Code Examples

### Cancel single-file: wiring in App.tsx

```typescript
// Source: App.tsx — pattern da error recovery esistente
// BEFORE: <ConversionProgress />
// AFTER:
{isConverting && (
  <ConversionProgress
    onCancel={() => setState({ phase: 'idle' })}
  />
)}
// Note: setState({ phase: 'idle' }) sets jobId = null, which triggers
// useJobStream's useEffect cleanup: return () => es.close()
// No manual SSE closure needed here.
```

### Cancel batch: `cancelFile` in `useBatchUpload.ts`

```typescript
// Source: useBatchUpload.ts — modeled after retryFile (existing pattern)
const cancelFile = useCallback((itemId: string) => {
  setFiles(prev => {
    const item = prev.find(f => f.id === itemId);
    if (!item || item.status !== 'converting') return prev; // guard
    return prev.map(f => f.id === itemId ? { ...f, status: 'cancelled' as const } : f);
  });
  streamsRef.current.get(itemId)?.close();
  streamsRef.current.delete(itemId);
}, []);
// Note: Using setFiles functional form avoids stale closure on 'files'
// This is cleaner than depending on 'files' in useCallback deps
```

### Cancelled badge in BatchFileRow

```typescript
// Source: BatchFileRow.tsx — aggiungere a STATUS_BADGE constant
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:    { label: 'In attesa',    className: 'bg-muted text-muted-foreground' },
  converting: { label: 'Conversione', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  done:       { label: 'Completato',  className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  error:      { label: 'Errore',      className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled:  { label: 'Annullato',   className: 'bg-muted text-muted-foreground' }, // NEW
};
```

### Header cliccabile con accessibilità

```typescript
// Source: App.tsx — header section
<h1
  className="text-2xl font-semibold tracking-tight cursor-pointer hover:opacity-70 transition-opacity select-none"
  onClick={() => {
    batchHook.clearFiles();
    setState({ phase: 'idle' });
  }}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      batchHook.clearFiles();
      setState({ phase: 'idle' });
    }
  }}
>
  Docling Webapp
</h1>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| SSE con backend abort | Frontend-only: `es.close()` + ignora risultato backend | Nessuna complessità backend; backend completa silenziosamente |
| `BatchFileStatus` senza `cancelled` | Union type esteso con `'cancelled'` | Distingue cancel (utente-intenzionale) da error (failure) |

---

## Open Questions

1. **Comportamento del cancel button nella batch row quando il file è in stato `pending` (non ancora in `converting`)**
   - What we know: La CONTEXT.md specifica che il cancel button appare per file in status `converting`
   - What's unclear: Cosa succede se l'utente vuole rimuovere un file `pending` prima che inizi? (non richiesto da questo phase)
   - Recommendation: Limitare il cancel button al solo status `converting` come da CONTEXT.md — la rimozione di pending è fuori scope

2. **`cancelFile` e la dipendenza su `files` nel `useCallback`**
   - What we know: Usare `files` come dipendenza di `useCallback` causa un nuovo ref della funzione ad ogni modifica della lista — potrebbe causare re-render extra in `BatchList`
   - What's unclear: L'impatto è visibile con liste corte tipiche (< 10 file)?
   - Recommendation: Usare il functional form di `setFiles` nel body di `cancelFile` per evitare la dipendenza su `files` (come mostrato nel Code Example sopra) — questo è il pattern più robusto

---

## Sources

### Primary (HIGH confidence)
- Codebase esistente (`useBatchUpload.ts`) — pattern `retryFile` e `clearFiles` analizzati direttamente
- Codebase esistente (`useJobStream.ts`) — pattern cleanup `useEffect` con `return () => es.close()`
- Codebase esistente (`BatchFileRow.tsx`) — pattern `STATUS_BADGE` e `onRetry` prop
- Codebase esistente (`App.tsx`) — state machine `AppPhase`, wiring pattern per hook e componenti
- Codebase esistente (`types/job.ts`) — union type `BatchFileStatus`

### Secondary (MEDIUM confidence)
- React 18 docs: `useEffect` cleanup guarantee — cleanup runs before next render when dep changes
- MDN EventSource API: `es.close()` terminates the connection immediately

### Tertiary (LOW confidence)
- Nessuna fonte esterna necessaria — tutte le decisioni si basano su pattern già presenti nel codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nessuna nuova libreria, tutto già nel progetto
- Architecture: HIGH — tutti i pattern sono dirette variazioni di codice esistente
- Pitfalls: HIGH — derivati da analisi diretta del codebase, non da assunzioni

**Research date:** 2026-03-03
**Valid until:** 90 giorni — stack stabile, nessuna dipendenza esterna nuova
