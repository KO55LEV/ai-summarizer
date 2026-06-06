import type { ResearchListData, ResearchBriefing } from '../../api/types';
import listData from '../data/research.json';
import briefingsData from '../data/researchBriefings.json';
import { delay } from './delay';

export async function getMockResearchList(): Promise<ResearchListData> {
  await delay();
  const data = listData as unknown as ResearchListData;
  return {
    ...data,
    topics: data.topics.map((topic) => ({
      ...topic,
      projectId: topic.projectId ?? null,
      updatedAt: topic.updatedAt ?? new Date().toISOString(),
    })),
  };
}

export async function getMockResearchBriefing(topicId: string): Promise<ResearchBriefing | null> {
  await delay();
  const briefings = briefingsData.briefings as Record<string, ResearchBriefing>;
  return briefings[topicId] ?? null;
}
