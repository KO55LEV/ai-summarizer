import type { ProfileData } from '../../api/types';
import data from '../data/profile.json';
import { delay } from './delay';

export async function getMockProfile(): Promise<ProfileData> {
  await delay();
  return data as unknown as ProfileData;
}
