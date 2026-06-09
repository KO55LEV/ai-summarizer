import { getStoredAuthState } from './auth';

const DEFAULT_USER_ID = '617a8af2-bae2-43a6-938f-7c384e3061ee';

export function getCurrentUserId(): string {
  const authUserId = getStoredAuthState()?.user.id?.trim();
  if (authUserId) {
    return authUserId;
  }

  return import.meta.env.VITE_DEMO_USER_ID?.trim() || DEFAULT_USER_ID;
}
