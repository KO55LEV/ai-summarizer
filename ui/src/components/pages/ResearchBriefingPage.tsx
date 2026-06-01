import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit3,
  Play,
  Clock,
  Calendar,
  FileText,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import type { ResearchTopic, ResearchBriefing } from '../../api/types';
import { getResearchBriefing } from '../../api/research';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'var(--color-accent)',
  neutral: 'var(--color-info, #4dc8e8)',
  negative: '#ef4444',
};

const FREQ_COLORS: Record<string, string> = {
  hourly: 'var(--color-info, #4dc8e8)',
  daily: 'var(--color-accent)',
  weekly: '#a78bfa',
  monthly: '#f59e0b',
};

interface ResearchBriefingPageProps {
  topic: ResearchTopic;
  onBack: () => void;
}

export function ResearchBriefingPage({ topic, onBack }: ResearchBriefingPageProps) {
  const [briefing, setBriefing] = useState<ResearchBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPast, setSelectedPast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getResearchBriefing(topic.id).then((b) => {
      setBriefing(b);
      setLoading(false);
    });
  }, [topic.id]);

  if (loading) return <BriefingSkeletonLoader onBack={onBack} />;

  if (!briefing) {
    return (
      <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
        <BackButton onBack={onBack} />
        <div className="text-center py-16 text-[var(--color-text-muted)]">No briefing available.</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      {/* Back + action buttons */}
      <div className="flex items-center justify-between mb-5">
        <BackButton onBack={onBack} />
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Edit3 size={13} />
            Edit
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--color-accent)', color: 'black' }}
          >
            <Play size={13} fill="black" />
            Run Now
          </button>
        </div>
      </div>

      {/* Topic header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
          {topic.name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{topic.description}</p>
      </div>

      {/* Schedule info bar */}
      <div
        className="flex items-center flex-wrap gap-5 rounded-xl px-5 py-3 mb-5 text-sm"
        style={{ background: 'var(--color-bg-card)' }}
      >
        <InfoPill icon={<Calendar size={14} />} label="Frequency">
          <span
            className="capitalize font-medium"
            style={{ color: FREQ_COLORS[topic.frequency] }}
          >
            {topic.frequency}
          </span>
        </InfoPill>
        <InfoPill icon={<Clock size={14} />} label="Last run">
          {topic.lastRun}
        </InfoPill>
        <InfoPill icon={<ChevronRight size={14} />} label="Next run">
          <span
            style={{ color: topic.nextRun === 'paused' ? '#f59e0b' : 'var(--color-text-primary)' }}
          >
            {topic.nextRun}
          </span>
        </InfoPill>
        <InfoPill icon={<FileText size={14} />} label="Generated">
          {briefing.generatedAt}
        </InfoPill>
        <InfoPill icon={<Clock size={14} />} label="Read time">
          {briefing.readTime} · {briefing.wordCount.toLocaleString()} words
        </InfoPill>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main column */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Executive summary */}
          <section
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Executive Summary
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {briefing.summary}
            </p>
          </section>

          {/* Sections */}
          {briefing.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-xl p-5"
              style={{
                background: 'var(--color-bg-card)',
                borderLeft: `3px solid ${SENTIMENT_COLORS[section.sentiment]}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {section.title}
                </h2>
                <SentimentBadge sentiment={section.sentiment} />
              </div>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ background: SENTIMENT_COLORS[section.sentiment] }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Sources */}
          <section
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Sources ({briefing.sources.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {briefing.sources.map((source) => (
                <a
                  key={source.domain}
                  href={`https://${source.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors hover:opacity-80"
                  style={{
                    background: 'var(--color-bg-hover)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                  title={source.title}
                >
                  <ExternalLink size={11} />
                  {source.domain}
                </a>
              ))}
            </div>
          </section>

          {/* Tags */}
          <section
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {topic.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg text-xs"
                  style={{
                    background: `var(--color-accent, #00d4aa)22`,
                    color: 'var(--color-accent)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* Past Briefings */}
          {briefing.pastBriefings.length > 0 && (
            <section
              className="rounded-xl p-5"
              style={{ background: 'var(--color-bg-card)' }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Past Briefings
              </h2>
              <div className="flex flex-col gap-2">
                {briefing.pastBriefings.map((pb) => (
                  <button
                    key={pb.id}
                    onClick={() => setSelectedPast(selectedPast === pb.id ? null : pb.id)}
                    className="text-left rounded-lg p-3 transition-colors"
                    style={{
                      background: selectedPast === pb.id ? 'var(--color-bg-hover)' : 'transparent',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {pb.date}
                      </span>
                      <ChevronRight
                        size={12}
                        className="transition-transform"
                        style={{
                          color: 'var(--color-text-muted)',
                          transform: selectedPast === pb.id ? 'rotate(90deg)' : 'none',
                        }}
                      />
                    </div>
                    {selectedPast === pb.id && (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        {pb.preview}
                      </p>
                    )}
                    {selectedPast !== pb.id && (
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
                        {pb.preview}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm transition-colors"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <ArrowLeft size={15} />
      Research
    </button>
  );
}

function InfoPill({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {label}:
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {children}
      </span>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{
        background: `${SENTIMENT_COLORS[sentiment]}22`,
        color: SENTIMENT_COLORS[sentiment],
      }}
    >
      {sentiment}
    </span>
  );
}

function BriefingSkeletonLoader({ onBack }: { onBack: () => void }) {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      <BackButton onBack={onBack} />
      <div className="mt-5 space-y-4">
        <div className="h-7 w-64 rounded-lg animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
        <div className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
            <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
          </div>
        </div>
      </div>
    </main>
  );
}
