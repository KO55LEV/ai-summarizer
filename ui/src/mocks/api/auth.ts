import type { AuthResponse, AuthUser, LoginWithPasswordInput, RegisterUserInput } from '../../api/auth';
import { delay } from './delay';

function buildSessionId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `mock-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

const sessions = new Map<string, AuthResponse>();

function buildAuthResponse(email: string, displayName: string | null): AuthResponse {
  const now = new Date().toISOString();
  const normalizedEmail = email.toLowerCase();
  const roles = normalizedEmail.includes('admin') ? ['admin', 'user'] : ['user'];
  const user: AuthUser = {
    id: buildSessionId(),
    email: normalizedEmail,
    displayName,
    avatarUrl: null,
    locale: null,
    timeZone: null,
    status: 'active',
    roles,
    createdAt: now,
    updatedAt: now,
  };

  const response = {
    user,
    session: {
      accessToken: buildSessionId(),
      refreshToken: buildSessionId(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
  };

  sessions.set(response.session.accessToken, response);
  return response;
}

export async function getMockRegister(input: RegisterUserInput): Promise<AuthResponse> {
  await delay();
  return buildAuthResponse(input.email, input.displayName?.trim() || null);
}

export async function getMockLogin(input: LoginWithPasswordInput): Promise<AuthResponse> {
  await delay();
  return buildAuthResponse(input.email, null);
}

export async function getMockCurrentUser(accessToken: string): Promise<AuthUser> {
  await delay();
  const session = sessions.get(accessToken);
  if (session) {
    return structuredClone(session.user);
  }

  const isAdmin = accessToken.toLowerCase().includes('admin');
  return {
    id: accessToken || buildSessionId(),
    email: 'demo@example.com',
    displayName: 'Demo User',
    avatarUrl: null,
    locale: null,
    timeZone: null,
    status: 'active',
    roles: isAdmin ? ['admin', 'user'] : ['user'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getMockLogout(): Promise<void> {
  await delay();
  sessions.clear();
}
