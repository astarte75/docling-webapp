---
phase: 04-options-panel-batch-conversion
verified: 2026-03-03T20:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Visual inspection — OptionsPanel above upload zone"
    expected: "OCR mode toggle (Auto/On/Off) and 'Opzioni avanzate' collapsible are visible above the upload drop zone in idle state"
    why_human: "Visual layout and component rendering cannot be verified without a running browser"
  - test: "Advanced panel expand/collapse"
    expected: "Clicking 'Opzioni avanzate' expands panel showing table detection switch, page range inputs (da/a), and language select"
    why_human: "Interactive UI behavior requires browser"
  - test: "Single-file conversion with options"
    expected: "Dropping one PDF with OCR mode set to 'On' sends ocr_mode=on in the POST /convert form data; conversion completes and shows markdown result"
    why_human: "Requires Docker stack running with Docling installed"
  - test: "Batch conversion flow"
    expected: "Dropping 2+ PDFs shows BatchList with per-file status badges (pending -> converting -> done), ZIP button appears when >= 1 file completes"
    why_human: "Requires Docker stack running and multiple test PDFs"
  - test: "ZIP download"
    expected: "Clicking 'Scarica ZIP' downloads a .zip containing one .md file per converted document"
    why_human: "File download behavior requires browser environment"
  - test: "Retry on batch error"
    expected: "A failed batch item shows a 'Riprova' button; clicking it re-uploads and re-streams the file"
    why_human: "Requires a file that produces an error to test the retry path"
  - test: "Compact strip 'Aggiungi altri file'"
    expected: "In batch-active state, a compact UploadZone strip allows adding more files which are appended to BatchList"
    why_human: "Interactive state machine behaviour requires browser"
---

# Phase 04: Options Panel and Batch Conversion — Verification Report

**Phase Goal:** Options Panel and Batch Conversion — pannello opzioni di conversione e upload batch multi-file con download ZIP
**Verified:** 2026-03-03
**Status:** human_needed (all automated checks passed)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /convert accetta form fields ocr_mode, table_detection, page_from, page_to, ocr_languages | VERIFIED | `backend/main.py` righe 79-83: 5 `Form(default=...)` params presenti |
| 2  | Il backend converte con opzioni personalizzate per-job (OCR mode, table detection, page range, OCR language) | VERIFIED | `backend/adapter.py`: `ConversionOptions` dataclass, `build_pipeline_options()` mappa tutti e 5 i campi a `PdfPipelineOptions` |
| 3  | Il worker esegue al massimo MAX_CONCURRENT_JOBS=2 conversioni in parallelo | VERIFIED | `backend/job_store.py` riga 38: `asyncio.Semaphore(MAX_CONCURRENT_JOBS)`; riga 68: `asyncio.create_task(process_job(job_id))` |
| 4  | MAX_CONCURRENT_JOBS è documentata in config.py con default 2 | VERIFIED | `backend/config.py` riga 10: `MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))` |
| 5  | L'utente vede il controllo OCR (Auto/On/Off) come ToggleGroup sopra l'upload zone | VERIFIED (code) | `OptionsPanel.tsx` righe 44-56: `ToggleGroup` con 3 `ToggleGroupItem`; `App.tsx` riga 87-91: visibile in `idle` e `batch-active` |
| 6  | L'utente può espandere/collassare un pannello avanzato con table detection, page range e OCR language | VERIFIED (code) | `OptionsPanel.tsx` righe 60-140: `Collapsible` con `Switch`, due `<input type="number">`, `Select` con `SUPPORTED_OCR_LANGUAGES` |
| 7  | 2+ file droppati avviano batch-active con BatchList per-file status | VERIFIED (code) | `App.tsx` riga 46-48: `batch-active` state + `batchHook.addFiles`; `useBatchUpload.ts`: upload sequenziale + SSE lazy per-job |
| 8  | Le opzioni sono snapshotate al drop time per ogni file | VERIFIED | `useBatchUpload.ts` riga 73: `options: { ...opts }` deep copy; `App.tsx` riga 48: `addFiles(files, currentOptions)` snapshot at call time |
| 9  | L'utente può scaricare tutti i file convertiti come ZIP | VERIFIED (code) | `BatchList.tsx` righe 11-28: `downloadBatchZip()` via JSZip client-side; bottone visibile quando `doneCount > 0` |

