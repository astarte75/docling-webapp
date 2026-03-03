import { Button } from '@/components/ui/button';

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
