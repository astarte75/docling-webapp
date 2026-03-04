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
      return 'Unsupported file type. Accepted: PDF, DOCX, PPTX, XLSX, HTML, MD';
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
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/html': ['.html', '.htm'],
      'text/markdown': ['.md'],
    },
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
          <span>Add more files...</span>
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
          'w-full rounded-xl border-2 px-8 py-12 text-center',
          'transition-all duration-200 cursor-pointer select-none',
          isDragActive
            ? [
                'border-emerald-500 border-solid',
                'bg-emerald-50/60 dark:bg-emerald-950/30',
                'shadow-lg shadow-emerald-500/40',
                'text-emerald-700 dark:text-emerald-300',
              ].join(' ')
            : [
                'border-emerald-600/40',
                'hover:border-emerald-500 hover:bg-emerald-50/30',
                'dark:border-emerald-700/40 dark:hover:border-emerald-500',
              ].join(' '),
          disabled ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        {isDragActive ? (
          <p className="text-sm font-medium">Drop your files here</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag and drop files, or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PPTX, XLSX, HTML, MD · max 50MB per file</p>
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
