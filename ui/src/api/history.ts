import { getYouTubePreview } from './youtube';
import type { HistoryItem, TranscriptHistoryRun } from './types';
import { getMockHistory } from '../mocks/api/history';
import { getCurrentUserId } from '../config/currentUser';

interface GetHistoryOptions {
  limit?: number;
  offset?: number;
  requestedByUserId?: string | null;
}

function formatDuration(durationSeconds: number | null): string {
  if (durationSeconds === null || Number.isNaN(durationSeconds)) {
    return '—';
  }

  const total = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (sameDay) {
    return `Today, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameYesterday = date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();

  if (sameYesterday) {
    return `Yesterday, ${time}`;
  }

  const datePart = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return `${datePart}, ${time}`;
}

function fallbackYouTubePreview(url: string): { title: string; channel: string; thumbnail: string } {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      if (id) {
        return {
          title: 'YouTube video',
          channel: 'YouTube',
          thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        };
      }
    }

    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      if (id) {
        return {
          title: 'YouTube video',
          channel: 'YouTube',
          thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        };
      }
    }
  } catch {
    // fallback below
  }

  return {
    title: 'YouTube video',
    channel: 'YouTube',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  };
}

function formatSourceLabel(source: string): string {
  switch (source.trim().toLowerCase()) {
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

async function enrichHistoryRun(run: TranscriptHistoryRun): Promise<HistoryItem> {
  const preview = run.sourceUrl ? await getYouTubePreview(run.sourceUrl).catch(() => null) : null;
  const fallback = run.sourceUrl ? fallbackYouTubePreview(run.sourceUrl) : fallbackYouTubePreview('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const title = preview?.title ?? fallback.title;
  const channel = preview?.channel ?? fallback.channel;
  const thumbnail = preview?.thumbnail ?? fallback.thumbnail;
  const url = run.sourceUrl ?? '';
  const source = formatSourceLabel(run.sourceLabel ?? (run.displayStatus === 'completed' ? 'YouTube captions' : run.displayStatus));

  return {
    requestId: run.requestId,
    sourceId: run.sourceId,
    title,
    channel,
    duration: formatDuration(run.durationSeconds),
    language: run.language?.toUpperCase() ?? '—',
    date: formatHistoryDate(run.finishedAt ?? run.startedAt ?? run.createdAt),
    thumbnail,
    source,
    url,
    status: run.displayStatus,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    sourceUrl: run.sourceUrl,
  };
}

export async function getHistory(options: GetHistoryOptions = {}): Promise<HistoryItem[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockHistory(options.limit);
  }
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  params.set('requestedByUserId', options.requestedByUserId ?? getCurrentUserId());

  const query = params.toString();
  const res = await fetch(`/api/transcripts/history${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  const runs = await res.json() as TranscriptHistoryRun[];
  const items = await Promise.all(runs.map(enrichHistoryRun));
  return items;
}
