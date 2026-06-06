// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStat {
  label: string;
  value: string;
  sub: string;
  color: string;
  iconKey: string;
}

export interface DashboardVideo {
  title: string;
  channel: string;
  duration: string;
  language: string;
  age: string;
  thumbnail: string;
  url: string;
  source: string;
}

export interface UsageItem {
  title: string;
  count: number;
  color: string;
  iconKey: string;
}

export interface DashboardData {
  stats: DashboardStat[];
  recentVideos: DashboardVideo[];
  usageBreakdown: UsageItem[];
  monthlyUsage: { used: number; total: number };
}

// ── History ──────────────────────────────────────────────────────────────────

export interface TranscriptHistoryRun {
  requestId: string;
  sourceId: string | null;
  sourceProvider: string | null;
  sourceKind: string | null;
  externalSourceId: string | null;
  sourceUrl: string | null;
  workflowId: string | null;
  transcriptId: string | null;
  status: string;
  displayStatus: 'completed' | 'queued' | 'running' | 'failed' | 'cancelled' | 'unknown';
  sourceLabel: string | null;
  language: string | null;
  durationSeconds: number | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface HistoryItem {
  requestId: string;
  sourceId: string | null;
  title: string;
  channel: string;
  duration: string;
  language: string;
  date: string;
  thumbnail: string;
  source: string;
  url: string;
  status: 'completed' | 'queued' | 'running' | 'failed' | 'cancelled' | 'unknown';
  startedAt: string;
  finishedAt: string | null;
  sourceUrl: string | null;
  insights?: number;
}

// ── Insights ─────────────────────────────────────────────────────────────────

export interface InsightTypeStat {
  key: string;
  label: string;
  description: string;
  count: number;
  color: string;
}

export interface RecentInsightItem {
  type: string;
  label: string;
  preview?: string;
  count?: number;
}

export interface RecentInsight {
  title: string;
  channel: string;
  age: string;
  thumbnail: string;
  items: RecentInsightItem[];
}

export interface InsightsData {
  types: InsightTypeStat[];
  recent: RecentInsight[];
}

// ── Exports ──────────────────────────────────────────────────────────────────

export interface ExportRecord {
  title: string;
  channel: string;
  format: string;
  size: string;
  date: string;
  type: string;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileUser {
  name: string;
  email: string;
  initials: string;
  plan: 'free' | 'pro';
  memberSince: string;
}

export interface ProfileStat {
  label: string;
  value: string;
  color: string;
  iconKey: string;
}

export interface ProfileLanguage {
  lang: string;
  count: number;
  pct: number;
}

export interface ProfileActivityItem {
  title: string;
  channel: string;
  age: string;
  thumbnail: string;
}

export interface ProfileSubscription {
  planName: string;
  price: string;
  renewsAt: string;
  used: number;
  total: number;
}

export interface ProfileData {
  user: ProfileUser;
  stats: ProfileStat[];
  languages: ProfileLanguage[];
  recentActivity: ProfileActivityItem[];
  subscription: ProfileSubscription;
}

// ── Research ─────────────────────────────────────────────────────────────────

export interface ResearchTopic {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'draft';
  sources: string[];
  tags: string[];
  briefingsCount: number;
  lastRun: string;
  nextRun: string;
  lastBriefingPreview: string;
  updatedAt: string;
}

export interface ResearchStats {
  activeTopics: number;
  briefingsGenerated: number;
  sourcesTracked: number;
  avgReadTime: string;
}

export interface ResearchListData {
  topics: ResearchTopic[];
  stats: ResearchStats;
}

export interface BriefingSection {
  title: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  items: string[];
}

export interface BriefingSource {
  title: string;
  domain: string;
}

export interface PastBriefing {
  id: string;
  date: string;
  preview: string;
}

export interface ResearchBriefing {
  topicId: string;
  topicName: string;
  generatedAt: string;
  period: string;
  readTime: string;
  wordCount: number;
  summary: string;
  sections: BriefingSection[];
  sources: BriefingSource[];
  pastBriefings: PastBriefing[];
}
