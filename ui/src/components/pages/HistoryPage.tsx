import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Search,
  Play,
  Plus,
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

export default function HistoryPage({
  onVideoOpen,
  onNew,
}: {
  onVideoOpen?: (v: HistoryItem) => void;
  onNew?: () => void;
}) {
  return <HistoryPageView onVideoOpen={onVideoOpen} onNew={onNew} />;
}

export function HistoryPageView({
  onVideoOpen,
  onNew,
}: {
  onVideoOpen?: (v: HistoryItem) => void;
  onNew?: () => void;
}) {
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
      <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5">
        <section className="rounded-[22px] border border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.12),rgba(19,28,48,0.96)_45%,rgba(12,18,33,1))] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.2)] sm:p-4.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[22px] font-semibold tracking-tight text-text-primary sm:text-[24px]">Summarizer</h1>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
                Recent transcript requests and completed analyses. Start a new video or return to previous results.
              </p>
            </div>

            {onNew && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onNew}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover sm:w-auto"
                >
                  <Plus size={14} />
                  New Video
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="flex items-center gap-2.5 rounded-2xl border border-border bg-bg-card px-3.5 py-2.5">
              <Search size={15} className="text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search videos..."
                className="w-full bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
              className="rounded-2xl border border-border bg-bg-card px-3.5 py-2.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All statuses' : formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12px] text-red-300">
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

        <div className="mt-5 overflow-hidden rounded-[22px] border border-border bg-bg-card">
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
