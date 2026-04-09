import { useEffect, useRef } from 'react';

interface StreamCallbacks {
  onCompleted: (markdown: string, engine: string) => void;
  onFailed: (message: string) => void;
}

export function useJobStream(jobId: string | null, callbacks: StreamCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);

    es.addEventListener('completed', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: 'completed'; markdown: string; engine: string };
      callbacksRef.current.onCompleted(data.markdown, data.engine);
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
