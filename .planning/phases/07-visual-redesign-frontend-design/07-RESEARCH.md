# Phase 7: visual-redesign-frontend-design - Research

**Researched:** 2026-03-03
**Domain:** CSS theming, dark mode, Tailwind v4, shadcn/ui, React
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Palette & identità**
- Accent color: **verde smeraldo** (emerald) — richiama il Markdown e il concetto di conversione completata
- Sostituire il tema shadcn bianco/nero puro con una palette emerald come colore primario/accent
- Il verde deve apparire su elementi interattivi chiave: hover stati, bordi focus, badge "Completato", pulsanti primari

**Dark mode**
- Comportamento: segue `prefers-color-scheme` del sistema come default
- Toggle visibile nell'header — l'utente può sovrascrivere manualmente
- Persistenza della scelta utente in `localStorage`

**UploadZone hero**
- Bordo verde smeraldo (non tratteggiato generico) in stato idle
- Al drag-over: leggero gradient di sfondo emerald + glow verde — feedback visivo immediato
- Proporzioni e tipografia raffinate rispetto all'attuale

**Result Viewer**
- Tipografia curata: line-height generoso, gerarchia titoli chiara (h1 > h2 > h3 con size distinte)
- Nessun syntax highlighting aggiuntivo — il contenuto al centro, non distrazione cromatica
- Padding interno ampio, testo leggibile e ben spaziato

