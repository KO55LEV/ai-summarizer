import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import {
  Play,
  Clock,
  Download,
  Sparkles,
  Star,
  Edit3,
  ChevronRight,
  Shield,
  CreditCard,
  Globe,
  BarChart2,
  Check,
} from 'lucide-react';
import type { ProfileData } from '../../api/types';
import { getProfileData } from '../../api/profile';

const STAT_ICONS: Record<string, JSX.Element> = {
  play:      <Play size={14} />,
  clock:     <Clock size={14} />,
  download:  <Download size={14} />,
  sparkles:  <Sparkles size={14} />,
};

interface ProfilePageProps {
  onNavChange: (nav: import('../../types').NavItem) => void;
}

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[760px] mx-auto px-8 py-8 animate-pulse">
        <div className="bg-bg-card border border-border rounded-2xl h-36 mb-5" />
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-bg-card border border-border rounded-xl h-24" />)}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-bg-card border border-border rounded-xl h-48" />
          <div className="bg-bg-card border border-border rounded-xl h-48" />
        </div>
        <div className="bg-bg-card border border-border rounded-xl h-40" />
      </div>
    </main>
  );
}

export default function ProfilePage({ onNavChange }: ProfilePageProps) {
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    let mounted = true;
    getProfileData().then(d => { if (mounted) setData(d); });
    return () => { mounted = false; };
  }, []);

  if (!data) return <PageSkeleton />;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[760px] mx-auto px-8 py-8">

        {/* Profile card */}
        <div className="bg-bg-card border border-border rounded-2xl p-6 mb-5">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center text-2xl font-bold text-bg-primary flex-shrink-0">
              {data.user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[20px] font-bold text-text-primary">{data.user.name}</h1>
                {data.user.plan === 'pro' && (
                  <span className="text-[10px] bg-pro-badge/20 text-pro-badge px-2 py-0.5 rounded font-bold tracking-wide">PRO</span>
                )}
              </div>
              <div className="text-[13px] text-text-muted mb-3">{data.user.email}</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Check size={11} className="text-accent" />
                  <span>Verified account</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Clock size={11} />
                  <span>Member since {data.user.memberSince}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavChange('settings')}
              className="flex items-center gap-1.5 bg-bg-input hover:bg-bg-card-hover border border-border text-text-secondary text-[12px] font-medium px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            >
              <Edit3 size={13} />
              Edit profile
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {data.stats.map((s) => (
            <div key={s.label} className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '18', color: s.color }}>
                  {STAT_ICONS[s.iconKey]}
                </div>
              </div>
              <div className="text-[22px] font-bold text-text-primary leading-none mb-0.5">{s.value}</div>
              <div className="text-[10px] text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* Subscription */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Subscription</span>
            </div>
            <div className="bg-gradient-to-r from-accent/8 to-transparent border border-accent/20 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-text-primary">{data.subscription.planName}</span>
                <span className="text-[10px] text-pro-badge font-bold">{data.subscription.price}</span>
              </div>
              <div className="text-[11px] text-text-muted">Renews {data.subscription.renewsAt}</div>
            </div>
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Videos this month</span>
                <span className="text-[11px] font-medium text-text-primary">{data.subscription.used} / {data.subscription.total}</span>
              </div>
              <div className="w-full h-1.5 bg-bg-input rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${(data.subscription.used / data.subscription.total) * 100}%` }} />
              </div>
            </div>
            <button
              onClick={() => onNavChange('settings')}
              className="w-full mt-2 text-[11px] text-accent hover:text-accent-hover font-medium cursor-pointer text-center"
            >
              Manage billing →
            </button>
          </div>

          {/* Language usage */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Languages processed</span>
            </div>
            <div className="space-y-3">
              {data.languages.map((l) => (
                <div key={l.lang}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-text-secondary">{l.lang}</span>
                    <span className="text-[11px] text-text-muted">{l.count} videos</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-input rounded-full overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${l.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-5">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Recent activity</span>
            </div>
            <button
              onClick={() => onNavChange('history')}
              className="text-[11px] text-accent hover:text-accent-hover cursor-pointer font-medium flex items-center gap-1"
            >
              View history <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border">
            {data.recentActivity.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-input/40 cursor-pointer transition-colors">
                <div className="w-[60px] h-[34px] rounded-md bg-bg-input overflow-hidden flex-shrink-0">
                  <img src={v.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-text-primary truncate">{v.title}</div>
                  <div className="text-[10px] text-text-muted">{v.channel}</div>
                </div>
                <span className="text-[11px] text-text-muted flex-shrink-0">{v.age}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick settings links */}
        <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
          {[
            { icon: <Edit3 size={14} />, label: 'Edit account details', nav: 'settings' as const },
            { icon: <Shield size={14} />, label: 'Privacy & data', nav: 'settings' as const },
            { icon: <Star size={14} />, label: 'Upgrade plan', nav: 'settings' as const },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => onNavChange(item.nav)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-input/40 transition-colors cursor-pointer group"
            >
              <span className="text-text-muted group-hover:text-accent transition-colors">{item.icon}</span>
              <span className="flex-1 text-[13px] text-text-secondary text-left group-hover:text-text-primary transition-colors">{item.label}</span>
              <ChevronRight size={13} className="text-text-muted/40 group-hover:text-text-muted transition-colors" />
            </button>
          ))}
        </div>

      </div>
    </main>
  );
}
