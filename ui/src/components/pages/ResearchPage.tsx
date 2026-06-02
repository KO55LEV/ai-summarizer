import { useState, useEffect } from 'react';
import { Plus, Search, Filter, BookOpen, Zap, Globe, Clock } from 'lucide-react';
import type { ResearchTopic, ResearchListData } from '../../api/types';
import { getResearchList } from '../../api/research';
import { getCurrentUserId } from '../../config/currentUser';

const FREQ_COLORS: Record<string, string> = {
  hourly: 'var(--color-info)',
  daily: 'var(--color-accent)',
  weekly: '#a78bfa',
  monthly: '#f59e0b',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--color-accent)',
  paused: '#f59e0b',
  draft: 'var(--color-text-muted)',
};

const STAT_ICONS = [
  <Zap size={20} />,
  <BookOpen size={20} />,
  <Globe size={20} />,
  <Clock size={20} />,
];

interface ResearchPageProps {
  onTopicSelect: (topic: ResearchTopic) => void;
  onCreateNew: () => void;
}

export function ResearchPage({ onTopicSelect, onCreateNew }: ResearchPageProps) {
  const [data, setData] = useState<ResearchListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'draft'>('all');

  useEffect(() => {
    getResearchList(getCurrentUserId()).then((d) => { setData(d); setLoading(false); });
  }, []);

  const filtered = (data?.topics ?? []).filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <SkeletonLoader />;

  const stats = data!.stats;
  const statCards = [
    { label: 'Active Topics', value: String(stats.activeTopics) },
    { label: 'Briefings Generated', value: String(stats.briefingsGenerated) },
    { label: 'Sources Tracked', value: String(stats.sourcesTracked) },
    { label: 'Avg Read Time', value: stats.avgReadTime },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Research</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Automated research topics with scheduled briefing generation
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black"
          style={{ background: 'var(--color-accent)' }}
        >
          <Plus size={16} />
          New Research
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <div
            key={s.label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <div className="p-2 rounded-lg" style={{ background: 'var(--color-bg-hover)' }}>
              <span style={{ color: 'var(--color-accent)' }}>{STAT_ICONS[i]}</span>
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--color-text-primary)]">{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search topics or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} style={{ color: 'var(--color-text-muted)' }} />
          {(['all', 'active', 'paused', 'draft'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
              style={{
                background: filterStatus === s ? 'var(--color-accent)' : 'var(--color-bg-card)',
                color: filterStatus === s ? 'black' : 'var(--color-text-secondary)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Topics Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
          No topics match your search.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onClick={() => onTopicSelect(topic)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function TopicCard({ topic, onClick }: { topic: ResearchTopic; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl p-5 cursor-pointer transition-all"
      style={{
        background: 'var(--color-bg-card)',
        border: `1px solid ${hovered ? 'var(--color-accent)' : 'var(--color-border)'}`,
        boxShadow: hovered ? '0 0 0 1px var(--color-accent)' : 'none',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <h3
          className="font-semibold text-sm leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {topic.name}
        </h3>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <StatusBadge status={topic.status} />
          <FreqBadge freq={topic.frequency} />
        </div>
      </div>

      {/* Description */}
      <p
        className="text-xs leading-relaxed mb-3 line-clamp-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {topic.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {topic.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-xs"
            style={{
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1">
            <BookOpen size={12} />
            {topic.briefingsCount} briefings
          </span>
          <span>Last: {topic.lastRun}</span>
          <span style={{ color: topic.nextRun === 'paused' ? '#f59e0b' : 'var(--color-text-muted)' }}>
            Next: {topic.nextRun}
          </span>
        </div>
        {hovered && (
          <span
            className="text-xs font-medium px-3 py-1 rounded-lg"
            style={{ background: 'var(--color-accent)', color: 'black' }}
          >
            View
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchTopic['status'] }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{
        background: `${STATUS_COLORS[status]}22`,
        color: STATUS_COLORS[status],
      }}
    >
      {status}
    </span>
  );
}

function FreqBadge({ freq }: { freq: ResearchTopic['frequency'] }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{
        background: `${FREQ_COLORS[freq]}22`,
        color: FREQ_COLORS[freq],
      }}
    >
      {freq}
    </span>
  );
}

function SkeletonLoader() {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      <div className="mb-6 h-8 w-40 rounded-lg animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl p-4 h-20 animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl p-5 h-44 animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
        ))}
      </div>
    </main>
  );
}
