import type { DashboardData } from './types';
import { getCurrentUserId } from '../config/currentUser';
import { getMockDashboard } from '../mocks/api/dashboard';
import { getRecentVideos } from './recentVideos';

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

function formatHoursSaved(durationSeconds: number): string {
  const totalMinutes = Math.max(0, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${Math.max(0, minutes)}m`;
  }

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

async function getCompletedLibraryItems(): Promise<UserVideoLibraryItemResponse[]> {
  const params = new URLSearchParams();
  params.set('requestedByUserId', getCurrentUserId());
  params.set('status', 'completed');
  params.set('limit', '1000');
  params.set('offset', '0');

  const res = await fetch(`/api/transcripts/library?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  return res.json() as Promise<UserVideoLibraryItemResponse[]>;
}

export async function getDashboardData(): Promise<DashboardData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockDashboard();
  }

  const [recentVideos, completedVideos] = await Promise.all([
    getRecentVideos(),
    getCompletedLibraryItems(),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const videosAnalyzedThisMonth = completedVideos.filter((item) => {
    const completedAt = item.completedAt ?? item.updatedAt ?? item.createdAt;
    const completedDate = new Date(completedAt);
    return !Number.isNaN(completedDate.getTime()) && completedDate >= monthStart;
  }).length;

  const totalDurationSeconds = completedVideos.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
  const transcriptCount = completedVideos.filter((item) => item.transcriptId !== null).length;
  const youtubeCount = completedVideos.filter((item) => item.sourceProvider.toLowerCase().includes('youtube')).length;
  const whisperCount = completedVideos.filter((item) => item.sourceProvider.toLowerCase().includes('whisper')).length;
  const languageCount = new Set(
    completedVideos
      .map((item) => item.language?.trim().toUpperCase())
      .filter((language): language is string => Boolean(language)),
  ).size;

  return {
    stats: [
      {
        label: 'Videos analyzed',
        value: String(videosAnalyzedThisMonth),
        sub: 'this month',
        color: '#4dc8e8',
        iconKey: 'play',
      },
      {
        label: 'Hours saved',
        value: formatHoursSaved(totalDurationSeconds),
        sub: 'vs watching fully',
        color: '#00d4aa',
        iconKey: 'clock',
      },
      {
        label: 'Transcripts ready',
        value: String(transcriptCount),
        sub: 'completed videos',
        color: '#a78bfa',
        iconKey: 'file-text',
      },
      {
        label: 'Processed videos',
        value: String(completedVideos.length),
        sub: 'in library',
        color: '#f59e0b',
        iconKey: 'download',
      },
    ],
    recentVideos,
    usageBreakdown: [
      {
        title: 'YouTube captions',
        count: youtubeCount,
        color: '#4dc8e8',
        iconKey: 'sparkles',
      },
      {
        title: 'Whisper transcriptions',
        count: whisperCount,
        color: '#00d4aa',
        iconKey: 'bar-chart-2',
      },
      {
        title: 'Languages processed',
        count: languageCount,
        color: '#a78bfa',
        iconKey: 'globe',
      },
      {
        title: 'Completed videos',
        count: completedVideos.length,
        color: '#f59e0b',
        iconKey: 'star',
      },
    ],
    monthlyUsage: {
      used: videosAnalyzedThisMonth,
      total: 500,
    },
  };
}
