import type { ProfileData } from './types';
import { getMockProfile } from '../mocks/api/profile';

export async function getProfileData(): Promise<ProfileData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockProfile();
  }
  const res = await fetch('/api/profile');
  if (!res.ok) throw new Error('Failed to fetch profile data');
  return res.json() as Promise<ProfileData>;
}
