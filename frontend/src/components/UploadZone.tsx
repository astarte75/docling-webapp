import { useDropzone, ErrorCode } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getRejectionMessage(rejections: FileRejection[]): string {
  if (!rejections.length) return '';
  const error = rejections[0].errors[0];
  switch (error.code) {
    case ErrorCode.FileTooLarge:
      return 'File exceeds the 50MB limit';
    case ErrorCode.FileInvalidType:
      return 'Only PDF files are supported';
    default:
      return error.message;
  }
}

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean; // compact = strip mode for batch-active and success states
}

export function UploadZone({ onFilesSelected, disabled = false, compact = false }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
    onDropAccepted: (files) => {
      setError(null);
      onFilesSelected(files);
    },
    onDropRejected: (rejections) => {
      setError(getRejectionMessage(rejections));
    },
  });

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div
          {...getRootProps()}
          className={[
            'w-full cursor-pointer rounded-md border px-3 py-1.5 text-sm text-muted-foreground',
            'transition-colors select-none',
            isDragActive
              ? 'border-primary bg-primary/5 text-primary'
              : 'hover:border-primary/60 hover:text-foreground',
            disabled ? 'pointer-events-none opacity-50' : '',
          ].join(' ')}
        >
          <input {...getInputProps()} />
          <span>Aggiungi altri file...</span>
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        {...getRootProps()}
        className={[
          'w-full rounded-xl border-2 border-dashed px-8 py-12 text-center',
          'transition-colors cursor-pointer select-none',
          isDragActive
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40',
          disabled ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium">Drop your files here</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag and drop files, or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF only · max 50MB per file</p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
