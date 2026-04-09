import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';

import { ENGINES } from '@/types/job';
import type { ConversionOptions, Engine } from '@/types/job';

interface OptionsPanelProps {
  value: ConversionOptions;
  onChange: (opts: ConversionOptions) => void;
}

export function OptionsPanel({ value, onChange }: OptionsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      {/* Engine toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0">Engine</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={value.engine}
          onValueChange={(v) => {
            if (!v) return;
            onChange({ ...value, engine: v as Engine });
          }}
        >
          {ENGINES.map((e) => (
            <ToggleGroupItem key={e.value} value={e.value}>
              {e.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Collapsible advanced options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
          Advanced options
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Table detection switch */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Table detection</span>
            <Switch
              checked={value.tableDetection}
              onCheckedChange={(checked) =>
                onChange({ ...value, tableDetection: checked })
              }
            />
          </div>

          {/* Page range inputs */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">Pages: from</span>
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
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="number"
              min="1"
              placeholder="end"
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