### Claude's Discretion
- Scelta esatta dei valori oklch per la palette emerald
- Implementazione del toggle dark mode (lucide icon, posizione esatta nell'header)
- Transizioni/durate delle animazioni drag-over
- Spaziatura e font-size esatti nel Result Viewer

### Deferred Ideas (OUT OF SCOPE)
Nessuna — la discussione è rimasta nel perimetro del redesign visivo.
</user_constraints>

---

## Summary

Questa fase è interamente CSS/styling: nessun nuovo componente funzionale, nessuna logica backend. La struttura esistente è già solida — `index.css` usa CSS custom properties oklch con selettori `:root` e `.dark`, shadcn/ui legge `--primary`, `--accent`, `--ring` automaticamente. Cambiare la palette emerald si riduce a ridefinire queste vars nei due selettori.

Il dark mode toggle richiede un `ThemeProvider` React context (pattern ufficiale shadcn/ui per Vite) che gestisce `localStorage` + `prefers-color-scheme` e applica la classe `.dark` su `<html>`. Il CONTEXT.md già identifica `App.tsx` come punto di integrazione. Il pattern ThemeProvider + `useTheme` hook è documentato ufficialmente e funziona senza dipendenze aggiuntive.

L'UploadZone ha già `isDragActive` come stato interno — basta aggiungere classi Tailwind condizionali per il glow/gradient. Il ResultViewer usa `prose prose-sm` da `@tailwindcss/typography` (già installato) — la gerarchia titoli e line-height si controllano con modificatori `prose-h1:`, `prose-h2:`, `prose-h3:` o `prose-lg` e `dark:prose-invert` per il dark mode.

**Primary recommendation:** Centralizzare tutte le modifiche in `index.css` (CSS vars emerald) + creare `ThemeProvider` + aggiungere classi condizionali agli esistenti `UploadZone.tsx` e `ResultViewer.tsx`. Zero nuove dipendenze necessarie.

---

## Standard Stack

### Core (già installato — nessuna nuova dipendenza)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4.2.1 | CSS utility classes + design tokens | Già configurato con Vite plugin |
| shadcn/ui (CSS vars) | 3.x | Tema via `--primary`, `--accent`, `--ring` | Cambio palette = aggiorna vars, tutto si propaga |
| @tailwindcss/typography | ^0.5.19 | prose classes per Markdown | Già installato, usato in ResultViewer |
| lucide-react | ^0.576.0 | Icone Sun/Moon per toggle | Già dipendenza, `Sun` e `Moon` disponibili |
| tw-animate-css | ^1.4.0 | Classi di animazione CSS | Già importato in `index.css` |

### Non serve installare nulla

```bash
# Zero nuove installazioni — tutto il necessario è già presente
```

---

## Architecture Patterns

### Struttura file coinvolti

```
frontend/src/
├── index.css                    # MODIFICA: CSS vars oklch emerald (primary, accent, ring)
├── App.tsx                      # MODIFICA: wrappare in ThemeProvider + aggiungere toggle nell'header
├── components/
│   ├── theme-provider.tsx       # NUOVO: ThemeProvider + useTheme hook
│   ├── mode-toggle.tsx          # NUOVO: bottone Sun/Moon toggle
│   ├── UploadZone.tsx           # MODIFICA: classi emerald su isDragActive
│   └── ResultViewer.tsx         # MODIFICA: prose-lg, prose-h1/h2/h3, dark:prose-invert, padding
```

### Pattern 1: Palette emerald via CSS custom properties

**What:** Ridefinire solo `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring` in `:root` e `.dark`. Tutto shadcn/ui si aggiorna automaticamente.

**Valori oklch emerald (fonte: tailwindcolor.com — verificati):**

```css
/* Source: https://tailwindcolor.com/emerald */
/* Emerald palette OKLCH reference:
   50:  oklch(97.9% .021 166.113)
   100: oklch(95% .052 163.051)
   200: oklch(90.5% .093 164.15)
   300: oklch(84.5% .143 164.978)
   400: oklch(76.5% .177 163.223)
   500: oklch(69.6% .17 162.48)
   600: oklch(59.6% .145 163.225)
   700: oklch(50.8% .118 165.612)
   800: oklch(43.2% .095 166.913)
   900: oklch(37.8% .077 168.94)
   950: oklch(26.2% .051 172.552)
*/

:root {
    /* Emerald-600 as primary — interattivo, visibile su bianco */
    --primary: oklch(59.6% .145 163.225);
    --primary-foreground: oklch(0.985 0 0);
    /* Emerald-50 come accent — sfondo tenue su hover/focus */
    --accent: oklch(97.9% .021 166.113);
    --accent-foreground: oklch(37.8% .077 168.94);
    /* Emerald-500 per i ring (focus outline) */
    --ring: oklch(69.6% .17 162.48);
}

.dark {
    /* Emerald-400 — luminoso su sfondo scuro */
    --primary: oklch(76.5% .177 163.223);
    --primary-foreground: oklch(26.2% .051 172.552);
    /* Emerald-950/emerald tenue come accent dark */
    --accent: oklch(26.2% .051 172.552);
    --accent-foreground: oklch(84.5% .143 164.978);
    /* Emerald-400 per ring in dark */
    --ring: oklch(76.5% .177 163.223);
}
```

### Pattern 2: ThemeProvider (pattern ufficiale shadcn/ui per Vite)

**What:** Context React che gestisce `localStorage` + `window.matchMedia` + classe `.dark` su `<html>`.

**Source:** https://ui.shadcn.com/docs/dark-mode/vite

```typescript
// frontend/src/components/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "docling-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
```

### Pattern 3: ModeToggle semplificato (Sun/Moon diretto)

**What:** Toggle semplice Sun/Moon — non dropdown 3-opzioni come nel pattern ufficiale. Il CONTEXT dice "discreto, non dominante". Un `Button variant="ghost" size="icon"` con `Sun`/`Moon` da lucide è sufficiente. Il click cicla tra `light` e `dark` (ignora "system" dopo la prima scelta manuale).

```typescript
// frontend/src/components/mode-toggle.tsx
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  // Resolve effective theme (system -> match prefers-color-scheme)
  const isDark = theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
```

### Pattern 4: UploadZone drag-over emerald glow

**What:** `isDragActive` è già disponibile da `useDropzone`. Aggiungere classi Tailwind per glow verde in drag-over.

**Glow in Tailwind v4:** `shadow-lg shadow-emerald-500/40` per il glow, `bg-emerald-50/60` per il gradient tenue in light, `bg-emerald-950/30` in dark.

```typescript
// UploadZone.tsx — hero mode classes (estratto modificato)
className={[
  'w-full rounded-xl border-2 px-8 py-12 text-center',
  'transition-all duration-200 cursor-pointer select-none',
  isDragActive
    ? [
        'border-emerald-500 border-solid',
        'bg-emerald-50/60 dark:bg-emerald-950/30',
        'shadow-lg shadow-emerald-500/40',
        'text-emerald-700 dark:text-emerald-300',
      ].join(' ')
    : [
        'border-emerald-600/40 border-solid',
        'hover:border-emerald-500 hover:bg-emerald-50/30',
        'dark:border-emerald-700/40 dark:hover:border-emerald-500',
      ].join(' '),
  disabled ? 'pointer-events-none opacity-50' : '',
].join(' ')}
```

**Nota:** Il bordo attuale è `border-dashed`. Il CONTEXT richiede bordo solido emerald — rimuovere `border-dashed`, usare `border-solid` (o omettere, è il default).

### Pattern 5: ResultViewer tipografia curata

**What:** Upgrade da `prose prose-sm` a `prose prose-sm md:prose-base` con modificatori heading e `dark:prose-invert`.

**Source:** https://github.com/tailwindlabs/tailwindcss-typography

```typescript
// ResultViewer.tsx — div.prose aggiornato
<div className={[
  "prose prose-sm max-w-none",
  "dark:prose-invert",
  // Gerarchia titoli esplicita
  "prose-h1:text-2xl prose-h1:font-bold prose-h1:leading-tight",
  "prose-h2:text-xl prose-h2:font-semibold prose-h2:leading-snug",
  "prose-h3:text-lg prose-h3:font-medium prose-h3:leading-snug",
  // Line-height generoso sul body
  "prose-p:leading-relaxed",
  // Padding interno già gestito da p-4 sul TabsContent — aumentare a p-6
].join(" ")}>
  <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
</div>
```

### Anti-Pattern da evitare

- **Cambiare il Tailwind config:** Non esiste `tailwind.config.js` in v4 — tutto va in CSS o classi inline.
- **Aggiungere `next-themes` o `@radix-ui/react-dropdown-menu`:** Non servono — il ThemeProvider custom è sufficiente e il toggle è semplice.
- **Usare `className` su `<Markdown>`:** È una breaking change di react-markdown v10 — va sul `div` wrapper (già corretto nel codebase).
- **Modificare le classi shadcn componenti `ui/`:** Le vars CSS propagano automaticamente — non toccare `button.tsx`, `tabs.tsx`, ecc.
- **Flash of Unstyled Content (FOUC) in dark mode:** Il ThemeProvider legge `localStorage` in `useState` initializer (lazy), ma React 19 hydra lato client — non c'è SSR, quindi FOUC non è un rischio reale in questa SPA Vite.

---

## Don't Hand-Roll

| Problem | Non costruire | Usa invece | Perché |
|---------|---------------|------------|--------|
| Lettura `prefers-color-scheme` | custom event listener | `window.matchMedia("(prefers-color-scheme: dark)").matches` in useEffect | Semplice, standard, già nel ThemeProvider pattern |
| Persistenza tema | custom store | `localStorage` direttamente nel ThemeProvider | Sufficiente per SPA, no dependencies aggiuntive |
| Icone Sun/Moon animate | SVG custom | `lucide-react` `Sun` + `Moon` con classi Tailwind | Già installato, animazione CSS pura |
| Glow effect | plugin tailwind-glow | `shadow-lg shadow-emerald-500/40` — Tailwind nativo v4 | shadow color utilities native, nessun plugin |
| Tipografia Markdown | custom CSS heading | `prose-h1:` `prose-h2:` `prose-h3:` element modifiers | @tailwindcss/typography già installato |

---

## Common Pitfalls

### Pitfall 1: CONTEXT.md dice "dark" class su `<html>` ma il progetto usa Tailwind v4

**What goes wrong:** `index.css` ha `@custom-variant dark (&:is(.dark *))` — questa è la definizione corretta per Tailwind v4 con class strategy. Il ThemeProvider aggiunge `.dark` su `document.documentElement` (il tag `<html>`). Funziona correttamente.

**How to avoid:** Non cambiare `@custom-variant dark` in `index.css`. Il meccanismo è già corretto.

**Warning signs:** Se le classi `dark:` non si applicano, verificare che `.dark` sia su `<html>`, non su `<body>`.

### Pitfall 2: Border dashed vs solid nell'UploadZone

**What goes wrong:** Il codice attuale usa `border-dashed` che è una classe Tailwind che sovrascrive il `border-style`. Aggiungendo solo `border-emerald-600/40` senza rimuovere `border-dashed`, il bordo resta tratteggiato.

**How to avoid:** Rimuovere `border-dashed` esplicitamente. In Tailwind v4 non esiste `border-solid` come classe separata (è il default), quindi basta omettere `border-dashed`.

**Warning signs:** Bordo ancora tratteggiato dopo la modifica → cercare `border-dashed` residuale nelle classi.

### Pitfall 3: Flash of wrong theme al mount

**What goes wrong:** Il ThemeProvider legge `localStorage` nel `useState` initializer — in React 19 questo è sincrono al render, quindi non c'è flash. Ma se in futuro si aggiunge SSR, diventa un problema.

**How to avoid:** Per questa SPA Vite non è necessario alcun workaround. Se appare un flash, aggiungere un `<script>` inline in `index.html` che imposta la classe prima del bundle React — ma non è necessario ora.

### Pitfall 4: `prose-invert` + sfondo non completamente scuro

**What goes wrong:** `dark:prose-invert` inverte i colori del testo (bianco/grigio chiaro su sfondo scuro) ma richiede che il container abbia effettivamente uno sfondo scuro (via `bg-background`). Il componente ResultViewer è inside un border box che usa `bg-background` — funziona correttamente.

**How to avoid:** Verificare che il container del ResultViewer abbia `bg-background` applicato (ereditato dal `<div className="min-h-screen bg-background">` in App.tsx).

### Pitfall 5: Valori oklch e compatibilità browser

**What goes wrong:** OKLCH è supportato in tutti i browser moderni (Chrome 111+, Firefox 113+, Safari 15.4+) ma non in browser molto vecchi.

**How to avoid:** Per questa webapp self-hosted questo non è un vincolo. Nessun fallback HSL necessario.

---

## Code Examples

### CSS vars emerald complete in index.css

```css
/* Source: https://tailwindcolor.com/emerald — verified OKLCH values */
:root {
    --radius: 0.625rem;
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    /* EMERALD PRIMARY */
    --primary: oklch(59.6% .145 163.225);        /* emerald-600 */
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    /* EMERALD ACCENT (tenue) */
    --accent: oklch(97.9% .021 166.113);          /* emerald-50 */
    --accent-foreground: oklch(37.8% .077 168.94); /* emerald-900 */
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    /* EMERALD RING */
    --ring: oklch(69.6% .17 162.48);              /* emerald-500 */
    /* chart vars invariati */
    --chart-1: oklch(0.646 0.222 41.116);
    --chart-2: oklch(0.6 0.118 184.704);
    --chart-3: oklch(0.398 0.07 227.392);
    --chart-4: oklch(0.828 0.189 84.429);
    --chart-5: oklch(0.769 0.188 70.08);
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    /* EMERALD PRIMARY DARK */
    --primary: oklch(76.5% .177 163.223);         /* emerald-400 */
    --primary-foreground: oklch(26.2% .051 172.552); /* emerald-950 */
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    /* EMERALD ACCENT DARK */
    --accent: oklch(26.2% .051 172.552);           /* emerald-950 */
    --accent-foreground: oklch(84.5% .143 164.978); /* emerald-300 */
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    /* EMERALD RING DARK */
    --ring: oklch(76.5% .177 163.223);             /* emerald-400 */
    /* chart vars invariati */
    --chart-1: oklch(0.488 0.243 264.376);
    --chart-2: oklch(0.696 0.17 162.48);
    --chart-3: oklch(0.769 0.188 70.08);
    --chart-4: oklch(0.627 0.265 303.9);
    --chart-5: oklch(0.645 0.246 16.439);
}
```

### Integrazione ThemeProvider in App.tsx

```typescript
// App.tsx — wrappare il return in ThemeProvider
import { ThemeProvider } from '@/components/theme-provider'
import { ModeToggle } from '@/components/mode-toggle'

// Nel JSX:
return (
  <ThemeProvider defaultTheme="system" storageKey="docling-theme">
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            {/* Title centrato — flex con justify-between spinge il toggle a destra */}
            <div className="flex-1" />
            <h1
              className="text-2xl font-semibold tracking-tight cursor-pointer select-none hover:opacity-70 transition-opacity"
              onClick={handleReset}
              role="button"
              tabIndex={0}
              onKeyDown={handleResetKeyDown}
            >
              Docling Webapp
            </h1>
            <div className="flex-1 flex justify-end">
              <ModeToggle />
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground text-center">
            Convert documents to Markdown
          </p>
        </header>
        {/* resto invariato */}
      </div>
    </div>
  </ThemeProvider>
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` per temi | CSS-first con `@theme inline` in `index.css` | Tailwind v4 (2025) | Nessun file config JS |
| `darkMode: 'class'` in config | `@custom-variant dark (&:is(.dark *))` in CSS | Tailwind v4 | Già implementato nel progetto |
| HSL color values per shadcn | OKLCH color values | shadcn/ui 2024+ | Gamut P3 più vivido |
| `className` su `<Markdown>` | `div` wrapper con className | react-markdown v10 | Già corretto nel progetto |
| Dropdown 3-opzioni per theme | Toggle semplice Sun/Moon | Best practice UX | Più discreto per app tool |

---

## Open Questions

1. **Posizione esatta del toggle nell'header**
   - What we know: App.tsx usa un header con h1 centrato. Il CONTEXT dice "discreto, non dominante".
   - What's unclear: Layout esatto — `flex justify-between` con spacer, oppure toggle come icona inline dopo il titolo.
   - Recommendation: Usare `flex items-center justify-between` con due spacer `flex-1` — titolo rimane visivamente centrato, toggle va a destra. Comune e discreto.

2. **Durata transizione drag-over**
   - What we know: `tw-animate-css` è già disponibile. L'attuale UploadZone usa `transition-colors`.
   - What's unclear: `transition-all duration-200` o `duration-150`?
   - Recommendation: `transition-all duration-200` — 200ms è il sweet spot per feedback immediato senza essere brusco.

3. **Font-size del Result Viewer**
   - What we know: Attualmente `prose-sm` (14px base). Il CONTEXT dice "testo leggibile e ben spaziato".
   - What's unclear: `prose-sm` vs `prose-base` (16px) — dipende dalla densità del contenuto.
   - Recommendation: Mantenere `prose-sm` per contenuto denso, aggiungere `prose-p:leading-relaxed` per il line-height generoso richiesto. Claude può passare a `prose-base` se l'output risulta troppo compresso visivamente.

---

## Sources

### Primary (HIGH confidence)
- https://tailwindcolor.com/emerald — valori OKLCH emerald palette completa (tutti gli shade 50-950)
- https://ui.shadcn.com/docs/dark-mode/vite — ThemeProvider ufficiale per Vite + React
- https://github.com/tailwindlabs/tailwindcss-typography — prose element modifiers, prose-invert, dark mode

### Secondary (MEDIUM confidence)
- https://tailwindcss.com/docs/box-shadow — shadow color utilities (`shadow-emerald-500/40`) Tailwind v4
- https://tailwindcss.com/docs/colors — conferma migrazione da RGB a OKLCH in v4

### Tertiary (LOW confidence)
- WebSearch su shadcn theming emerald — confermato con fonte primaria ui.shadcn.com/docs/theming

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tutto già installato, zero nuove dipendenze
- Architecture: HIGH — pattern ThemeProvider da docs ufficiali shadcn, valori oklch da tailwindcolor.com
- Pitfalls: HIGH — basati su esame diretto del codice esistente + docs verificate

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (librerie stabili, 30 giorni)
