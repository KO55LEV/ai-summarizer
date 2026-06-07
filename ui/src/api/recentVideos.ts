import { getCurrentUserId } from '../config/currentUser';
import { getMockRecentVideos } from '../mocks/api/recentVideos';
import { getYouTubePreview } from './youtube';
import type { VideoRecord } from '../types';

interface UserVideoLibraryItemResponse {
  id: string;
  requestedByUserId: string;
  mediaSourceId: string;
  publicRequestRunId: string | null;
  workflowId: string | null;
  transcriptId: string | null;
  status: string;
  sourceProvider: string;
  sourceKind: string;
  externalSourceId: string;
  sourceUrl: string;
  language: string | null;
  durationSeconds: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

function formatAge(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const absMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (absMinutes < 1) return 'just now';
  if (absMinutes < 60) return `${absMinutes}m ago`;
  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return `${absHours}h ago`;
  const absDays = Math.round(absHours / 24);
  return `${absDays}d ago`;
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

export async function getRecentVideos(): Promise<VideoRecord[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockRecentVideos();
  }

  const params = new URLSearchParams();
  params.set('requestedByUserId', getCurrentUserId());
  params.set('status', 'completed');
  params.set('limit', '3');
  params.set('offset', '0');

  const response = await fetch(`/api/transcripts/library?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recent videos');
  }

  const items = await response.json() as UserVideoLibraryItemResponse[];
  const videos = await Promise.all(items.map(async (item) => {
    const preview = await getYouTubePreview(item.sourceUrl).catch(() => null);
    const fallback = fallbackYouTubePreview(item.sourceUrl);
    const source = item.sourceProvider.toLowerCase().includes('youtube') ? 'YouTube' : item.sourceProvider;

    return {
      title: preview?.title ?? fallback.title,
      channel: preview?.channel ?? fallback.channel,
      duration: formatDuration(item.durationSeconds),
      language: item.language?.toUpperCase() ?? '—',
      quality: item.transcriptId ? 'Transcript ready' : 'Processing',
      views: '—',
      age: formatAge(item.completedAt ?? item.updatedAt ?? item.createdAt),
      url: item.sourceUrl,
      thumbnail: preview?.thumbnail ?? fallback.thumbnail,
      source,
    } satisfies VideoRecord;
  }));

  return videos;
}
