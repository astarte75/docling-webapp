interface DoclingLogoProps {
  className?: string;
}

/**
 * Docling document mark — a page with folded corner and a markdown heading
 * indicator (# mark in emerald) suggesting document-to-markdown conversion.
 * Uses currentColor for the document body so it adapts to light/dark theme,
 * and var(--primary) for the emerald accent elements.
 */
export function DoclingLogo({ className }: DoclingLogoProps) {
  return (
    <svg
      viewBox="0 0 40 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Document body */}
      <path
        d="M2 5a3 3 0 013-3h21l12 12v31a3 3 0 01-3 3H5a3 3 0 01-3-3V5z"
        fill="currentColor"
        fillOpacity="0.07"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Folded corner */}
      <path
        d="M26 2l12 12H26V2z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Document text lines */}
      <rect x="7" y="20" width="22" height="2" rx="1" fill="currentColor" fillOpacity="0.6" />
      <rect x="7" y="25" width="17" height="2" rx="1" fill="currentColor" fillOpacity="0.6" />
      <rect x="7" y="30" width="20" height="2" rx="1" fill="currentColor" fillOpacity="0.6" />

      {/* Markdown heading indicator — # mark in primary/emerald color */}
      {/* Vertical bars of # */}
      <rect x="7"   y="35" width="1.8" height="7.5" rx="0.9" fill="var(--primary)" />
      <rect x="10.2" y="35" width="1.8" height="7.5" rx="0.9" fill="var(--primary)" />
      {/* Horizontal bars of # */}
      <rect x="6.5" y="37"   width="6.2" height="1.5" rx="0.75" fill="var(--primary)" />
      <rect x="6.5" y="39.8" width="6.2" height="1.5" rx="0.75" fill="var(--primary)" />
      {/* Text line after #, in emerald */}
      <rect x="15" y="37.5" width="17" height="2" rx="1" fill="var(--primary)" fillOpacity="0.75" />
    </svg>
  );
}
