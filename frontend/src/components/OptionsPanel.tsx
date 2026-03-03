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
  SUPPORTED_OCR_LANGUAGES,
} from '@/types/job';
import type { ConversionOptions, OcrMode } from '@/types/job';

interface OptionsPanelProps {
  value: ConversionOptions;
  onChange: (opts: ConversionOptions) => void;
}

export function OptionsPanel({ value, onChange }: OptionsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  // Radix Select does not allow empty string as item value — use sentinel
  const LANG_NONE = '__none__';

  // Derive single language code for the select (we store as array, expose as single)
  const selectedLanguage =
    value.ocrLanguages.length > 0 ? value.ocrLanguages[0] : LANG_NONE;

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
            if (v) onChange({ ...value, ocrMode: v as OcrMode });
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

          {/* OCR language select */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Lingua OCR</span>
            <Select
              value={selectedLanguage}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  ocrLanguages: v && v !== LANG_NONE ? [v] : [],
                })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Qualsiasi (default)" />
              </SelectTrigger>
              <SelectContent>
                {/* Sentinel value resets to "any language" (Radix disallows empty string) */}
                <SelectItem value={LANG_NONE}>Qualsiasi (default)</SelectItem>
                {SUPPORTED_OCR_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
