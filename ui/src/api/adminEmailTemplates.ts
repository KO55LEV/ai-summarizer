import { getAuthAccessToken } from '../config/auth';
import {
  createMockEmailTemplate,
  deleteMockEmailTemplate,
  getMockEmailTemplateByKey,
  getMockEmailTemplates,
  updateMockEmailTemplate,
} from '../mocks/api/adminEmailTemplates';

export interface EmailTemplateResponse {
  id: string;
  templateKey: string;
  title: string;
  description: string | null;
  subject: string;
  htmlBody: string | null;
  textBody: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateInput {
  templateKey: string;
  title: string;
  description?: string | null;
  subject: string;
  htmlBody?: string | null;
  textBody?: string | null;
  isActive: boolean;
}

export interface UpdateEmailTemplateInput {
  title: string;
  description?: string | null;
  subject: string;
  htmlBody?: string | null;
  textBody?: string | null;
  isActive: boolean;
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

export async function listEmailTemplates(search = '', accessToken?: string): Promise<EmailTemplateResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockEmailTemplates(search);
  }

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());

  const query = params.toString();
  return requestJson<EmailTemplateResponse[]>(`/api/admin/email-templates${query ? `?${query}` : ''}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getEmailTemplate(templateKey: string, accessToken?: string): Promise<EmailTemplateResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockEmailTemplateByKey(templateKey);
  }

  return requestJson<EmailTemplateResponse>(`/api/admin/email-templates/${encodeURIComponent(templateKey)}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function createEmailTemplate(input: CreateEmailTemplateInput, accessToken?: string): Promise<EmailTemplateResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return createMockEmailTemplate(input);
  }

  return requestJson<EmailTemplateResponse>('/api/admin/email-templates', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}

export async function updateEmailTemplate(templateKey: string, input: UpdateEmailTemplateInput, accessToken?: string): Promise<EmailTemplateResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockEmailTemplate(templateKey, input);
  }

  return requestJson<EmailTemplateResponse>(`/api/admin/email-templates/${encodeURIComponent(templateKey)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}

export async function deleteEmailTemplate(templateKey: string, accessToken?: string): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    await deleteMockEmailTemplate(templateKey);
    return;
  }

  await requestJson<void>(`/api/admin/email-templates/${encodeURIComponent(templateKey)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });
}
