import type {
  AdminSettingsResponse,
  UpdateAdminSettingsInput,
} from '../../api/adminSettings';
import { delay } from './delay';

const state: AdminSettingsResponse = {
  email: {
    provider: 'Brevo',
    defaultFromEmail: 'no-reply@example.com',
    defaultFromName: 'AiSummarizer',
  },
  transcribe: {
    provider: 'Whisper',
  },
};

export async function getMockAdminSettings(): Promise<AdminSettingsResponse> {
  await delay();
  return structuredClone(state);
}

export async function updateMockAdminSettings(input: UpdateAdminSettingsInput): Promise<AdminSettingsResponse> {
  await delay();
  state.email = {
    provider: input.email.provider.trim(),
    defaultFromEmail: input.email.defaultFromEmail.trim(),
    defaultFromName: input.email.defaultFromName?.trim() || null,
  };
  state.transcribe = {
    provider: input.transcribe.provider.trim(),
  };
  return structuredClone(state);
}
