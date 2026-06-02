import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Search,
  Play,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { HistoryItem } from '../../api/types';
import { getHistory } from '../../api/history';

const PAGE_SIZE = 12;
const STATUS_FILTERS = ['all', 'completed', 'queued', 'running', 'failed', 'cancelled'] as const;

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8 animate-pulse">
        <div className="h-7 w-32 bg-bg-card rounded mb-2" />
        <div className="h-4 w-64 bg-bg-card rounded mb-7" />
        <div className="bg-bg-card border border-border rounded-xl h-96" />
      </div>
    </main>
  );
}

function formatStatusLabel(status: HistoryItem['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function statusStyles(status: HistoryItem['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'queued':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'running':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'failed':
      return 'bg-danger/10 text-danger border-danger/20';
    case 'cancelled':
      return 'bg-text-muted/10 text-text-muted border-border';
    default:
      return 'bg-bg-input text-text-muted border-border';
  }
}

function sourceStyles(source: string): string {
  const normalized = source.toLowerCase();

  if (normalized.includes('whisper')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }

  if (normalized.includes('youtube') || normalized.includes('yt')) {
    return 'bg-[#4dc8e8]/10 text-[#4dc8e8] border-[#4dc8e8]/20';
  }

  return 'bg-bg-input text-text-muted border-border';
}

function formatSourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();

  switch (normalized) {
    case 'youtube captions':
      return 'YT Captions';
    case 'whisper':
      return 'Whisper';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Processing';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'completed':
      return 'Completed';
    default:
      return source;
  }
}

export default function HistoryPage({ onVideoOpen }: { onVideoOpen?: (v: HistoryItem) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setError(null);
      try {
        const next = await getHistory({ limit: PAGE_SIZE, offset: 0 });
        if (cancelled) {
          return;
        }

        setItems(next);
        setOffset(next.length);
        setHasMore(next.length === PAGE_SIZE);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const next = await getHistory({ limit: PAGE_SIZE, offset });
      setItems(prev => [...prev, ...next]);
      setOffset(prev => prev + next.length);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more history');
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery = needle.length === 0
        || [item.title, item.channel, item.source, item.url]
          .filter(Boolean)
          .some(value => value.toLowerCase().includes(needle));

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [items, query, statusFilter]);

  if (!loaded) return <PageSkeleton />;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8">

        <div className="mb-7">
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1">History</h1>
          <p className="text-text-secondary text-[13px]">Recent transcript requests and completed analyses for the current user.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-bg-card border border-border rounded-xl px-4 py-2.5">
            <Search size={14} className="text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, channel, source or URL…"
              className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-bg-card border border-border rounded-xl p-1.5">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-accent text-bg-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
                }`}
              >
                {status === 'all' ? 'All' : formatStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
            <div className="flex items-center gap-2 text-[13px]">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-3 py-1.5 text-[12px] font-medium text-danger hover:bg-danger/10 transition-colors"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_72px] items-center gap-4 px-5 py-2.5 border-b border-border">
            <span className="text-[11px] font-medium text-text-muted">Video</span>
            <span className="text-[11px] font-medium text-text-muted">Source</span>
            <span className="text-[11px] font-medium text-text-muted">Status</span>
            <span className="text-[11px] font-medium text-text-muted">Date</span>
            <span />
          </div>

          {filteredItems.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-input text-text-muted">
                <Clock size={18} />
              </div>
              <div className="text-[14px] font-semibold text-text-primary mb-1">
                No history items found
              </div>
              <div className="text-[12px] text-text-muted">
                Try a different search term or status filter.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item) => {
                const openable = item.status === 'completed' && Boolean(item.sourceId);
                return (
                  <div
                    key={item.requestId}
                    onClick={() => {
                      if (openable) {
                        onVideoOpen?.(item);
                      }
                    }}
                    className={`grid grid-cols-[2.2fr_1fr_1fr_1fr_72px] items-center gap-4 px-5 py-3.5 transition-colors group ${
                      openable ? 'hover:bg-bg-input/40 cursor-pointer' : 'cursor-default opacity-95'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-[72px] h-[40px] rounded-md bg-bg-input overflow-hidden flex-shrink-0 relative">
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] font-semibold px-1 py-0.5 rounded">
                          {item.duration}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-text-primary truncate leading-snug">{item.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Play size={9} className="text-youtube" fill="currentColor" />
                          <span className="text-[10px] text-text-muted">{item.channel}</span>
                          <span className="text-[10px] font-medium px-1 py-0 rounded bg-bg-input text-text-muted">
                            {item.language}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${sourceStyles(item.source)}`}>
                        {formatSourceLabel(item.source)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${statusStyles(item.status)}`}>
                        {formatStatusLabel(item.status)}
                      </span>
                    </div>

                    <span className="text-[11px] text-text-muted">{item.date}</span>

                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 text-text-muted hover:text-accent cursor-pointer transition-colors disabled:opacity-40"
                        title={openable ? 'Open' : 'Unavailable'}
                        disabled={!openable}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openable) {
                            onVideoOpen?.(item);
                          }
                        }}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[12px] text-text-muted">
            Showing {filteredItems.length} of {items.length} loaded records
          </div>
          <button
            onClick={loadMore}
            disabled={!hasMore || loadingMore}
            className="inline-flex items-center gap-2 text-[12px] text-text-muted hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors py-2"
          >
            {loadingMore ? 'Loading…' : hasMore ? 'Load older requests…' : 'No more history'}
          </button>
        </div>

      </div>
    </main>
  );
}
