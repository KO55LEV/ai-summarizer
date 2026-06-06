import {
  getMockAdminSettings,
  updateMockAdminSettings,
} from '../mocks/api/adminSettings';
import { getAuthAccessToken } from '../config/auth';

export interface EmailSettingsResponse {
  provider: string;
  defaultFromEmail: string;
  defaultFromName: string | null;
}

export interface TranscribeSettingsResponse {
  provider: string;
}

export interface AdminSettingsResponse {
  email: EmailSettingsResponse;
  transcribe: TranscribeSettingsResponse;
}

export interface UpdateAdminSettingsInput {
  email: EmailSettingsResponse;
  transcribe: TranscribeSettingsResponse;
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
    throw new Error(`Request failed: ${res.status}`);
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

export async function getAdminSettings(accessToken?: string): Promise<AdminSettingsResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockAdminSettings();
  }

  return requestJson<AdminSettingsResponse>('/api/admin/settings', {
    headers: getAuthHeaders(accessToken),
  });
}

export async function updateAdminSettings(input: UpdateAdminSettingsInput, accessToken?: string): Promise<AdminSettingsResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockAdminSettings(input);
  }

  return requestJson<AdminSettingsResponse>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}
