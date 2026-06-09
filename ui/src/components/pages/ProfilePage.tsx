import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import {
  Play,
  Clock,
  Download,
  Sparkles,
  Edit3,
  ChevronRight,
  Shield,
  CreditCard,
  Globe,
  BarChart2,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { ProfileData } from '../../api/types';
import { getProfileData } from '../../api/profile';

const STAT_ICONS: Record<string, JSX.Element> = {
  play: <Play size={14} />,
  clock: <Clock size={14} />,
  download: <Download size={14} />,
  sparkles: <Sparkles size={14} />,
};

interface ProfilePageProps {
  onNavChange: (nav: import('../../types').NavItem) => void;
}

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[760px] animate-pulse px-8 py-8">
        <div className="mb-5 h-36 rounded-2xl border border-border bg-bg-card" />
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl border border-border bg-bg-card" />)}
        </div>
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div className="h-48 rounded-xl border border-border bg-bg-card" />
          <div className="h-48 rounded-xl border border-border bg-bg-card" />
        </div>
        <div className="h-40 rounded-xl border border-border bg-bg-card" />
      </div>
    </main>
  );
}

function formatStatusLabel(status: string | null | undefined): string {
  const normalized = (status ?? '').trim();
  if (!normalized) return 'Active';
  return normalized[0].toUpperCase() + normalized.slice(1);
}

export default function ProfilePage({ onNavChange }: ProfilePageProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const next = await getProfileData();
        if (mounted) {
          setData(next);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load profile data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAvatarError(false);
  }, [data?.user.avatarUrl]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        <div className="mx-auto flex min-h-full max-w-[760px] items-center px-8 py-8">
          <div className="w-full rounded-2xl border border-border bg-bg-card p-6">
            <div className="mb-3 flex items-center gap-2 text-danger">
              <AlertCircle size={16} />
              <h1 className="text-[16px] font-semibold text-text-primary">Profile unavailable</h1>
            </div>
            <p className="text-[13px] leading-6 text-text-secondary">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                void getProfileData()
                  .then((next) => setData(next))
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Failed to load profile data');
                  })
                  .finally(() => setLoading(false));
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return <PageSkeleton />;
  }

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[760px] px-8 py-8">
        <div className="mb-5 rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-cyan-400 text-2xl font-bold text-bg-primary">
              {data.user.avatarUrl && !avatarError ? (
                <img
                  src={data.user.avatarUrl}
                  alt={data.user.name}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                data.user.initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-3">
                <h1 className="text-[20px] font-bold text-text-primary">{data.user.name}</h1>
                <span className="rounded-full border border-border bg-bg-input px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  {formatStatusLabel(data.user.status)}
                </span>
              </div>
              <div className="mb-3 text-[13px] text-text-muted">{data.user.email}</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Check size={11} className="text-accent" />
                  <span>Signed-in account</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Clock size={11} />
                  <span>Member since {data.user.memberSince}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavChange('settings')}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-bg-input px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover"
            >
              <Edit3 size={13} />
              Edit profile
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-3">
          {data.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-bg-card p-4 text-center">
              <div className="mb-2 flex items-center justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${stat.color}18`, color: stat.color }}>
                  {STAT_ICONS[stat.iconKey]}
                </div>
              </div>
              <div className="mb-0.5 text-[22px] font-bold leading-none text-text-primary">{stat.value}</div>
              <div className="text-[10px] text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Usage</span>
            </div>
            <div className="mb-3 rounded-lg border border-accent/20 bg-gradient-to-r from-accent/8 to-transparent p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[13px] font-bold text-text-primary">{data.subscription.planName}</span>
                <span className="text-[10px] font-bold text-pro-badge">{data.subscription.price}</span>
              </div>
              <div className="text-[11px] text-text-muted">{data.subscription.renewsAt}</div>
            </div>
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Videos this month</span>
                <span className="text-[11px] font-medium text-text-primary">{data.subscription.used} / {data.subscription.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: data.subscription.total > 0
                      ? `${Math.min(100, (data.subscription.used / data.subscription.total) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavChange('settings')}
              className="mt-2 w-full text-center text-[11px] font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Open settings →
            </button>
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Globe size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Languages processed</span>
            </div>
            <div className="space-y-3">
              {data.languages.length > 0 ? data.languages.map((language) => (
                <div key={language.lang}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">{language.lang}</span>
                    <span className="text-[11px] text-text-muted">{language.count} videos</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
                    <div className="h-full rounded-full bg-accent/60" style={{ width: `${language.pct}%` }} />
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-[12px] text-text-muted">
                  No completed videos yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-5 overflow-hidden rounded-xl border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Recent activity</span>
            </div>
            <button
              type="button"
              onClick={() => onNavChange('history')}
              className="flex items-center gap-1 text-[11px] font-medium text-accent transition-colors hover:text-accent-hover"
            >
              View history <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border">
            {data.recentActivity.length > 0 ? data.recentActivity.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-input/40">
                <div className="flex h-[34px] w-[60px] flex-shrink-0 overflow-hidden rounded-md bg-bg-input">
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-text-primary">{item.title}</div>
                  <div className="text-[10px] text-text-muted">{item.channel}</div>
                </div>
                <span className="flex-shrink-0 text-[11px] text-text-muted">{item.age}</span>
              </div>
            )) : (
              <div className="px-5 py-6 text-[12px] text-text-muted">No recent activity yet.</div>
            )}
          </div>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg-card">
          {[
            { icon: <Edit3 size={14} />, label: 'Edit account details', nav: 'settings' as const },
            { icon: <Shield size={14} />, label: 'Privacy & data', nav: 'settings' as const },
            { icon: <CreditCard size={14} />, label: 'Billing & usage', nav: 'settings' as const },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavChange(item.nav)}
              className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-bg-input/40"
            >
              <span className="text-text-muted transition-colors group-hover:text-accent">{item.icon}</span>
              <span className="flex-1 text-[13px] text-text-secondary transition-colors group-hover:text-text-primary">{item.label}</span>
              <ChevronRight size={13} className="text-text-muted/40 transition-colors group-hover:text-text-muted" />
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
