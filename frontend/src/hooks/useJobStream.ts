import { useEffect, useRef } from 'react';

interface StreamCallbacks {
  onCompleted: (markdown: string) => void;
  onFailed: (message: string) => void;
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
      const data = JSON.parse(e.data) as { type: 'completed'; markdown: string };
      callbacksRef.current.onCompleted(data.markdown);
      es.close();
    });

    es.addEventListener('failed', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: 'failed'; message: string };
      callbacksRef.current.onFailed(data.message);
      es.close();
    });

    es.onerror = () => {
      callbacksRef.current.onFailed('Connection error');
      es.close();
    };

    return () => es.close();
  }, [jobId]);
}
