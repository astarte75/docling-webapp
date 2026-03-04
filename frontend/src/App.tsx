import { useState, useCallback } from 'react';
import { useJobStream } from '@/hooks/useJobStream';
import { useBatchUpload } from '@/hooks/useBatchUpload';
import { UploadZone } from '@/components/UploadZone';
import { OptionsPanel } from '@/components/OptionsPanel';
import { ConversionProgress } from '@/components/ConversionProgress';
import { ResultViewer } from '@/components/ResultViewer';
import { BatchList } from '@/components/BatchList';
import { DoclingLogo } from '@/components/DoclingLogo';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/mode-toggle';
import type { AppPhase, ConversionOptions } from '@/types/job';
import { DEFAULT_CONVERSION_OPTIONS, OCR_ENGINES } from '@/types/job';

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
        formData.append('ocr_engine', currentOptions.ocrEngine);
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
    onCompleted: useCallback((markdown: string, ocrEngine: string, ocrEngineRequested?: string) => {
      setState((prev) => ({
        phase: 'success',
        markdown,
        filename: prev.phase === 'converting' ? prev.file.name : 'document',
        ocrEngine: ocrEngine as import('@/types/job').OcrEngine,
        ocrEngineRequested: ocrEngineRequested as import('@/types/job').OcrEngine | undefined,
      }));
    }, []),
    onFailed: useCallback((message: string, ocrEngine?: string) => {
      setState((prev) => ({
        phase: 'error',
        message,
        file: prev.phase === 'converting' ? prev.file : new File([], 'unknown'),
        ocrEngine: ocrEngine as import('@/types/job').OcrEngine | undefined,
      }));
    }, []),
  });

  const isConverting = state.phase === 'uploading' || state.phase === 'converting';
  const isBatch = state.phase === 'batch-active' || state.phase === 'batch-complete';

  const resetApp = useCallback(() => {
    batchHook.clearFiles();
    setState({ phase: 'idle' });
  }, [batchHook]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="docling-theme">
    <div className="min-h-screen bg-background text-foreground app-bg">
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header — fades in first */}
        <header className="mb-8 animate-fade-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <div className="flex flex-col items-center gap-3">
              <DoclingLogo className="h-11 w-10 text-foreground" />
              <h1
                className="text-2xl font-semibold tracking-tight cursor-pointer select-none hover:opacity-70 transition-opacity"
                onClick={resetApp}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') resetApp();
                }}
              >
                Docling Webapp
              </h1>
            </div>
            <div className="flex-1 flex justify-end">
              <ModeToggle />
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Convert documents to Markdown
          </p>
        </header>

        {/* Options Panel — slides in second */}
        {(state.phase === 'idle' || isBatch) && (
          <div className="mb-4 animate-fade-up" style={{ animationDelay: '120ms' }}>
            <OptionsPanel value={currentOptions} onChange={setCurrentOptions} />
          </div>
        )}

        {/* Upload zone area — slides in third */}
        <div className={`${isBatch ? 'mb-4' : 'mb-8'} animate-fade-up`} style={{ animationDelay: '220ms' }}>
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
            {state.ocrEngine && (
              <span className="inline-flex items-center rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine} — non disponibile
              </span>
            )}
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
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Conversione completata
              </p>
              {state.ocrEngineRequested ? (
                <span className="inline-flex items-center rounded-full border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngineRequested)?.label ?? state.ocrEngineRequested} → {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine}
                </span>
              )}
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
    </ThemeProvider>
  );
}
