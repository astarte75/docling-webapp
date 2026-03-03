// Types for the async job flow: POST /convert → SSE stream

/** Possible phases of the single-file conversion flow */
export type AppPhase =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string; ocrEngine: OcrEngine; ocrEngineRequested?: OcrEngine }
  | { phase: 'error'; message: string; file: File; ocrEngine?: OcrEngine }
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

/** OCR engine selection — sent as ocr_engine to /convert */
export type OcrEngine = 'auto' | 'easyocr' | 'rapidocr' | 'tesseract';

/** Conversion options snapshot — captured at file-drop time, immutable per file */
export interface ConversionOptions {
  ocrMode: OcrMode;
  ocrEngine: OcrEngine;
  tableDetection: boolean;
  pageFrom: number | null;  // 1-based inclusive, null = first page
  pageTo: number | null;    // 1-based inclusive, null = last page
  ocrLanguages: string[];   // EasyOCR lang codes e.g. ["it", "en"]
}

/** Default options — matches backend ConversionOptions defaults */
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  ocrMode: 'auto',
  ocrEngine: 'auto',
  tableDetection: true,
  pageFrom: null,
  pageTo: null,
  ocrLanguages: [],
};

/** Status of a single file in a batch conversion */
export type BatchFileStatus = 'pending' | 'converting' | 'done' | 'error' | 'cancelled';

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

/** Engine options for the UI Select — friendly labels */
export const OCR_ENGINES: { value: OcrEngine; label: string }[] = [
  { value: 'auto',      label: 'Auto (best available)' },
  { value: 'easyocr',  label: 'EasyOCR' },
  { value: 'rapidocr', label: 'RapidOCR (fast)' },
  { value: 'tesseract', label: 'Tesseract' },
];

/** EasyOCR languages available with pre-downloaded models (latin_g2 + english_g2) */
export const EASYOCR_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'it', label: 'IT' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'nl', label: 'NL' },
  { code: 'pl', label: 'PL' },
  { code: 'tr', label: 'TR' },
];

/** Languages available for Tesseract — must match packages installed in the Docker image (multi-select) */
export const TESSERACT_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'it', label: 'IT' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'nl', label: 'NL' },
  { code: 'pl', label: 'PL' },
  { code: 'ru', label: 'RU' },
  { code: 'ar', label: 'AR' },
  { code: 'hi', label: 'HI' },
  { code: 'tr', label: 'TR' },
  { code: 'zh', label: 'ZH' },
  { code: 'ja', label: 'JA' },
  { code: 'ko', label: 'KO' },
];

/** @deprecated use EASYOCR_LANGUAGES */
export const SUPPORTED_OCR_LANGUAGES = EASYOCR_LANGUAGES;