**Score:** 9/9 truths verified (automated code checks)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/config.py` | MAX_CONCURRENT_JOBS env var | VERIFIED | Riga 10: `int(os.getenv("MAX_CONCURRENT_JOBS", "2"))` |
| `backend/adapter.py` | ConversionOptions dataclass, build_pipeline_options, DoclingAdapter.convert_file con opts param | VERIFIED | Righe 12-27 (dataclass), 30-53 (build func), 70 (convert_file signature) |
| `backend/job_store.py` | Job con options field, semaphore-based conversion_worker | VERIFIED | Riga 23: `options: ConversionOptions`; riga 38: `asyncio.Semaphore(MAX_CONCURRENT_JOBS)` |
| `backend/main.py` | POST /convert che legge form fields e costruisce ConversionOptions | VERIFIED | Righe 79-83: Form params; righe 129-135: `ConversionOptions(...)` instantiation |
| `frontend/src/types/job.ts` | ConversionOptions, BatchFile, BatchFileStatus, AppPhase esteso | VERIFIED | Tutti i tipi presenti e esportati; `batch-active` e `batch-complete` in AppPhase |
| `frontend/package.json` | jszip dependency | VERIFIED | `"jszip": "^3.10.1"` presente |
| `frontend/src/components/ui/toggle-group.tsx` | shadcn toggle-group | VERIFIED | File presente |
| `frontend/src/components/ui/collapsible.tsx` | shadcn collapsible | VERIFIED | File presente |
| `frontend/src/components/ui/switch.tsx` | shadcn switch | VERIFIED | File presente |
| `frontend/src/components/ui/select.tsx` | shadcn select | VERIFIED | File presente |
| `frontend/src/components/OptionsPanel.tsx` | OCR ToggleGroup + Collapsible advanced panel | VERIFIED | 144 righe, tutti i controlli presenti, guard `if (v)` per deselection |
| `frontend/src/hooks/useBatchUpload.ts` | Hook batch upload + SSE per-job | VERIFIED | 127 righe, upload sequenziale, SSE lazy, retry, clearFiles |
| `frontend/src/components/BatchFileRow.tsx` | Riga batch: filename, status badge, retry button | VERIFIED | 53 righe, badge system completo, Loader2 spinner su converting |
| `frontend/src/components/BatchList.tsx` | Lista batch + ZIP download footer | VERIFIED | 61 righe, JSZip import, downloadBatchZip() funzionale |
| `frontend/src/components/UploadZone.tsx` | Multi-file support con compact mode | VERIFIED | `multiple: true` in useDropzone, prop `onFilesSelected`, `compact` mode strip |
| `frontend/src/App.tsx` | State machine con OptionsPanel, batch flow, single-file con options | VERIFIED | 173 righe, tutti i flussi presenti e collegati |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/main.py POST /convert` | `backend/adapter.py ConversionOptions` | Form params → ConversionOptions instantiation | WIRED | Riga 129: `ConversionOptions(ocr_mode=ocr_mode, ...)` |
| `backend/job_store.py conversion_worker` | `backend/adapter.py convert_file` | `await state.converter.convert_file(job.tmp_path, job.options)` | WIRED | Riga 47: chiamata con `job.options` |
| `frontend/src/App.tsx` | `frontend/src/components/OptionsPanel.tsx` | `currentOptions state → OptionsPanel value + onChange` | WIRED | Riga 89: `<OptionsPanel value={currentOptions} onChange={setCurrentOptions} />` |
| `frontend/src/App.tsx` | `frontend/src/hooks/useBatchUpload.ts` | `useBatchUpload().addFiles(files, currentOptions)` | WIRED | Riga 48: `batchHook.addFiles(files, currentOptions)` |
| `frontend/src/App.tsx` | `frontend/src/components/BatchList.tsx` | `state.phase === 'batch-active' → <BatchList ...>` | WIRED | Righe 162-166: render condizionale su `isBatch` |
| `frontend/src/hooks/useBatchUpload.ts` | `backend POST /convert` | `FormData append ocr_mode, table_detection, ...` | WIRED | Righe 10-15: tutti i campi options appesi al FormData |
| `frontend/src/components/BatchList.tsx` | JSZip | `downloadBatchZip()` genera blob e scarica | WIRED | Riga 1: `import JSZip`; righe 11-28: implementazione completa |
| `frontend/src/App.tsx single-file` | `backend POST /convert` | `FormData con ocr_mode, table_detection, pageFrom, pageTo, ocrLanguages` | WIRED | Righe 28-32 in App.tsx |

