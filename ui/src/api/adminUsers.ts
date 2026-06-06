import {
  getMockAdminRoles,
  getMockAdminUserById,
  getMockAdminUsers,
  updateMockAdminUser,
} from '../mocks/api/adminUsers';
import { getAuthAccessToken } from '../config/auth';

export interface AdminUserResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  timeZone: string | null;
  status: string;
  roles: string[];
  sessionCount: number;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRoleResponse {
  roleKey: string;
  displayName: string;
  description: string | null;
}

export interface UpdateAdminUserInput {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  timeZone: string | null;
  status: string;
  roles: string[];
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
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

function getAuthHeaders(accessToken?: string): HeadersInit {
  const token = accessToken ?? getAuthAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listAdminUsers(search = '', accessToken?: string): Promise<AdminUserResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockAdminUsers(search);
  }

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());

  const query = params.toString();
  return requestJson<AdminUserResponse[]>(`/api/admin/users${query ? `?${query}` : ''}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getAdminUser(userId: string, accessToken?: string): Promise<AdminUserResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockAdminUserById(userId);
  }

  return requestJson<AdminUserResponse>(`/api/admin/users/${userId}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getAdminRoles(accessToken?: string): Promise<AdminRoleResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockAdminRoles();
  }

  return requestJson<AdminRoleResponse[]>('/api/admin/users/roles', {
    headers: getAuthHeaders(accessToken),
  });
}

export async function updateAdminUser(userId: string, input: UpdateAdminUserInput, accessToken?: string): Promise<AdminUserResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockAdminUser(userId, input);
  }

  return requestJson<AdminUserResponse>(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}
