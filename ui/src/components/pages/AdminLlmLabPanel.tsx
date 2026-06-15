import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bot,
  Code2,
  Copy,
  FileJson,
  Gauge,
  PanelTop,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  listReasoningProviders,
  runReasoningChat,
  type ReasoningChatInput,
  type ReasoningChatResponse,
} from '../../api/reasoning';

type ResponseFormat = 'text' | 'json';

const MODEL_PRESETS: Record<string, string[]> = {
  OpenRouter: ['openai/gpt-4.1-mini', 'openai/gpt-4.1', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.5-pro', 'mistralai/mistral-small-3.1'],
  GoogleVertex: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  InceptionLabs: ['mercury'],
  Ollama: ['llama3.1', 'qwen2.5', 'mistral', 'deepseek-r1'],
};

const DEFAULT_SYSTEM_PROMPT = 'You are a precise assistant. Answer clearly and directly.';
const DEFAULT_USER_PROMPT = 'Explain how to evaluate an LLM response for correctness, safety, and usefulness in 5 bullets.';

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function normalizeText(value: string): string {
  return value.trim();
}

function buildRequestPreview(input: {
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: string;
  maxTokens: string;
  responseFormat: ResponseFormat;
}): ReasoningChatInput {
  return {
    provider: input.provider,
    model: normalizeText(input.model) || null,
    systemPrompt: normalizeText(input.systemPrompt) || null,
    userPrompt: normalizeText(input.userPrompt) || null,
    messages: [
      ...(normalizeText(input.systemPrompt)
        ? [{ role: 'system', content: normalizeText(input.systemPrompt) }]
        : []),
      ...(normalizeText(input.userPrompt)
        ? [{ role: 'user', content: normalizeText(input.userPrompt) }]
        : []),
    ],
    temperature: input.temperature.trim() && Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : null,
    maxTokens: input.maxTokens.trim() && Number.isFinite(Number(input.maxTokens)) ? Number(input.maxTokens) : null,
    responseFormat: input.responseFormat === 'json' ? 'json' : null,
  };
}

function SectionCard({ title, description, icon, children, actions }: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-border bg-[linear-gradient(180deg,_rgba(14,22,43,0.95),_rgba(9,15,28,0.97))] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.75)]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
            {icon}
          </div>
          <div>
            <div className="text-[15px] font-semibold text-text-primary">{title}</div>
            <div className="mt-1 text-[12px] leading-5 text-text-muted">{description}</div>
          </div>
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</span>
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
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      value={value}
      type={type}
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

