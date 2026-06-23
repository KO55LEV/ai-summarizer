import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  Archive,
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock3,
  Database,
  Filter,
  KeyRound,
  Layers3,
  PenSquare,
  Plus,
  PanelTop,
  RefreshCw,
  Search,
  Server,
  Shield,
  Sparkles,
  Settings2,
  Trash2,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
import type {
  BillingRuleInput,
  BillingRuleResponse,
  BillingRuleUpdateInput,
} from '../../api/adminBillingRules';
import {
  createBillingRule,
  deleteBillingRule,
  listBillingRules,
  updateBillingRule,
} from '../../api/adminBillingRules';
import type {
  BillingBalanceResponse,
  BillingLedgerEntryResponse,
  BillingReservationResponse,
} from '../../api/adminBilling';
import {
  getBillingBalance,
  listBillingLedger,
  listBillingReservations,
  topUpBillingBalance,
} from '../../api/adminBilling';
import type { WorkflowCostResponse } from '../../api/adminWorkflowCosts';
import { listWorkflowCosts } from '../../api/adminWorkflowCosts';
import type { WorkflowEventResponse } from '../../api/adminWorkflows';
import { getWorkflowEvents, getWorkflowSteps, listActiveWorkflows, listHistoryWorkflows, requestWorkflowCancel } from '../../api/adminWorkflows';
import type { JobLogResponse, JobResponse } from '../../api/adminJobs';
import { getJobLogs, listActiveJobs, listHistoryJobs } from '../../api/adminJobs';
import type {
  PromptArchiveResponse,
  PromptResponse,
  PromptRunResponse,
  PromptRunUsageResponse,
  PromptUpdateInput,
} from '../../api/prompts';
import {
  createPrompt,
  deletePrompt,
  getPromptUsage,
  listPromptArchives,
  listPromptRuns,
  listPrompts,
  updatePrompt,
} from '../../api/prompts';
import type {
  SearchProviderResponse,
  SearchProviderUpdateInput,
  SearchProviderUsageResponse,
} from '../../api/searchProviders';
import {
  createSearchProvider,
  deleteSearchProvider,
  getSearchProviderUsage,
  listSearchProviders,
  updateSearchProvider,
} from '../../api/searchProviders';
import type {
  AdminSettingsResponse,
  UpdateAdminSettingsInput,
} from '../../api/adminSettings';
import {
  getAdminSettings,
  updateAdminSettings,
} from '../../api/adminSettings';
import type {
  AdminRoleResponse,
  AdminUserResponse,
  UpdateAdminUserInput,
} from '../../api/adminUsers';
import {
  getAdminRoles,
  getAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '../../api/adminUsers';
import type {
  CreateEmailTemplateInput,
  EmailTemplateResponse,
  UpdateEmailTemplateInput,
} from '../../api/adminEmailTemplates';
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  updateEmailTemplate,
} from '../../api/adminEmailTemplates';
import type { WorkflowResponse, WorkflowStepResponse } from '../../types';
import AdminLlmLabPanel from './AdminLlmLabPanel';

type AdminSection = 'users' | 'billing' | 'prompts' | 'llm-lab' | 'search-providers' | 'runtime-settings' | 'email-templates' | 'billing-rules' | 'workflow-costs';
type WorkflowCostStatusFilter = 'all' | 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled' | 'dead';
type PromptTab = 'editor' | 'runs' | 'archive' | 'usage';
type ProviderTab = 'editor' | 'usage';
type WorkflowHostKind = 'active' | 'history' | 'cost';
type WorkflowHostSelection = string | null;
type JobStatusFilter = 'all' | 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled' | 'dead';
type JobSelection = string | null;

interface WorkflowHostRow {
  kind: WorkflowHostKind;
  workflowId: string;
  requestedByUserId: string | null;
  requestedByUserEmail: string | null;
  requestedByUserDisplayName: string | null;
  workflowType: string;
  workflowStatus: string;
  sourceId: string | null;
  sourceLabel: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progressPercent: number | null;
  progressMessage: string | null;
  currentStepKey: string | null;
  attemptCount: number | null;
  maxAttempts: number | null;
  lockedBy: string | null;
  lockedAt: string | null;
  lockedUntil: string | null;
  heartbeatAt: string | null;
  estimatedCredits: number | null;
  finalCredits: number | null;
  reservationStatus: string | null;
  sourceType: string | null;
  reason: string | null;
  diagnosticProvider: string | null;
  diagnosticMessage: string | null;
}

interface JobHostRow {
  jobId: string;
  parentJobId: string | null;
  requestedByUserId: string | null;
  jobType: string;
  jobStatus: string;
  priority: number;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  progressPercent: number | null;
  progressMessage: string | null;
  availableAt: string;
  lockedBy: string | null;
  lockedAt: string | null;
  lockedUntil: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  cancelRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorDetails: Record<string, unknown> | null;
}

interface AdminPageProps {
  initialSection: AdminSection;
  initialSelectedWorkflowId?: string | null;
  onSectionChange: (section: AdminSection) => void;
  onBackToApp: () => void;
}

interface AdminUserFormState {
  email: string;
  displayName: string;
  avatarUrl: string;
  locale: string;
  timeZone: string;
  status: string;
  roles: string[];
}

interface PromptFormState {
  promptKey: string;
  title: string;
  description: string;
  workflowType: string;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
}

interface ProviderFormState {
  provider: string;
  apiKey: string;
  quotaPerMonth: string;
  note: string;
  isActive: boolean;
}

interface RuntimeSettingsFormState {
  emailProvider: string;
  emailFromEmail: string;
  emailFromName: string;
  transcribeProvider: string;
}

interface EmailTemplateFormState {
  templateKey: string;
  title: string;
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  isActive: boolean;
}

interface BillingRuleFormState {
  actionType: string;
  provider: string;
  model: string;
  version: string;
  unitType: string;
  baseFeeCredits: string;
  ratePerUnitCredits: string;
  minCredits: string;
  maxCredits: string;
  multiplier: string;
  isActive: boolean;
  effectiveFrom: string;
}

interface BillingTopUpFormState {
  credits: string;
  reason: string;
}

const EMPTY_PROMPT_FORM: PromptFormState = {
  promptKey: 'admin.new.prompt',
  title: 'New prompt',
  description: '',
  workflowType: '',
  provider: 'openai',
  model: 'gpt-4.1-mini',
  systemPrompt: 'You are a precise assistant. Follow the instructions exactly.',
  userPrompt: '',
  isActive: true,
};

const EMPTY_PROVIDER_FORM: ProviderFormState = {
  provider: 'Tavily',
  apiKey: 'tvly-mock-key-new',
  quotaPerMonth: '50000',
  note: '',
  isActive: true,
};

const EMPTY_RUNTIME_SETTINGS_FORM: RuntimeSettingsFormState = {
  emailProvider: 'Brevo',
  emailFromEmail: 'no-reply@example.com',
  emailFromName: 'AiSummarizer',
  transcribeProvider: 'Whisper',
};

const EMPTY_EMAIL_TEMPLATE_FORM: EmailTemplateFormState = {
  templateKey: 'email.new.template',
  title: 'New email template',
  description: '',
  subject: 'Subject line',
  htmlBody: '',
  textBody: '',
  isActive: true,
};

const EMPTY_BILLING_RULE_FORM: BillingRuleFormState = {
  actionType: 'youtube.transcript',
  provider: 'Whisper',
  model: 'whisper-large-v3',
  version: '1',
  unitType: 'minute',
  baseFeeCredits: '0',
  ratePerUnitCredits: '0',
  minCredits: '0',
  maxCredits: '',
  multiplier: '1',
  isActive: true,
  effectiveFrom: new Date().toISOString().slice(0, 16),
};

const EMPTY_BILLING_TOPUP_FORM: BillingTopUpFormState = {
  credits: '50',
  reason: 'Manual top up',
};

const EMPTY_USER_FORM: AdminUserFormState = {
  email: '',
  displayName: '',
  avatarUrl: '',
  locale: '',
  timeZone: '',
  status: 'active',
  roles: [],
};

