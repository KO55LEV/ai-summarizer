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

type AdminSection = 'users' | 'prompts' | 'search-providers' | 'runtime-settings';
type PromptTab = 'editor' | 'runs' | 'archive' | 'usage';
type ProviderTab = 'editor' | 'usage';

interface AdminPageProps {
  initialSection: AdminSection;
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
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/60 focus:bg-bg-card"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  minHeight = 'min-h-[140px]',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/60 focus:bg-bg-card ${minHeight}`}
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

export default function AdminPage({ initialSection, onSectionChange, onBackToApp }: AdminPageProps) {
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

  const userStats = {
    total: users.length,
    active: users.filter((item) => item.status === 'active').length,
    disabled: users.filter((item) => item.status === 'disabled').length,
    deleted: users.filter((item) => item.status === 'deleted').length,
  };

  const selectedUser = selectedUserId ? users.find((item) => item.id === selectedUserId) ?? null : null;

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
    if (focusId && items.some((item) => item.id === focusId)) {
      setSelectedUserId(focusId);
    } else if (items.length > 0) {
      setSelectedUserId(items[0].id);
    } else {
      setUserMode('new');
      setUserForm(EMPTY_USER_FORM);
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

  if (userLoading || promptLoading || providerLoading || runtimeSettingsLoading) return <PageSkeleton />;

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
      : section === 'prompts'
        ? 'Prompt management'
        : section === 'search-providers'
        ? 'Search provider management'
        : 'Runtime settings';
  const currentDescription =
    section === 'users'
      ? 'Search users, inspect access, and edit profile data and roles.'
      : section === 'prompts'
        ? 'Scan, edit, archive, and delete prompt templates.'
        : section === 'search-providers'
        ? 'Add, review, and remove search-provider keys.'
        : 'Choose active email and transcription providers.';

  const currentHeaderStats = section === 'users'
    ? [
        { label: 'Total', value: String(userStats.total), icon: <Users size={14} /> },
        { label: 'Active', value: String(userStats.active), icon: <CircleCheck size={14} />, accent: true },
        { label: 'Disabled', value: String(userStats.disabled), icon: <CircleDashed size={14} /> },
        { label: 'Deleted', value: String(userStats.deleted), icon: <Trash2 size={14} /> },
      ]
    : section === 'prompts'
    ? [
        { label: 'Total', value: String(promptStats.total), icon: <Layers3 size={14} /> },
        { label: 'Active', value: String(promptStats.active), icon: <CircleCheck size={14} />, accent: true },
        { label: 'Inactive', value: String(promptStats.inactive), icon: <CircleDashed size={14} /> },
        { label: 'Archive', value: String(promptStats.archives), icon: <Archive size={14} /> },
      ]
    : section === 'search-providers'
      ? [
        { label: 'Total', value: String(providerStats.total), icon: <Server size={14} /> },
        { label: 'Active', value: String(providerStats.active), icon: <CircleCheck size={14} />, accent: true },
        { label: 'Inactive', value: String(providerStats.inactive), icon: <CircleDashed size={14} /> },
        { label: 'Quota', value: formatQuota(providerStats.quota), icon: <KeyRound size={14} /> },
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
                  : section === 'users'
                    ? [
                        { label: 'User profiles', value: 'Edit profile data', icon: <Users size={14} /> },
                        { label: 'Role assignments', value: 'Multi-role access', icon: <UserCog size={14} /> },
                        { label: 'Session insight', value: 'Login and activity state', icon: <Server size={14} /> },
                      ]
                  : section === 'search-providers'
                    ? [
                        { label: 'Search keys', value: 'Manage API keys', icon: <KeyRound size={14} /> },
                        { label: 'Usage tracking', value: 'Monthly quota view', icon: <Database size={14} /> },
                        { label: 'Admin actions', value: 'Create / edit / delete', icon: <Shield size={14} /> },
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
