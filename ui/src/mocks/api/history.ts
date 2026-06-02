import type { HistoryItem } from '../../api/types';
import data from '../data/history.json';
import { delay } from './delay';

export async function getMockHistory(limit?: number): Promise<HistoryItem[]> {
  await delay();
  const items = ((data as { items: Array<Record<string, unknown>> }).items).map((item, index) => ({
    requestId: `mock-history-${index + 1}`,
    sourceId: null,
    title: String(item.title ?? 'YouTube video'),
    channel: String(item.channel ?? 'YouTube'),
    duration: String(item.duration ?? '—'),
    language: String(item.language ?? '—'),
    date: String(item.date ?? '—'),
    thumbnail: String(item.thumbnail ?? 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'),
    source: String(item.source ?? 'YouTube captions'),
    url: String(item.url ?? ''),
    status: 'completed' as const,
    startedAt: new Date(Date.now() - index * 60 * 60 * 1000).toISOString(),
    finishedAt: new Date(Date.now() - index * 60 * 60 * 1000).toISOString(),
    sourceUrl: String(item.url ?? ''),
    insights: typeof item.insights === 'number' ? item.insights : undefined,
  })) as HistoryItem[];

  return typeof limit === 'number' ? items.slice(0, limit) : items;
}
