import type { ResearchListData, ResearchBriefing } from '../../api/types';
import listData from '../data/research.json';
import briefingsData from '../data/researchBriefings.json';
import { delay } from './delay';

export async function getMockResearchList(): Promise<ResearchListData> {
  await delay();
  return listData as unknown as ResearchListData;
}

export async function getMockResearchBriefing(topicId: string): Promise<ResearchBriefing | null> {
  await delay();
  const briefings = briefingsData.briefings as Record<string, ResearchBriefing>;
  return briefings[topicId] ?? null;
}
