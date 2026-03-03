import { useState, useCallback } from 'react';
import { useJobStream } from '@/hooks/useJobStream';
import { useBatchUpload } from '@/hooks/useBatchUpload';
import { UploadZone } from '@/components/UploadZone';
import { OptionsPanel } from '@/components/OptionsPanel';
import { ConversionProgress } from '@/components/ConversionProgress';
import { ResultViewer } from '@/components/ResultViewer';
import { BatchList } from '@/components/BatchList';
import { Button } from '@/components/ui/button';
import type { AppPhase, ConversionOptions } from '@/types/job';
import { DEFAULT_CONVERSION_OPTIONS } from '@/types/job';

export default function App() {
  const [state, setState] = useState<AppPhase>({ phase: 'idle' });
  // Options state — sticky for session, reset on refresh (no localStorage)
  const [currentOptions, setCurrentOptions] = useState<ConversionOptions>(DEFAULT_CONVERSION_OPTIONS);
  const batchHook = useBatchUpload();

  // Handler for dropped files — decides single vs batch flow
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 1) {
      // Single-file flow — send with current options via direct fetch
      const file = files[0];
      setState({ phase: 'uploading', file });
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ocr_mode', currentOptions.ocrMode);
        formData.append('table_detection', String(currentOptions.tableDetection));
        if (currentOptions.pageFrom !== null) formData.append('page_from', String(currentOptions.pageFrom));
        if (currentOptions.pageTo !== null) formData.append('page_to', String(currentOptions.pageTo));
        if (currentOptions.ocrLanguages.length > 0) formData.append('ocr_languages', currentOptions.ocrLanguages.join(','));

        const res = await fetch('/api/convert', { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(body.error || 'Upload failed');
        }
        const { job_id } = await res.json();
        setState({ phase: 'converting', jobId: job_id, file });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setState({ phase: 'error', message, file });
      }
    } else {
      // Batch flow — 2+ files
      setState({ phase: 'batch-active', files: [] });
      await batchHook.addFiles(files, currentOptions);
    }
  }, [currentOptions, batchHook]);

  // Single-file SSE — null when not converting
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

  const isConverting = state.phase === 'uploading' || state.phase === 'converting';
  const isBatch = state.phase === 'batch-active' || state.phase === 'batch-complete';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header */}
        <header className="mb-8 text-center">
          <h1
            className="text-2xl font-semibold tracking-tight cursor-pointer select-none hover:opacity-70 transition-opacity"
            onClick={() => {
              batchHook.clearFiles(); // closes all batch EventSources + clears batch state
              setState({ phase: 'idle' }); // sets jobId=null → triggers useJobStream useEffect cleanup
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                batchHook.clearFiles();
                setState({ phase: 'idle' });
              }
            }}
          >
            Docling Webapp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Convert documents to Markdown
          </p>
        </header>

        {/* Options Panel — visible in idle and batch-active (above upload zone) */}
        {(state.phase === 'idle' || isBatch) && (
          <div className="mb-4">
            <OptionsPanel value={currentOptions} onChange={setCurrentOptions} />
          </div>
        )}

        {/* Upload zone area */}
        <div className={isBatch ? 'mb-4' : 'mb-8'}>
          {isBatch ? (
            /* Batch compact strip */
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Aggiungi altri file:</span>
              <div className="flex-1">
                <UploadZone
                  onFilesSelected={(files) => batchHook.addFiles(files, currentOptions)}
                  disabled={false}
                  compact
                />
              </div>
            </div>
          ) : (
            /* Hero upload zone (idle, converting, error, success) */
            <UploadZone
              onFilesSelected={handleFilesSelected}
              disabled={isConverting}
            />
          )}
        </div>

        {/* Converting state — single file */}
        {isConverting && (
          <ConversionProgress
            onCancel={() => setState({ phase: 'idle' })}
          />
        )}

        {/* Error state — single file */}
        {state.phase === 'error' && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
            <p className="text-sm font-medium text-destructive" role="alert">
              {state.message}
            </p>
            <Button
              variant="outline"
              onClick={() => handleFilesSelected([state.file])}
            >
              Riprova
            </Button>
          </div>
        )}

        {/* Success state — single file */}
        {state.phase === 'success' && (
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Conversione completata
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState({ phase: 'idle' })}
              >
                Nuova conversione
              </Button>
            </div>
            <ResultViewer
              markdown={state.markdown}
              filename={state.filename}
            />
          </div>
        )}

        {/* Batch state */}
        {isBatch && batchHook.files.length > 0 && (
          <BatchList
            files={batchHook.files}
            onRetry={batchHook.retryFile}
            onCancel={batchHook.cancelFile}
          />
        )}

      </div>
    </div>
  );
}
