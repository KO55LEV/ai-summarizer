import data from '../data/prompts.json';
import { delay } from './delay';
import type {
  PromptArchiveResponse,
  PromptInput,
  PromptResponse,
  PromptRunResponse,
  PromptRunUsageResponse,
  PromptUpdateInput,
} from '../../api/prompts';

type PromptSeed = PromptResponse;

type PromptDataFile = {
  prompts: PromptSeed[];
  archives: Record<string, PromptArchiveResponse[]>;
  runs: Record<string, PromptRunResponse[]>;
  usage: Record<string, PromptRunUsageResponse>;
};

const state = structuredClone(data) as PromptDataFile;

function clonePrompt(prompt: PromptSeed): PromptResponse {
  return structuredClone(prompt);
}

function archivePrompt(prompt: PromptSeed, reason: string): void {
  const archiveList = state.archives[prompt.id] ?? [];
  const nextVersion = archiveList.length > 0 ? Math.max(...archiveList.map((item) => item.archiveVersion)) + 1 : 1;

  archiveList.unshift({
    id: `archive-${prompt.id}-${nextVersion}`,
    promptId: prompt.id,
    archiveVersion: nextVersion,
    archiveReason: reason,
    promptKey: prompt.promptKey,
    title: prompt.title,
    description: prompt.description,
    workflowType: prompt.workflowType,
    provider: prompt.provider,
    model: prompt.model,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    isActive: prompt.isActive,
    archivedAt: new Date().toISOString(),
    sourceUpdatedAt: prompt.updatedAt,
  });

  state.archives[prompt.id] = archiveList;
}

export async function getMockPrompts(limit = 100, offset = 0): Promise<PromptResponse[]> {
  await delay();
  return state.prompts.slice(offset, offset + limit).map(clonePrompt);
}

export async function getMockPromptById(promptId: string): Promise<PromptResponse> {
  await delay();
  const prompt = state.prompts.find((item) => item.id === promptId);
  if (!prompt) throw new Error('Prompt not found');
  return clonePrompt(prompt);
}

export async function createMockPrompt(input: PromptInput): Promise<PromptResponse> {
  await delay();
  const now = new Date().toISOString();
  const prompt: PromptResponse = {
    id: `mock-${crypto.randomUUID()}`,
    promptKey: input.promptKey.trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    workflowType: input.workflowType?.trim() || null,
    provider: input.provider.trim().toLowerCase(),
    model: input.model.trim(),
    systemPrompt: input.systemPrompt.trim(),
    userPrompt: input.userPrompt.trim(),
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  state.prompts.unshift(prompt);
  state.archives[prompt.id] = [];
  state.runs[prompt.id] = [];
  state.usage[prompt.id] = {
    promptId: prompt.id,
    totalRuns: 0,
    succeededRuns: 0,
    failedRuns: 0,
    runningRuns: 0,
    lastRunAt: null,
    lastStatus: null,
  };

  return clonePrompt(prompt);
}

export async function updateMockPrompt(promptId: string, input: PromptUpdateInput): Promise<PromptResponse> {
  await delay();
  const index = state.prompts.findIndex((item) => item.id === promptId);
  if (index < 0) throw new Error('Prompt not found');

  const existing = state.prompts[index];
  archivePrompt(existing, 'Updated from admin UI');

  const updated: PromptResponse = {
    ...existing,
    promptKey: input.promptKey.trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    workflowType: input.workflowType?.trim() || null,
    provider: input.provider.trim().toLowerCase(),
    model: input.model.trim(),
    systemPrompt: input.systemPrompt.trim(),
    userPrompt: input.userPrompt.trim(),
    isActive: input.isActive,
    updatedAt: new Date().toISOString(),
  };

  state.prompts[index] = updated;
  return clonePrompt(updated);
}

export async function deleteMockPrompt(promptId: string): Promise<void> {
  await delay();
  state.prompts = state.prompts.filter((item) => item.id !== promptId);
  delete state.archives[promptId];
  delete state.runs[promptId];
  delete state.usage[promptId];
}

export async function getMockPromptArchives(promptId: string, limit = 100, offset = 0): Promise<PromptArchiveResponse[]> {
  await delay();
  return (state.archives[promptId] ?? []).slice(offset, offset + limit).map((item) => structuredClone(item));
}

export async function getMockPromptRuns(promptId: string, limit = 100, offset = 0): Promise<PromptRunResponse[]> {
  await delay();
  return (state.runs[promptId] ?? []).slice(offset, offset + limit).map((item) => structuredClone(item));
}

export async function getMockPromptUsage(promptId: string): Promise<PromptRunUsageResponse> {
  await delay();
  const usage = state.usage[promptId];
  if (!usage) {
    return {
      promptId,
      totalRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
      runningRuns: 0,
      lastRunAt: null,
      lastStatus: null,
    };
  }

  return structuredClone(usage);
}
