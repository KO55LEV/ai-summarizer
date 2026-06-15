import { delay } from './delay';
import type { ReasoningChatInput, ReasoningChatResponse } from '../../api/reasoning';

const PROVIDERS = ['OpenRouter', 'GoogleVertex', 'InceptionLabs', 'Ollama'] as const;

export function getMockReasoningProviders(): string[] {
  return [...PROVIDERS];
}

function buildEchoText(input: ReasoningChatInput): string {
  const userMessage = input.userPrompt?.trim() || input.messages?.find((message) => message.role.toLowerCase() === 'user')?.content?.trim() || '';
  const systemMessage = input.systemPrompt?.trim() || input.messages?.find((message) => message.role.toLowerCase() === 'system')?.content?.trim() || '';

  return [
    `Mock response from ${input.provider}`,
    input.model ? `Model: ${input.model}` : null,
    systemMessage ? `System: ${systemMessage}` : null,
    userMessage ? `User: ${userMessage}` : null,
  ].filter(Boolean).join('\n');
}

export async function runMockReasoningChat(input: ReasoningChatInput): Promise<ReasoningChatResponse> {
  await delay();
  const model = (input.model?.trim() || 'mock-model').trim();
  const text = buildEchoText(input);
  const raw = {
    id: `mock-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: text,
        },
      },
    ],
    usage: {
      prompt_tokens: 42,
      completion_tokens: 24,
      total_tokens: 66,
    },
  };

  return {
    provider: input.provider,
    model,
    text,
    finishReason: 'stop',
    usage: {
      promptTokens: 42,
      completionTokens: 24,
      totalTokens: 66,
    },
    rawResponseJson: JSON.stringify(raw, null, 2),
  };
}
