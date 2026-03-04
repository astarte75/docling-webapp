import type { BatchFile } from '@/types/job';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Status badge colors
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:    { label: 'Pending',     className: 'bg-muted text-muted-foreground' },
  converting: { label: 'Converting',  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  done:       { label: 'Done',        className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  error:      { label: 'Error',       className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled:  { label: 'Cancelled',   className: 'bg-muted text-muted-foreground' },
};

interface BatchFileRowProps {
  item: BatchFile;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

export function BatchFileRow({ item, onRetry, onCancel }: BatchFileRowProps) {
  const badge = STATUS_BADGE[item.status];

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/30">
      {/* Filename */}
      <span className="flex-1 truncate text-sm font-medium" title={item.file.name}>
        {item.file.name}
      </span>

      {/* Status badge with spinner for converting */}
      <div className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', badge.className)}>
        {item.status === 'converting' && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {badge.label}
      </div>

      {/* Cancel button — only on converting */}
      {item.status === 'converting' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onCancel(item.id)}
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Error message inline (visible only on error) */}
      {item.status === 'error' && item.errorMessage && (
        <span className="text-xs text-destructive truncate max-w-[200px]" title={item.errorMessage}>
          {item.errorMessage}
        </span>
      )}

      {/* Retry button — only on error */}
      {item.status === 'error' && (
        <Button variant="outline" size="sm" onClick={() => onRetry(item.id)}>
          Retry
        </Button>
      )}
    </div>
  );
}
