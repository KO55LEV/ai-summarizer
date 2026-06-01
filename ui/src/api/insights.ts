import type { InsightsData } from './types';
import { getMockInsights } from '../mocks/api/insights';

export async function getInsightsData(): Promise<InsightsData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockInsights();
  }
  const res = await fetch('/api/insights');
  if (!res.ok) throw new Error('Failed to fetch insights data');
  return res.json() as Promise<InsightsData>;
}
