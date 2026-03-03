import { useState, useCallback } from 'react';
import { useUpload } from '@/hooks/useUpload';
import { useJobStream } from '@/hooks/useJobStream';
import { UploadZone } from '@/components/UploadZone';
import { ConversionProgress } from '@/components/ConversionProgress';
import { ResultViewer } from '@/components/ResultViewer';
import { Button } from '@/components/ui/button';
import type { AppPhase } from '@/types/job';

export default function App() {
  const [state, setState] = useState<AppPhase>({ phase: 'idle' });
  const upload = useUpload();

  const startUpload = useCallback(async (file: File) => {
    setState({ phase: 'uploading', file });
    try {
      const { job_id } = await upload.mutateAsync(file);
      setState({ phase: 'converting', jobId: job_id, file });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setState((prev) => ({
        phase: 'error',
        message,
        file: prev.phase === 'uploading' || prev.phase === 'error' ? prev.file : file,
      }));
    }
  }, [upload]);

  // useJobStream watches jobId; null when not in converting state
  const jobId = state.phase === 'converting' ? state.jobId : null;

  useJobStream(jobId, {
    onCompleted: useCallback((markdown: string) => {
      setState((prev) => ({
        phase: 'success',
        markdown,
        filename: prev.phase === 'converting' ? prev.file.name : 'document',
      }));
    }, []),
    onFailed: useCallback((message: string) => {
      setState((prev) => ({
        phase: 'error',
        message,
        file: prev.phase === 'converting' ? prev.file : new File([], 'unknown'),
      }));
    }, []),
  });

  const isConverting =
    state.phase === 'uploading' || state.phase === 'converting';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Docling Webapp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Convert documents to Markdown
          </p>
        </header>

        {/* Upload zone — hero in idle, compact in success state */}
        <div className={state.phase === 'success' ? 'mb-6' : 'mb-8'}>
          {state.phase === 'success' ? (
            /* Compact strip after success — user can convert another file */
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Convert another file:</span>
              <div className="flex-1">
                <UploadZone
                  onFileSelected={startUpload}
                  disabled={isConverting}
                />
              </div>
            </div>
          ) : (
            /* Hero upload zone */
            <UploadZone
              onFileSelected={startUpload}
              disabled={isConverting}
            />
          )}
        </div>

        {/* Converting state */}
        {isConverting && <ConversionProgress />}

        {/* Error state */}
        {state.phase === 'error' && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
            <p className="text-sm font-medium text-destructive" role="alert">
              {state.message}
            </p>
            <Button
              variant="outline"
              onClick={() => startUpload(state.file)}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Success state */}
        {state.phase === 'success' && (
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">
                Conversion complete
              </p>
            </div>
            <ResultViewer
              markdown={state.markdown}
              filename={state.filename}
            />
          </div>
        )}

      </div>
    </div>
  );
}