function Pill({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? 'border-accent/30 bg-accent/15 text-accent'
          : 'border-border bg-bg-input text-text-secondary hover:bg-bg-card hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[12px] text-text-secondary transition-colors hover:text-text-primary"
    >
      <Copy size={12} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function AdminLlmLabPanel() {
  const [providers, setProviders] = useState<string[]>(Object.keys(MODEL_PRESETS));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('OpenRouter');
  const [model, setModel] = useState('openai/gpt-4.1-mini');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const [temperature, setTemperature] = useState('0.2');
  const [maxTokens, setMaxTokens] = useState('512');
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>('text');
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ReasoningChatResponse | null>(null);
  const [lastRequestJson, setLastRequestJson] = useState<string>('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listReasoningProviders()
      .then((items) => {
        if (cancelled) return;
        const nextProviders = items.length > 0 ? items : Object.keys(MODEL_PRESETS);
        setProviders(nextProviders);
        const preferredProvider = nextProviders.includes('OpenRouter') ? 'OpenRouter' : nextProviders[0];
        setSelectedProvider(preferredProvider);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reasoning providers');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const modelSuggestions = useMemo(() => MODEL_PRESETS[selectedProvider] ?? [], [selectedProvider]);

  useEffect(() => {
    if (modelSuggestions.length === 0) return;
    if (!model.trim()) {
      setModel(modelSuggestions[0]);
    }
  }, [model, modelSuggestions]);

  const requestPreview = useMemo(() => buildRequestPreview({
    provider: selectedProvider,
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens,
    responseFormat,
  }), [selectedProvider, model, systemPrompt, userPrompt, temperature, maxTokens, responseFormat]);

  const requestPreviewJson = useMemo(() => formatJson(requestPreview), [requestPreview]);

  const canRun = selectedProvider.trim().length > 0 && normalizeText(userPrompt).length > 0;

  const runQuery = async () => {
    setRunning(true);
    setLastError(null);
    setLastResult(null);
    setLastLatencyMs(null);

    const startedAt = performance.now();
    try {
      const response = await runReasoningChat(requestPreview);
      setLastResult(response);
      setLastRequestJson(requestPreviewJson);
      setLastLatencyMs(Math.round(performance.now() - startedAt));
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Failed to run reasoning query');
      setLastRequestJson(requestPreviewJson);
    } finally {
      setRunning(false);
    }
  };

  const applyPreset = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setUserPrompt(DEFAULT_USER_PROMPT);
    setTemperature('0.2');
    setMaxTokens('512');
    setResponseFormat('text');
    if (modelSuggestions.length > 0) {
      setModel(modelSuggestions[0]);
    }
  };

  const rawOutputJson = (() => {
    const raw = lastResult?.rawResponseJson?.trim();
    if (raw) return raw;
    if (!lastResult) return '';

    return formatJson({
      provider: lastResult.provider,
      model: lastResult.model,
      text: lastResult.text,
      finishReason: lastResult.finishReason,
      usage: lastResult.usage,
    });
  })();
  const rawOutputIsFallback = Boolean(lastResult && !lastResult.rawResponseJson?.trim());
  const responsePreview = lastResult?.text ?? '';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
      <div className="space-y-5">
        <SectionCard
          title="LLM Lab"
          description="Pick a provider, choose a model, send a prompt, and inspect the exact payload and raw provider output."
          icon={<Sparkles size={18} />}
          actions={<Pill active>{loading ? 'Loading providers…' : `${providers.length} providers`}</Pill>}
        >
          {error && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
              {error}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Field label="Provider" helper="Loads the available reasoning backends.">
              <div className="flex flex-wrap gap-2">
                {providers.map((provider) => (
                  <Pill key={provider} active={selectedProvider === provider} onClick={() => setSelectedProvider(provider)}>
                    <span className="inline-flex items-center gap-1.5">
                      <Server size={12} />
                      {provider}
                    </span>
                  </Pill>
                ))}
              </div>
            </Field>

            <Field label="Model" helper="Use a preset or type any model name.">
              <div className="space-y-3">
                <Input value={model} onChange={setModel} placeholder="gpt-4.1-mini" />
                <div className="flex flex-wrap gap-2">
                  {modelSuggestions.map((item) => (
                    <Pill key={item} active={model === item} onClick={() => setModel(item)}>
                      {item}
                    </Pill>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="System prompt" helper="Optional. Sent as the system message.">
              <Textarea value={systemPrompt} onChange={setSystemPrompt} placeholder="You are a careful assistant." minHeight="min-h-[180px]" />
            </Field>
            <Field label="User prompt" helper="Required. Sent as the user message.">
              <Textarea value={userPrompt} onChange={setUserPrompt} placeholder="Ask something specific." minHeight="min-h-[180px]" />
            </Field>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Temperature" helper="Optional">
              <Input value={temperature} onChange={setTemperature} placeholder="0.2" type="number" />
            </Field>
            <Field label="Max tokens" helper="Optional">
              <Input value={maxTokens} onChange={setMaxTokens} placeholder="512" type="number" />
            </Field>
            <Field label="Response format" helper="Text or JSON">
              <select
                value={responseFormat}
                onChange={(e) => setResponseFormat(e.target.value as ResponseFormat)}
                className="w-full rounded-xl border border-border bg-bg-input px-3.5 py-2.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent/60 focus:bg-bg-card"
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
              </select>
            </Field>
            <Field label="Actions" helper="Quick reset">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyPreset}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  <Wand2 size={14} />
                  Preset
                </button>
                <button
                  type="button"
                  onClick={runQuery}
                  disabled={!canRun || running}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-emerald-400 px-3 py-2.5 text-[13px] font-semibold text-bg-primary shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  Run query
                </button>
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="What I sent"
          description="This is the exact request payload built from the form above."
          icon={<FileJson size={18} />}
          actions={<CopyButton value={lastRequestJson || requestPreviewJson} />}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Provider</div>
              <div className="mt-1 text-[13px] font-semibold text-text-primary">{selectedProvider}</div>
            </div>
            <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Model</div>
              <div className="mt-1 text-[13px] font-semibold text-text-primary break-all">{model || '—'}</div>
            </div>
            <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Format</div>
              <div className="mt-1 text-[13px] font-semibold text-text-primary">{responseFormat.toUpperCase()}</div>
            </div>
            <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Latency</div>
              <div className="mt-1 text-[13px] font-semibold text-text-primary">{lastLatencyMs === null ? '—' : `${lastLatencyMs} ms`}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-[#09101d]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                <Code2 size={13} className="text-accent" />
                Request JSON
              </div>
              <span className="text-[11px] text-text-muted">system + user input</span>
            </div>
            <pre className="max-h-[360px] overflow-auto p-4 text-[12px] leading-6 text-emerald-100 whitespace-pre-wrap break-words">
              {lastRequestJson || requestPreviewJson}
            </pre>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard
          title="Output"
          description="The parsed assistant response and token usage, if the provider returned it."
          icon={<Bot size={18} />}
          actions={lastResult ? <Pill active>Ready</Pill> : <Pill>Waiting</Pill>}
        >
          {lastError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-[13px] text-rose-200">
              <div className="mb-1.5 font-semibold text-rose-100">Request failed</div>
              <div className="leading-6">{lastError}</div>
            </div>
          ) : lastResult ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Model returned</div>
                  <div className="mt-1 text-[13px] font-semibold text-text-primary break-all">{lastResult.model}</div>
                </div>
                <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Finish reason</div>
                  <div className="mt-1 text-[13px] font-semibold text-text-primary">{lastResult.finishReason ?? '—'}</div>
                </div>
                <div className="rounded-2xl border border-border bg-bg-input/65 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Tokens</div>
                  <div className="mt-1 text-[13px] font-semibold text-text-primary">
                    {lastResult.usage?.totalTokens ?? '—'}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-[#08111d]">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                    <Gauge size={13} className="text-accent" />
                    Assistant output
                  </div>
                  <CopyButton value={responsePreview} />
                </div>
                <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-words p-4 text-[13px] leading-6 text-text-primary">
                  {responsePreview}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-bg-input/30 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-bg-card text-accent">
                <Sparkles size={18} />
              </div>
              <div className="text-[13px] font-semibold text-text-primary">No output yet</div>
              <div className="mt-1 text-[11px] text-text-muted">Run a query to inspect the model response here.</div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Raw response"
          description="The provider payload exactly as returned by the backend client."
          icon={<PanelTop size={18} />}
          actions={<CopyButton value={rawOutputJson || '{}'} />}
        >
          {rawOutputIsFallback && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] leading-6 text-amber-100">
              The backend did not return a raw provider JSON blob for this call, so the panel is showing a normalized response object instead.
            </div>
          )}
          <div className="rounded-2xl border border-border bg-[#09101d]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                <Server size={13} className="text-accent" />
                Response JSON
              </div>
              <span className="text-[11px] text-text-muted">raw provider payload</span>
            </div>
            <pre className="min-h-[320px] max-h-[480px] overflow-auto p-4 font-mono text-[12px] leading-6 text-cyan-100 whitespace-pre-wrap break-words">
              {rawOutputJson || '{}'}
            </pre>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