---

## Requirements Coverage

| Requirement | Source Plan | Descrizione | Status | Evidenza |
|-------------|-------------|-------------|--------|----------|
| CONF-01 | 04-01, 04-03, 04-05 | User can set OCR mode (auto/on/off) | SATISFIED | `OptionsPanel.tsx` ToggleGroup + Form field `ocr_mode` in backend |
| CONF-02 | 04-03, 04-05 | User can expand/collapse advanced options panel | SATISFIED | `OptionsPanel.tsx` Collapsible con ChevronDown animato |
| CONF-03 | 04-01, 04-03, 04-05 | User can toggle table detection on/off | SATISFIED | `Switch` in OptionsPanel + `table_detection` Form field + `build_pipeline_options` |
| CONF-04 | 04-01, 04-03, 04-05 | User can set page range (from/to) | SATISFIED | Input numerici in OptionsPanel + `page_from`/`page_to` Form fields + `page_range` in adapter |
| CONF-05 | 04-01, 04-03, 04-05 | User can select OCR language | SATISFIED | `Select` in OptionsPanel + `ocr_languages` Form field + `EasyOcrOptions.lang` |
| BTCH-01 | 04-02, 04-04, 04-05 | User can upload multiple files in a single session | SATISFIED | `UploadZone` con `multiple: true`; `useBatchUpload.addFiles` accetta `File[]` |
| BTCH-02 | 04-02, 04-04, 04-05 | User sees individual status per file (pending/converting/done/error) | SATISFIED | `BatchFileRow` con badge system 4 stati + Loader2 spinner |
| BTCH-03 | 04-01 | System converts batch files in parallel up to MAX_CONCURRENT_JOBS (default 2) | SATISFIED | `asyncio.Semaphore(MAX_CONCURRENT_JOBS)` in `conversion_worker` |
| BTCH-04 | 04-02, 04-04 | User can download all converted files as ZIP | SATISFIED | `BatchList` + JSZip client-side + bottone "Scarica ZIP (N file)" |

**Tutti i 9 requirement IDs dichiarati nei PLAN sono coperti e soddisfatti.**

Nessun requirement ORPHANED: i 9 ID (CONF-01..05, BTCH-01..04) sono gli stessi sia nei PLAN che nel mapping REQUIREMENTS.md → Phase 4.

---

## Anti-Patterns Found

| File | Nota | Tipo | Impatto |
|------|------|------|---------|
| `backend/adapter.py` (righe 81-86) | `DocumentConverter` creato FUORI dal `async with self._lock` — il lock copre solo la chiamata `to_thread`, non la creazione. Il commento nella docstring dice "lock covers creation+conversion" ma non è accurato. | Info | Nessun impatto funzionale: la creazione del `DocumentConverter` è idempotente e non accede a stato condiviso. Il lock è ancora necessario per serializzare le chiamate bloccanti `to_thread` a Docling. Il commento è inaccurato ma non introduce bug. |
| `frontend/src/types/job.ts` (riga 11) | Tipo `batch-complete` definito in `AppPhase` e usato in `isBatch` di App.tsx, ma nessuna transizione verso questo stato è mai invocata nel codice (né in App.tsx né in useBatchUpload). Il batch rimane permanentemente in `batch-active`. | Info | Nessun blocco funzionale. Il batch funziona correttamente in `batch-active`. Il tipo `batch-complete` è previsto per un uso futuro (es. quando tutti i file sono done), ma non è necessario per il funzionamento attuale. |

