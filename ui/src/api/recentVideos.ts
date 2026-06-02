import type { VideoRecord } from '../types';
import type { HistoryItem } from './types';
import { getHistory } from './history';

function historyItemToVideoRecord(item: HistoryItem): VideoRecord {
  return {
    title: item.title,
    channel: item.channel,
    duration: item.duration,
    language: item.language,
    quality: '1080p',
    views: '—',
    age: item.date,
    url: item.url || item.sourceUrl || '',
    thumbnail: item.thumbnail,
    source: item.source,
  };
}

export async function getRecentVideos(): Promise<VideoRecord[]> {
  const items = await getHistory({ limit: 3 });
  return items.map(historyItemToVideoRecord);
}
