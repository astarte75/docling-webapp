// Types for the async job flow: POST /convert → SSE stream

/** Possible phases of the single-file conversion flow */
export type AppPhase =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string }
  | { phase: 'error'; message: string; file: File }
  | { phase: 'batch-active'; files: BatchFile[] }
  | { phase: 'batch-complete'; files: BatchFile[] };

/** Response from POST /convert (202 Accepted) */
export interface ConvertResponse {
  job_id: string;
}

/** Error response format from backend (all errors) */
export interface ApiError {
  error: string;
}

/** SSE event types from GET /jobs/{job_id}/stream */
export type SSEEventType = 'started' | 'completed' | 'failed';

/** SSE started event payload */
export interface SSEStartedEvent {
  type: 'started';
  message: string;
}

/** SSE completed event payload — markdown is delivered inline */
export interface SSECompletedEvent {
  type: 'completed';
  markdown: string;
}

/** SSE failed event payload */
export interface SSEFailedEvent {
  type: 'failed';
  message: string;
}

export type SSEEvent = SSEStartedEvent | SSECompletedEvent | SSEFailedEvent;

// --- Phase 4: Configuration options and batch conversion ---

/** OCR processing mode sent to the backend */
export type OcrMode = 'auto' | 'on' | 'off';

/** Conversion options snapshot — captured at file-drop time, immutable per file */
export interface ConversionOptions {
  ocrMode: OcrMode;
  tableDetection: boolean;
  pageFrom: number | null;  // 1-based inclusive, null = first page
  pageTo: number | null;    // 1-based inclusive, null = last page
  ocrLanguages: string[];   // EasyOCR lang codes e.g. ["it", "en"]
}

/** Default options — matches backend ConversionOptions defaults */
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  ocrMode: 'auto',
  tableDetection: true,
  pageFrom: null,
  pageTo: null,
  ocrLanguages: [],
};

/** Status of a single file in a batch conversion */
export type BatchFileStatus = 'pending' | 'converting' | 'done' | 'error';

/** A single file entry in the batch list, with its snapshot options */
export interface BatchFile {
  id: string;               // crypto.randomUUID() — client-generated
  file: File;
  options: ConversionOptions;  // snapshot at drop time
  status: BatchFileStatus;
  jobId?: string;           // set after POST /convert returns 202
  markdown?: string;        // set when SSE emits 'completed'
  errorMessage?: string;    // set when SSE emits 'failed'
}

/** Curated list of EasyOCR languages exposed in the UI */
export const SUPPORTED_OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italian' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
];
