// Types for the async job flow: POST /api/convert → SSE stream

/** Possible phases of the single-file conversion flow */
export type AppPhase =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string; engine: string }
  | { phase: 'error'; message: string; file: File }
  | { phase: 'batch-active'; files: BatchFile[] }
  | { phase: 'batch-complete'; files: BatchFile[] };

/** Response from POST /api/convert (202 Accepted) */
export interface ConvertResponse {
  job_id: string;
}

/** Error response format from backend (all errors) */
export interface ApiError {
  error: string;
}

/** SSE event types from GET /api/jobs/{job_id}/stream */
export type SSEEventType = 'started' | 'completed' | 'failed';

/** SSE started event payload */
export interface SSEStartedEvent {
  type: 'started';
  message: string;
}

/** SSE completed event payload */
export interface SSECompletedEvent {
  type: 'completed';
  markdown: string;
  engine: string;
}

/** SSE failed event payload */
export interface SSEFailedEvent {
  type: 'failed';
  message: string;
}

export type SSEEvent = SSEStartedEvent | SSECompletedEvent | SSEFailedEvent;

/** Conversion engine */
export type Engine = 'auto' | 'vlm' | 'standard';

/** Conversion options — captured at file-drop time, immutable per file */
export interface ConversionOptions {
  engine: Engine;
  tableDetection: boolean;
  pageFrom: number | null;
  pageTo: number | null;
}

/** Default options */
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  engine: 'auto',
  tableDetection: true,
  pageFrom: null,
  pageTo: null,
};

/** Engine options for the UI */
export const ENGINES: { value: Engine; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'vlm', label: 'MLX (GraniteDocling)' },
  { value: 'standard', label: 'Standard' },
];

/** Status of a single file in a batch conversion */
export type BatchFileStatus = 'pending' | 'converting' | 'done' | 'error' | 'cancelled';

/** A single file entry in the batch list */
export interface BatchFile {
  id: string;
  file: File;
  options: ConversionOptions;
  status: BatchFileStatus;
  jobId?: string;
  markdown?: string;
  errorMessage?: string;
  progressMessage?: string;
}
