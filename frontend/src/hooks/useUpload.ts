import { useMutation } from '@tanstack/react-query';
import type { ConvertResponse } from '@/types/job';

async function uploadFile(file: File): Promise<ConvertResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/convert', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Upload failed');
  }

  return res.json() as Promise<ConvertResponse>;
}

export function useUpload() {
  return useMutation({ mutationFn: uploadFile });
}
