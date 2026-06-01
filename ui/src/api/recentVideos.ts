import type { VideoRecord } from '../types';
import { getMockRecentVideos } from '../mocks/api/recentVideos';

export async function getRecentVideos(): Promise<VideoRecord[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockRecentVideos();
  }
  const res = await fetch('/api/recent-videos');
  if (!res.ok) throw new Error('Failed to fetch recent videos');
  return res.json() as Promise<VideoRecord[]>;
}
