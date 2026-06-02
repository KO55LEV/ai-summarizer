const DEFAULT_USER_ID = '617a8af2-bae2-43a6-938f-7c384e3061ee';

export function getCurrentUserId(): string {
  return import.meta.env.VITE_DEMO_USER_ID?.trim() || DEFAULT_USER_ID;
}
