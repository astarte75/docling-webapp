// Types for the async job flow: POST /convert → SSE stream

/** Possible phases of the single-file conversion flow */
export type AppPhase =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string }
  | { phase: 'error'; message: string; file: File };

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
