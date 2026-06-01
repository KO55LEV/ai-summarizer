import { useMemo } from 'react';

interface AudioWaveformProps {
  isAnimating?: boolean;
  barCount?: number;
  className?: string;
  color?: string;
  height?: number;
}

export default function AudioWaveform({
  isAnimating = true,
  barCount = 60,
  className = '',
  color = 'var(--color-accent)',
  height = 40,
}: AudioWaveformProps) {
  const bars = useMemo(
    () =>
      Array.from({ length: barCount }, () => ({
        baseHeight: 0.15 + Math.random() * 0.55,
        delay: -(Math.random() * 1.8).toFixed(2),
        duration: (0.4 + Math.random() * 0.8).toFixed(2),
      })),
    [barCount],
  );

  return (
    <div
      className={`flex items-center justify-center gap-[2px] ${className}`}
      style={{ height }}
      role="img"
      aria-label="Audio waveform"
    >
      {bars.map((bar, i) => (
        <span
          key={i}
          className={isAnimating ? 'animate-waveform' : ''}
          style={{
            display: 'inline-block',
            width: 3,
            borderRadius: 2,
            backgroundColor: color,
            height: `${bar.baseHeight * 100}%`,
            animationDelay: `${bar.delay}s`,
            animationDuration: `${bar.duration}s`,
            opacity: isAnimating ? 1 : 0.4,
            transition: 'opacity 0.3s',
          }}
        />
      ))}

      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .animate-waveform {
          animation-name: waveform;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}
