import { getCurrentUserId } from '../config/currentUser';
import type { ResearchBriefing, ResearchListData, ResearchSearchResult, ResearchTopic, ResearchTopicRun } from './types';
import { getMockResearchList, getMockResearchBriefing, listMockResearchRuns, listMockResearchRunSearchResults } from '../mocks/api/research';

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

interface ApiResearchSearchResult {
  id: string;
  researchTopicRunId: string;
  researchTopicId: string;
  sourceKey: string;
  query: string;
  title: string;
  url: string;
  canonicalUrl: string | null;
  snippet: string | null;
  score: number;
  publishedAt: string | null;
  authorName: string | null;
  domain: string | null;
  language: string | null;
  resultRank: number;
  rawResultJson: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateResearchTopicInput {
  requestedByUserId: string;
  projectId?: string | null;
  name: string;
  description?: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  status?: 'active' | 'paused' | 'draft';
  deliveryTime?: string | null;
  sources: string[];
  tags: string[];
  outputs: string[];
}

export interface UpdateResearchTopicInput {
  requestedByUserId?: string;
  projectId?: string | null;
  name: string;
  description?: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'draft';
  deliveryTime?: string | null;
  sources: string[];
  tags: string[];
  outputs: string[];
}

interface StartResearchRunResponse {
  jobId: string | null;
  workflowId: string | null;
  topicId: string;
  existingRunId: string | null;
  jobType: string;
  status: string;
  createdAt: string;
  message: string;
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
    requestedByUserId: topic.requestedByUserId ?? null,
    projectId: topic.projectId ?? null,
    name: topic.name,
    description: topic.description ?? '',
    frequency: topic.frequency,
    status: topic.status,
    deliveryTime: topic.deliveryTime,
    sources: topic.sources,
    tags: topic.tags,
    outputs: topic.outputs,
    briefingsCount: topic.briefingsCount,
    lastRunAt: topic.lastRunAt,
    nextRunAt: topic.nextRunAt,
    lastRun: formatRelativeDate(topic.lastRunAt, topic.status),
    nextRun: formatRelativeDate(topic.nextRunAt, topic.status),
    lastBriefingPreview: topic.lastBriefingPreview ?? '',
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt ?? topic.lastRunAt ?? new Date().toISOString(),
  };
}

function mapBriefing(briefing: ApiResearchBriefing): ResearchBriefing {
  return {
    id: briefing.id,
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
      generatedAt: item.generatedAt,
      date: formatGeneratedAt(item.generatedAt),
      preview: item.previewText,
    })),
    previewText: briefing.previewText,
  };
}

function mapSearchResult(item: ApiResearchSearchResult): ResearchSearchResult {
  return {
    id: item.id,
    researchTopicRunId: item.researchTopicRunId,
    researchTopicId: item.researchTopicId,
    sourceKey: item.sourceKey,
    query: item.query,
    title: item.title,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    snippet: item.snippet,
    score: item.score,
    publishedAt: item.publishedAt,
    authorName: item.authorName,
    domain: item.domain,
    language: item.language,
    resultRank: item.resultRank,
    rawResultJson: item.rawResultJson,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
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

export async function getResearchTopic(topicId: string): Promise<ResearchTopic> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    const data = await getMockResearchList();
    const topic = data.topics.find((item) => item.id === topicId);
    if (!topic) throw new Error('Research topic not found');
    return topic;
  }

  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch research topic');
  const data = await res.json() as ApiResearchTopic;
  return mapTopic(data);
}

export async function getResearchBriefing(topicId: string): Promise<ResearchBriefing | null> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockResearchBriefing(topicId);
  }
  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}/briefing?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch research briefing');
  const data = await res.json() as ApiResearchBriefing;
  return mapBriefing(data);
}

export async function getResearchBriefingById(topicId: string, briefingId: string): Promise<ResearchBriefing | null> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockResearchBriefing(topicId);
  }

  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}/briefings/${encodeURIComponent(briefingId)}?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch research briefing');
  const data = await res.json() as ApiResearchBriefing;
  return mapBriefing(data);
}

export async function listResearchBriefings(topicId: string): Promise<ResearchBriefing['pastBriefings']> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    const briefing = await getMockResearchBriefing(topicId);
    return briefing?.pastBriefings ?? [];
  }

  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}/briefings?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch research briefing history');
  const data = await res.json() as ApiResearchBriefingHistoryItem[];
  return data.map((item) => ({
    id: item.id,
    generatedAt: item.generatedAt,
    date: formatGeneratedAt(item.generatedAt),
    preview: item.previewText,
  }));
}

export async function createResearchTopic(input: CreateResearchTopicInput): Promise<ResearchTopic> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return {
      id: `mock-${Date.now()}`,
      requestedByUserId: input.requestedByUserId,
      projectId: input.projectId ?? null,
      name: input.name,
      description: input.description ?? '',
      frequency: input.frequency,
      status: input.status ?? 'active',
      deliveryTime: input.deliveryTime ?? null,
      sources: input.sources,
      tags: input.tags,
      outputs: input.outputs,
      briefingsCount: 0,
      lastRunAt: null,
      nextRunAt: null,
      lastRun: '—',
      nextRun: input.deliveryTime ? `at ${input.deliveryTime}` : '—',
      lastBriefingPreview: '',
      createdAt: new Date().toISOString(),
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

export async function updateResearchTopic(topicId: string, input: UpdateResearchTopicInput): Promise<ResearchTopic> {
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, requestedByUserId: input.requestedByUserId ?? getCurrentUserId() }),
  });

  if (!res.ok) {
    throw new Error('Failed to update research topic');
  }

  const data = await res.json() as ApiResearchTopic;
  return mapTopic(data);
}

export async function deleteResearchTopic(topicId: string): Promise<void> {
  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}?${params.toString()}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete research topic');
}

export async function startResearchRun(topicId: string, requestedByUserId = getCurrentUserId()): Promise<StartResearchRunResponse> {
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestedByUserId, triggeredBy: 'manual', forceRun: true }),
  });
  if (!res.ok) throw new Error('Failed to start research run');
  return await res.json() as StartResearchRunResponse;
}

export async function listResearchRuns(topicId: string): Promise<ResearchTopicRun[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return listMockResearchRuns(topicId);
  }

  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/${encodeURIComponent(topicId)}/runs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch research runs');
  return await res.json() as ResearchTopicRun[];
}

export async function listResearchRunSearchResults(runId: string): Promise<ResearchSearchResult[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return listMockResearchRunSearchResults(runId);
  }

  const params = new URLSearchParams({ requestedByUserId: getCurrentUserId() });
  const res = await fetch(`/api/research/runs/${encodeURIComponent(runId)}/search-results?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch research run search results');
  const data = await res.json() as ApiResearchSearchResult[];
  return data.map(mapSearchResult);
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