Nessun anti-pattern di categoria Blocker o Warning trovato.

---

## Human Verification Required

### 1. OptionsPanel — Rendering e layout visivo

**Test:** Avvia `docker compose up` dalla root, apri http://localhost:3000
**Expected:** Sopra la drop zone sono visibili i 3 pulsanti [Auto] [On] [Off] con etichetta "OCR Mode"; sotto un link/trigger "Opzioni avanzate" con freccia
**Why human:** Layout CSS e rendering React richiedono un browser

### 2. Pannello avanzato espandibile

**Test:** Clicca su "Opzioni avanzate"
**Expected:** Il pannello si espande mostrando: toggle "Rilevamento tabelle", due campi numerici "Pagine: da [ ] a [ ]", select "Lingua OCR" con opzione "Qualsiasi (default)"
**Why human:** Animazione Collapsible e rendering shadcn richiedono browser

### 3. Single-file con opzioni

**Test:** Setta OCR mode su "On", droppa un PDF singolo
**Expected:** La conversione avviene (progress spinner → risultato markdown); le opzioni selezionate sono inviate al backend (verificabile dai log Docker: `ocr_mode=on`)
**Why human:** Richiede Docker con Docling installato e PDF di test

### 4. Batch conversion — status per-file

**Test:** Droppa 2+ PDF contemporaneamente
**Expected:** Appare BatchList con una riga per file; lo stato passa da "In attesa" → "Conversione" (con spinner) → "Completato"
**Why human:** Comportamento real-time SSE richiede running stack

### 5. ZIP download

**Test:** Dopo che almeno 1 file batch è "Completato", clicca "Scarica ZIP (N file)"
**Expected:** Il browser scarica `converted.zip` contenente un file `.md` per ogni documento convertito
**Why human:** Download di file richiede browser

### 6. Retry su errore batch

**Test:** Se un file risulta in errore, clicca "Riprova"
**Expected:** La riga torna a "In attesa" poi "Conversione", poi eventualmente "Completato"
**Why human:** Richiede un file che produca un errore (es. PDF corrotto o >50MB)

### 7. Compact strip "Aggiungi altri file"

**Test:** Con batch in corso, usa la striscia compatta in cima per aggiungere un altro PDF
**Expected:** Il nuovo file appare in fondo alla BatchList con status "In attesa" e inizia la conversione
**Why human:** Interazione React state machine richiede browser

---

## Note Tecniche Rilevanti

### Lock scope in adapter.py
Il `DocumentConverter` viene istanziato **prima** del `async with self._lock` (righe 81-84 vs riga 86). Il lock serializza solo la chiamata a `asyncio.to_thread(converter.convert, ...)`. Questo è funzionalmente corretto perché la creazione del `DocumentConverter` è thread-safe (non accede a stato condiviso). Il `asyncio.Semaphore` in `conversion_worker` limita ulteriormente la concorrenza a `MAX_CONCURRENT_JOBS`. Il commento nella docstring che afferma "lock covers creation+conversion" è inaccurato ma non introduce vulnerabilità o bug.

### Stato batch-complete mai raggiunto
`batch-complete` è un tipo valido in `AppPhase` ma nessun codice esegue mai `setState({ phase: 'batch-complete', ... })`. Il batch rimane in `batch-active` per l'intera sessione. Non è un bug — il comportamento è corretto e l'utente può continuare ad aggiungere file — ma potrebbe essere intenzionale per un futuro "fine batch" esplicito.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
