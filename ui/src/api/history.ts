import type { HistoryItem } from './types';
import { getMockHistory } from '../mocks/api/history';

export async function getHistory(): Promise<HistoryItem[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockHistory();
  }
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json() as Promise<HistoryItem[]>;
}
