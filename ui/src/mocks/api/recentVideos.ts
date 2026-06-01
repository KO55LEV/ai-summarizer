import type { VideoRecord } from '../../types';
import data from '../data/recentVideos.json';
import { delay } from './delay';

export async function getMockRecentVideos(): Promise<VideoRecord[]> {
  await delay();
  return data as unknown as VideoRecord[];
}
