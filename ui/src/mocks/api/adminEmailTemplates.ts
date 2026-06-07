import type {
  CreateEmailTemplateInput,
  EmailTemplateResponse,
  UpdateEmailTemplateInput,
} from '../../api/adminEmailTemplates';
import data from '../data/emailTemplates.json';
import { delay } from './delay';

type EmailTemplatesDataFile = {
  templates: EmailTemplateResponse[];
};

const state = structuredClone(data) as EmailTemplatesDataFile;

function cloneTemplate(template: EmailTemplateResponse): EmailTemplateResponse {
  return structuredClone(template);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function getMockEmailTemplates(search = ''): Promise<EmailTemplateResponse[]> {
  await delay();
  const term = search.trim().toLowerCase();
  if (!term) return state.templates.map(cloneTemplate);

  return state.templates
    .filter((template) => [
      template.templateKey,
      template.title,
      template.description ?? '',
      template.subject,
      template.htmlBody ?? '',
      template.textBody ?? '',
    ].join(' ').toLowerCase().includes(term))
    .map(cloneTemplate);
}

export async function getMockEmailTemplateByKey(templateKey: string): Promise<EmailTemplateResponse> {
  await delay();
  const template = state.templates.find((item) => item.templateKey === normalizeKey(templateKey));
  if (!template) throw new Error('Email template not found');
  return cloneTemplate(template);
}

export async function createMockEmailTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplateResponse> {
  await delay();
  const normalizedKey = normalizeKey(input.templateKey);
  if (state.templates.some((item) => item.templateKey === normalizedKey)) {
    throw new Error('An email template with this key already exists.');
  }

  const now = new Date().toISOString();
  const template: EmailTemplateResponse = {
    id: `mock-${crypto.randomUUID()}`,
    templateKey: normalizedKey,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    subject: input.subject.trim(),
    htmlBody: input.htmlBody?.trim() || null,
    textBody: input.textBody?.trim() || null,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  };

  state.templates.unshift(template);
  return cloneTemplate(template);
}

export async function updateMockEmailTemplate(templateKey: string, input: UpdateEmailTemplateInput): Promise<EmailTemplateResponse> {
  await delay();
  const index = state.templates.findIndex((item) => item.templateKey === normalizeKey(templateKey));
  if (index < 0) throw new Error('Email template not found');

  const updated: EmailTemplateResponse = {
    ...state.templates[index],
    title: input.title.trim(),
    description: input.description?.trim() || null,
    subject: input.subject.trim(),
    htmlBody: input.htmlBody?.trim() || null,
    textBody: input.textBody?.trim() || null,
    isActive: input.isActive,
    updatedAt: new Date().toISOString(),
  };

  state.templates[index] = updated;
  return cloneTemplate(updated);
}

export async function deleteMockEmailTemplate(templateKey: string): Promise<void> {
  await delay();
  const normalizedKey = normalizeKey(templateKey);
  const before = state.templates.length;
  state.templates = state.templates.filter((item) => item.templateKey !== normalizedKey);
  if (state.templates.length === before) {
    throw new Error('Email template not found');
  }
}
