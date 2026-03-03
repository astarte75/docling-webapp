import { useDropzone, FileRejection, ErrorCode } from 'react-dropzone';
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
    case ErrorCode.TooManyFiles:
      return 'Please select one file at a time';
    default:
      return error.message;
  }
}

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelected, disabled = false }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled,
    onDropAccepted: ([file]) => {
      setError(null);
      onFileSelected(file);
    },
    onDropRejected: (rejections) => {
      setError(getRejectionMessage(rejections));
    },
  });

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
          <p className="text-sm font-medium">Drop your PDF here</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag and drop a PDF, or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF only · max 50MB</p>
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
