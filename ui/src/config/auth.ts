import type { AuthResponse } from '../api/auth';

const AUTH_SESSION_KEY = 'ai_summarizer_auth_session';

export function getStoredAuthState(): AuthResponse | null {
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthResponse;
    if (!parsed?.user?.id || !parsed?.session?.accessToken || !parsed?.session?.expiresAt) {
      return null;
    }

    parsed.user.roles = Array.isArray(parsed.user.roles) ? parsed.user.roles : [];
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredAuthState(auth: AuthResponse): void {
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(auth));
}

export function clearAuthenticated(): void {
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

export function isAuthenticated(): boolean {
  const auth = getStoredAuthState();
  if (!auth) {
    return false;
  }

  const expiresAt = new Date(auth.session.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function getAuthAccessToken(): string | null {
  return getStoredAuthState()?.session.accessToken ?? null;
}
