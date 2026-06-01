/* Polished SVG icons — consistent 24×24 stroke-based design system */

// ─── Pipeline step icons (top 3-step bar) ────────────────────────────────────

/** Cloud with download arrow — "Fetch video" */
export function CloudFetchIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6.5 19a4.5 4.5 0 0 1-.42-8.98 7 7 0 0 1 13.84 0A4.5 4.5 0 0 1 17.5 19H6.5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M12 13v5m-2-2 2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Waveform bars framed by brackets — "Get transcript / Whisper" */
export function TranscriptWaveformIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* brackets */}
      <path d="M5.5 5H4v14h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 5H20v14h-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* bars */}
      <rect x="7.5" y="10" width="1.6" height="4" rx=".8" fill="currentColor" />
      <rect x="10.2" y="7.5" width="1.6" height="9" rx=".8" fill="currentColor" />
      <rect x="12.9" y="5.5" width="1.6" height="13" rx=".8" fill="currentColor" />
      <rect x="15.6" y="8.5" width="1.6" height="7" rx=".8" fill="currentColor" />
    </svg>
  );
}

/** 4-pointed sparkle star — "Generate insights" */
export function InsightSparkleIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2c0 0 1.2 4.8 2.8 7.2C17.2 6.8 18 5.5 19.2 6c1.2.5-.4 2.2-3.4 3.2 3 1.2 6.2 2.8 6.2 2.8s-3.2 1.6-6.2 2.8c3 1 4.6 2.7 3.4 3.2-1.2.5-2-1.2-4.4-3.6C13.2 17.2 12 22 12 22s-1.2-4.8-2.8-7.6c-2.4 2.4-3.2 4.1-4.4 3.6-1.2-.5.4-2.2 3.4-3.2-3-1.2-6.2-2.8-6.2-2.8s3.2-1.6 6.2-2.8c-3-1-4.6-2.7-3.4-3.2 1.2-.5 2 .8 4.4 3.2C10.8 6.8 12 2 12 2Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
        fill="currentColor" fillOpacity=".08"
      />
    </svg>
  );
}

// ─── "How it works" flow section icons ───────────────────────────────────────

/** YouTube play logo — red bg + white triangle */
export function YouTubeLogoIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 48 34" fill="none">
      <rect width="48" height="34" rx="8" fill="#FF0000" />
      <path d="M19 10v14l14-7-14-7Z" fill="#fff" />
    </svg>
  );
}

/** Horizontal text bars — "Captions" */
export function CaptionBarsIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="4.5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="9" width="13" height="1.5" rx=".75" fill="currentColor" fillOpacity=".65" />
      <rect x="3" y="12.5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="15" height="1.5" rx=".75" fill="currentColor" fillOpacity=".65" />
      <rect x="3" y="20.5" width="10" height="1.5" rx=".75" fill="currentColor" fillOpacity=".45" />
    </svg>
  );
}

/** Vertical audio bars — "Whisper waveform" */
export function WaveformBarsIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2"   y="9"  width="2" height="6"  rx="1" fill="currentColor" />
      <rect x="5.5" y="6"  width="2" height="12" rx="1" fill="currentColor" />
      <rect x="9"   y="4"  width="2" height="16" rx="1" fill="currentColor" />
      <rect x="12.5" y="3" width="2" height="18" rx="1" fill="currentColor" />
      <rect x="16"  y="5"  width="2" height="14" rx="1" fill="currentColor" />
      <rect x="19.5" y="8" width="2" height="8"  rx="1" fill="currentColor" />
    </svg>
  );
}

/** Document + sparkle stars — "Actionable summary" */
export function SummarySparklesIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="6.5" y1="7"  x2="13.5" y2="7"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6.5" y1="13" x2="11"   y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6.5" y1="16" x2="9"    y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M19 4l.7 2.3L22 7l-2.3.7L19 10l-.7-2.3L16 7l2.3-.7L19 4Z" fill="currentColor" />
      <path d="M20 14l.4 1.3 1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4.4-1.3Z" fill="currentColor" fillOpacity=".5" />
    </svg>
  );
}

// ─── Misc / shared ───────────────────────────────────────────────────────────

export function CloudDownloadIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6.5 19a4.5 4.5 0 0 1-.42-8.98 7 7 0 0 1 13.84 0A4.5 4.5 0 0 1 17.5 19H6.5Z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity=".04"
      />
      <path d="M12 13v5m-2-2 2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
