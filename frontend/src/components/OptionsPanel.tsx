import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  OCR_ENGINES,
  EASYOCR_LANGUAGES,
  TESSERACT_LANGUAGES,
} from '@/types/job';
import type { ConversionOptions, OcrMode, OcrEngine } from '@/types/job';

/** Language list and default-lang info per engine */
const ENGINE_LANG_CONFIG: Record<string, { langs: { code: string; label: string }[]; defaultHint: string }> = {
  easyocr:  { langs: EASYOCR_LANGUAGES,  defaultHint: 'EN IT FR DE ES PT NL PL TR' },
  tesseract: { langs: TESSERACT_LANGUAGES, defaultHint: 'EN IT FR DE ES' },
};

interface OptionsPanelProps {
  value: ConversionOptions;
  onChange: (opts: ConversionOptions) => void;
}

export function OptionsPanel({ value, onChange }: OptionsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  function handleEngineChange(engine: OcrEngine) {
    // Selecting a specific engine while ocrMode is 'auto' is contradictory:
    // switch to 'on' so the mode buttons reflect the actual behavior.
    const nextMode = engine !== 'auto' && value.ocrMode === 'auto' ? 'on' : value.ocrMode;
    onChange({ ...value, ocrEngine: engine, ocrLanguages: [], ocrMode: nextMode });
  }

  function handleLangToggle(code: string) {
    const current = value.ocrLanguages;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    onChange({ ...value, ocrLanguages: next });
  }

  const langConfig = ENGINE_LANG_CONFIG[value.ocrEngine];

  return (
    <div className="space-y-3">
      {/* OCR mode row */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0">OCR Mode</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={value.ocrMode}
          onValueChange={(v) => {
            // Guard against deselection (Radix emits "" when clicking the already-selected item)
            if (!v) return;
            const nextMode = v as OcrMode;
            // Switching to 'auto' means the engine choice is also automatic.
            const nextEngine = nextMode === 'auto' ? 'auto' : value.ocrEngine;
            onChange({ ...value, ocrMode: nextMode, ocrEngine: nextEngine });
          }}
        >
          <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
          <ToggleGroupItem value="on">On</ToggleGroupItem>
          <ToggleGroupItem value="off">Off</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Collapsible advanced options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
          Opzioni avanzate
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Table detection switch */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rilevamento tabelle</span>
            <Switch
              checked={value.tableDetection}
              onCheckedChange={(checked) =>
                onChange({ ...value, tableDetection: checked })
              }
            />
          </div>

          {/* Page range inputs */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">Pagine: da</span>
            <input
              type="number"
              min="1"
              placeholder="1"
              value={value.pageFrom ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  pageFrom: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20 text-center rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">a</span>
            <input
              type="number"
              min="1"
              placeholder="fine"
              value={value.pageTo ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  pageTo: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20 text-center rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* OCR engine select */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Motore OCR</span>
            <Select
              value={value.ocrEngine}
              onValueChange={(v) => handleEngineChange(v as OcrEngine)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OCR_ENGINES.map((engine) => (
                  <SelectItem key={engine.value} value={engine.value}>
                    {engine.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language selector */}
          {!langConfig ? (
            /* Auto / RapidOCR: multilingual, no selection needed */
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>🌍</span>
              <span>
                {value.ocrEngine === 'rapidocr'
                  ? 'RapidOCR è multilingue automatico'
                  : 'Il motore scelto automaticamente è multilingue'}
              </span>
            </div>
          ) : (
            /* EasyOCR / Tesseract: multi-select toggle buttons */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Lingue{' '}
                  <span className="text-xs opacity-60">
                    (default: {langConfig.defaultHint})
                  </span>
                </span>
                {value.ocrLanguages.length > 0 && (
                  <button
                    onClick={() => onChange({ ...value, ocrLanguages: [] })}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {langConfig.langs.map((lang) => {
                  const selected = value.ocrLanguages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleLangToggle(lang.code)}
                      className={[
                        'px-2 py-0.5 text-xs rounded-md border transition-colors',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30',
                      ].join(' ')}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
              {value.ocrLanguages.length === 0 && (
                <p className="text-xs text-muted-foreground opacity-60">
                  Nessuna selezione = usa default
                </p>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
