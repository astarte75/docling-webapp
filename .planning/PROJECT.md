# Docling Webapp

## What This Is

A web application che espone le funzionalità di Docling attraverso un'interfaccia chiara e semplice. L'utente può caricare uno o più documenti (PDF, DOCX, PPTX, XLSX, immagini, HTML, ecc.) e ottenere la conversione in Markdown, con la possibilità di configurare le opzioni di Docling tramite un pannello progressivo (default semplici, opzioni avanzate espandibili).

## Core Value

Convertire qualsiasi documento in Markdown pulito con un semplice browser upload, rendendo accessibile la potenza di Docling senza toccare la CLI.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Upload di un singolo documento con preview immediata del Markdown risultante
- [ ] Upload batch di più documenti con download del risultato come archivio ZIP
- [ ] Configurazione progressiva: default sensati + pannello avanzato espandibile
- [ ] Supporto a tutti i formati di input Docling (PDF, DOCX, PPTX, XLSX, HTML, immagini PNG/JPEG/TIFF, ecc.)
- [ ] Output esclusivamente in Markdown
- [ ] Backend FastAPI (Python) che wrappa Docling
- [ ] Frontend React + Vite con interfaccia chiara e responsiva
- [ ] Containerizzazione Docker Compose (backend + frontend separati)
- [ ] Avvio locale per sviluppo, deployment self-hosted in produzione

### Out of Scope

- Output in JSON, HTML o altri formati — focus su Markdown per v1
- Autenticazione utenti — uso personale/self-hosted, non necessaria
- Storage persistente delle conversioni — sessione temporanea, nessun DB
- Integrazioni AI (LangChain, LlamaIndex, MCP) — fuori scope v1
- Supporto audio/video (WAV, MP3, WebVTT) — formati di nicchia, v2+

## Context

- Docling è una libreria Python (≥3.10) open source dell'LF AI & Data Foundation
- Supporta pipeline diverse: standard, VLM (Visual Language Model con Granite)
- OCR integrato per documenti scansionati e immagini
- Riconoscimento avanzato di tabelle, formule, layout
- Il modello di layout è stato recentemente aggiornato a Heron (più veloce)
- La conversione può essere computazionalmente intensa — occorre gestire job asincroni

## Constraints

- **Tech stack**: FastAPI + React + Vite + Docker Compose — deciso
- **Output**: Solo Markdown per v1 — semplifica l'interfaccia e il backend
- **Python**: ≥3.10 richiesto da Docling
- **Esecuzione locale**: modelli Docling scaricati localmente, nessun cloud API
- **Performance**: conversioni pesanti devono girare in background (async/task queue)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI come backend | Docling è Python, zero friction, ottimo async support | — Pending |
| React + Vite come frontend | SPA moderna, buon ecosistema UI, separazione netta da backend | — Pending |
| Docker Compose | Self-hosting semplice, ambiente riproducibile, deploy pronto | — Pending |
| Solo Markdown in output | Focus sul caso d'uso principale, interfaccia più semplice | — Pending |
| Job asincroni per conversione | Docling può essere lento su PDF complessi — UX non bloccata | — Pending |

---
*Last updated: 2026-03-02 after initialization*
