import { useState } from 'react';
import { ArrowLeft, Plus, X, Globe, Newspaper, BookOpen, MessageSquare, TrendingUp, Twitter } from 'lucide-react';

const SOURCE_OPTIONS = [
  { id: 'web', label: 'Web Search', icon: <Globe size={16} />, description: 'General web crawl via search engines' },
  { id: 'news', label: 'News', icon: <Newspaper size={16} />, description: 'Major news publications & RSS feeds' },
  { id: 'arXiv', label: 'arXiv', icon: <BookOpen size={16} />, description: 'Academic pre-print research papers' },
  { id: 'reddit', label: 'Reddit', icon: <MessageSquare size={16} />, description: 'Community discussions & trending posts' },
  { id: 'financial-data', label: 'Financial Data', icon: <TrendingUp size={16} />, description: 'Market data, earnings & analyst reports' },
  { id: 'twitter', label: 'Twitter / X', icon: <Twitter size={16} />, description: 'Real-time social sentiment & announcements' },
];

const FREQ_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'hourly', label: 'Hourly', description: 'New briefing every hour' },
  { value: 'daily', label: 'Daily', description: 'One briefing per day' },
  { value: 'weekly', label: 'Weekly', description: 'One briefing per week' },
  { value: 'monthly', label: 'Monthly', description: 'One briefing per month' },
];

const FREQ_COLORS: Record<string, string> = {
  hourly: 'var(--color-info, #4dc8e8)',
  daily: 'var(--color-accent)',
  weekly: '#a78bfa',
  monthly: '#f59e0b',
};

const DELIVERY_TIMES = [
  '06:00', '07:00', '08:00', '09:00', '10:00',
  '12:00', '15:00', '18:00', '20:00', '22:00',
];

interface ResearchCreatePageProps {
  onBack: () => void;
}

export function ResearchCreatePage({ onBack }: ResearchCreatePageProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sources, setSources] = useState<string[]>(['web', 'news']);
  const [frequency, setFrequency] = useState('daily');
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const toggleSource = (id: string) => {
    setSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#+/, '');
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const isValid = name.trim().length > 0 && sources.length > 0;

  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft size={15} />
            Research
          </button>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            New Research Topic
          </span>
        </div>
      </div>

      <div className="max-w-2xl flex flex-col gap-5">
        {/* Name */}
        <FormCard title="Topic Name">
          <input
            type="text"
            placeholder="e.g. AI & Machine Learning Weekly"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-primary)',
              border: `1px solid ${name.trim() ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          />
        </FormCard>

        {/* Description */}
        <FormCard title="Description" subtitle="Optional — helps the AI focus its research">
          <textarea
            placeholder="Describe what you want to research…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
            style={{
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          />
        </FormCard>

        {/* Sources */}
        <FormCard title="Sources" subtitle={`${sources.length} selected`}>
          <div className="grid grid-cols-2 gap-2">
            {SOURCE_OPTIONS.map((s) => {
              const active = sources.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className="flex items-start gap-3 p-3 rounded-lg text-left transition-all"
                  style={{
                    background: active ? `var(--color-accent)11` : 'var(--color-bg-hover)',
                    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  <span style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                    {s.icon}
                  </span>
                  <div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                    >
                      {s.label}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {s.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </FormCard>

        {/* Frequency */}
        <FormCard title="Frequency">
          <div className="grid grid-cols-4 gap-2">
            {FREQ_OPTIONS.map((f) => {
              const active = frequency === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFrequency(f.value)}
                  className="flex flex-col items-center p-3 rounded-lg transition-all"
                  style={{
                    background: active ? `${FREQ_COLORS[f.value]}22` : 'var(--color-bg-hover)',
                    border: `1px solid ${active ? FREQ_COLORS[f.value] : 'var(--color-border)'}`,
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: active ? FREQ_COLORS[f.value] : 'var(--color-text-secondary)' }}
                  >
                    {f.label}
                  </span>
                  <span className="text-xs mt-0.5 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    {f.description}
                  </span>
                </button>
              );
            })}
          </div>
        </FormCard>

        {/* Delivery time */}
        <FormCard title="Delivery Time" subtitle="When to send the briefing">
          <select
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {DELIVERY_TIMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FormCard>

        {/* Tags */}
        <FormCard title="Tags" subtitle="Press Enter or comma to add">
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
                style={{
                  background: `var(--color-accent)22`,
                  color: 'var(--color-accent)',
                }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            />
            <button
              onClick={addTag}
              disabled={!tagInput.trim()}
              className="px-3 py-2 rounded-lg text-sm transition-opacity"
              style={{
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                opacity: tagInput.trim() ? 1 : 0.4,
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        </FormCard>

        {/* Actions */}
        <div
          className="flex justify-end gap-3 pt-2 pb-6"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!isValid}
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: 'var(--color-accent)',
              color: 'black',
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            Create Research Topic
          </button>
        </div>
      </div>
    </main>
  );
}

function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)' }}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
