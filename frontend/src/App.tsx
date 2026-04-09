import { useState, useCallback, useEffect } from 'react';
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
import { DEFAULT_CONVERSION_OPTIONS } from '@/types/job';

export default function App() {
  const [state, setState] = useState<AppPhase>({ phase: 'idle' });
  // Options state — sticky for session, reset on refresh (no localStorage)
  const [currentOptions, setCurrentOptions] = useState<ConversionOptions>(DEFAULT_CONVERSION_OPTIONS);
  const [progressMessage, setProgressMessage] = useState<string | undefined>();
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
        formData.append('engine', currentOptions.engine);
        formData.append('table_detection', String(currentOptions.tableDetection));
        if (currentOptions.pageFrom !== null) formData.append('page_from', String(currentOptions.pageFrom));
        if (currentOptions.pageTo !== null) formData.append('page_to', String(currentOptions.pageTo));

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
    onCompleted: useCallback((markdown: string, engine: string) => {
      setProgressMessage(undefined);
      setState((prev) => ({
        phase: 'success',
        markdown,
        filename: prev.phase === 'converting' ? prev.file.name : 'document',
        engine,
      }));
    }, []),
    onFailed: useCallback((message: string) => {
      setProgressMessage(undefined);
      setState((prev) => ({
        phase: 'error',
        message,
        file: prev.phase === 'converting' ? prev.file : new File([], 'unknown'),
      }));
    }, []),
    onProgress: useCallback((message: string) => {
      setProgressMessage(message);
    }, []),
  });

  const isConverting = state.phase === 'uploading' || state.phase === 'converting';
  const isBatch = state.phase === 'batch-active' || state.phase === 'batch-complete';
  const isSuccess = state.phase === 'success';

  // Transition state: exitingHome triggers fade-out of homepage,
  // then displaySuccess mounts the success layout after the animation
  const [displaySuccess, setDisplaySuccess] = useState(false);
  const [exitingHome, setExitingHome] = useState(false);

  useEffect(() => {
    if (isSuccess && !displaySuccess) {
      setExitingHome(true);
      const t = setTimeout(() => {
        setDisplaySuccess(true);
        setExitingHome(false);
      }, 350);
      return () => clearTimeout(t);
    }
    if (!isSuccess) {
      setDisplaySuccess(false);
      setExitingHome(false);
    }
  }, [isSuccess]);

  const resetApp = useCallback(() => {
    batchHook.clearFiles();
    setState({ phase: 'idle' });
  }, [batchHook]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="docling-theme">
    <div className="min-h-screen bg-background text-foreground app-bg">

      {/* Branch A — success state: full-width two-column layout */}
      {displaySuccess && state.phase === 'success' && (
        <div className="px-6 py-8 animate-fade-up">
          {/* Compact header: logo+title on left, ModeToggle on right */}
          <header className="mb-6 flex items-center justify-between">
            <button
              className="flex items-center gap-3 hover:opacity-70 transition-opacity"
              onClick={resetApp}
              aria-label="Reset to home"
            >
              <DoclingLogo className="h-8 w-7 text-foreground" />
              <span className="text-lg font-semibold">Docling Webapp</span>
            </button>
            <ModeToggle />
          </header>

          {/* Two-column grid */}
          <div className="grid grid-cols-[340px_1fr] gap-6 items-start">
            {/* Left sidebar: upload for next file + options below */}
            <aside className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Convert another file</p>
                <UploadZone
                  onFilesSelected={handleFilesSelected}
                  disabled={false}
                />
              </div>
              <OptionsPanel value={currentOptions} onChange={setCurrentOptions} />
            </aside>

            {/* Right panel: result */}
            <main className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">Conversion complete</p>
                <span className="inline-flex items-center rounded-full border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  {state.engine === 'vlm-mlx' ? 'MLX' : 'Standard'}
                </span>
              </div>
              <div className="rounded-lg border">
                <ResultViewer markdown={state.markdown} filename={state.filename} />
              </div>
            </main>
          </div>
        </div>
      )}

      {/* Branch B — all other states: single-column centered layout */}
      {!displaySuccess && (
        <div className={`mx-auto max-w-3xl px-4 py-8 ${exitingHome ? 'animate-fade-out' : ''}`}>

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

          {/* Upload zone area — slides in second */}
          <div className={`${isBatch ? 'mb-4' : 'mb-8'} animate-fade-up`} style={{ animationDelay: '120ms' }}>
            {isBatch ? (
              /* Batch compact strip */
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">Add more files:</span>
                <div className="flex-1">
                  <UploadZone
                    onFilesSelected={(files) => batchHook.addFiles(files, currentOptions)}
                    disabled={false}
                    compact
                  />
                </div>
              </div>
            ) : (
              /* Hero upload zone (idle, converting, error) */
              <UploadZone
                onFilesSelected={handleFilesSelected}
                disabled={isConverting}
              />
            )}
          </div>

          {/* Options Panel — slides in third */}
          {(state.phase === 'idle' || isBatch) && (
            <div className="mb-4 animate-fade-up" style={{ animationDelay: '220ms' }}>
              <OptionsPanel value={currentOptions} onChange={setCurrentOptions} />
            </div>
          )}

          {/* Converting state — single file */}
          {isConverting && (
            <ConversionProgress
              onCancel={() => { setProgressMessage(undefined); setState({ phase: 'idle' }); }}
              message={progressMessage}
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
                Retry
              </Button>
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
      )}

    </div>
    </ThemeProvider>
  );
}
