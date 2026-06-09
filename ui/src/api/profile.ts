import type { ProfileData, ProfileLanguage, ProfileStat } from './types';
import { getAuthAccessToken } from '../config/auth';
import { getCurrentUserId } from '../config/currentUser';
import { getCurrentUser } from './auth';
import { getDashboardData } from './dashboard';
import { getExports } from './exports';
import { getInsightsData } from './insights';
import { getYouTubePreview } from './youtube';
import { getMockProfile } from '../mocks/api/profile';

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

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init).then(async (res) => {
    if (!res.ok) {
      throw new Error('Failed to fetch profile data');
    }

    return res.json() as Promise<T>;
  });
}

function computeInitials(name: string | null | undefined, email: string): string {
  const fromName = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('');

  if (fromName) {
    return fromName.slice(0, 2).toUpperCase();
  }

  const localPart = email.split('@')[0] ?? '';
  return localPart.slice(0, 2).toUpperCase() || 'AI';
}

function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatRelativeAge(iso: string | null | undefined): string {
  if (!iso) {
    return 'Just now';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatNextMonthlyReset(now = new Date()): string {
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(nextReset);
}

function buildLanguageBreakdown(items: UserVideoLibraryItemResponse[]): ProfileLanguage[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const language = item.language?.trim();
    if (!language) continue;

    const key = language.toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return Array.from(counts.entries())
    .map(([lang, count]) => ({
      lang: `${lang}`,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildStats(dashboardValue: Awaited<ReturnType<typeof getDashboardData>>, exportsCount: number, insightsCount: number): ProfileStat[] {
  const videosAnalyzed = dashboardValue.stats[0]?.value ?? String(dashboardValue.monthlyUsage.used);
  const hoursSaved = dashboardValue.stats[1]?.value ?? '0h';

  return [
    {
      label: 'Videos analyzed',
      value: videosAnalyzed,
      color: '#4dc8e8',
      iconKey: 'play',
    },
    {
      label: 'Hours saved',
      value: hoursSaved,
      color: '#00d4aa',
      iconKey: 'clock',
    },
    {
      label: 'Exports',
      value: String(exportsCount),
      color: '#f59e0b',
      iconKey: 'download',
    },
    {
      label: 'Insights',
      value: String(insightsCount),
      color: '#a78bfa',
      iconKey: 'sparkles',
    },
  ];
}

async function fetchLibraryItems(requestedByUserId: string): Promise<UserVideoLibraryItemResponse[]> {
  const params = new URLSearchParams();
  params.set('requestedByUserId', requestedByUserId);
  params.set('status', 'completed');
  params.set('limit', '1000');
  params.set('offset', '0');

  return requestJson<UserVideoLibraryItemResponse[]>(`/api/transcripts/library?${params.toString()}`);
}

async function buildRecentActivity(items: UserVideoLibraryItemResponse[]): Promise<ProfileData['recentActivity']> {
  const recentItems = [...items]
    .sort((a, b) => {
      const aTime = new Date(a.completedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.completedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 3);

  return Promise.all(recentItems.map(async (item) => {
    const preview = await getYouTubePreview(item.sourceUrl).catch(() => null);
    const fallbackTitle = 'YouTube video';
    const fallbackChannel = item.sourceProvider || 'YouTube';

    return {
      title: preview?.title ?? fallbackTitle,
      channel: preview?.channel ?? fallbackChannel,
      age: formatRelativeAge(item.completedAt ?? item.updatedAt ?? item.createdAt),
      thumbnail: preview?.thumbnail ?? `https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg`,
    };
  }));
}

export async function getProfileData(): Promise<ProfileData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockProfile();
  }

  const accessToken = getAuthAccessToken();
  if (!accessToken) {
    throw new Error('You must be signed in to load profile data.');
  }

  const requestedByUserId = getCurrentUserId();
  const [currentUser, dashboard, exportsResult, insightsResult, libraryItems] = await Promise.allSettled([
    getCurrentUser(accessToken),
    getDashboardData(),
    getExports(),
    getInsightsData(),
    fetchLibraryItems(requestedByUserId),
  ]);

  if (currentUser.status === 'rejected') {
    throw currentUser.reason instanceof Error ? currentUser.reason : new Error('Failed to load user profile');
  }

  if (dashboard.status === 'rejected') {
    throw dashboard.reason instanceof Error ? dashboard.reason : new Error('Failed to load dashboard data');
  }

  if (libraryItems.status === 'rejected') {
    throw libraryItems.reason instanceof Error ? libraryItems.reason : new Error('Failed to load profile activity');
  }

  const currentUserValue = currentUser.value;
  const dashboardValue = dashboard.value;
  const exportsCount = exportsResult.status === 'fulfilled' ? exportsResult.value.length : 0;
  const insightsCount = insightsResult.status === 'fulfilled'
    ? insightsResult.value.types.reduce((sum, item) => sum + item.count, 0)
    : 0;
  const subscription = {
    planName: 'Current usage',
    price: `${dashboardValue.monthlyUsage.used} / ${dashboardValue.monthlyUsage.total}`,
    renewsAt: `Resets on ${formatNextMonthlyReset()}`,
    used: dashboardValue.monthlyUsage.used,
    total: dashboardValue.monthlyUsage.total,
  };

  return {
    user: {
      name: currentUserValue.displayName?.trim() || currentUserValue.email,
      email: currentUserValue.email,
      initials: computeInitials(currentUserValue.displayName, currentUserValue.email),
      avatarUrl: currentUserValue.avatarUrl,
      status: currentUserValue.status,
      plan: dashboardValue.monthlyUsage.total > 0 ? 'pro' : 'free',
      memberSince: formatMonthYear(currentUserValue.createdAt),
    },
    stats: buildStats(dashboardValue, exportsCount, insightsCount),
    languages: buildLanguageBreakdown(libraryItems.value),
    recentActivity: await buildRecentActivity(libraryItems.value),
    subscription,
  };
}
