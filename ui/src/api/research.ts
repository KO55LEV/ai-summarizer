import type { ResearchListData, ResearchBriefing } from './types';
import { getMockResearchList, getMockResearchBriefing } from '../mocks/api/research';

export async function getResearchList(): Promise<ResearchListData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockResearchList();
  }
  const res = await fetch('/api/research');
  if (!res.ok) throw new Error('Failed to fetch research list');
  return res.json() as Promise<ResearchListData>;
}

export async function getResearchBriefing(topicId: string): Promise<ResearchBriefing | null> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockResearchBriefing(topicId);
  }
  const res = await fetch(`/api/research/${topicId}/briefing`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch research briefing');
  return res.json() as Promise<ResearchBriefing>;
}
