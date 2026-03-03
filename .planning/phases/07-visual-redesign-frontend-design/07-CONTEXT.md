# Phase 7: visual-redesign-frontend-design - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign visivo del frontend: palette colori, identità brand, dark mode con toggle, animazioni UploadZone, tipografia e spaziatura del Result Viewer. La struttura funzionale e i componenti rimangono invariati — solo l'aspetto visivo cambia.

</domain>

<decisions>
## Implementation Decisions

### Palette & identità
- Accent color: **verde smeraldo** (emerald) — richiama il Markdown e il concetto di conversione completata
- Sostituire il tema shadcn bianco/nero puro con una palette emerald come colore primario/accent
- Il verde deve apparire su elementi interattivi chiave: hover stati, bordi focus, badge "Completato", pulsanti primari

### Dark mode
- Comportamento: segue `prefers-color-scheme` del sistema come default
- Toggle visibile nell'header — l'utente può sovrascrivere manualmente
- Persistenza della scelta utente in `localStorage`

### UploadZone hero
- Bordo verde smeraldo (non tratteggiato generico) in stato idle
- Al drag-over: leggero gradient di sfondo emerald + glow verde — feedback visivo immediato
- Proporzioni e tipografia raffinate rispetto all'attuale

### Result Viewer
- Tipografia curata: line-height generoso, gerarchia titoli chiara (h1 > h2 > h3 con size distinte)
- Nessun syntax highlighting aggiuntivo — il contenuto al centro, non distrazione cromatica
- Padding interno ampio, testo leggibile e ben spaziato

### Claude's Discretion
- Scelta esatta dei valori oklch per la palette emerald
- Implementazione del toggle dark mode (lucide icon, posizione esatta nell'header)
- Transizioni/durate delle animazioni drag-over
- Spaziatura e font-size esatti nel Result Viewer

</decisions>

<specifics>
## Specific Ideas

- Il verde smeraldo deve evocare "Markdown riuscito" — non un verde aggressivo, più un emerald/teal raffinato
- Il toggle dark/light nell'header deve essere discreto, non dominare il layout
- L'animazione drag-over deve essere evidente ma non eccessiva — un glow pulito, non una discoteca

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/ui/button.tsx` — già con varianti (outline, ghost, default) — basta aggiornare i CSS vars
- `frontend/src/components/UploadZone.tsx` — gestisce già drag-over state internamente, aggiungere classi condizionali
- `frontend/src/index.css` — CSS vars oklch già strutturate per light/dark, basta ridefinire i valori

### Established Patterns
- Tema tramite CSS custom properties in `index.css` (`:root` e `.dark`) — non serve toccare Tailwind config
- Shadcn/ui usa `--primary`, `--accent`, `--ring` per colorare componenti — aggiornare queste vars propaga il verde ovunque
- Dark mode già supportata via `.dark` class selector

### Integration Points
- Toggle dark mode: aggiungere state/localStorage in `App.tsx` o un provider dedicato, classe `.dark` su `<html>`
- UploadZone: aggiungere classi emerald sullo stato `isDragOver` già presente nel componente

</code_context>

<deferred>
## Deferred Ideas

Nessuna — la discussione è rimasta nel perimetro del redesign visivo.

</deferred>

---

*Phase: 07-visual-redesign-frontend-design*
*Context gathered: 2026-03-03*
