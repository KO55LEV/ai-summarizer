import { getCurrentUserId } from '../config/currentUser';
import type { ResearchBriefing, ResearchListData, ResearchTopic } from './types';
import { getMockResearchList, getMockResearchBriefing } from '../mocks/api/research';

interface ApiResearchTopic {
  id: string;
  requestedByUserId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'draft';
  deliveryTime: string | null;
  sources: string[];
  tags: string[];
  outputs: string[];
  briefingsCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastBriefingPreview: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResearchStats {
  activeTopics: number;
  briefingsGenerated: number;
  sourcesTracked: number;
  avgReadTimeMinutes: number;
}

interface ApiResearchListData {
  topics: ApiResearchTopic[];
  stats: ApiResearchStats;
}

interface ApiResearchBriefingSection {
  title: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  items: string[];
}

interface ApiResearchBriefingSource {
  title: string;
  domain: string;
}

interface ApiResearchBriefingHistoryItem {
  id: string;
  generatedAt: string;
  previewText: string;
}

interface ApiResearchBriefing {
  id: string;
  researchTopicId: string;
  requestedByUserId: string | null;
  topicName: string;
  generatedAt: string;
  periodLabel: string;
  readTimeMinutes: number;
  wordCount: number;
  summary: string;
  sections: ApiResearchBriefingSection[];
  sources: ApiResearchBriefingSource[];
  pastBriefings: ApiResearchBriefingHistoryItem[];
  previewText: string;
}

interface CreateResearchTopicInput {
  requestedByUserId: string;
  name: string;
  description?: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  deliveryTime?: string | null;
  sources: string[];
  tags: string[];
  outputs: string[];
}

interface CreateResearchBriefingInput {
  requestedByUserId?: string;
  generatedAt?: string;
  periodLabel: string;
  readTimeMinutes: number;
  wordCount: number;
  summary: string;
  previewText: string;
  nextRunAt?: string | null;
  sections: Array<ApiResearchBriefingSection>;
  sources: Array<ApiResearchBriefingSource>;
}

function formatRelativeDate(value: string | null, status?: string): string {
  if (!value) {
    return status === 'paused' ? 'paused' : '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return status === 'paused' ? 'paused' : '—';
  }

  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);

  if (absMinutes < 1) {
    return diffMs >= 0 ? 'just now' : 'just now';
  }

  if (absMinutes < 60) {
    return diffMs >= 0 ? `in ${absMinutes}m` : `${absMinutes}m ago`;
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
  }

  const absDays = Math.round(absHours / 24);
  return diffMs >= 0 ? `in ${absDays}d` : `${absDays}d ago`;
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${datePart} · ${timePart}`;
}

function formatReadTime(minutes: number): string {
  return `${minutes} min`;
}

function mapTopic(topic: ApiResearchTopic): ResearchTopic {
  return {
    id: topic.id,
    projectId: topic.projectId ?? null,
    name: topic.name,
    description: topic.description ?? '',
    frequency: topic.frequency,
    status: topic.status,
    sources: topic.sources,
    tags: topic.tags,
    briefingsCount: topic.briefingsCount,
    lastRun: formatRelativeDate(topic.lastRunAt, topic.status),
    nextRun: formatRelativeDate(topic.nextRunAt, topic.status),
    lastBriefingPreview: topic.lastBriefingPreview ?? '',
    updatedAt: topic.updatedAt ?? topic.lastRunAt ?? new Date().toISOString(),
  };
}

function mapBriefing(briefing: ApiResearchBriefing): ResearchBriefing {
  return {
    topicId: briefing.researchTopicId,
    topicName: briefing.topicName,
    generatedAt: formatGeneratedAt(briefing.generatedAt),
    period: briefing.periodLabel,
    readTime: formatReadTime(briefing.readTimeMinutes),
    wordCount: briefing.wordCount,
    summary: briefing.summary,
    sections: briefing.sections,
    sources: briefing.sources,
    pastBriefings: briefing.pastBriefings.map((item) => ({
      id: item.id,
      date: formatGeneratedAt(item.generatedAt),
      preview: item.previewText,
    })),
  };
}

export async function getResearchList(requestedByUserId = getCurrentUserId()): Promise<ResearchListData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockResearchList();
  }
  const params = new URLSearchParams({ requestedByUserId });
  const res = await fetch(`/api/research?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch research list');
  const data = await res.json() as ApiResearchListData;
  return {
    topics: data.topics.map(mapTopic),
    stats: {
      activeTopics: data.stats.activeTopics,
      briefingsGenerated: data.stats.briefingsGenerated,
      sourcesTracked: data.stats.sourcesTracked,
      avgReadTime: formatReadTime(data.stats.avgReadTimeMinutes),
    },
  };
}

export async function getResearchBriefing(topicId: string): Promise<ResearchBriefing | null> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockResearchBriefing(topicId);
  }
  const res = await fetch(`/api/research/${topicId}/briefing`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch research briefing');
  const data = await res.json() as ApiResearchBriefing;
  return mapBriefing(data);
}

export async function createResearchTopic(input: CreateResearchTopicInput): Promise<ResearchTopic> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return {
      id: `mock-${Date.now()}`,
      projectId: null,
      name: input.name,
      description: input.description ?? '',
      frequency: input.frequency,
      status: 'draft',
      sources: input.sources,
      tags: input.tags,
      briefingsCount: 0,
      lastRun: '—',
      nextRun: input.deliveryTime ? `at ${input.deliveryTime}` : '—',
      lastBriefingPreview: '',
      updatedAt: new Date().toISOString(),
    };
  }

  const res = await fetch('/api/research', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error('Failed to create research topic');
  }

  const data = await res.json() as ApiResearchTopic;
  return mapTopic(data);
}

export async function createResearchBriefing(topicId: string, input: CreateResearchBriefingInput): Promise<ResearchBriefing> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    const mock = await getMockResearchBriefing(topicId);
    if (!mock) {
      throw new Error('Failed to create research briefing');
    }

    return mock;
  }

  const res = await fetch(`/api/research/${topicId}/briefings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error('Failed to create research briefing');
  }

  const data = await res.json() as ApiResearchBriefing;
  return mapBriefing(data);
}
