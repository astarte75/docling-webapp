import JSZip from 'jszip';
import type { BatchFile } from '@/types/job';
import { BatchFileRow } from '@/components/BatchFileRow';
import { Button } from '@/components/ui/button';

interface BatchListProps {
  files: BatchFile[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

async function downloadBatchZip(files: BatchFile[]): Promise<void> {
  const zip = new JSZip();

  for (const f of files) {
    if (f.status === 'done' && f.markdown) {
      const basename = f.file.name.replace(/\.[^.]+$/, '');
      zip.file(`${basename}.md`, f.markdown);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted.zip';
  a.click();
  URL.revokeObjectURL(url);
}

export function BatchList({ files, onRetry, onCancel }: BatchListProps) {
  const doneCount = files.filter(f => f.status === 'done').length;
  const hasActive = files.some(f => f.status === 'pending' || f.status === 'converting');

  return (
    <div className="rounded-lg border">
      {/* File list */}
      <div className="divide-y">
        {files.map(item => (
          <BatchFileRow key={item.id} item={item} onRetry={onRetry} onCancel={onCancel} />
        ))}
      </div>

      {/* ZIP download footer — shown when >= 1 file is done */}
      {doneCount > 0 && (
        <div className="border-t px-3 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {doneCount} file convertit{doneCount === 1 ? 'o' : 'i'}
            {hasActive && ' (conversioni in corso...)'}
          </span>
          <Button
            onClick={() => downloadBatchZip(files)}
            disabled={doneCount === 0}
          >
            Scarica ZIP ({doneCount} {doneCount === 1 ? 'file' : 'file'})
          </Button>
        </div>
      )}
    </div>
  );
}
