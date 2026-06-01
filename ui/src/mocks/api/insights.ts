import type { InsightsData } from '../../api/types';
import data from '../data/insights.json';
import { delay } from './delay';

export async function getMockInsights(): Promise<InsightsData> {
  await delay();
  return data as unknown as InsightsData;
}
