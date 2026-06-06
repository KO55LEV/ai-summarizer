import { getMockCurrentUser, getMockLogin, getMockLogout, getMockRegister } from '../mocks/api/auth';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  timeZone: string | null;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  session: AuthSession;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string | null;
}

export interface LoginWithPasswordInput {
  email: string;
  password: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await res.json().catch(() => null)) as { detail?: string; message?: string } | null;
      const detail = payload?.detail ?? payload?.message;
      throw new Error(detail || `Request failed: ${res.status}`);
    }

    const message = await res.text().catch(() => '');
    throw new Error(message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function registerUser(input: RegisterUserInput): Promise<AuthResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockRegister(input);
  }

  return requestJson<AuthResponse>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginWithPassword(input: LoginWithPasswordInput): Promise<AuthResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockLogin(input);
  }

  return requestJson<AuthResponse>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logoutUser(accessToken: string | null): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    await getMockLogout();
    return;
  }

  if (!accessToken) {
    return;
  }

  await requestJson<void>('/api/users/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockCurrentUser(accessToken);
  }

  return requestJson<AuthUser>('/api/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
