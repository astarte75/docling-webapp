import { useState, useCallback, useRef } from 'react';
import type { BatchFile, ConversionOptions } from '@/types/job';

// Internal helper: upload one file with its options snapshot
async function uploadFileWithOptions(
  file: File,
  opts: ConversionOptions
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('engine', opts.engine);
  formData.append('table_detection', String(opts.tableDetection));
  if (opts.pageFrom !== null) formData.append('page_from', String(opts.pageFrom));
  if (opts.pageTo !== null) formData.append('page_to', String(opts.pageTo));

  const res = await fetch('/api/convert', { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.error || 'Upload failed');
  }
  const data = await res.json();
  return data.job_id as string;
}

// Internal helper: connect to SSE stream and update item status
function connectJobStream(
  jobId: string,
  itemId: string,
  updateItem: (id: string, patch: Partial<BatchFile>) => void
): EventSource {
  const es = new EventSource(`/api/jobs/${jobId}/stream`);

  es.addEventListener('started', () => {
    updateItem(itemId, { status: 'converting' });
  });

  es.addEventListener('completed', (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    updateItem(itemId, { status: 'done', markdown: data.markdown });
    es.close();
  });

  es.addEventListener('failed', (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    updateItem(itemId, { status: 'error', errorMessage: data.message });
    es.close();
  });

  es.onerror = () => {
    updateItem(itemId, { status: 'error', errorMessage: 'Connection error' });
    es.close();
  };

  return es;
}

export function useBatchUpload() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  // Keep EventSource refs to avoid opening duplicates
  const streamsRef = useRef<Map<string, EventSource>>(new Map());

  // Functional updater — safe for concurrent SSE callbacks (avoids stale closure)
  const updateItem = useCallback((id: string, patch: Partial<BatchFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  // Add files to batch with options snapshot, then upload each
  const addFiles = useCallback(async (newFiles: File[], opts: ConversionOptions) => {
    const items: BatchFile[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      options: { ...opts },  // snapshot
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...items]);

    // Upload each file and open SSE stream — sequential uploads (one per file per request)
    // SSE connection opened after upload returns job_id
    for (const item of items) {
      try {
        const jobId = await uploadFileWithOptions(item.file, item.options);
        updateItem(item.id, { jobId, status: 'converting' });

        // Open SSE stream only after upload succeeds (lazy — not on 'pending')
        const es = connectJobStream(jobId, item.id, updateItem);
        streamsRef.current.set(item.id, es);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        updateItem(item.id, { status: 'error', errorMessage: msg });
      }
    }
  }, [updateItem]);

  // Retry a failed file with its original options
  const retryFile = useCallback(async (itemId: string) => {
    const item = files.find(f => f.id === itemId);
    if (!item) return;

    // Close existing stream if any
    streamsRef.current.get(itemId)?.close();
    streamsRef.current.delete(itemId);

    updateItem(itemId, { status: 'pending', jobId: undefined, errorMessage: undefined });

    try {
      const jobId = await uploadFileWithOptions(item.file, item.options);
      updateItem(itemId, { jobId, status: 'converting' });
      const es = connectJobStream(jobId, itemId, updateItem);
      streamsRef.current.set(itemId, es);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      updateItem(itemId, { status: 'error', errorMessage: msg });
    }
  }, [files, updateItem]);

  // Cancel a single file that is currently converting
  const cancelFile = useCallback((itemId: string) => {
    // Guard: only cancel if currently converting — prevents overwriting 'done' in race condition
    setFiles(prev => {
      const item = prev.find(f => f.id === itemId);
      if (!item || item.status !== 'converting') return prev;
      return prev.map(f => f.id === itemId ? { ...f, status: 'cancelled' as const } : f);
    });
    // Close the EventSource regardless of guard (safe: optional chaining handles missing stream)
    streamsRef.current.get(itemId)?.close();
    streamsRef.current.delete(itemId);
  }, []); // No deps — uses functional setFiles form, streamsRef is a ref (stable)

  const clearFiles = useCallback(() => {
    // Close all open streams
    streamsRef.current.forEach(es => es.close());
    streamsRef.current.clear();
    setFiles([]);
  }, []);

  return { files, addFiles, retryFile, cancelFile, clearFiles };
}
