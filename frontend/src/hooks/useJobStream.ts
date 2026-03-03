import { useEffect, useRef } from 'react';

interface StreamCallbacks {
  onCompleted: (markdown: string, ocrEngine: string, ocrEngineRequested?: string) => void;
  onFailed: (message: string, ocrEngine?: string) => void;
}

export function useJobStream(jobId: string | null, callbacks: StreamCallbacks) {
  // Store callbacks in a ref so the effect doesn't need them in deps
  // (avoids infinite re-render if caller passes inline functions)
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);

    es.addEventListener('completed', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: 'completed'; markdown: string; ocr_engine: string; ocr_engine_requested?: string };
      callbacksRef.current.onCompleted(data.markdown, data.ocr_engine ?? 'auto', data.ocr_engine_requested);
      es.close();
    });

    es.addEventListener('failed', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: 'failed'; message: string; ocr_engine?: string };
      callbacksRef.current.onFailed(data.message, data.ocr_engine);
      es.close();
    });

    es.onerror = () => {
      callbacksRef.current.onFailed('Connection error');
      es.close();
    };

    return () => es.close();
  }, [jobId]);
}
