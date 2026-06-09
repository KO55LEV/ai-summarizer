import data from '../data/billingRules.json';
import { delay } from './delay';
import type {
  BillingRuleInput,
  BillingRuleResponse,
  BillingRuleUpdateInput,
} from '../../api/adminBillingRules';

type BillingRuleDataFile = {
  rules: BillingRuleResponse[];
};

const state = structuredClone(data) as BillingRuleDataFile;

function cloneRule(rule: BillingRuleResponse): BillingRuleResponse {
  return structuredClone(rule);
}

function normalize(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export async function getMockBillingRules(): Promise<BillingRuleResponse[]> {
  await delay();
  return state.rules.map(cloneRule);
}

export async function getMockBillingRuleById(ruleId: string): Promise<BillingRuleResponse> {
  await delay();
  const rule = state.rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error('Billing rule not found');
  return cloneRule(rule);
}

export async function createMockBillingRule(input: BillingRuleInput): Promise<BillingRuleResponse> {
  await delay();
  const now = new Date().toISOString();
  const rule: BillingRuleResponse = {
    id: `mock-${crypto.randomUUID()}`,
    actionType: input.actionType.trim(),
    provider: normalize(input.provider),
    model: normalize(input.model),
    version: input.version,
    unitType: input.unitType.trim(),
    baseFeeCredits: input.baseFeeCredits,
    ratePerUnitCredits: input.ratePerUnitCredits,
    minCredits: input.minCredits,
    maxCredits: input.maxCredits,
    multiplier: input.multiplier,
    isActive: input.isActive,
    effectiveFrom: input.effectiveFrom,
    createdAt: now,
    updatedAt: now,
  };
  state.rules.unshift(rule);
  return cloneRule(rule);
}

export async function updateMockBillingRule(ruleId: string, input: BillingRuleUpdateInput): Promise<BillingRuleResponse> {
  await delay();
  const index = state.rules.findIndex((item) => item.id === ruleId);
  if (index < 0) throw new Error('Billing rule not found');
  const updated: BillingRuleResponse = {
    id: ruleId,
    actionType: input.actionType.trim(),
    provider: normalize(input.provider),
    model: normalize(input.model),
    version: input.version,
    unitType: input.unitType.trim(),
    baseFeeCredits: input.baseFeeCredits,
    ratePerUnitCredits: input.ratePerUnitCredits,
    minCredits: input.minCredits,
    maxCredits: input.maxCredits,
    multiplier: input.multiplier,
    isActive: input.isActive,
    effectiveFrom: input.effectiveFrom,
    createdAt: state.rules[index].createdAt,
    updatedAt: new Date().toISOString(),
  };
  state.rules[index] = updated;
  return cloneRule(updated);
}

export async function deleteMockBillingRule(ruleId: string): Promise<void> {
  await delay();
  state.rules = state.rules.filter((item) => item.id !== ruleId);
}
