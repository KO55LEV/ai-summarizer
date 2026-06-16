import type { ResearchListData, ResearchBriefing, ResearchSearchResult, ResearchTopicRun } from '../../api/types';
import listData from '../data/research.json';
import briefingsData from '../data/researchBriefings.json';
import runsData from '../data/researchRuns.json';
import searchResultsData from '../data/researchSearchResults.json';
import { delay } from './delay';

export async function getMockResearchList(): Promise<ResearchListData> {
  await delay();
  const data = listData as unknown as ResearchListData;
  return {
    ...data,
    topics: data.topics.map((topic) => ({
      ...topic,
      requestedByUserId: null,
      projectId: topic.projectId ?? null,
      deliveryTime: topic.deliveryTime ?? '08:00',
      lookbackWindow: topic.lookbackWindow ?? null,
      outputs: topic.outputs ?? ['briefing', 'structured'],
      lastRunAt: topic.lastRunAt ?? null,
      nextRunAt: topic.nextRunAt ?? null,
      createdAt: topic.createdAt ?? new Date().toISOString(),
      updatedAt: topic.updatedAt ?? new Date().toISOString(),
    })),
  };
}

export async function getMockResearchBriefing(topicId: string): Promise<ResearchBriefing | null> {
  await delay();
  const briefings = briefingsData.briefings as unknown as Record<string, Omit<ResearchBriefing, 'id' | 'previewText'> & { previewText?: string }>;
  const briefing = briefings[topicId];
  if (!briefing) return null;
  return {
    ...briefing,
    id: `${topicId}-latest`,
    previewText: briefing.previewText ?? briefing.summary,
    pastBriefings: briefing.pastBriefings.map((item) => ({
      ...item,
      generatedAt: item.generatedAt ?? item.date,
    })),
  };
}

export async function listMockResearchRunSearchResults(runId: string): Promise<ResearchSearchResult[]> {
  await delay();
  const results = searchResultsData.results as unknown as Record<string, ResearchSearchResult[]>;
  return results[runId] ?? [];
}

export async function listMockResearchRuns(topicId: string): Promise<ResearchTopicRun[]> {
  await delay();
  const runs = runsData.runs as unknown as Record<string, ResearchTopicRun[]>;
  return runs[topicId] ?? [];
}
