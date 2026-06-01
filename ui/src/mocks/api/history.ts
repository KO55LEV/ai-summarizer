import type { HistoryItem } from '../../api/types';
import data from '../data/history.json';
import { delay } from './delay';

export async function getMockHistory(): Promise<HistoryItem[]> {
  await delay();
  return (data as { items: unknown[] }).items as HistoryItem[];
}