function normalizeMaybe(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDateTimeLocalValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatQuota(value: number): string {
  return value.toLocaleString();
}

function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function promptToForm(prompt: PromptResponse): PromptFormState {
  return {
    promptKey: prompt.promptKey,
    title: prompt.title,
    description: prompt.description ?? '',
    workflowType: prompt.workflowType ?? '',
    provider: prompt.provider,
    model: prompt.model,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    isActive: prompt.isActive,
  };
}

function providerToForm(provider: SearchProviderResponse): ProviderFormState {
  return {
    provider: provider.provider,
    apiKey: provider.apiKey,
    quotaPerMonth: String(provider.quotaPerMonth),
    note: provider.note ?? '',
    isActive: provider.isActive,
  };
}

function templateToForm(template: EmailTemplateResponse): EmailTemplateFormState {
  return {
    templateKey: template.templateKey,
    title: template.title,
    description: template.description ?? '',
    subject: template.subject,
    htmlBody: template.htmlBody ?? '',
    textBody: template.textBody ?? '',
    isActive: template.isActive,
  };
}

function userToForm(user: AdminUserResponse): AdminUserFormState {
  return {
    email: user.email,
    displayName: user.displayName ?? '',
    avatarUrl: user.avatarUrl ?? '',
    locale: user.locale ?? '',
    timeZone: user.timeZone ?? '',
    status: user.status,
    roles: [...user.roles],
  };
}

function settingsToForm(settings: AdminSettingsResponse): RuntimeSettingsFormState {
  return {
    emailProvider: settings.email.provider,
    emailFromEmail: settings.email.defaultFromEmail,
    emailFromName: settings.email.defaultFromName ?? '',
    transcribeProvider: settings.transcribe.provider,
  };
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'muted' }) {
  const className =
    tone === 'accent'
      ? 'bg-accent/12 text-accent border-accent/20'
      : tone === 'muted'
        ? 'bg-bg-input text-text-muted border-border'
        : 'bg-bg-input text-text-secondary border-border';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${className}`}>
      {children}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-accent' : 'bg-bg-input border border-border'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</span>
        {helper && <span className="text-[10px] text-text-muted">{helper}</span>}
      </div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/60 focus:bg-bg-card disabled:cursor-not-allowed disabled:opacity-70`}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  minHeight = 'min-h-[140px]',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/60 focus:bg-bg-card disabled:cursor-not-allowed disabled:opacity-70 ${minHeight}`}
    />
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-accent/20 bg-accent/10' : 'border-border bg-bg-card/85'}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</div>
        <div className={accent ? 'text-accent' : 'text-text-muted'}>{icon}</div>
      </div>
      <div className="mt-4 text-[28px] font-bold leading-none text-text-primary">{value}</div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-bg-input/30 px-4 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-bg-card text-accent">
        {icon}
      </div>
      <div className="text-[13px] font-semibold text-text-primary">{title}</div>
      <div className="mt-1 text-[11px] text-text-muted">{description}</div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_34%),linear-gradient(180deg,_#0c1221_0%,_#0a1020_100%)]">
      <div className="flex h-full animate-pulse">
        <div className="w-[250px] shrink-0 border-r border-border/70 bg-bg-secondary/60 p-4">
          <div className="h-8 w-36 rounded-lg bg-bg-card/80 mb-6" />
          <div className="space-y-2">
            <div className="h-10 rounded-lg bg-bg-card/80" />
            <div className="h-10 rounded-lg bg-bg-card/80" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="h-8 w-64 rounded bg-bg-card mb-3" />
          <div className="h-4 w-96 rounded bg-bg-card mb-6" />
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl border border-border bg-bg-card" />)}
          </div>
          <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4">
            <div className="h-[560px] rounded-2xl border border-border bg-bg-card" />
            <div className="h-[560px] rounded-2xl border border-border bg-bg-card" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AdminPage({ initialSection, initialSelectedWorkflowId, onSectionChange, onBackToApp }: AdminPageProps) {
  const [section, setSection] = useState<AdminSection>(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<AdminUserFormState>(EMPTY_USER_FORM);
  const [userRoles, setUserRoles] = useState<AdminRoleResponse[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'disabled' | 'deleted'>('all');
  const [userMode, setUserMode] = useState<'view' | 'new'>('view');

  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [promptTab, setPromptTab] = useState<PromptTab>('editor');
  const [promptForm, setPromptForm] = useState<PromptFormState>(EMPTY_PROMPT_FORM);
  const [promptArchives, setPromptArchives] = useState<PromptArchiveResponse[]>([]);
  const [promptRuns, setPromptRuns] = useState<PromptRunResponse[]>([]);
  const [promptUsage, setPromptUsage] = useState<PromptRunUsageResponse | null>(null);
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptDetailLoading, setPromptDetailLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSearch, setPromptSearch] = useState('');
  const [promptStatusFilter, setPromptStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [promptMode, setPromptMode] = useState<'view' | 'new'>('view');

  const [providers, setProviders] = useState<SearchProviderResponse[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerTab, setProviderTab] = useState<ProviderTab>('editor');
  const [providerForm, setProviderForm] = useState<ProviderFormState>(EMPTY_PROVIDER_FORM);
  const [providerUsage, setProviderUsage] = useState<SearchProviderUsageResponse | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerDetailLoading, setProviderDetailLoading] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSearch, setProviderSearch] = useState('');
  const [providerStatusFilter, setProviderStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [providerMode, setProviderMode] = useState<'view' | 'new'>('view');

  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettingsFormState>(EMPTY_RUNTIME_SETTINGS_FORM);
  const [runtimeSettingsLoading, setRuntimeSettingsLoading] = useState(true);
  const [runtimeSettingsSaving, setRuntimeSettingsSaving] = useState(false);
  const [runtimeSettingsError, setRuntimeSettingsError] = useState<string | null>(null);

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateResponse[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [emailTemplateForm, setEmailTemplateForm] = useState<EmailTemplateFormState>(EMPTY_EMAIL_TEMPLATE_FORM);
  const [emailTemplateLoading, setEmailTemplateLoading] = useState(true);
  const [emailTemplateSaving, setEmailTemplateSaving] = useState(false);
  const [emailTemplateError, setEmailTemplateError] = useState<string | null>(null);
  const [emailTemplateSearch, setEmailTemplateSearch] = useState('');
  const [emailTemplateStatusFilter, setEmailTemplateStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [emailTemplateMode, setEmailTemplateMode] = useState<'view' | 'new'>('view');

  const [billingRules, setBillingRules] = useState<BillingRuleResponse[]>([]);
  const [selectedBillingRuleId, setSelectedBillingRuleId] = useState<string | null>(null);
  const [billingRuleForm, setBillingRuleForm] = useState<BillingRuleFormState>(EMPTY_BILLING_RULE_FORM);
  const [billingRuleLoading, setBillingRuleLoading] = useState(true);
  const [billingRuleDetailLoading, setBillingRuleDetailLoading] = useState(false);
  const [billingRuleSaving, setBillingRuleSaving] = useState(false);
  const [billingRuleError, setBillingRuleError] = useState<string | null>(null);
  const [billingRuleSearch, setBillingRuleSearch] = useState('');
  const [billingRuleStatusFilter, setBillingRuleStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [billingRuleMode, setBillingRuleMode] = useState<'view' | 'new'>('view');

  const [billingUsers, setBillingUsers] = useState<AdminUserResponse[]>([]);
  const [selectedBillingUserId, setSelectedBillingUserId] = useState<string | null>(null);
  const [billingBalance, setBillingBalance] = useState<BillingBalanceResponse | null>(null);
  const [billingLedger, setBillingLedger] = useState<BillingLedgerEntryResponse[]>([]);
  const [billingReservations, setBillingReservations] = useState<BillingReservationResponse[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingDetailLoading, setBillingDetailLoading] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingUserSearch, setBillingUserSearch] = useState('');
  const [billingUserStatusFilter, setBillingUserStatusFilter] = useState<'all' | 'active' | 'disabled' | 'deleted'>('all');
  const [billingTopUpForm, setBillingTopUpForm] = useState<BillingTopUpFormState>(EMPTY_BILLING_TOPUP_FORM);

  const [workflowCosts, setWorkflowCosts] = useState<WorkflowCostResponse[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowResponse[]>([]);
  const [historyWorkflows, setHistoryWorkflows] = useState<WorkflowResponse[]>([]);
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<WorkflowHostSelection>(null);
  const [workflowCostsLoading, setWorkflowCostsLoading] = useState(true);
  const [workflowHostLoading, setWorkflowHostLoading] = useState(true);
  const [workflowCostsError, setWorkflowCostsError] = useState<string | null>(null);
  const [workflowHostError, setWorkflowHostError] = useState<string | null>(null);
  const [workflowCostSearch, setWorkflowCostSearch] = useState('');
  const [workflowCostStatusFilter, setWorkflowCostStatusFilter] = useState<WorkflowCostStatusFilter>('all');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepResponse[]>([]);
  const [selectedWorkflowStepId, setSelectedWorkflowStepId] = useState<string | null>(null);
  const [workflowEventScope, setWorkflowEventScope] = useState<'step' | 'all'>('step');
  const [workflowStepsLoading, setWorkflowStepsLoading] = useState(false);
  const [workflowStepsError, setWorkflowStepsError] = useState<string | null>(null);
  const [workflowStepJobLogs, setWorkflowStepJobLogs] = useState<JobLogResponse[]>([]);
  const [workflowStepJobLogsLoading, setWorkflowStepJobLogsLoading] = useState(false);
  const [workflowStepJobLogsError, setWorkflowStepJobLogsError] = useState<string | null>(null);
  const [workflowCanceling, setWorkflowCanceling] = useState(false);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEventResponse[]>([]);
  const [workflowEventsLoading, setWorkflowEventsLoading] = useState(false);
  const [workflowEventsError, setWorkflowEventsError] = useState<string | null>(null);
  const [workflowRefreshNonce, setWorkflowRefreshNonce] = useState(0);
  const [jobsActive, setJobsActive] = useState<JobResponse[]>([]);
  const [jobsHistory, setJobsHistory] = useState<JobResponse[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<JobSelection>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusFilter>('all');
  const [jobLogs, setJobLogs] = useState<JobLogResponse[]>([]);
  const [jobLogsLoading, setJobLogsLoading] = useState(false);
  const [jobLogsError, setJobLogsError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSection === 'workflow-costs' && initialSelectedWorkflowId) {
      setSelectedWorkflowKey(initialSelectedWorkflowId);
    }
  }, [initialSection, initialSelectedWorkflowId]);

  const changeSection = (nextSection: AdminSection) => {
    setSection(nextSection);
    onSectionChange(nextSection);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [items, roles] = await Promise.all([listAdminUsers(''), getAdminRoles()]);
        if (!mounted) return;

        setUsers(items);
        setBillingUsers(items);
        setUserRoles(roles);
        if (items.length > 0) {
          setSelectedUserId(items[0].id);
        }
      } catch (err) {
        if (!mounted) return;
        setUserError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        if (mounted) setUserLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const items = await listBillingRules();
        if (!mounted) return;

        setBillingRules(items);
        if (items.length > 0) {
          setSelectedBillingRuleId(items[0].id);
        } else {
          setBillingRuleMode('new');
          setBillingRuleForm(EMPTY_BILLING_RULE_FORM);
        }
      } catch (err) {
        if (!mounted) return;
        setBillingRuleError(err instanceof Error ? err.message : 'Failed to load billing rules');
      } finally {
        if (mounted) setBillingRuleLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const items = await listEmailTemplates('');
        if (!mounted) return;

        setEmailTemplates(items);
        if (items.length > 0) {
          setSelectedTemplateKey(items[0].templateKey);
        } else {
          setSelectedTemplateKey(null);
          setEmailTemplateMode('new');
          setEmailTemplateForm(EMPTY_EMAIL_TEMPLATE_FORM);
        }
      } catch (err) {
        if (!mounted) return;
        setEmailTemplateError(err instanceof Error ? err.message : 'Failed to load email templates');
      } finally {
        if (mounted) setEmailTemplateLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const items = await listPrompts(100, 0);
        if (!mounted) return;

        setPrompts(items);
        if (items.length > 0) {
          setSelectedPromptId(items[0].id);
        } else {
          setPromptMode('new');
          setPromptForm(EMPTY_PROMPT_FORM);
        }
      } catch (err) {
        if (!mounted) return;
        setPromptError(err instanceof Error ? err.message : 'Failed to load prompts');
      } finally {
        if (mounted) setPromptLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const settings = await getAdminSettings();
        if (!mounted) return;
        setRuntimeSettings(settingsToForm(settings));
      } catch (err) {
        if (!mounted) return;
        setRuntimeSettingsError(err instanceof Error ? err.message : 'Failed to load runtime settings');
      } finally {
        if (mounted) setRuntimeSettingsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const items = await listSearchProviders(100, 0);
        if (!mounted) return;

        setProviders(items);
        if (items.length > 0) {
          setSelectedProviderId(items[0].id);
        } else {
          setProviderMode('new');
          setProviderForm(EMPTY_PROVIDER_FORM);
        }
      } catch (err) {
        if (!mounted) return;
        setProviderError(err instanceof Error ? err.message : 'Failed to load search providers');
      } finally {
        if (mounted) setProviderLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (promptMode === 'new') {
      setPromptArchives([]);
      setPromptRuns([]);
      setPromptUsage(null);
      return;
    }

    if (!selectedPromptId) return;
    const item = prompts.find((p) => p.id === selectedPromptId);
    if (item) setPromptForm(promptToForm(item));
  }, [promptMode, selectedPromptId, prompts]);

  useEffect(() => {
    if (providerMode === 'new') {
      setProviderUsage(null);
      return;
    }

    if (!selectedProviderId) return;
    const item = providers.find((p) => p.id === selectedProviderId);
    if (item) setProviderForm(providerToForm(item));
  }, [providerMode, selectedProviderId, providers]);

  useEffect(() => {
    if (promptMode === 'new' || !selectedPromptId) return;

    let cancelled = false;
    setPromptDetailLoading(true);
    Promise.all([
      listPromptArchives(selectedPromptId, 100, 0),
      listPromptRuns(selectedPromptId, 100, 0),
      getPromptUsage(selectedPromptId),
    ])
      .then(([archives, runs, usage]) => {
        if (cancelled) return;
        setPromptArchives(archives);
        setPromptRuns(runs);
        setPromptUsage(usage);
      })
      .catch((err) => {
        if (!cancelled) setPromptError(err instanceof Error ? err.message : 'Failed to load prompt details');
      })
      .finally(() => {
        if (!cancelled) setPromptDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [promptMode, selectedPromptId]);

  useEffect(() => {
    if (providerMode === 'new' || !selectedProviderId) return;

    let cancelled = false;
    setProviderDetailLoading(true);
    getSearchProviderUsage(selectedProviderId)
      .then((usage) => {
        if (!cancelled) setProviderUsage(usage);
      })
      .catch((err) => {
        if (!cancelled) setProviderError(err instanceof Error ? err.message : 'Failed to load provider usage');
      })
      .finally(() => {
        if (!cancelled) setProviderDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providerMode, selectedProviderId]);

  useEffect(() => {
    if (emailTemplateMode === 'new') {
      setEmailTemplateForm(EMPTY_EMAIL_TEMPLATE_FORM);
      return;
    }

    if (!selectedTemplateKey) return;
    const item = emailTemplates.find((template) => template.templateKey === selectedTemplateKey);
    if (item) {
      setEmailTemplateForm(templateToForm(item));
    }
  }, [emailTemplateMode, selectedTemplateKey, emailTemplates]);

  useEffect(() => {
    if (billingRuleMode === 'new') {
      setBillingRuleForm(EMPTY_BILLING_RULE_FORM);
      setBillingRuleDetailLoading(false);
      return;
    }

    if (!selectedBillingRuleId) return;
    setBillingRuleDetailLoading(true);
    const item = billingRules.find((rule) => rule.id === selectedBillingRuleId);
    if (item) {
      setBillingRuleForm({
        actionType: item.actionType,
        provider: item.provider ?? '',
        model: item.model ?? '',
        version: String(item.version),
        unitType: item.unitType,
        baseFeeCredits: String(item.baseFeeCredits),
        ratePerUnitCredits: String(item.ratePerUnitCredits),
        minCredits: String(item.minCredits),
        maxCredits: item.maxCredits === null ? '' : String(item.maxCredits),
        multiplier: String(item.multiplier),
        isActive: item.isActive,
        effectiveFrom: formatDateTimeLocalValue(item.effectiveFrom),
      });
    }
    setBillingRuleDetailLoading(false);
  }, [billingRuleMode, selectedBillingRuleId, billingRules]);

  useEffect(() => {
    if (section !== 'billing') {
      return;
    }

    if (billingUsers.length === 0) {
      setSelectedBillingUserId(null);
      setBillingBalance(null);
      setBillingLedger([]);
      setBillingReservations([]);
      setBillingLoading(false);
      return;
    }

    if (!selectedBillingUserId || !billingUsers.some((item) => item.id === selectedBillingUserId)) {
      setSelectedBillingUserId(billingUsers[0].id);
    }
  }, [section, billingUsers, selectedBillingUserId]);

  useEffect(() => {
    if (section !== 'billing' || !selectedBillingUserId) {
      setBillingLoading(false);
      return;
    }

    let cancelled = false;
    setBillingError(null);
    setBillingDetailLoading(true);
    setBillingLoading(true);

    Promise.all([
      getBillingBalance(selectedBillingUserId),
      listBillingLedger(selectedBillingUserId, 50, 0),
      listBillingReservations(selectedBillingUserId, 50, 0),
    ])
      .then(([balance, ledger, reservations]) => {
        if (cancelled) return;
        setBillingBalance(balance);
        setBillingLedger(ledger);
        setBillingReservations(reservations);
      })
      .catch((err) => {
        if (!cancelled) setBillingError(err instanceof Error ? err.message : 'Failed to load billing details');
      })
      .finally(() => {
        if (!cancelled) {
          setBillingDetailLoading(false);
          setBillingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, selectedBillingUserId]);

  useEffect(() => {
    if (section !== 'workflow-costs') {
      setWorkflowCostsLoading(false);
      setWorkflowHostLoading(false);
      return;
    }

    let cancelled = false;
    setWorkflowCostsError(null);
    setWorkflowHostError(null);
    setWorkflowCostsLoading(true);
    setWorkflowHostLoading(true);

    Promise.all([
      listWorkflowCosts(100, 0),
      listActiveWorkflows(100, 0),
      listHistoryWorkflows(100, 0),
    ])
      .then(([items, activeItems, historyItems]) => {
        if (cancelled) return;
        setWorkflowCosts(items);
        setActiveWorkflows(activeItems);
        setHistoryWorkflows(historyItems);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load workflows';
          setWorkflowCostsError(message);
          setWorkflowHostError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowCostsLoading(false);
          setWorkflowHostLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section]);

  useEffect(() => {
    if (section !== 'workflow-costs' || !selectedWorkflowKey) {
      setWorkflowEvents([]);
      setWorkflowEventsError(null);
      setWorkflowEventsLoading(false);
      return;
    }

    const selectedWorkflowId = selectedWorkflowKey;
    let cancelled = false;
    setWorkflowEventsError(null);
    setWorkflowEventsLoading(true);

    getWorkflowEvents(selectedWorkflowId, 100, 0)
      .then((items) => {
        if (!cancelled) {
          setWorkflowEvents(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWorkflowEventsError(err instanceof Error ? err.message : 'Failed to load workflow events');
          setWorkflowEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowEventsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, selectedWorkflowKey, workflowRefreshNonce, workflowCosts, activeWorkflows, historyWorkflows]);

  useEffect(() => {
    const currentWorkflow = selectedWorkflowKey
      ? workflowHostRows.find((item) => workflowKey(item) === selectedWorkflowKey) ?? null
      : null;

    if (section !== 'workflow-costs' || !currentWorkflow) {
      setWorkflowSteps([]);
      setSelectedWorkflowStepId(null);
      setWorkflowStepsError(null);
      setWorkflowStepsLoading(false);
      return;
    }

    const selectedWorkflowId = currentWorkflow.workflowId;
    let cancelled = false;
    setWorkflowStepsError(null);
    setWorkflowStepsLoading(true);

    getWorkflowSteps(selectedWorkflowId)
      .then((items) => {
        if (cancelled) {
          return;
        }

        setWorkflowSteps(items);
        setSelectedWorkflowStepId((current) => {
          if (current && items.some((item) => item.id === current)) {
            return current;
          }

          const preferredStep =
            items.find((item) => item.stepKey === currentWorkflow.currentStepKey) ??
            [...items].sort((a, b) => b.stepOrder - a.stepOrder)[0] ??
            null;

          return preferredStep?.id ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setWorkflowStepsError(err instanceof Error ? err.message : 'Failed to load workflow steps');
          setWorkflowSteps([]);
          setSelectedWorkflowStepId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowStepsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, selectedWorkflowKey, workflowRefreshNonce, workflowCosts, activeWorkflows, historyWorkflows]);

  const selectedWorkflowStep = selectedWorkflowStepId
    ? workflowSteps.find((item) => item.id === selectedWorkflowStepId) ?? null
    : null;

  useEffect(() => {
    if (section !== 'workflow-costs' || !selectedWorkflowStep?.jobId) {
      setWorkflowStepJobLogs([]);
      setWorkflowStepJobLogsError(null);
      setWorkflowStepJobLogsLoading(false);
      return;
    }

    const jobId = selectedWorkflowStep.jobId;
    let cancelled = false;
    setWorkflowStepJobLogsError(null);
    setWorkflowStepJobLogsLoading(true);

    getJobLogs(jobId, 100, 0)
      .then((items) => {
        if (!cancelled) {
          setWorkflowStepJobLogs(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWorkflowStepJobLogsError(err instanceof Error ? err.message : 'Failed to load job logs');
          setWorkflowStepJobLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowStepJobLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, selectedWorkflowStep?.jobId, workflowRefreshNonce, workflowCosts, activeWorkflows, historyWorkflows]);

  useEffect(() => {
    if (section !== 'workflow-costs') {
      setJobsActive([]);
      setJobsHistory([]);
      setJobsLoading(false);
      setJobsError(null);
      return;
    }

    let cancelled = false;
    setJobsError(null);
    setJobsLoading(true);

    Promise.all([listActiveJobs(100, 0), listHistoryJobs(100, 0)])
      .then(([activeItems, historyItems]) => {
        if (cancelled) return;
        setJobsActive(activeItems);
        setJobsHistory(historyItems);
      })
      .catch((err) => {
        if (!cancelled) {
          setJobsError(err instanceof Error ? err.message : 'Failed to load jobs');
          setJobsActive([]);
          setJobsHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setJobsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, workflowRefreshNonce]);

  const selectedJob = selectedJobId
    ? [...jobsActive, ...jobsHistory].find((item) => item.id === selectedJobId) ?? null
    : null;

  useEffect(() => {
    if (section !== 'workflow-costs' || !selectedJob?.id) {
      setJobLogs([]);
      setJobLogsLoading(false);
      setJobLogsError(null);
      return;
    }

    let cancelled = false;
    setJobLogsError(null);
    setJobLogsLoading(true);

    getJobLogs(selectedJob.id, 100, 0)
      .then((items) => {
        if (!cancelled) {
          setJobLogs(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setJobLogsError(err instanceof Error ? err.message : 'Failed to load job logs');
          setJobLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setJobLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, selectedJob?.id, workflowRefreshNonce]);

  useEffect(() => {
    if (userMode === 'new') {
      setUserForm(EMPTY_USER_FORM);
      return;
    }

    if (!selectedUserId) return;
    let cancelled = false;
    setUserError(null);
    setUserDetailLoading(true);
    getAdminUser(selectedUserId)
      .then((item) => {
        if (cancelled) return;
        setUserForm(userToForm(item));
        setUsers((current) => current.map((user) => (user.id === item.id ? item : user)));
      })
      .catch((err) => {
        if (!cancelled) setUserError(err instanceof Error ? err.message : 'Failed to load user details');
      })
      .finally(() => {
        if (!cancelled) setUserDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userMode, selectedUserId]);

  const selectedPrompt = selectedPromptId ? prompts.find((item) => item.id === selectedPromptId) ?? null : null;
  const selectedProvider = selectedProviderId ? providers.find((item) => item.id === selectedProviderId) ?? null : null;
  const selectedBillingRule = selectedBillingRuleId ? billingRules.find((item) => item.id === selectedBillingRuleId) ?? null : null;
  const selectedBillingUser = selectedBillingUserId ? billingUsers.find((item) => item.id === selectedBillingUserId) ?? null : null;
  function workflowKey(item: WorkflowHostRow): WorkflowHostSelection {
    return item.workflowId;
  }

  function mapWorkflowCost(item: WorkflowCostResponse): WorkflowHostRow {
    return {
      kind: 'cost',
      workflowId: item.workflowId,
      requestedByUserId: item.requestedByUserId,
      requestedByUserEmail: item.requestedByUserEmail,
      requestedByUserDisplayName: item.requestedByUserDisplayName,
      workflowType: item.workflowType,
      workflowStatus: item.workflowStatus,
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      progressPercent: null,
      progressMessage: null,
      currentStepKey: null,
      attemptCount: null,
      maxAttempts: null,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      heartbeatAt: null,
      estimatedCredits: item.estimatedCredits,
      finalCredits: item.finalCredits,
      reservationStatus: item.reservationStatus,
      sourceType: item.sourceType,
      reason: item.reason,
      diagnosticProvider: item.diagnosticProvider,
      diagnosticMessage: item.diagnosticMessage,
    };
  }

  function mapWorkflow(item: WorkflowResponse, kind: Extract<WorkflowHostKind, 'active' | 'history'>): WorkflowHostRow {
    const input = item.input && typeof item.input === 'object' ? item.input : {};
    const sourceId = typeof input.sourceId === 'string' ? input.sourceId : item.sourceId;
    const sourceLabel =
      typeof input.sourceLabel === 'string'
        ? input.sourceLabel
        : typeof input.youtubeUrl === 'string'
          ? input.youtubeUrl
          : typeof input.sourceUrl === 'string'
            ? input.sourceUrl
            : typeof input.topicName === 'string'
              ? input.topicName
              : typeof input.researchTopicId === 'string'
                ? input.researchTopicId
                : sourceId;

    return {
      kind,
      workflowId: item.id,
      requestedByUserId: item.requestedByUserId,
      requestedByUserEmail: null,
      requestedByUserDisplayName: null,
      workflowType: item.workflowType,
      workflowStatus: item.status,
      sourceId,
      sourceLabel,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      progressPercent: item.progressPercent,
      progressMessage: item.progressMessage,
      currentStepKey: item.currentStepKey,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
      lockedBy: item.lockedBy,
      lockedAt: item.lockedAt,
      lockedUntil: item.lockedUntil,
      heartbeatAt: item.heartbeatAt,
      estimatedCredits: null,
      finalCredits: null,
      reservationStatus: null,
      sourceType: sourceId ? 'workflow' : null,
      reason: typeof input.reason === 'string' ? input.reason : typeof input.triggeredBy === 'string' ? input.triggeredBy : null,
      diagnosticProvider: null,
      diagnosticMessage: null,
    };
  }

  const activeWorkflowRows = activeWorkflows.map((item) => mapWorkflow(item, 'active'));
  const historyWorkflowRows = historyWorkflows.map((item) => mapWorkflow(item, 'history'));
  const costWorkflowRows = workflowCosts.map(mapWorkflowCost);
  const workflowHostRows = [...activeWorkflowRows, ...costWorkflowRows, ...historyWorkflowRows]
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.workflowId === item.workflowId) === index)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function mapJob(item: JobResponse): JobHostRow {
    const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
    const result = item.result && typeof item.result === 'object' ? item.result : null;
    const errorDetails = item.errorDetails && typeof item.errorDetails === 'object' ? item.errorDetails : null;

    return {
      jobId: item.id,
      parentJobId: item.parentJobId,
      requestedByUserId: item.requestedByUserId,
      jobType: item.jobType,
      jobStatus: item.status,
      priority: item.priority,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
      progressPercent: item.progressPercent,
      progressMessage: item.progressMessage,
      availableAt: item.availableAt,
      lockedBy: item.lockedBy,
      lockedAt: item.lockedAt,
      lockedUntil: item.lockedUntil,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      heartbeatAt: item.heartbeatAt,
      cancelRequestedAt: item.cancelRequestedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      payload,
      result,
      errorDetails,
    };
  }

  const jobHostRows = [...jobsActive.map(mapJob), ...jobsHistory.map(mapJob)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const filteredWorkflowRows = (() => {
    const search = workflowCostSearch.trim().toLowerCase();

    const matchesSearch = (item: WorkflowHostRow) => {
      if (!search) return true;
      return [
        item.workflowId,
        item.requestedByUserEmail ?? '',
        item.requestedByUserDisplayName ?? '',
        item.workflowType,
        item.workflowStatus,
        item.sourceLabel ?? '',
        item.reason ?? '',
        item.sourceType ?? '',
        item.currentStepKey ?? '',
        item.progressMessage ?? '',
        item.errorCode ?? '',
        item.errorMessage ?? '',
        item.diagnosticProvider ?? '',
        item.diagnosticMessage ?? '',
      ].join(' ').toLowerCase().includes(search);
    };

    const matchesStatus = (item: WorkflowHostRow) => {
      if (workflowCostStatusFilter === 'all') return true;
      return item.workflowStatus === workflowCostStatusFilter;
    };

    return workflowHostRows.filter((item) => matchesSearch(item) && matchesStatus(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  })();

  const filteredJobRows = (() => {
    const search = jobSearch.trim().toLowerCase();

    const matchesSearch = (item: JobHostRow) => {
      if (!search) return true;
      return [
        item.jobId,
        item.parentJobId ?? '',
        item.requestedByUserId ?? '',
        item.jobType,
        item.jobStatus,
        item.errorCode ?? '',
        item.errorMessage ?? '',
        item.progressMessage ?? '',
        JSON.stringify(item.payload),
        JSON.stringify(item.result ?? {}),
        JSON.stringify(item.errorDetails ?? {}),
      ].join(' ').toLowerCase().includes(search);
    };

    const matchesStatus = (item: JobHostRow) => {
      if (jobStatusFilter === 'all') return true;
      return item.jobStatus === jobStatusFilter;
    };

    return jobHostRows.filter((item) => matchesSearch(item) && matchesStatus(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  })();

  const selectedWorkflow = selectedWorkflowKey
    ? filteredWorkflowRows.find((item) => workflowKey(item) === selectedWorkflowKey) ?? null
    : null;

  useEffect(() => {
    if (section !== 'workflow-costs') {
      return;
    }

    const visibleJobs = filteredJobRows;
    if (visibleJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !visibleJobs.some((item) => item.jobId === selectedJobId)) {
      setSelectedJobId(visibleJobs[0].jobId);
    }
  }, [section, selectedJobId, filteredJobRows]);

  useEffect(() => {
    if (section !== 'workflow-costs') {
      return;
    }

    const visible = filteredWorkflowRows;
    if (visible.length === 0) {
      setSelectedWorkflowKey(null);
      return;
    }

    if (!selectedWorkflowKey || !visible.some((item) => workflowKey(item) === selectedWorkflowKey)) {
      setSelectedWorkflowKey(workflowKey(visible[0]));
    }
  }, [section, selectedWorkflowKey, filteredWorkflowRows]);

  const filteredPrompts = prompts.filter((prompt) => {
    const haystack = [prompt.promptKey, prompt.title, prompt.description ?? '', prompt.provider, prompt.model, prompt.workflowType ?? ''].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(promptSearch.toLowerCase());
    const matchesStatus =
      promptStatusFilter === 'all' ? true : promptStatusFilter === 'active' ? prompt.isActive : !prompt.isActive;
    return matchesSearch && matchesStatus;
  });

  const filteredProviders = providers.filter((provider) => {
    const haystack = [provider.provider, provider.apiKey, provider.note ?? '', String(provider.quotaPerMonth)].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(providerSearch.toLowerCase());
    const matchesStatus =
      providerStatusFilter === 'all' ? true : providerStatusFilter === 'active' ? provider.isActive : !provider.isActive;
    return matchesSearch && matchesStatus;
  });

  const filteredEmailTemplates = emailTemplates.filter((template) => {
    const haystack = [
      template.templateKey,
      template.title,
      template.description ?? '',
      template.subject,
      template.htmlBody ?? '',
      template.textBody ?? '',
    ].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(emailTemplateSearch.toLowerCase());
    const matchesStatus =
      emailTemplateStatusFilter === 'all' ? true : emailTemplateStatusFilter === 'active' ? template.isActive : !template.isActive;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter((user) => {
    const haystack = [
      user.email,
      user.displayName ?? '',
      user.locale ?? '',
      user.timeZone ?? '',
      user.roles.join(' '),
      user.status,
    ].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(userSearch.toLowerCase());
    const matchesStatus =
      userStatusFilter === 'all' ? true : user.status === userStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredBillingUsers = billingUsers.filter((user) => {
    const haystack = [
      user.email,
      user.displayName ?? '',
      user.locale ?? '',
      user.timeZone ?? '',
      user.roles.join(' '),
      user.status,
    ].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(billingUserSearch.toLowerCase());
    const matchesStatus =
      billingUserStatusFilter === 'all' ? true : user.status === billingUserStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const promptStats = {
    total: prompts.length,
    active: prompts.filter((item) => item.isActive).length,
    inactive: prompts.filter((item) => !item.isActive).length,
    archives: promptArchives.length,
  };

  const providerStats = {
    total: providers.length,
    active: providers.filter((item) => item.isActive).length,
    inactive: providers.filter((item) => !item.isActive).length,
    quota: providers.reduce((sum, item) => sum + item.quotaPerMonth, 0),
  };

  const emailTemplateStats = {
    total: emailTemplates.length,
    active: emailTemplates.filter((item) => item.isActive).length,
    inactive: emailTemplates.filter((item) => !item.isActive).length,
    withHtml: emailTemplates.filter((item) => Boolean(item.htmlBody?.trim())).length,
  };

  const billingRuleStats = {
    total: billingRules.length,
    active: billingRules.filter((item) => item.isActive).length,
    inactive: billingRules.filter((item) => !item.isActive).length,
    actions: new Set(billingRules.map((item) => item.actionType)).size,
  };

  const billingStats = {
    balance: billingBalance?.balanceCredits ?? 0,
    reserved: billingBalance?.reservedCredits ?? 0,
    available: billingBalance?.availableCredits ?? 0,
    ledger: billingLedger.length,
  };

  const workflowCostStats = {
    total: workflowHostRows.length,
    active: workflowHostRows.filter((item) => ['queued', 'running', 'waiting'].includes(item.workflowStatus)).length,
    succeeded: workflowHostRows.filter((item) => item.workflowStatus === 'succeeded').length,
    charged: workflowCosts.reduce((sum, item) => sum + (item.finalCredits ?? 0), 0),
  };

  const userStats = {
    total: users.length,
    active: users.filter((item) => item.status === 'active').length,
    disabled: users.filter((item) => item.status === 'disabled').length,
    deleted: users.filter((item) => item.status === 'deleted').length,
  };

  const selectedUser = selectedUserId ? users.find((item) => item.id === selectedUserId) ?? null : null;
  const selectedTemplate = selectedTemplateKey ? emailTemplates.find((item) => item.templateKey === selectedTemplateKey) ?? null : null;

  const reloadPrompts = async (focusId?: string) => {
    const items = await listPrompts(100, 0);
    setPrompts(items);
    if (focusId && items.some((item) => item.id === focusId)) {
      setSelectedPromptId(focusId);
    } else if (items.length > 0) {
      setSelectedPromptId(items[0].id);
    } else {
      setPromptMode('new');
      setPromptForm(EMPTY_PROMPT_FORM);
    }
  };

  const reloadProviders = async (focusId?: string) => {
    const items = await listSearchProviders(100, 0);
    setProviders(items);
    if (focusId && items.some((item) => item.id === focusId)) {
      setSelectedProviderId(focusId);
    } else if (items.length > 0) {
      setSelectedProviderId(items[0].id);
    } else {
      setProviderMode('new');
      setProviderForm(EMPTY_PROVIDER_FORM);
    }
  };

  const reloadUsers = async (focusId?: string) => {
    setUserError(null);
    const items = await listAdminUsers(userSearch.trim());
    setUsers(items);
    setBillingUsers(items);
    if (focusId && items.some((item) => item.id === focusId)) {
      setSelectedUserId(focusId);
    } else if (items.length > 0) {
      setSelectedUserId(items[0].id);
    } else {
      setUserMode('new');
      setUserForm(EMPTY_USER_FORM);
    }
  };

  const reloadEmailTemplates = async (focusKey?: string) => {
    setEmailTemplateError(null);
    const items = await listEmailTemplates(emailTemplateSearch.trim());
    setEmailTemplates(items);
    if (focusKey && items.some((item) => item.templateKey === focusKey)) {
      setSelectedTemplateKey(focusKey);
    } else if (items.length > 0) {
      setSelectedTemplateKey(items[0].templateKey);
    } else {
      setSelectedTemplateKey(null);
      setEmailTemplateMode('new');
      setEmailTemplateForm(EMPTY_EMAIL_TEMPLATE_FORM);
    }
  };

  const reloadBillingRules = async (focusId?: string) => {
    setBillingRuleError(null);
    const items = await listBillingRules();
    setBillingRules(items);
    if (focusId && items.some((item) => item.id === focusId)) {
      setSelectedBillingRuleId(focusId);
    } else if (items.length > 0) {
      setSelectedBillingRuleId(items[0].id);
    } else {
      setSelectedBillingRuleId(null);
      setBillingRuleMode('new');
      setBillingRuleForm(EMPTY_BILLING_RULE_FORM);
    }
  };

  const reloadBillingDetails = async (userId: string) => {
    setBillingError(null);
    setBillingDetailLoading(true);
    try {
      const [balance, ledger, reservations] = await Promise.all([
        getBillingBalance(userId),
        listBillingLedger(userId, 50, 0),
        listBillingReservations(userId, 50, 0),
      ]);
      setBillingBalance(balance);
      setBillingLedger(ledger);
      setBillingReservations(reservations);
    } finally {
      setBillingDetailLoading(false);
    }
  };

  const savePrompt = async () => {
    setPromptSaving(true);
    setPromptError(null);

    const payloadBase = {
      promptKey: promptForm.promptKey.trim(),
      title: promptForm.title.trim(),
      description: normalizeMaybe(promptForm.description),
      workflowType: normalizeMaybe(promptForm.workflowType),
      provider: promptForm.provider.trim(),
      model: promptForm.model.trim(),
      systemPrompt: promptForm.systemPrompt.trim(),
      userPrompt: promptForm.userPrompt.trim(),
    };

    try {
      if (promptMode === 'new') {
        const created = await createPrompt({ ...payloadBase, isActive: promptForm.isActive });
        setPromptMode('view');
        await reloadPrompts(created.id);
      } else {
        if (!selectedPromptId) throw new Error('No prompt selected');
        const updated = await updatePrompt(selectedPromptId, { ...payloadBase, isActive: promptForm.isActive } satisfies PromptUpdateInput);
        setPromptMode('view');
        await reloadPrompts(updated.id);
      }
      setPromptTab('editor');
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setPromptSaving(false);
    }
  };

  const deletePromptItem = async () => {
    if (!selectedPromptId) return;
    if (!window.confirm(`Delete prompt "${selectedPrompt?.title ?? selectedPromptId}"?`)) return;

    setPromptSaving(true);
    setPromptError(null);
    try {
      await deletePrompt(selectedPromptId);
      const remaining = prompts.filter((item) => item.id !== selectedPromptId);
      setPrompts(remaining);
      if (remaining.length > 0) {
        setSelectedPromptId(remaining[0].id);
      } else {
        setPromptMode('new');
        setPromptForm(EMPTY_PROMPT_FORM);
      }
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Failed to delete prompt');
    } finally {
      setPromptSaving(false);
    }
  };

  const saveUser = async () => {
    if (!selectedUserId && userMode !== 'new') return;

    setUserSaving(true);
    setUserError(null);

    const payload: UpdateAdminUserInput = {
      email: userForm.email.trim(),
      displayName: normalizeMaybe(userForm.displayName),
      avatarUrl: normalizeMaybe(userForm.avatarUrl),
      locale: normalizeMaybe(userForm.locale),
      timeZone: normalizeMaybe(userForm.timeZone),
      status: userForm.status.trim().toLowerCase(),
      roles: userForm.roles,
    };

    try {
      if (userMode === 'new') {
        throw new Error('User creation is not enabled yet.');
      }

      const updated = await updateAdminUser(selectedUserId!, payload);
      setUserForm(userToForm(updated));
      setUserMode('view');
      await reloadUsers(updated.id);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setUserSaving(false);
    }
  };

  const saveProvider = async () => {
    setProviderSaving(true);
    setProviderError(null);

    const quota = Number.parseInt(providerForm.quotaPerMonth, 10);
    if (Number.isNaN(quota) || quota < 0) {
      setProviderError('Quota must be a non-negative integer.');
      setProviderSaving(false);
      return;
    }

    const payloadBase = {
      provider: providerForm.provider.trim(),
      apiKey: providerForm.apiKey.trim(),
      quotaPerMonth: quota,
      note: normalizeMaybe(providerForm.note),
    };

    try {
      if (providerMode === 'new') {
        const created = await createSearchProvider({ ...payloadBase, isActive: providerForm.isActive });
        setProviderMode('view');
        await reloadProviders(created.id);
      } else {
        if (!selectedProviderId) throw new Error('No search provider selected');
        const updated = await updateSearchProvider(selectedProviderId, { ...payloadBase, isActive: providerForm.isActive } satisfies SearchProviderUpdateInput);
        setProviderMode('view');
        await reloadProviders(updated.id);
      }
      setProviderTab('editor');
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : 'Failed to save search provider');
    } finally {
      setProviderSaving(false);
    }
  };

  const deleteProviderItem = async () => {
    if (!selectedProviderId) return;
    if (!window.confirm(`Delete search provider "${selectedProvider?.provider ?? selectedProviderId}"?`)) return;

    setProviderSaving(true);
    setProviderError(null);
    try {
      await deleteSearchProvider(selectedProviderId);
      const remaining = providers.filter((item) => item.id !== selectedProviderId);
      setProviders(remaining);
      if (remaining.length > 0) {
        setSelectedProviderId(remaining[0].id);
      } else {
        setProviderMode('new');
        setProviderForm(EMPTY_PROVIDER_FORM);
      }
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : 'Failed to delete search provider');
    } finally {
      setProviderSaving(false);
    }
  };

  const saveRuntimeSettings = async () => {
    setRuntimeSettingsSaving(true);
    setRuntimeSettingsError(null);

    const payload: UpdateAdminSettingsInput = {
      email: {
        provider: runtimeSettings.emailProvider.trim(),
        defaultFromEmail: runtimeSettings.emailFromEmail.trim(),
        defaultFromName: normalizeMaybe(runtimeSettings.emailFromName),
      },
      transcribe: {
        provider: runtimeSettings.transcribeProvider.trim(),
      },
    };

    try {
      const updated = await updateAdminSettings(payload);
      setRuntimeSettings(settingsToForm(updated));
    } catch (err) {
      setRuntimeSettingsError(err instanceof Error ? err.message : 'Failed to save runtime settings');
    } finally {
      setRuntimeSettingsSaving(false);
    }
  };

  const saveEmailTemplate = async () => {
    setEmailTemplateSaving(true);
    setEmailTemplateError(null);

    const payloadBase = {
      templateKey: emailTemplateForm.templateKey.trim(),
      title: emailTemplateForm.title.trim(),
      description: normalizeMaybe(emailTemplateForm.description),
      subject: emailTemplateForm.subject.trim(),
      htmlBody: normalizeMaybe(emailTemplateForm.htmlBody),
      textBody: normalizeMaybe(emailTemplateForm.textBody),
      isActive: emailTemplateForm.isActive,
    };

    try {
      if (emailTemplateMode === 'new') {
        const created = await createEmailTemplate(payloadBase satisfies CreateEmailTemplateInput);
        setEmailTemplateMode('view');
        await reloadEmailTemplates(created.templateKey);
      } else {
        if (!selectedTemplateKey) throw new Error('No email template selected');
        const updated = await updateEmailTemplate(
          selectedTemplateKey,
          {
            title: payloadBase.title,
            description: payloadBase.description,
            subject: payloadBase.subject,
            htmlBody: payloadBase.htmlBody,
            textBody: payloadBase.textBody,
            isActive: payloadBase.isActive,
          } satisfies UpdateEmailTemplateInput,
        );
        setEmailTemplateMode('view');
        await reloadEmailTemplates(updated.templateKey);
      }
    } catch (err) {
      setEmailTemplateError(err instanceof Error ? err.message : 'Failed to save email template');
    } finally {
      setEmailTemplateSaving(false);
    }
  };

  const saveBillingRule = async () => {
    setBillingRuleSaving(true);
    setBillingRuleError(null);

    const payloadBase = {
      actionType: billingRuleForm.actionType.trim(),
      provider: normalizeMaybe(billingRuleForm.provider),
      model: normalizeMaybe(billingRuleForm.model),
      version: Number.parseInt(billingRuleForm.version, 10),
      unitType: billingRuleForm.unitType.trim(),
      baseFeeCredits: Number.parseFloat(billingRuleForm.baseFeeCredits),
      ratePerUnitCredits: Number.parseFloat(billingRuleForm.ratePerUnitCredits),
      minCredits: Number.parseFloat(billingRuleForm.minCredits),
      maxCredits: billingRuleForm.maxCredits.trim() ? Number.parseFloat(billingRuleForm.maxCredits) : null,
      multiplier: Number.parseFloat(billingRuleForm.multiplier),
      isActive: billingRuleForm.isActive,
      effectiveFrom: new Date(billingRuleForm.effectiveFrom || new Date().toISOString()).toISOString(),
    };

    if (
      Number.isNaN(payloadBase.version) ||
      Number.isNaN(payloadBase.baseFeeCredits) ||
      Number.isNaN(payloadBase.ratePerUnitCredits) ||
      Number.isNaN(payloadBase.minCredits) ||
      Number.isNaN(payloadBase.multiplier) ||
      (payloadBase.maxCredits !== null && Number.isNaN(payloadBase.maxCredits))
    ) {
      setBillingRuleError('Please enter valid numeric values.');
      setBillingRuleSaving(false);
      return;
    }

    try {
      if (billingRuleMode === 'new') {
        const created = await createBillingRule(payloadBase satisfies BillingRuleInput);
        setBillingRuleMode('view');
        await reloadBillingRules(created.id);
      } else {
        if (!selectedBillingRuleId) throw new Error('No billing rule selected');
        const updated = await updateBillingRule(selectedBillingRuleId, payloadBase satisfies BillingRuleUpdateInput);
        setBillingRuleMode('view');
        await reloadBillingRules(updated.id);
      }
    } catch (err) {
      setBillingRuleError(err instanceof Error ? err.message : 'Failed to save billing rule');
    } finally {
      setBillingRuleSaving(false);
    }
  };

  const deleteBillingRuleItem = async () => {
    if (!selectedBillingRuleId) return;
    if (!window.confirm(`Delete billing rule "${selectedBillingRule?.actionType ?? selectedBillingRuleId}"?`)) return;

    setBillingRuleSaving(true);
    setBillingRuleError(null);
    try {
      await deleteBillingRule(selectedBillingRuleId);
      const remaining = billingRules.filter((item) => item.id !== selectedBillingRuleId);
      setBillingRules(remaining);
      if (remaining.length > 0) {
        setSelectedBillingRuleId(remaining[0].id);
      } else {
        setBillingRuleMode('new');
        setBillingRuleForm(EMPTY_BILLING_RULE_FORM);
      }
    } catch (err) {
      setBillingRuleError(err instanceof Error ? err.message : 'Failed to delete billing rule');
    } finally {
      setBillingRuleSaving(false);
    }
  };

  const saveBillingTopUp = async () => {
    if (!selectedBillingUserId) return;

    setBillingSaving(true);
    setBillingError(null);

    const credits = Number.parseFloat(billingTopUpForm.credits);
    if (Number.isNaN(credits) || credits <= 0) {
      setBillingError('Credits must be greater than zero.');
      setBillingSaving(false);
      return;
    }

    try {
      await topUpBillingBalance({
        requestedByUserId: selectedBillingUserId,
        credits,
        reason: normalizeMaybe(billingTopUpForm.reason),
      });
      await reloadBillingDetails(selectedBillingUserId);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Failed to top up balance');
    } finally {
      setBillingSaving(false);
    }
  };

  const deleteEmailTemplateItem = async () => {
    if (!selectedTemplateKey) return;
    if (!window.confirm(`Delete email template "${selectedTemplate?.title ?? selectedTemplateKey}"?`)) return;

    setEmailTemplateSaving(true);
    setEmailTemplateError(null);
    try {
      await deleteEmailTemplate(selectedTemplateKey);
      const remaining = emailTemplates.filter((item) => item.templateKey !== selectedTemplateKey);
      setEmailTemplates(remaining);
      if (remaining.length > 0) {
        setSelectedTemplateKey(remaining[0].templateKey);
      } else {
        setSelectedTemplateKey(null);
        setEmailTemplateMode('new');
        setEmailTemplateForm(EMPTY_EMAIL_TEMPLATE_FORM);
      }
    } catch (err) {
      setEmailTemplateError(err instanceof Error ? err.message : 'Failed to delete email template');
    } finally {
      setEmailTemplateSaving(false);
    }
  };

  if (userLoading || billingLoading || promptLoading || providerLoading || runtimeSettingsLoading || emailTemplateLoading || billingRuleLoading || workflowCostsLoading || workflowHostLoading || jobsLoading) return <PageSkeleton />;

  const renderUserPanel = () => {
    const toggleRole = (roleKey: string) => {
      setUserForm((current) => {
        const roles = current.roles.includes(roleKey)
          ? current.roles.filter((item) => item !== roleKey)
          : [...current.roles, roleKey];
        return { ...current, roles };
      });
    };

    const userInitials = (user: AdminUserResponse | null) => {
      if (!user) return 'U';
      const source = user.displayName?.trim() || user.email;
      const parts = source.split(/[\s@._-]+/).filter(Boolean);
      return (parts.slice(0, 2).map((part) => part[0]).join('') || 'U').toUpperCase();
    };

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary">Users</h2>
                <p className="text-[11px] text-text-muted">Search users, edit profile fields, and manage roles.</p>
              </div>
              <button
                type="button"
                onClick={() => void reloadUsers(selectedUserId ?? undefined).catch((err) => {
                  setUserError(err instanceof Error ? err.message : 'Failed to refresh users');
                })}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by email, name, locale, role..."
                  className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={13} className="text-text-muted" />
                {(['all', 'active', 'disabled', 'deleted'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUserStatusFilter(value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      userStatusFilter === value
                        ? 'bg-accent text-bg-primary'
                        : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
            {filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <div className="text-[13px] font-medium text-text-primary">No users match your filters.</div>
                <div className="mt-1 text-[11px] text-text-muted">Try a different search term or status filter.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => {
                  const isSelected = user.id === selectedUserId && userMode !== 'new';
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setUserMode('view');
                        setSelectedUserId(user.id);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                          : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg-card text-[12px] font-bold text-accent">
                          {userInitials(user)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-text-primary">{user.displayName ?? user.email}</div>
                              <div className="mt-0.5 truncate text-[11px] text-text-muted">{user.email}</div>
                            </div>
                            <Badge tone={user.status === 'active' ? 'accent' : 'muted'}>{user.status}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {user.roles.slice(0, 3).map((role) => (
                              <Badge key={role}>{role}</Badge>
                            ))}
                            {user.roles.length === 0 && <Badge tone="muted">No roles</Badge>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    {selectedUser ? selectedUser.displayName ?? selectedUser.email : 'Select a user'}
                  </h2>
                  {selectedUser && <Badge tone={selectedUser.status === 'active' ? 'accent' : 'muted'}>{selectedUser.status}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  {selectedUser ? (
                    <>
                      <span>{selectedUser.email}</span>
                      <span>•</span>
                      <span>Updated {formatDateTime(selectedUser.updatedAt)}</span>
                    </>
                  ) : (
                    <span>No user selected.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveUser}
                  disabled={userSaving || !selectedUser}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {userSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                  Save
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Users" value={String(userStats.total)} icon={<Users size={14} />} />
              <StatCard label="Active" value={String(userStats.active)} icon={<CircleCheck size={14} />} accent />
              <StatCard label="Disabled" value={String(userStats.disabled)} icon={<CircleDashed size={14} />} />
              <StatCard label="Deleted" value={String(userStats.deleted)} icon={<Trash2 size={14} />} />
            </div>
          </div>

          <div className="p-5">
            {userDetailLoading && selectedUser ? (
              <div className="grid gap-4">
                <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
                <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              </div>
            ) : selectedUser ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Field label="Email">
                    <Input value={userForm.email} onChange={(value) => setUserForm((cur) => ({ ...cur, email: value }))} placeholder="name@example.com" />
                  </Field>
                  <Field label="Display name">
                    <Input value={userForm.displayName} onChange={(value) => setUserForm((cur) => ({ ...cur, displayName: value }))} placeholder="User name" />
                  </Field>
                  <Field label="Avatar URL" helper="Optional">
                    <Input value={userForm.avatarUrl} onChange={(value) => setUserForm((cur) => ({ ...cur, avatarUrl: value }))} placeholder="https://..." />
                  </Field>
                  <Field label="Status">
                    <select
                      value={userForm.status}
                      onChange={(e) => setUserForm((cur) => ({ ...cur, status: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent/60 focus:bg-bg-card"
                    >
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                      <option value="deleted">deleted</option>
                    </select>
                  </Field>
                  <Field label="Locale" helper="Optional">
                    <Input value={userForm.locale} onChange={(value) => setUserForm((cur) => ({ ...cur, locale: value }))} placeholder="en-US" />
                  </Field>
                  <Field label="Time zone" helper="Optional">
                    <Input value={userForm.timeZone} onChange={(value) => setUserForm((cur) => ({ ...cur, timeZone: value }))} placeholder="Europe/London" />
                  </Field>
                </div>

                <div className="rounded-2xl border border-border bg-bg-input/30 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                    <UserCog size={14} className="text-accent" />
                    Roles
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {userRoles.map((role) => {
                      const selected = userForm.roles.includes(role.roleKey);
                      return (
                        <button
                          key={role.roleKey}
                          type="button"
                          onClick={() => toggleRole(role.roleKey)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                            selected
                              ? 'border-accent/40 bg-accent/15 text-accent'
                              : 'border-border bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-input'
                          }`}
                          title={role.description ?? role.displayName}
                        >
                          {role.displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Sessions', value: String(selectedUser.sessionCount), icon: <Server size={14} /> },
                    { label: 'Last login', value: selectedUser.lastLoginAt ? formatDateTime(selectedUser.lastLoginAt) : '—', icon: <Clock3 size={14} /> },
                    { label: 'Email verified', value: selectedUser.emailVerifiedAt ? formatDateTime(selectedUser.emailVerifiedAt) : '—', icon: <Shield size={14} /> },
                    { label: 'Initials', value: userInitials(selectedUser), icon: <Users size={14} />, accent: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border p-4 ${item.accent ? 'border-accent/20 bg-accent/10' : 'border-border bg-bg-card/85'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{item.label}</div>
                        <div className={item.accent ? 'text-accent' : 'text-text-muted'}>{item.icon}</div>
                      </div>
                      <div className="mt-4 break-words text-[13px] font-semibold leading-5 text-text-primary">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-bg-input/40 p-4 text-[11px] text-text-muted">
                  Created {formatDateTime(selectedUser.createdAt)} · Updated {formatDateTime(selectedUser.updatedAt)}
                </div>
              </div>
            ) : (
              <EmptyState icon={<Users size={18} />} title="No user selected" description="Choose a user from the list to edit profile data and roles." />
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderPromptPanel = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">Prompts</h2>
              <p className="text-[11px] text-text-muted">Search and select a prompt template.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPromptMode('new');
                setPromptForm(EMPTY_PROMPT_FORM);
                setPromptTab('editor');
                setSelectedPromptId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
            >
              <Plus size={14} />
              New
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={promptSearch}
                onChange={(e) => setPromptSearch(e.target.value)}
                placeholder="Search by key, title, provider..."
                className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={13} className="text-text-muted" />
              {(['all', 'active', 'inactive'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPromptStatusFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                    promptStatusFilter === value
                      ? 'bg-accent text-bg-primary'
                      : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
          {filteredPrompts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <div className="text-[13px] font-medium text-text-primary">No prompts match your filters.</div>
              <div className="mt-1 text-[11px] text-text-muted">Create a new prompt or loosen the search criteria.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPrompts.map((prompt) => {
                const isSelected = prompt.id === selectedPromptId && promptMode !== 'new';

                return (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => {
                      setPromptMode('view');
                      setSelectedPromptId(prompt.id);
                      setPromptTab('editor');
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                        : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-text-primary">{prompt.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-text-muted">{prompt.promptKey}</div>
                      </div>
                      <Badge tone={prompt.isActive ? 'accent' : 'muted'}>{prompt.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{prompt.provider}</Badge>
                      <Badge>{prompt.model}</Badge>
                      {prompt.workflowType && <Badge tone="muted">{prompt.workflowType}</Badge>}
                    </div>
                    <div className="mt-3 line-clamp-2 text-[11px] leading-5 text-text-secondary">
                      {prompt.description ?? 'No description set.'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold text-text-primary">
                  {promptMode === 'new' ? 'Create prompt' : selectedPrompt?.title ?? 'Select a prompt'}
                </h2>
                {selectedPrompt && promptMode === 'view' && (
                  <Badge tone={selectedPrompt.isActive ? 'accent' : 'muted'}>{selectedPrompt.isActive ? 'Active' : 'Inactive'}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                {promptMode === 'new' ? (
                  <span>Draft editor for a new prompt template.</span>
                ) : selectedPrompt ? (
                  <>
                    <span>{selectedPrompt.promptKey}</span>
                    <span>•</span>
                    <span>Updated {formatDateTime(selectedPrompt.updatedAt)}</span>
                  </>
                ) : (
                  <span>No prompt selected.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {promptMode === 'view' && selectedPrompt && (
                <button
                  type="button"
                  onClick={deletePromptItem}
                  disabled={promptSaving}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[12px] font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={savePrompt}
                disabled={promptSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {promptSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                Save
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              { key: 'editor' as PromptTab, label: 'Editor', icon: <PenSquare size={14} /> },
              { key: 'runs' as PromptTab, label: 'Runs', icon: <Activity size={14} /> },
              { key: 'archive' as PromptTab, label: 'Archive', icon: <Archive size={14} /> },
              { key: 'usage' as PromptTab, label: 'Usage', icon: <Database size={14} /> },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPromptTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                  promptTab === tab.key
                    ? 'bg-bg-input text-text-primary border border-border'
                    : 'bg-transparent text-text-muted hover:text-text-primary hover:bg-bg-input/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {promptDetailLoading && promptMode !== 'new' ? (
            <div className="grid gap-4">
              <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
            </div>
          ) : (
            <>
              {promptTab === 'editor' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Field label="Prompt key">
                      <Input value={promptForm.promptKey} onChange={(value) => setPromptForm((cur) => ({ ...cur, promptKey: value }))} placeholder="research.briefing.summary" />
                    </Field>
                    <Field label="Title">
                      <Input value={promptForm.title} onChange={(value) => setPromptForm((cur) => ({ ...cur, title: value }))} placeholder="Research briefing summary" />
                    </Field>
                    <Field label="Provider">
                      <Input value={promptForm.provider} onChange={(value) => setPromptForm((cur) => ({ ...cur, provider: value }))} placeholder="openai" />
                    </Field>
                    <Field label="Model">
                      <Input value={promptForm.model} onChange={(value) => setPromptForm((cur) => ({ ...cur, model: value }))} placeholder="gpt-4.1-mini" />
                    </Field>
                    <Field label="Workflow type" helper="Optional">
                      <Input value={promptForm.workflowType} onChange={(value) => setPromptForm((cur) => ({ ...cur, workflowType: value }))} placeholder="research.synthesis" />
                    </Field>
                    <Field label="Active">
                      <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-bg-input px-3.5 py-2.5">
                        <Toggle checked={promptForm.isActive} onChange={(value) => setPromptForm((cur) => ({ ...cur, isActive: value }))} />
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{promptForm.isActive ? 'Enabled' : 'Disabled'}</div>
                          <div className="text-[11px] text-text-muted">Controls whether this prompt is used by workflows.</div>
                        </div>
                      </div>
                    </Field>
                  </div>

                  <Field label="Description" helper="Optional">
                    <Textarea value={promptForm.description} onChange={(value) => setPromptForm((cur) => ({ ...cur, description: value }))} placeholder="Human-readable description for admins." minHeight="min-h-[96px]" />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Field label="System prompt">
                      <Textarea value={promptForm.systemPrompt} onChange={(value) => setPromptForm((cur) => ({ ...cur, systemPrompt: value }))} placeholder="System instructions" minHeight="min-h-[320px]" />
                    </Field>
                    <Field label="User prompt">
                      <Textarea value={promptForm.userPrompt} onChange={(value) => setPromptForm((cur) => ({ ...cur, userPrompt: value }))} placeholder="User instructions" minHeight="min-h-[320px]" />
                    </Field>
                  </div>
                </div>
              )}

              {promptTab === 'runs' && (
                <div className="space-y-3">
                  {promptRuns.length === 0 ? (
                    <EmptyState icon={<Activity size={18} />} title="No prompt runs" description="This prompt has not been executed yet." />
                  ) : (
                    promptRuns.map((run) => (
                      <div key={run.id} className="rounded-2xl border border-border bg-bg-input/40 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="muted">{run.status}</Badge>
                          {run.stepKey && <Badge tone="muted">{run.stepKey}</Badge>}
                          <Badge>{run.provider}</Badge>
                          <Badge>{run.model}</Badge>
                        </div>
                        <div className="mt-2 text-[13px] font-semibold text-text-primary">{run.title}</div>
                        <div className="mt-1 text-[11px] text-text-muted">Started {formatDateTime(run.startedAt)}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {promptTab === 'archive' && (
                <div className="space-y-3">
                  {promptArchives.length === 0 ? (
                    <EmptyState icon={<Archive size={18} />} title="No archived versions" description="Edits will create archive entries automatically." />
                  ) : (
                    promptArchives.map((archive) => (
                      <div key={archive.id} className="rounded-2xl border border-border bg-bg-input/40 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="accent">v{archive.archiveVersion}</Badge>
                          <Badge tone="muted">{archive.promptKey}</Badge>
                        </div>
                        <div className="mt-2 text-[13px] font-semibold text-text-primary">{archive.title}</div>
                        <div className="mt-1 text-[11px] text-text-muted">Archived {formatDateTime(archive.archivedAt)}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {promptTab === 'usage' && (
                <div className="space-y-4">
                  {promptUsage ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <StatCard label="Total runs" value={String(promptUsage.totalRuns)} icon={<Activity size={14} />} />
                        <StatCard label="Succeeded" value={String(promptUsage.succeededRuns)} icon={<CircleCheck size={14} />} accent />
                        <StatCard label="Failed" value={String(promptUsage.failedRuns)} icon={<CircleAlert size={14} />} />
                        <StatCard label="Running" value={String(promptUsage.runningRuns)} icon={<CircleDashed size={14} />} />
                      </div>
                      <div className="rounded-2xl border border-border bg-bg-input/40 p-4 text-[11px] text-text-muted">
                        Last run {formatDateTime(promptUsage.lastRunAt)}
                      </div>
                    </>
                  ) : (
                    <EmptyState icon={<Database size={18} />} title="No usage data" description="Usage metrics are unavailable for this prompt." />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );

  const renderProviderPanel = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">Search providers</h2>
              <p className="text-[11px] text-text-muted">Manage API keys and quotas.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setProviderMode('new');
                setProviderForm(EMPTY_PROVIDER_FORM);
                setProviderTab('editor');
                setSelectedProviderId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
            >
              <Plus size={14} />
              New
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                placeholder="Search by provider, key, or note..."
                className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={13} className="text-text-muted" />
              {(['all', 'active', 'inactive'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProviderStatusFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                    providerStatusFilter === value
                      ? 'bg-accent text-bg-primary'
                      : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
          {filteredProviders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <div className="text-[13px] font-medium text-text-primary">No search providers match your filters.</div>
              <div className="mt-1 text-[11px] text-text-muted">Create a new key or loosen the search criteria.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProviders.map((provider) => {
                const isSelected = provider.id === selectedProviderId && providerMode !== 'new';
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      setProviderMode('view');
                      setSelectedProviderId(provider.id);
                      setProviderTab('editor');
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                        : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-text-primary">{provider.provider}</div>
                        <div className="mt-0.5 truncate text-[11px] text-text-muted">{maskApiKey(provider.apiKey)}</div>
                      </div>
                      <Badge tone={provider.isActive ? 'accent' : 'muted'}>{provider.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{formatQuota(provider.quotaPerMonth)}</Badge>
                    </div>
                    <div className="mt-3 line-clamp-2 text-[11px] leading-5 text-text-secondary">
                      {provider.note ?? 'No note set.'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold text-text-primary">
                  {providerMode === 'new' ? 'Create search provider' : selectedProvider?.provider ?? 'Select a search provider'}
                </h2>
                {selectedProvider && providerMode === 'view' && (
                  <Badge tone={selectedProvider.isActive ? 'accent' : 'muted'}>{selectedProvider.isActive ? 'Active' : 'Inactive'}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                {providerMode === 'new' ? (
                  <span>Draft editor for a new search provider key.</span>
                ) : selectedProvider ? (
                  <>
                    <span>{selectedProvider.provider}</span>
                    <span>•</span>
                    <span>Updated key {maskApiKey(selectedProvider.apiKey)}</span>
                  </>
                ) : (
                  <span>No search provider selected.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {providerMode === 'view' && selectedProvider && (
                <button
                  type="button"
                  onClick={deleteProviderItem}
                  disabled={providerSaving}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[12px] font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={saveProvider}
                disabled={providerSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {providerSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                Save
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              { key: 'editor' as ProviderTab, label: 'Editor', icon: <PenSquare size={14} /> },
              { key: 'usage' as ProviderTab, label: 'Usage', icon: <Database size={14} /> },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setProviderTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                  providerTab === tab.key
                    ? 'bg-bg-input text-text-primary border border-border'
                    : 'bg-transparent text-text-muted hover:text-text-primary hover:bg-bg-input/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {providerDetailLoading && providerMode !== 'new' ? (
            <div className="grid gap-4">
              <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
            </div>
          ) : (
            <>
              {providerTab === 'editor' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Field label="Provider">
                      <Input value={providerForm.provider} onChange={(value) => setProviderForm((cur) => ({ ...cur, provider: value }))} placeholder="Tavily" />
                    </Field>
                    <Field label="Quota per month">
                      <Input value={providerForm.quotaPerMonth} onChange={(value) => setProviderForm((cur) => ({ ...cur, quotaPerMonth: value }))} placeholder="50000" />
                    </Field>
                    <Field label="API key">
                      <Input value={providerForm.apiKey} onChange={(value) => setProviderForm((cur) => ({ ...cur, apiKey: value }))} placeholder="tvly-..." />
                    </Field>
                    <Field label="Active">
                      <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-bg-input px-3.5 py-2.5">
                        <Toggle checked={providerForm.isActive} onChange={(value) => setProviderForm((cur) => ({ ...cur, isActive: value }))} />
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{providerForm.isActive ? 'Enabled' : 'Disabled'}</div>
                          <div className="text-[11px] text-text-muted">Controls whether this key can be selected by the pipeline.</div>
                        </div>
                      </div>
                    </Field>
                  </div>

                  <Field label="Note" helper="Optional">
                    <Textarea value={providerForm.note} onChange={(value) => setProviderForm((cur) => ({ ...cur, note: value }))} placeholder="Human-readable note for this key." minHeight="min-h-[120px]" />
                  </Field>
                </div>
              )}

              {providerTab === 'usage' && (
                <div className="space-y-4">
                  {providerUsage ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <StatCard label="Quota" value={formatQuota(providerUsage.quotaPerMonth)} icon={<KeyRound size={14} />} />
                        <StatCard label="Used" value={formatQuota(providerUsage.used)} icon={<Database size={14} />} accent />
                        <StatCard label="Remaining" value={formatQuota(Math.max(0, providerUsage.quotaPerMonth - providerUsage.used))} icon={<CircleCheck size={14} />} />
                        <StatCard label="Provider" value={providerUsage.provider} icon={<Server size={14} />} />
                      </div>
                      <div className="rounded-2xl border border-border bg-bg-input/40 p-4 text-[11px] text-text-muted">
                        Cycle {formatDateTime(providerUsage.cycleStart)} - {formatDateTime(providerUsage.cycleEnd)}
                      </div>
                    </>
                  ) : (
                    <EmptyState icon={<Database size={18} />} title="No usage data" description="Select a provider to inspect quota and usage." />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );

  const renderEmailTemplatesPanel = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">Email templates</h2>
              <p className="text-[11px] text-text-muted">View, create, and edit email template content.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmailTemplateMode('new');
                setEmailTemplateForm(EMPTY_EMAIL_TEMPLATE_FORM);
                setSelectedTemplateKey(null);
                setEmailTemplateError(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
            >
              <Plus size={14} />
              New
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={emailTemplateSearch}
                onChange={(e) => setEmailTemplateSearch(e.target.value)}
                placeholder="Search by key, title, subject..."
                className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={13} className="text-text-muted" />
              {(['all', 'active', 'inactive'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEmailTemplateStatusFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                    emailTemplateStatusFilter === value
                      ? 'bg-accent text-bg-primary'
                      : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
          {filteredEmailTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <div className="text-[13px] font-medium text-text-primary">No email templates match your filters.</div>
              <div className="mt-1 text-[11px] text-text-muted">Create a new template or loosen the search criteria.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmailTemplates.map((template) => {
                const isSelected = template.templateKey === selectedTemplateKey && emailTemplateMode !== 'new';
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setEmailTemplateMode('view');
                      setSelectedTemplateKey(template.templateKey);
                      setEmailTemplateError(null);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                        : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-text-primary">{template.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-text-muted">{template.templateKey}</div>
                      </div>
                      <Badge tone={template.isActive ? 'accent' : 'muted'}>{template.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{template.subject}</Badge>
                    </div>
                    <div className="mt-3 line-clamp-2 text-[11px] leading-5 text-text-secondary">
                      {template.description ?? 'No description set.'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold text-text-primary">
                  {emailTemplateMode === 'new' ? 'Create email template' : selectedTemplate?.title ?? 'Select an email template'}
                </h2>
                {selectedTemplate && emailTemplateMode === 'view' && (
                  <Badge tone={selectedTemplate.isActive ? 'accent' : 'muted'}>{selectedTemplate.isActive ? 'Active' : 'Inactive'}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                {emailTemplateMode === 'new' ? (
                  <span>Draft editor for a new template key.</span>
                ) : selectedTemplate ? (
                  <>
                    <span>{selectedTemplate.templateKey}</span>
                    <span>•</span>
                    <span>Updated {formatDateTime(selectedTemplate.updatedAt)}</span>
                  </>
                ) : (
                  <span>No email template selected.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {emailTemplateMode === 'view' && selectedTemplate && (
                <button
                  type="button"
                  onClick={deleteEmailTemplateItem}
                  disabled={emailTemplateSaving}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[12px] font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={saveEmailTemplate}
                disabled={emailTemplateSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {emailTemplateSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                Save
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Total" value={String(emailTemplateStats.total)} icon={<Layers3 size={14} />} />
            <StatCard label="Active" value={String(emailTemplateStats.active)} icon={<CircleCheck size={14} />} accent />
            <StatCard label="Inactive" value={String(emailTemplateStats.inactive)} icon={<CircleDashed size={14} />} />
            <StatCard label="HTML" value={String(emailTemplateStats.withHtml)} icon={<KeyRound size={14} />} />
          </div>
        </div>

        <div className="p-5">
          {emailTemplateLoading ? (
            <div className="grid gap-4">
              <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field label="Template key" helper="Required and unique">
                  <Input
                    value={emailTemplateForm.templateKey}
                    onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, templateKey: value }))}
                    placeholder="email.welcome"
                    disabled={emailTemplateMode === 'view'}
                  />
                </Field>
                <Field label="Title">
                  <Input
                    value={emailTemplateForm.title}
                    onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, title: value }))}
                    placeholder="Welcome email"
                  />
                </Field>
                <Field label="Subject">
                  <Input
                    value={emailTemplateForm.subject}
                    onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, subject: value }))}
                    placeholder="Welcome to Ai Summarizer"
                  />
                </Field>
                <Field label="Active">
                  <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-bg-input px-3.5 py-2.5">
                    <Toggle checked={emailTemplateForm.isActive} onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, isActive: value }))} />
                    <div>
                      <div className="text-[12px] font-medium text-text-primary">{emailTemplateForm.isActive ? 'Enabled' : 'Disabled'}</div>
                      <div className="text-[11px] text-text-muted">Disabled templates fall back to built-in content in the worker.</div>
                    </div>
                  </div>
                </Field>
              </div>

              <Field label="Description" helper="Optional">
                <Textarea
                  value={emailTemplateForm.description}
                  onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, description: value }))}
                  placeholder="Explain when this template is used."
                  minHeight="min-h-[100px]"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Field label="HTML body">
                  <Textarea
                    value={emailTemplateForm.htmlBody}
                    onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, htmlBody: value }))}
                    placeholder="<div>Hi {{displayName}}</div>"
                    minHeight="min-h-[340px]"
                  />
                </Field>
                <Field label="Text body">
                  <Textarea
                    value={emailTemplateForm.textBody}
                    onChange={(value) => setEmailTemplateForm((cur) => ({ ...cur, textBody: value }))}
                    placeholder="Hi {{displayName}}"
                    minHeight="min-h-[340px]"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                    <KeyRound size={14} className="text-accent" />
                    Placeholder hints
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                    <div><span className="text-text-primary">{"{{displayName}}"}</span> renders the recipient display name or email fallback.</div>
                    <div><span className="text-text-primary">{"{{email}}"}</span> renders the recipient email address.</div>
                    <div><span className="text-text-primary">{"{{appName}}"}</span> renders the product name.</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                    <Shield size={14} className="text-accent" />
                    Routing behavior
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                    <div>The worker loads the template at send time.</div>
                    <div>If the template is missing or disabled, it falls back to built-in welcome content.</div>
                    <div>The final email is still routed through the selected provider.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderBillingRulesPanel = () => {
    const filteredRules = billingRules.filter((rule) => {
      const haystack = [
        rule.actionType,
        rule.provider ?? '',
        rule.model ?? '',
        rule.unitType,
        String(rule.version),
      ].join(' ').toLowerCase();
      const matchesSearch = haystack.includes(billingRuleSearch.toLowerCase());
      const matchesStatus =
        billingRuleStatusFilter === 'all' ? true : billingRuleStatusFilter === 'active' ? rule.isActive : !rule.isActive;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary">Billing rules</h2>
                <p className="text-[11px] text-text-muted">Manage credits, unit rates, and model-specific pricing.</p>
              </div>
              <button
                type="button"
                onClick={() => void reloadBillingRules(selectedBillingRuleId ?? undefined).catch((err) => {
                  setBillingRuleError(err instanceof Error ? err.message : 'Failed to refresh billing rules');
                })}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={billingRuleSearch}
                  onChange={(e) => setBillingRuleSearch(e.target.value)}
                  placeholder="Search by action, provider, model..."
                  className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={13} className="text-text-muted" />
                {(['all', 'active', 'inactive'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBillingRuleStatusFilter(value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      billingRuleStatusFilter === value
                        ? 'bg-accent text-bg-primary'
                        : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
            {filteredRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <div className="text-[13px] font-medium text-text-primary">No billing rules match your filters.</div>
                <div className="mt-1 text-[11px] text-text-muted">Create a rule or loosen the search criteria.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRules.map((rule) => {
                  const isSelected = rule.id === selectedBillingRuleId && billingRuleMode !== 'new';
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => {
                        setBillingRuleMode('view');
                        setSelectedBillingRuleId(rule.id);
                        setBillingRuleError(null);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                          : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-text-primary">{rule.actionType}</div>
                          <div className="mt-0.5 truncate text-[11px] text-text-muted">
                            {rule.provider ?? 'Any provider'}{rule.model ? ` • ${rule.model}` : ''}
                          </div>
                        </div>
                        <Badge tone={rule.isActive ? 'accent' : 'muted'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{rule.unitType}</Badge>
                        <Badge>v{rule.version}</Badge>
                      </div>
                      <div className="mt-3 line-clamp-2 text-[11px] leading-5 text-text-secondary">
                        Base {formatCredits(rule.baseFeeCredits)} credits, rate {formatCredits(rule.ratePerUnitCredits)} per unit, minimum {formatCredits(rule.minCredits)}.
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    {billingRuleMode === 'new' ? 'Create billing rule' : selectedBillingRule?.actionType ?? 'Select a billing rule'}
                  </h2>
                  {selectedBillingRule && billingRuleMode === 'view' && (
                    <Badge tone={selectedBillingRule.isActive ? 'accent' : 'muted'}>{selectedBillingRule.isActive ? 'Active' : 'Inactive'}</Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  {billingRuleMode === 'new' ? (
                    <span>Define a pricing rule for an action or model.</span>
                  ) : selectedBillingRule ? (
                    <>
                      <span>{selectedBillingRule.provider ?? 'Any provider'}</span>
                      <span>•</span>
                      <span>Updated {formatDateTime(selectedBillingRule.updatedAt)}</span>
                    </>
                  ) : (
                    <span>No billing rule selected.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {billingRuleMode === 'view' && selectedBillingRule && (
                  <button
                    type="button"
                    onClick={deleteBillingRuleItem}
                    disabled={billingRuleSaving}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[12px] font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveBillingRule}
                  disabled={billingRuleSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {billingRuleSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                  Save
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Total" value={String(billingRuleStats.total)} icon={<Database size={14} />} />
              <StatCard label="Active" value={String(billingRuleStats.active)} icon={<CircleCheck size={14} />} accent />
              <StatCard label="Inactive" value={String(billingRuleStats.inactive)} icon={<CircleDashed size={14} />} />
              <StatCard label="Actions" value={String(billingRuleStats.actions)} icon={<Layers3 size={14} />} />
            </div>
          </div>

          <div className="p-5">
            {billingRuleError && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                <div>{billingRuleError}</div>
              </div>
            )}

            {billingRuleDetailLoading ? (
              <div className="grid gap-4">
                <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
                <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Field label="Action type" helper="Required">
                    <Input value={billingRuleForm.actionType} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, actionType: value }))} placeholder="youtube.summary" />
                  </Field>
                  <Field label="Provider">
                    <Input value={billingRuleForm.provider} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, provider: value }))} placeholder="OpenAI" />
                  </Field>
                  <Field label="Model">
                    <Input value={billingRuleForm.model} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, model: value }))} placeholder="gpt-4.1-mini" />
                  </Field>
                  <Field label="Version">
                    <Input value={billingRuleForm.version} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, version: value }))} placeholder="1" />
                  </Field>
                  <Field label="Unit type">
                    <select
                      value={billingRuleForm.unitType}
                      onChange={(e) => setBillingRuleForm((cur) => ({ ...cur, unitType: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent/60 focus:bg-bg-card"
                    >
                      <option value="token">Token</option>
                      <option value="minute">Minute</option>
                      <option value="second">Second</option>
                      <option value="mb">MB</option>
                      <option value="item">Item</option>
                      <option value="call">Call</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </Field>
                  <Field label="Effective from">
                    <input
                      type="datetime-local"
                      value={billingRuleForm.effectiveFrom}
                      onChange={(e) => setBillingRuleForm((cur) => ({ ...cur, effectiveFrom: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/60 focus:bg-bg-card"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Field label="Base fee credits">
                    <Input value={billingRuleForm.baseFeeCredits} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, baseFeeCredits: value }))} placeholder="0" />
                  </Field>
                  <Field label="Rate per unit credits">
                    <Input value={billingRuleForm.ratePerUnitCredits} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, ratePerUnitCredits: value }))} placeholder="0.0025" />
                  </Field>
                  <Field label="Minimum credits">
                    <Input value={billingRuleForm.minCredits} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, minCredits: value }))} placeholder="0" />
                  </Field>
                  <Field label="Maximum credits">
                    <Input value={billingRuleForm.maxCredits} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, maxCredits: value }))} placeholder="Optional" />
                  </Field>
                  <Field label="Multiplier">
                    <Input value={billingRuleForm.multiplier} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, multiplier: value }))} placeholder="1" />
                  </Field>
                  <Field label="Active">
                    <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-bg-input px-3.5 py-2.5">
                      <Toggle checked={billingRuleForm.isActive} onChange={(value) => setBillingRuleForm((cur) => ({ ...cur, isActive: value }))} />
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{billingRuleForm.isActive ? 'Enabled' : 'Disabled'}</div>
                        <div className="text-[11px] text-text-muted">Inactive rules are kept for history and future versioning.</div>
                      </div>
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                      <KeyRound size={14} className="text-accent" />
                      Rule guidance
                    </div>
                    <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                      <div><span className="text-text-primary">Action type</span> is the workflow or action identifier, like <span className="text-text-primary">youtube.summary</span>.</div>
                      <div><span className="text-text-primary">Unit type</span> controls how usage is measured: token, minute, second, MB, item, call, or fixed.</div>
                      <div><span className="text-text-primary">Multiplier</span> lets you add margin or risk buffer on top of provider cost.</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                      <Shield size={14} className="text-accent" />
                      Billing behavior
                    </div>
                    <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                      <div>Rules are used later by the billing engine to price usage events.</div>
                      <div>Keep versions incrementing when changing the pricing formula.</div>
                      <div>Effective dates let you change prices without losing history.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderBillingPanel = () => {
    const userInitials = (user: AdminUserResponse | null) => {
      if (!user) return 'U';
      const source = user.displayName?.trim() || user.email;
      const parts = source.split(/[\s@._-]+/).filter(Boolean);
      return (parts.slice(0, 2).map((part) => part[0]).join('') || 'U').toUpperCase();
    };

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary">User billing</h2>
                <p className="text-[11px] text-text-muted">Inspect balance, ledger, reservations, and top up credits.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedBillingUserId) return;
                  void reloadBillingDetails(selectedBillingUserId).catch((err) => {
                    setBillingError(err instanceof Error ? err.message : 'Failed to refresh billing details');
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={billingUserSearch}
                  onChange={(e) => setBillingUserSearch(e.target.value)}
                  placeholder="Search by email, name, role..."
                  className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={13} className="text-text-muted" />
                {(['all', 'active', 'disabled', 'deleted'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBillingUserStatusFilter(value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      billingUserStatusFilter === value
                        ? 'bg-accent text-bg-primary'
                        : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
            {filteredBillingUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <div className="text-[13px] font-medium text-text-primary">No users match your filters.</div>
                <div className="mt-1 text-[11px] text-text-muted">Try a different search or status filter.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBillingUsers.map((user) => {
                  const isSelected = user.id === selectedBillingUserId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedBillingUserId(user.id);
                        setBillingTopUpForm(EMPTY_BILLING_TOPUP_FORM);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                          : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg-card text-[12px] font-bold text-accent">
                          {userInitials(user)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-text-primary">{user.displayName ?? user.email}</div>
                              <div className="mt-0.5 truncate text-[11px] text-text-muted">{user.email}</div>
                            </div>
                            <Badge tone={user.status === 'active' ? 'accent' : 'muted'}>{user.status}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {user.roles.slice(0, 3).map((role) => (
                              <Badge key={role}>{role}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    {selectedBillingUser ? selectedBillingUser.displayName ?? selectedBillingUser.email : 'Select a user'}
                  </h2>
                  {selectedBillingUser && <Badge tone={selectedBillingUser.status === 'active' ? 'accent' : 'muted'}>{selectedBillingUser.status}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  {selectedBillingUser ? (
                    <>
                      <span>{selectedBillingUser.email}</span>
                      <span>•</span>
                      <span>Updated {formatDateTime(selectedBillingUser.updatedAt)}</span>
                    </>
                  ) : (
                    <span>No user selected.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveBillingTopUp}
                  disabled={billingSaving || !selectedBillingUser}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {billingSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                  Top up
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Balance" value={formatCredits(billingStats.balance)} icon={<Database size={14} />} />
              <StatCard label="Reserved" value={formatCredits(billingStats.reserved)} icon={<Clock3 size={14} />} />
              <StatCard label="Available" value={formatCredits(billingStats.available)} icon={<CircleCheck size={14} />} accent />
              <StatCard label="Ledger" value={String(billingStats.ledger)} icon={<Layers3 size={14} />} />
            </div>
          </div>

          <div className="p-5">
            {billingDetailLoading ? (
              <div className="grid gap-4">
                <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
                <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                      <KeyRound size={14} className="text-accent" />
                      Top up balance
                    </div>
                    <div className="mt-4 grid gap-4">
                      <Field label="Credits">
                        <Input value={billingTopUpForm.credits} onChange={(value) => setBillingTopUpForm((cur) => ({ ...cur, credits: value }))} placeholder="50" />
                      </Field>
                      <Field label="Reason">
                        <Input value={billingTopUpForm.reason} onChange={(value) => setBillingTopUpForm((cur) => ({ ...cur, reason: value }))} placeholder="Manual top up" />
                      </Field>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                      <Shield size={14} className="text-accent" />
                      Current account
                    </div>
                    <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                      <div>Balance and reservations are fetched from the billing wallet.</div>
                      <div>Reserved credits are blocked for active workflows.</div>
                      <div>Top-up writes a ledger entry immediately.</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-text-primary">Active reservations</div>
                      <Badge tone="accent">{billingReservations.length}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {billingReservations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[11px] text-text-muted">No reservations.</div>
                      ) : (
                        billingReservations.slice(0, 5).map((reservation) => (
                          <div key={reservation.id} className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-semibold text-text-primary">{reservation.sourceType}</div>
                                <div className="mt-0.5 truncate text-[11px] text-text-muted">{reservation.reason ?? 'No reason set'}</div>
                              </div>
                              <Badge tone={reservation.status === 'active' ? 'accent' : 'muted'}>{reservation.status}</Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                              <span>{formatCredits(reservation.estimatedCredits)} credits</span>
                              <span>•</span>
                              <span>{formatDateTime(reservation.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-text-primary">Ledger</div>
                      <Badge tone="accent">{billingLedger.length}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {billingLedger.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[11px] text-text-muted">No ledger entries.</div>
                      ) : (
                        billingLedger.slice(0, 6).map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-semibold text-text-primary">{entry.entryType}</div>
                                <div className="mt-0.5 truncate text-[11px] text-text-muted">{entry.reason ?? 'No reason set'}</div>
                              </div>
                              <Badge tone={entry.entryType === 'topup' ? 'accent' : 'muted'}>{formatCredits(entry.amountCredits)}</Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                              <span>{entry.sourceType ?? 'manual'}</span>
                              <span>•</span>
                              <span>{formatDateTime(entry.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderWorkflowsPanel = () => {
    const userInitials = (item: WorkflowHostRow | null) => {
      if (!item) return 'W';
      const source = item.requestedByUserDisplayName?.trim() || item.requestedByUserEmail || item.workflowId;
      const parts = source.split(/[\s@._-]+/).filter(Boolean);
      return (parts.slice(0, 2).map((part) => part[0]).join('') || 'W').toUpperCase();
    };

    const eventContextText = (context: Record<string, unknown>) => {
      const keys = Object.keys(context);
      if (keys.length === 0) return 'No extra context.';
      try {
        return JSON.stringify(context, null, 2);
      } catch {
        return 'Context could not be serialized.';
      }
    };

    const refreshWorkflows = async () => {
      setWorkflowCostsError(null);
      setWorkflowHostError(null);
      try {
        setWorkflowRefreshNonce((current) => current + 1);
        const [items, activeItems, historyItems] = await Promise.all([
          listWorkflowCosts(100, 0),
          listActiveWorkflows(100, 0),
          listHistoryWorkflows(100, 0),
        ]);
        setWorkflowCosts(items);
        setActiveWorkflows(activeItems);
        setHistoryWorkflows(historyItems);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to refresh workflows';
        setWorkflowCostsError(message);
        setWorkflowHostError(message);
      }
    };

    const getContextString = (context: Record<string, unknown>, key: string): string | null => {
      const value = context[key];
      return typeof value === 'string' ? value : null;
    };

    const getContextNumber = (context: Record<string, unknown>, key: string): number | null => {
      const value = context[key];
      return typeof value === 'number' ? value : null;
    };

    const getContextArray = (context: Record<string, unknown>, key: string): Record<string, unknown>[] => {
      const value = context[key];
      return Array.isArray(value)
        ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        : [];
    };

    const selectedStepLogsHeader = selectedWorkflowStep ? `${selectedWorkflowStep.stepKey} logs` : 'Step logs';
    const selectedStepEvents = selectedWorkflowStep
      ? workflowEvents
        .filter((event) => event.stepKey === selectedWorkflowStep.stepKey)
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : [];
    const selectedSearchPlanningEvent = selectedWorkflowStep?.stepKey === 'search_intake'
      ? selectedStepEvents.find((event) => event.message === 'Research queries planned.')
      : null;
    const selectedSearchSources = selectedWorkflowStep?.stepKey === 'search_intake'
      ? selectedStepEvents
        .filter((event) => event.message === 'Research source search started.')
        .map((startEvent) => {
          const searchRunId = getContextString(startEvent.context, 'searchRunId');
          const finishEvent = searchRunId
            ? selectedStepEvents.find((event) =>
              event.message === 'Research source search finished.' &&
              getContextString(event.context, 'searchRunId') === searchRunId)
            : null;

          return {
            searchRunId,
            source: getContextString(startEvent.context, 'source') ?? 'unknown',
            adapter: getContextString(startEvent.context, 'adapter') ?? 'unknown',
            queryCount: getContextNumber(startEvent.context, 'queryCount'),
            queries: getContextArray(startEvent.context, 'queries'),
            startEvent,
            finishEvent,
          };
        })
      : [];
    const visibleWorkflowEvents = workflowEventScope === 'all' ? workflowEvents : selectedStepEvents;

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary">Workflows</h2>
                <p className="text-[11px] text-text-muted">Inspect live workflows, completed runs, and their logs.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refreshWorkflows();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={workflowCostSearch}
                  onChange={(e) => setWorkflowCostSearch(e.target.value)}
                  placeholder="Search by user, workflow, source, status, or ID..."
                  className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Filter size={13} className="text-text-muted" />
                {(['all', 'queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'dead'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWorkflowCostStatusFilter(value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      workflowCostStatusFilter === value
                        ? 'bg-accent text-bg-primary'
                        : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
            {filteredWorkflowRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <div className="text-[13px] font-medium text-text-primary">No workflows match your filters.</div>
                <div className="mt-1 text-[11px] text-text-muted">Try a different search or status filter.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredWorkflowRows.map((item) => {
                  const isSelected = item.workflowId === selectedWorkflowKey;
                  return (
                    <button
                      key={item.workflowId}
                      type="button"
                      onClick={() => {
                        setSelectedWorkflowKey(item.workflowId);
                        setWorkflowCostsError(null);
                        setWorkflowHostError(null);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                          : 'border-border bg-bg-input/40 hover:border-border/80 hover:bg-bg-input'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg-card text-[12px] font-bold text-accent">
                          {userInitials(item)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-text-primary">
                                {item.requestedByUserDisplayName ?? item.requestedByUserEmail ?? 'System workflow'}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-text-muted">
                                {item.workflowType} • {item.sourceLabel ?? item.workflowId}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <Badge tone={item.kind === 'active' ? 'accent' : 'muted'}>{item.kind === 'active' ? 'Live' : 'History'}</Badge>
                              <Badge tone={item.workflowStatus === 'succeeded' ? 'accent' : 'muted'}>{item.workflowStatus}</Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.kind === 'cost' ? (
                              <>
                                <Badge>{formatCredits(item.estimatedCredits ?? 0)} est</Badge>
                                <Badge tone={item.finalCredits !== null ? 'accent' : 'muted'}>
                                  {item.finalCredits !== null ? `${formatCredits(item.finalCredits)} final` : 'Open'}
                                </Badge>
                              </>
                            ) : (
                              <>
                                <Badge>{item.progressPercent !== null ? `${item.progressPercent}%` : 'Live'}</Badge>
                                <Badge tone={item.currentStepKey ? 'accent' : 'muted'}>{item.currentStepKey ?? 'No step'}</Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    {selectedWorkflow
                      ? selectedWorkflow.requestedByUserDisplayName ?? selectedWorkflow.requestedByUserEmail ?? 'Workflow'
                      : 'Select a workflow'}
                  </h2>
                  {selectedWorkflow && <Badge tone={selectedWorkflow.kind === 'active' ? 'accent' : 'muted'}>{selectedWorkflow.kind === 'active' ? 'Live' : 'History'}</Badge>}
                  {selectedWorkflow && <Badge tone={selectedWorkflow.workflowStatus === 'succeeded' ? 'accent' : 'muted'}>{selectedWorkflow.workflowStatus}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  {selectedWorkflow ? (
                    <>
                      <span>{selectedWorkflow.workflowType}</span>
                      <span>•</span>
                      <span>{selectedWorkflow.sourceLabel ?? selectedWorkflow.workflowId}</span>
                      <span>•</span>
                      <span>Created {formatDateTime(selectedWorkflow.createdAt)}</span>
                    </>
                  ) : (
                    <span>No workflow selected.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedWorkflow?.kind === 'active' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedWorkflow) return;
                      setWorkflowCanceling(true);
                      setWorkflowStepJobLogsError(null);
                      try {
                        await requestWorkflowCancel(selectedWorkflow.workflowId);
                        setWorkflowRefreshNonce((current) => current + 1);
                      } catch (err) {
                        setWorkflowStepJobLogsError(err instanceof Error ? err.message : 'Failed to request workflow cancel');
                      } finally {
                        setWorkflowCanceling(false);
                      }
                    }}
                    disabled={workflowCanceling}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CircleDashed size={14} />
                    {workflowCanceling ? 'Stopping…' : 'Stop workflow'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void refreshWorkflows();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Total" value={String(workflowCostStats.total)} icon={<Layers3 size={14} />} />
              <StatCard label="Succeeded" value={String(workflowCostStats.succeeded)} icon={<CircleCheck size={14} />} accent />
              <StatCard label="Running" value={String(workflowCostStats.active)} icon={<Clock3 size={14} />} />
              <StatCard label="Charged" value={formatCredits(workflowCostStats.charged)} icon={<Database size={14} />} />
            </div>
          </div>

          <div className="p-5">
            {workflowCostsLoading || workflowHostLoading ? (
              <div className="grid gap-4">
                <div className="h-28 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
                <div className="h-64 rounded-2xl border border-border bg-bg-input/60 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                      <Database size={14} className="text-accent" />
                      {selectedWorkflow?.kind === 'active' ? 'Live workflow' : 'History snapshot'}
                    </div>
                    {selectedWorkflow ? (
                      selectedWorkflow.kind === 'cost' ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-text-muted">
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Estimated</div>
                            <div className="mt-1 text-[16px] font-semibold text-text-primary">{formatCredits(selectedWorkflow.estimatedCredits ?? 0)}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Final</div>
                            <div className="mt-1 text-[16px] font-semibold text-text-primary">
                              {selectedWorkflow.finalCredits !== null ? formatCredits(selectedWorkflow.finalCredits) : 'Open'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Reservation</div>
                            <div className="mt-1 text-[12px] font-semibold text-text-primary">{selectedWorkflow.reservationStatus ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Source type</div>
                            <div className="mt-1 text-[12px] font-semibold text-text-primary">{selectedWorkflow.sourceType ?? '—'}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-text-muted">
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Progress</div>
                            <div className="mt-1 text-[16px] font-semibold text-text-primary">
                              {selectedWorkflow.progressPercent !== null ? `${selectedWorkflow.progressPercent}%` : 'Live'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Current step</div>
                            <div className="mt-1 truncate text-[12px] font-semibold text-text-primary">{selectedWorkflow.currentStepKey ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Attempts</div>
                            <div className="mt-1 text-[12px] font-semibold text-text-primary">
                              {selectedWorkflow.attemptCount ?? 0}/{selectedWorkflow.maxAttempts ?? '—'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                            <div className="text-text-muted">Heartbeat</div>
                            <div className="mt-1 text-[12px] font-semibold text-text-primary">{formatDateTime(selectedWorkflow.heartbeatAt)}</div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="mt-3 text-[11px] text-text-muted">Select a workflow on the left to inspect live state or history details.</div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                      <Shield size={14} className="text-accent" />
                      Workflow details
                    </div>
                    {selectedWorkflow ? (
                      <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                        <div><span className="text-text-primary">Workflow ID:</span> {selectedWorkflow.workflowId}</div>
                        <div><span className="text-text-primary">User:</span> {selectedWorkflow.requestedByUserDisplayName ?? selectedWorkflow.requestedByUserEmail ?? 'System'}</div>
                        <div><span className="text-text-primary">Email:</span> {selectedWorkflow.requestedByUserEmail ?? '—'}</div>
                        <div><span className="text-text-primary">Source:</span> {selectedWorkflow.sourceLabel ?? '—'}</div>
                        <div><span className="text-text-primary">Source ID:</span> {selectedWorkflow.sourceId ?? '—'}</div>
                        <div><span className="text-text-primary">Error code:</span> {selectedWorkflow.errorCode ?? '—'}</div>
                        <div><span className="text-text-primary">Error message:</span> {selectedWorkflow.errorMessage ?? '—'}</div>
                        <div><span className="text-text-primary">Created:</span> {formatDateTime(selectedWorkflow.createdAt)}</div>
                        <div><span className="text-text-primary">Started:</span> {formatDateTime(selectedWorkflow.startedAt)}</div>
                        <div><span className="text-text-primary">Finished:</span> {formatDateTime(selectedWorkflow.finishedAt)}</div>
                        {selectedWorkflow.kind === 'active' ? (
                          <>
                            <div><span className="text-text-primary">Locked by:</span> {selectedWorkflow.lockedBy ?? '—'}</div>
                            <div><span className="text-text-primary">Locked at:</span> {formatDateTime(selectedWorkflow.lockedAt)}</div>
                            <div><span className="text-text-primary">Locked until:</span> {formatDateTime(selectedWorkflow.lockedUntil)}</div>
                          </>
                        ) : (
                          <>
                            <div><span className="text-text-primary">Provider:</span> {selectedWorkflow.diagnosticProvider ?? '—'}</div>
                            <div>
                              <span className="text-text-primary">Provider diagnostic:</span>
                              <div className="mt-1 max-h-44 overflow-auto rounded-xl border border-border bg-bg-card/70 p-2 text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                                {selectedWorkflow.diagnosticMessage ?? '—'}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-[11px] text-text-muted">Choose a workflow to inspect metadata.</div>
                    )}
                  </div>
                </div>

                <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-text-primary">Steps</div>
                    <Badge tone={workflowStepsLoading ? 'muted' : workflowStepsError ? 'muted' : 'accent'}>
                      {workflowStepsLoading ? 'Loading' : workflowStepsError ? 'Error' : `${workflowSteps.length} steps`}
                    </Badge>
                  </div>
                  {workflowStepsError ? (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                      {workflowStepsError}
                    </div>
                  ) : workflowStepsLoading ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                      <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                    </div>
                  ) : workflowSteps.length === 0 ? (
                    <div className="mt-3 text-[11px] text-text-muted">No step details recorded for this workflow.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {workflowSteps
                        .slice()
                        .sort((a, b) => a.stepOrder - b.stepOrder)
                        .map((step) => {
                          const isSelected = step.id === selectedWorkflowStepId;
                          return (
                            <button
                              key={step.id}
                              type="button"
                              onClick={() => setSelectedWorkflowStepId(step.id)}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                isSelected
                                  ? 'border-accent/40 bg-accent/10'
                                  : 'border-border bg-bg-card/70 hover:border-border/80 hover:bg-bg-card'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-semibold text-text-primary">
                                    {step.stepOrder}. {step.stepKey}
                                  </div>
                                  <div className="mt-0.5 truncate text-[10px] text-text-muted">
                                    {step.stepType}
                                    {step.jobId ? ` • ${step.jobId}` : ''}
                                  </div>
                                </div>
                                <Badge tone={step.status === 'succeeded' ? 'accent' : step.status === 'failed' ? 'muted' : 'default'}>
                                  {step.status}
                                </Badge>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-text-primary">Step details</div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-full border border-border bg-bg-card p-1">
                        <button
                          type="button"
                          onClick={() => setWorkflowEventScope('step')}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                            workflowEventScope === 'step'
                              ? 'bg-accent text-bg-primary'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          Step events
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkflowEventScope('all')}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                            workflowEventScope === 'all'
                              ? 'bg-accent text-bg-primary'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          All events
                        </button>
                      </div>
                      {selectedWorkflowStep && (
                        <Badge tone={selectedWorkflowStep.status === 'succeeded' ? 'accent' : selectedWorkflowStep.status === 'failed' ? 'muted' : 'default'}>
                          {selectedWorkflowStep.status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {selectedWorkflowStep ? (
                    <div className="mt-3 space-y-4">
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Step order</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">{selectedWorkflowStep.stepOrder}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Type</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">{selectedWorkflowStep.stepType}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Job ID</div>
                          <div className="mt-1 break-all text-[12px] font-semibold text-text-primary">{selectedWorkflowStep.jobId ?? '—'}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Updated</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">
                            {selectedWorkflowStep.finishedAt ? formatDateTime(selectedWorkflowStep.finishedAt) : formatDateTime(selectedWorkflowStep.startedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-bg-card/70 p-4">
                          <div className="text-[12px] font-semibold text-text-primary">Input</div>
                          <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-bg-secondary/60 p-3 text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                            {eventContextText(selectedWorkflowStep.input ?? {})}
                          </pre>
                        </div>
                        <div className="rounded-2xl border border-border bg-bg-card/70 p-4">
                          <div className="text-[12px] font-semibold text-text-primary">Output</div>
                          <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-bg-secondary/60 p-3 text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                            {eventContextText(selectedWorkflowStep.output ?? {})}
                          </pre>
                        </div>
                      </div>

                      {selectedWorkflowStep.stepKey === 'search_intake' && (
                        <div className="space-y-3">
                          <div className="text-[12px] font-semibold text-text-primary">Search intake breakdown</div>

                          {selectedSearchPlanningEvent && (
                            <div className="rounded-2xl border border-border bg-bg-card/70 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-[12px] font-semibold text-text-primary">Planned sources</div>
                                  <div className="mt-0.5 text-[11px] text-text-muted">
                                    {getContextString(selectedSearchPlanningEvent.context, 'topicSummary') ?? 'Topic summary unavailable.'}
                                  </div>
                                </div>
                                <Badge tone="accent">
                                  {getContextNumber(selectedSearchPlanningEvent.context, 'queryCount') ?? 0} queries
                                </Badge>
                              </div>

                              <div className="mt-3 grid gap-2">
                                {getContextArray(selectedSearchPlanningEvent.context, 'sources').map((sourcePlan, index) => {
                                  const source = getContextString(sourcePlan, 'source') ?? `source ${index + 1}`;
                                  const queries = getContextArray(sourcePlan, 'queries');
                                  const queryLabels = queries
                                    .map((queryPlan) => getContextString(queryPlan, 'query') ?? '')
                                    .filter(Boolean);

                                  return (
                                    <div key={`${source}-${index}`} className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-[12px] font-semibold text-text-primary">{source}</div>
                                        <Badge tone="muted">{getContextNumber(sourcePlan, 'queryCount') ?? queries.length} queries</Badge>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {queryLabels.length > 0 ? queryLabels.map((query) => (
                                          <span key={query} className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[10px] text-text-secondary">
                                            {query}
                                          </span>
                                        )) : (
                                          <span className="text-[11px] text-text-muted">No query text recorded.</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {selectedSearchSources.length > 0 && (
                            <div className="grid gap-3">
                              {selectedSearchSources.map((sourceRun) => {
                                const finishContext = sourceRun.finishEvent?.context ?? {};
                                const queryLabels = sourceRun.queries
                                  .map((queryPlan) => getContextString(queryPlan, 'query') ?? '')
                                  .filter(Boolean);
                                const topResults = Array.isArray(finishContext['topResults'])
                                  ? finishContext['topResults'].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
                                  : [];

                                return (
                                  <div key={sourceRun.searchRunId ?? sourceRun.source} className="rounded-2xl border border-border bg-bg-card/70 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <div className="text-[12px] font-semibold text-text-primary">{sourceRun.source}</div>
                                        <div className="mt-0.5 text-[11px] text-text-muted">{sourceRun.adapter}</div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge tone="muted">{sourceRun.queryCount ?? sourceRun.queries.length} queries</Badge>
                                        <Badge tone={sourceRun.finishEvent ? 'accent' : 'default'}>
                                          {sourceRun.finishEvent ? 'completed' : 'running'}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                      <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Search run</div>
                                        <div className="mt-1 break-all text-[11px] font-semibold text-text-primary">{sourceRun.searchRunId ?? '—'}</div>
                                      </div>
                                      <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Results</div>
                                        <div className="mt-1 text-[11px] font-semibold text-text-primary">
                                          {getContextNumber(finishContext, 'uniqueResultCount') ?? getContextNumber(finishContext, 'combinedResultCount') ?? 0}
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Finished</div>
                                        <div className="mt-1 text-[11px] font-semibold text-text-primary">
                                          {formatDateTime(sourceRun.finishEvent?.createdAt ?? sourceRun.startEvent.createdAt)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3">
                                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Queries</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {queryLabels.length > 0 ? queryLabels.map((query) => (
                                          <span key={query} className="rounded-full border border-border bg-bg-input/40 px-2.5 py-1 text-[10px] text-text-secondary">
                                            {query}
                                          </span>
                                        )) : (
                                          <span className="text-[11px] text-text-muted">No queries recorded.</span>
                                        )}
                                      </div>
                                    </div>

                                    {topResults.length > 0 && (
                                      <div className="mt-3">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Top results</div>
                                        <div className="mt-2 space-y-2">
                                          {topResults.slice(0, 5).map((result, index) => (
                                            <div key={`${sourceRun.searchRunId ?? sourceRun.source}-${index}`} className="rounded-xl border border-border bg-bg-input/40 px-3 py-2">
                                              <div className="truncate text-[11px] font-semibold text-text-primary">
                                                {typeof result.title === 'string' ? result.title : 'Untitled result'}
                                              </div>
                                              <div className="mt-0.5 truncate text-[10px] text-text-muted">
                                                {typeof result.url === 'string' ? result.url : '—'}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {visibleWorkflowEvents.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[12px] font-semibold text-text-primary">
                            {workflowEventScope === 'all' ? 'All workflow events' : 'Step events'}
                          </div>
                          <div className="space-y-2">
                            {visibleWorkflowEvents.map((event) => (
                              <div key={event.id} className="rounded-xl border border-border bg-bg-card px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Badge tone={event.level === 'error' ? 'muted' : 'accent'}>{event.level}</Badge>
                                    <div className="truncate text-[11px] font-semibold text-text-primary">{event.message}</div>
                                  </div>
                                  <div className="text-[10px] text-text-muted">{formatDateTime(event.createdAt)}</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-muted">
                                  <span>{event.stepKey ?? 'root'}</span>
                                  <span>•</span>
                                  <span>{event.workflowId}</span>
                                </div>
                                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-bg-secondary/60 p-2 text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                                  {eventContextText(event.context)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-text-muted">Pick a step to inspect inputs, outputs, and child activity.</div>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-text-primary">{selectedStepLogsHeader}</div>
                    <div className="flex items-center gap-2">
                      {selectedWorkflowStep?.jobId && <Badge tone="muted">Job {selectedWorkflowStep.jobId}</Badge>}
                      <Badge tone={workflowStepJobLogsLoading ? 'muted' : workflowStepJobLogsError ? 'muted' : 'accent'}>
                        {workflowStepJobLogsLoading ? 'Loading' : workflowStepJobLogsError ? 'Error' : `${workflowStepJobLogs.length} logs`}
                      </Badge>
                    </div>
                  </div>
                  {workflowStepJobLogsError ? (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                      {workflowStepJobLogsError}
                    </div>
                  ) : workflowStepJobLogsLoading ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                      <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                      <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                    </div>
                  ) : !selectedWorkflowStep?.jobId ? (
                    <div className="mt-3 text-[11px] text-text-muted">Pick a step with a job ID to inspect worker logs.</div>
                  ) : workflowStepJobLogs.length === 0 ? (
                    <div className="mt-3 text-[11px] text-text-muted">No logs recorded for this job.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {workflowStepJobLogs.map((log) => (
                        <div key={log.id} className="rounded-xl border border-border bg-bg-card px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge tone={log.level === 'error' ? 'muted' : log.level === 'warn' ? 'default' : 'accent'}>{log.level}</Badge>
                              <div className="truncate text-[11px] font-semibold text-text-primary">{log.message}</div>
                            </div>
                            <div className="text-[10px] text-text-muted">{formatDateTime(log.createdAt)}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-muted">
                            <span>{log.attemptNo !== null ? `attempt ${log.attemptNo}` : 'attempt —'}</span>
                            <span>•</span>
                            <span>{log.jobId}</span>
                          </div>
                          <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-border bg-bg-secondary/60 p-2 text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                            {eventContextText(log.context)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-text-primary">Jobs</div>
                      <div className="mt-0.5 text-[10px] text-text-muted">All queued, running, and completed jobs.</div>
                    </div>
                    <Badge tone={jobsLoading ? 'muted' : jobsError ? 'muted' : 'accent'}>
                      {jobsLoading ? 'Loading' : jobsError ? 'Error' : `${filteredJobRows.length} jobs`}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        placeholder="Search by job type, status, payload, or ID..."
                        className="w-full rounded-xl border border-border bg-bg-input py-2.5 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/60"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Filter size={13} className="text-text-muted" />
                      {(['all', 'queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'dead'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setJobStatusFilter(value)}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                            jobStatusFilter === value
                              ? 'bg-accent text-bg-primary'
                              : 'border border-border bg-bg-input text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {jobsError ? (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                      {jobsError}
                    </div>
                  ) : jobsLoading ? (
                    <div className="mt-3 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <div className="h-16 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                        <div className="h-16 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                      </div>
                      <div className="h-56 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {filteredJobRows.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                            <div className="text-[13px] font-medium text-text-primary">No jobs match your filters.</div>
                            <div className="mt-1 text-[11px] text-text-muted">Try a different search or status filter.</div>
                          </div>
                        ) : (
                          filteredJobRows.map((item) => {
                            const isSelected = item.jobId === selectedJobId;
                            const sourceLabel =
                              typeof item.payload.sourceLabel === 'string'
                                ? item.payload.sourceLabel
                                : typeof item.payload.sourceId === 'string'
                                  ? item.payload.sourceId
                                  : item.jobType;

                            return (
                              <button
                                key={item.jobId}
                                type="button"
                                onClick={() => setSelectedJobId(item.jobId)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                                  isSelected
                                    ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                                    : 'border-border bg-bg-card/70 hover:border-border/80 hover:bg-bg-card'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[12px] font-semibold text-text-primary">{item.jobType}</div>
                                    <div className="mt-0.5 truncate text-[11px] text-text-muted">{sourceLabel}</div>
                                  </div>
                                  <Badge tone={item.jobStatus === 'succeeded' ? 'accent' : item.jobStatus === 'failed' ? 'muted' : 'default'}>
                                    {item.jobStatus}
                                  </Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Badge tone="muted">{item.jobId}</Badge>
                                  <Badge>{formatDateTime(item.createdAt)}</Badge>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-bg-card/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[12px] font-semibold text-text-primary">
                                {selectedJob ? selectedJob.jobType : 'Select a job'}
                              </div>
                              <div className="mt-0.5 truncate text-[10px] text-text-muted">
                                {selectedJob ? selectedJob.jobId : 'Choose a job from the list to inspect details and logs.'}
                              </div>
                            </div>
                            {selectedJob && <Badge tone={selectedJob.jobStatus === 'succeeded' ? 'accent' : selectedJob.jobStatus === 'failed' ? 'muted' : 'default'}>{selectedJob.jobStatus}</Badge>}
                          </div>

                          {selectedJob ? (
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Job ID</div>
                                <div className="mt-1 break-all text-[12px] font-semibold text-text-primary">{selectedJob.jobId}</div>
                              </div>
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Type</div>
                                <div className="mt-1 text-[12px] font-semibold text-text-primary">{selectedJob.jobType}</div>
                              </div>
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Progress</div>
                                <div className="mt-1 text-[12px] font-semibold text-text-primary">
                                  {selectedJob.progressPercent !== null ? `${selectedJob.progressPercent}%` : '—'}
                                  {selectedJob.progressMessage ? ` • ${selectedJob.progressMessage}` : ''}
                                </div>
                              </div>
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Attempts</div>
                                <div className="mt-1 text-[12px] font-semibold text-text-primary">
                                  {selectedJob.attemptCount}/{selectedJob.maxAttempts}
                                </div>
                              </div>
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Started</div>
                                <div className="mt-1 text-[12px] font-semibold text-text-primary">{formatDateTime(selectedJob.startedAt)}</div>
                              </div>
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Finished</div>
                                <div className="mt-1 text-[12px] font-semibold text-text-primary">{formatDateTime(selectedJob.finishedAt)}</div>
                              </div>
                              <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-3 md:col-span-2">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Payload</div>
                                <pre className="mt-1 max-h-36 overflow-auto text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                                  {JSON.stringify(selectedJob.payload, null, 2)}
                                </pre>
                              </div>
                              {(selectedJob.errorMessage || selectedJob.errorCode) && (
                                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 md:col-span-2">
                                  <div className="text-[10px] uppercase tracking-[0.14em] text-red-200">Error</div>
                                  <div className="mt-1 text-[12px] font-semibold text-red-100">{selectedJob.errorCode ?? 'error'}</div>
                                  <div className="mt-1 text-[11px] text-red-100/90">{selectedJob.errorMessage ?? 'No error message'}</div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <section className="rounded-2xl border border-border bg-bg-input/40 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[12px] font-semibold text-text-primary">Job logs</div>
                            <Badge tone={jobLogsLoading ? 'muted' : jobLogsError ? 'muted' : 'accent'}>
                              {jobLogsLoading ? 'Loading' : jobLogsError ? 'Error' : `${jobLogs.length} logs`}
                            </Badge>
                          </div>
                          {jobLogsError ? (
                            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                              {jobLogsError}
                            </div>
                          ) : jobLogsLoading ? (
                            <div className="mt-3 space-y-2">
                              <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                              <div className="h-12 rounded-xl border border-border bg-bg-card/60 animate-pulse" />
                            </div>
                          ) : !selectedJob ? (
                            <div className="mt-3 text-[11px] text-text-muted">Select a job to inspect its logs.</div>
                          ) : jobLogs.length === 0 ? (
                            <div className="mt-3 text-[11px] text-text-muted">No logs recorded for this job.</div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {jobLogs.map((log) => (
                                <div key={log.id} className="rounded-xl border border-border bg-bg-card px-3 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Badge tone={log.level === 'error' ? 'muted' : log.level === 'warn' ? 'default' : 'accent'}>{log.level}</Badge>
                                      <div className="truncate text-[11px] font-semibold text-text-primary">{log.message}</div>
                                    </div>
                                    <div className="text-[10px] text-text-muted">{formatDateTime(log.createdAt)}</div>
                                  </div>
                                  <div className="mt-2 text-[10px] text-text-muted">
                                    attempt {log.attemptNo ?? '—'} • {log.jobId}
                                  </div>
                                  <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-border bg-bg-secondary/60 p-2 text-[10px] leading-relaxed text-text-muted whitespace-pre-wrap break-words">
                                    {eventContextText(log.context)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  void renderWorkflowsPanel;

  const renderRuntimeSettingsPanel = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">Runtime settings</h2>
              <p className="text-[11px] text-text-muted">Choose active providers. Secrets stay in .env.</p>
            </div>
            <button
              type="button"
              onClick={saveRuntimeSettings}
              disabled={runtimeSettingsSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {runtimeSettingsSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
              Save
            </button>
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-bg-input/40 p-3 text-[11px] text-text-muted">
            Admin settings are persisted in <span className="text-text-primary">upsettings</span>. API keys remain in environment variables.
          </div>
        </div>

        <div className="p-3 space-y-2">
          {[
            { label: 'Email provider', value: runtimeSettings.emailProvider, subtitle: 'Brevo and File dump are available; others can be added later.' },
            { label: 'Transcribe provider', value: runtimeSettings.transcribeProvider, subtitle: 'Whisper is live; OpenRouter is routed via a separate job type.' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-bg-input/40 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{item.label}</div>
              <div className="mt-1 text-[13px] font-semibold text-text-primary">{item.value}</div>
              <div className="mt-1 text-[11px] text-text-muted">{item.subtitle}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="min-h-[760px] rounded-3xl border border-border bg-bg-card/90 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold text-text-primary">Provider routing</h2>
                <Badge tone="accent">Live</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                <span>Change the active provider without redeploying.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveRuntimeSettings}
                disabled={runtimeSettingsSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {runtimeSettingsSaving ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                Save changes
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {runtimeSettingsError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              <div>{runtimeSettingsError}</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Email provider">
              <select
                value={runtimeSettings.emailProvider}
                onChange={(e) => setRuntimeSettings((cur) => ({ ...cur, emailProvider: e.target.value }))}
                className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent/60 focus:bg-bg-card"
              >
                <option value="Brevo">Brevo</option>
                <option value="File">File dump</option>
                <option value="Resend">Resend</option>
                <option value="MailerSend">MailerSend</option>
                <option value="Postmark">Postmark</option>
                <option value="SendGrid">SendGrid</option>
                <option value="Ses">Amazon SES</option>
              </select>
            </Field>

            <Field label="Transcribe provider">
              <select
                value={runtimeSettings.transcribeProvider}
                onChange={(e) => setRuntimeSettings((cur) => ({ ...cur, transcribeProvider: e.target.value }))}
                className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent/60 focus:bg-bg-card"
              >
                <option value="Whisper">Whisper</option>
                <option value="OpenRouter">OpenRouter</option>
              </select>
            </Field>
            <Field label="Default from email">
              <Input value={runtimeSettings.emailFromEmail} onChange={(value) => setRuntimeSettings((cur) => ({ ...cur, emailFromEmail: value }))} placeholder="no-reply@example.com" />
            </Field>
            <Field label="Default from name">
              <Input value={runtimeSettings.emailFromName} onChange={(value) => setRuntimeSettings((cur) => ({ ...cur, emailFromName: value }))} placeholder="AiSummarizer" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                <KeyRound size={14} className="text-accent" />
                Environment keys
              </div>
              <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                <div><span className="text-text-primary">Email__Brevo__ApiKey</span> stays in `.env`.</div>
                <div><span className="text-text-primary">Email__FileDump__FolderPath</span> stores dumped emails in `.env`-configured folder.</div>
                <div><span className="text-text-primary">Jobs__WhisperTranscribe__*</span> stays in `.env`.</div>
                <div><span className="text-text-primary">Jobs__OpenRouterTranscribe__*</span> stays in `.env` for future external transcription.</div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-bg-input/40 p-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                <Shield size={14} className="text-accent" />
                Routing behavior
              </div>
              <div className="mt-3 space-y-2 text-[11px] text-text-muted">
                <div>Email sender resolves provider at send time.</div>
                <div>Workflow processor resolves transcription provider at queue time.</div>
                <div>Switching provider takes effect on the next request or workflow step.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const currentTitle =
    section === 'users'
      ? 'User management'
      : section === 'billing'
        ? 'User billing'
      : section === 'prompts'
        ? 'Prompt management'
        : section === 'llm-lab'
          ? 'LLM lab'
        : section === 'email-templates'
          ? 'Email template management'
        : section === 'search-providers'
        ? 'Search provider management'
        : section === 'billing-rules'
        ? 'Billing rules'
        : section === 'workflow-costs'
        ? 'Workflows'
        : 'Runtime settings';
  const currentDescription =
    section === 'users'
      ? 'Search users, inspect access, and edit profile data and roles.'
      : section === 'billing'
        ? 'Search a user, inspect credits, review transactions, and add balance.'
      : section === 'prompts'
        ? 'Scan, edit, archive, and delete prompt templates.'
        : section === 'llm-lab'
          ? 'Test reasoning providers and inspect the exact request and raw response payloads.'
        : section === 'email-templates'
          ? 'View, edit, add, and remove email templates used by the worker.'
      : section === 'search-providers'
        ? 'Add, review, and remove search-provider keys.'
        : section === 'billing-rules'
        ? 'Configure pricing rules for workflow billing and usage metering.'
        : section === 'workflow-costs'
        ? 'Inspect workflows, jobs, steps, logs, and cancellations.'
        : 'Choose active email and transcription providers.';

  const currentHeaderStats = section === 'users'
    ? [
        { label: 'Total', value: String(userStats.total), icon: <Users size={14} /> },
        { label: 'Active', value: String(userStats.active), icon: <CircleCheck size={14} />, accent: true },
        { label: 'Disabled', value: String(userStats.disabled), icon: <CircleDashed size={14} /> },
        { label: 'Deleted', value: String(userStats.deleted), icon: <Trash2 size={14} /> },
      ]
    : section === 'billing'
      ? [
          { label: 'Balance', value: formatCredits(billingStats.balance), icon: <Database size={14} /> },
          { label: 'Reserved', value: formatCredits(billingStats.reserved), icon: <Clock3 size={14} /> },
          { label: 'Available', value: formatCredits(billingStats.available), icon: <CircleCheck size={14} />, accent: true },
          { label: 'Ledger', value: String(billingStats.ledger), icon: <Layers3 size={14} /> },
        ]
    : section === 'prompts'
    ? [
        { label: 'Total', value: String(promptStats.total), icon: <Layers3 size={14} /> },
        { label: 'Active', value: String(promptStats.active), icon: <CircleCheck size={14} />, accent: true },
        { label: 'Inactive', value: String(promptStats.inactive), icon: <CircleDashed size={14} /> },
        { label: 'Archive', value: String(promptStats.archives), icon: <Archive size={14} /> },
      ]
    : section === 'llm-lab'
      ? [
          { label: 'Providers', value: '4', icon: <Server size={14} /> },
          { label: 'Presets', value: '12', icon: <Sparkles size={14} />, accent: true },
          { label: 'Raw JSON', value: 'Yes', icon: <Database size={14} /> },
          { label: 'Freeform', value: 'Yes', icon: <KeyRound size={14} /> },
        ]
    : section === 'email-templates'
      ? [
          { label: 'Total', value: String(emailTemplateStats.total), icon: <Layers3 size={14} /> },
          { label: 'Active', value: String(emailTemplateStats.active), icon: <CircleCheck size={14} />, accent: true },
          { label: 'Inactive', value: String(emailTemplateStats.inactive), icon: <CircleDashed size={14} /> },
          { label: 'HTML', value: String(emailTemplateStats.withHtml), icon: <KeyRound size={14} /> },
        ]
    : section === 'search-providers'
      ? [
        { label: 'Total', value: String(providerStats.total), icon: <Server size={14} /> },
        { label: 'Active', value: String(providerStats.active), icon: <CircleCheck size={14} />, accent: true },
        { label: 'Inactive', value: String(providerStats.inactive), icon: <CircleDashed size={14} /> },
        { label: 'Quota', value: formatQuota(providerStats.quota), icon: <KeyRound size={14} /> },
      ]
    : section === 'billing-rules'
      ? [
          { label: 'Total', value: String(billingRuleStats.total), icon: <Database size={14} /> },
          { label: 'Active', value: String(billingRuleStats.active), icon: <CircleCheck size={14} />, accent: true },
          { label: 'Inactive', value: String(billingRuleStats.inactive), icon: <CircleDashed size={14} /> },
          { label: 'Actions', value: String(billingRuleStats.actions), icon: <Layers3 size={14} /> },
        ]
    : section === 'workflow-costs'
      ? [
          { label: 'Total', value: String(workflowCostStats.total), icon: <Layers3 size={14} /> },
          { label: 'Succeeded', value: String(workflowCostStats.succeeded), icon: <CircleCheck size={14} />, accent: true },
          { label: 'Active', value: String(workflowCostStats.active), icon: <Clock3 size={14} /> },
          { label: 'Charged', value: formatCredits(workflowCostStats.charged), icon: <Database size={14} /> },
        ]
      : [
        { label: 'Email', value: runtimeSettings.emailProvider, icon: <Server size={14} /> },
        { label: 'From', value: runtimeSettings.emailFromEmail, icon: <KeyRound size={14} />, accent: true },
        { label: 'Transcribe', value: runtimeSettings.transcribeProvider, icon: <Sparkles size={14} /> },
        { label: 'State', value: 'Live', icon: <CircleCheck size={14} /> },
      ];

  return (
    <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_30%),linear-gradient(180deg,_#0c1221_0%,_#0a1020_100%)]">
      <div className="flex h-full">
        <aside className="w-[250px] shrink-0 border-r border-white/5 bg-bg-secondary/85 backdrop-blur-xl flex flex-col">
          <div className="border-b border-border px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center text-bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                <Shield size={18} strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-text-primary">Admin Console</div>
                <div className="text-[11px] text-text-muted">System operations</div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => changeSection('users')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'users' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Users size={16} />
                Users
              </button>
              <button
                type="button"
                onClick={() => changeSection('prompts')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'prompts' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Sparkles size={16} />
                Prompts
              </button>
              <button
                type="button"
                onClick={() => changeSection('llm-lab')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'llm-lab' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <PanelTop size={16} />
                LLM lab
              </button>
              <button
                type="button"
                onClick={() => changeSection('billing')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'billing' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Database size={16} />
                User billing
              </button>
              <button
                type="button"
                onClick={() => changeSection('email-templates')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'email-templates' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Settings2 size={16} />
                Email templates
              </button>
              <button
                type="button"
                onClick={() => changeSection('search-providers')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'search-providers' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Server size={16} />
                Search providers
              </button>
              <button
                type="button"
                onClick={() => changeSection('billing-rules')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'billing-rules' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Database size={16} />
                Billing rules
              </button>
              <button
                type="button"
                onClick={() => changeSection('workflow-costs')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'workflow-costs' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Layers3 size={16} />
                Workflows
              </button>
              <button
                type="button"
                onClick={() => changeSection('runtime-settings')}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  section === 'runtime-settings' ? 'bg-accent text-bg-primary font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                <Settings2 size={16} />
                Runtime settings
              </button>
            </div>
          </div>

          <div className="px-4">
            <div className="rounded-2xl border border-border bg-bg-card/80 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-accent" />
                <span className="text-[12px] font-semibold text-text-primary">Admin surface</span>
              </div>
              <div className="space-y-2">
                {(section === 'prompts'
                  ? [
                      { label: 'Prompt library', value: 'Managed templates', icon: <Layers3 size={14} /> },
                      { label: 'Execution trail', value: 'Runs and payloads', icon: <Activity size={14} /> },
                      { label: 'Version history', value: 'Archived revisions', icon: <Archive size={14} /> },
                    ]
                  : section === 'email-templates'
                    ? [
                        { label: 'Template library', value: 'View and edit email content', icon: <Settings2 size={14} /> },
                        { label: 'Rendering', value: 'Token replacement on send', icon: <Sparkles size={14} /> },
                        { label: 'Fallback', value: 'Built-in welcome template', icon: <Shield size={14} /> },
                      ]
                  : section === 'users'
                    ? [
                        { label: 'User profiles', value: 'Edit profile data', icon: <Users size={14} /> },
                        { label: 'Role assignments', value: 'Multi-role access', icon: <UserCog size={14} /> },
                        { label: 'Session insight', value: 'Login and activity state', icon: <Server size={14} /> },
                      ]
                  : section === 'llm-lab'
                    ? [
                        { label: 'Model tests', value: 'Run prompts against live providers', icon: <Sparkles size={14} /> },
                        { label: 'Payloads', value: 'Inspect raw request JSON', icon: <Database size={14} /> },
                        { label: 'Outputs', value: 'View parsed and raw responses', icon: <PanelTop size={14} /> },
                      ]
                    : section === 'billing'
                      ? [
                          { label: 'Balance', value: 'Credits, reserved, available', icon: <Database size={14} /> },
                          { label: 'Transactions', value: 'Ledger and reservations', icon: <Layers3 size={14} /> },
                          { label: 'Top ups', value: 'Manual account funding', icon: <KeyRound size={14} /> },
                        ]
                  : section === 'search-providers'
                    ? [
                        { label: 'Search keys', value: 'Manage API keys', icon: <KeyRound size={14} /> },
                        { label: 'Usage tracking', value: 'Monthly quota view', icon: <Database size={14} /> },
                        { label: 'Admin actions', value: 'Create / edit / delete', icon: <Shield size={14} /> },
                      ]
                    : section === 'billing-rules'
                    ? [
                        { label: 'Pricing rules', value: 'Model and workflow charges', icon: <Database size={14} /> },
                        { label: 'Versioning', value: 'Keep historical pricing', icon: <Archive size={14} /> },
                        { label: 'Active window', value: 'Effective dates and state', icon: <Clock3 size={14} /> },
                      ]
                    : section === 'workflow-costs'
                    ? [
                        { label: 'Workflow timeline', value: 'Live status, history, and steps', icon: <Database size={14} /> },
                        { label: 'Jobs', value: 'Queued, running, and completed jobs', icon: <Layers3 size={14} /> },
                        { label: 'Cancel control', value: 'Stop a running job', icon: <Clock3 size={14} /> },
                        { label: 'Per-user view', value: 'Workflow history by account', icon: <Users size={14} /> },
                      ]
                    : [
                        { label: 'Runtime providers', value: 'Email and transcription', icon: <Settings2 size={14} /> },
                        { label: 'Secrets', value: 'Kept in .env', icon: <KeyRound size={14} /> },
                        { label: 'Switching', value: 'Takes effect immediately', icon: <Zap size={14} /> },
                      ]).map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5 rounded-lg bg-bg-input/60 px-3 py-2">
                    <div className="text-accent">{item.icon}</div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-text-primary">{item.label}</div>
                      <div className="text-[10px] text-text-muted truncate">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-border px-4 py-4">
            <button
              type="button"
              onClick={onBackToApp}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
            >
              <ArrowLeft size={15} />
              Back to app
            </button>
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] px-6 py-6">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  <Shield size={12} />
                  Admin
                </div>
                <h1 className="text-[26px] font-bold tracking-tight text-text-primary">{currentTitle}</h1>
                <p className="mt-1 max-w-2xl text-[13px] leading-6 text-text-secondary">{currentDescription}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:min-w-[560px] xl:grid-cols-4">
                {currentHeaderStats.map((stat) => (
                  <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} accent={Boolean(stat.accent)} />
                ))}
              </div>
            </div>

            {section === 'users' ? (
              <>
                {userError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{userError}</div>
                  </div>
                )}
                {renderUserPanel()}
              </>
            ) : section === 'llm-lab' ? (
              <AdminLlmLabPanel />
            ) : section === 'billing' ? (
              <>
                {billingError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{billingError}</div>
                  </div>
                )}
                {renderBillingPanel()}
              </>
            ) : section === 'prompts' ? (
              <>
                {promptError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{promptError}</div>
                  </div>
                )}
                {renderPromptPanel()}
              </>
            ) : section === 'email-templates' ? (
              <>
                {emailTemplateError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{emailTemplateError}</div>
                  </div>
                )}
                {renderEmailTemplatesPanel()}
              </>
            ) : section === 'search-providers' ? (
              <>
                {providerError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{providerError}</div>
                  </div>
                )}
                {renderProviderPanel()}
              </>
            ) : section === 'billing-rules' ? (
              <>
                {billingRuleError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{billingRuleError}</div>
                  </div>
                )}
                {renderBillingRulesPanel()}
              </>
            ) : section === 'workflow-costs' ? (
              <>
                {(workflowCostsError || workflowHostError) && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{workflowCostsError ?? workflowHostError}</div>
                  </div>
                )}
                {renderWorkflowsPanel()}
              </>
            ) : (
              <>
                {runtimeSettingsError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    <div>{runtimeSettingsError}</div>
                  </div>
                )}
                {renderRuntimeSettingsPanel()}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
