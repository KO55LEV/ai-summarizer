import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import {
  TrendingUp,
  Clock,
  FileText,
  Download,
  Sparkles,
  Play,
  ChevronRight,
  Star,
  Globe,
  BarChart2,
  Zap,
} from 'lucide-react';
import type { DashboardData } from '../../api/types';
import { getDashboardData } from '../../api/dashboard';

const STAT_ICONS: Record<string, JSX.Element> = {
  play:        <Play size={16} />,
  clock:       <Clock size={16} />,
  'file-text': <FileText size={16} />,
  download:    <Download size={16} />,
};

const USAGE_ICONS: Record<string, JSX.Element> = {
  sparkles:      <Sparkles size={14} />,
  star:          <Star size={14} />,
  globe:         <Globe size={14} />,
  'bar-chart-2': <BarChart2 size={14} />,
};

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8 animate-pulse">
        <div className="h-7 w-40 bg-bg-card rounded mb-2" />
        <div className="h-4 w-72 bg-bg-card rounded mb-7" />
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-bg-card border border-border rounded-xl h-24" />)}
        </div>
        <div className="bg-bg-card border border-border rounded-xl h-64" />
      </div>
    </main>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let mounted = true;
    getDashboardData().then(d => { if (mounted) setData(d); });
    return () => { mounted = false; };
  }, []);

  if (!data) return <PageSkeleton />;

  const { used, total } = data.monthlyUsage;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8">

        {/* Header */}
        <div className="mb-7">
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1">Dashboard</h1>
          <p className="text-text-secondary text-[13px]">Overview of your research activity and recent work.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {data.stats.map((s) => (
            <div key={s.label} className="bg-bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-text-muted font-medium">{s.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.color + '18', color: s.color }}>
                  {STAT_ICONS[s.iconKey]}
                </div>
              </div>
              <div className="text-[26px] font-bold text-text-primary leading-none mb-0.5">{s.value}</div>
              <div className="text-[11px] text-text-muted">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Recent videos */}
          <div className="col-span-2 bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-accent" />
                <span className="text-[13px] font-semibold text-text-primary">Recent videos</span>
              </div>
              <button className="text-[11px] text-accent hover:text-accent-hover cursor-pointer font-medium flex items-center gap-1">
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-border">
              {data.recentVideos.map((v, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-input/40 transition-colors cursor-pointer">
                  <div className="w-[64px] h-[36px] rounded-md bg-bg-input overflow-hidden flex-shrink-0">
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-text-primary truncate">{v.title}</div>
                    <div className="text-[11px] text-text-muted">{v.channel} · {v.duration}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-input text-text-muted">{v.language}</span>
                    <span className="text-[10px] text-text-muted">{v.age}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage breakdown */}
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <TrendingUp size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Usage breakdown</span>
            </div>
            <div className="p-4 space-y-3">
              {data.usageBreakdown.map((ins) => (
                <div key={ins.title} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-bg-input flex items-center justify-center flex-shrink-0" style={{ color: ins.color }}>
                    {USAGE_ICONS[ins.iconKey]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-text-secondary leading-tight">{ins.title}</div>
                  </div>
                  <span className="text-[13px] font-bold text-text-primary flex-shrink-0">{ins.count}</span>
                </div>
              ))}

              <div className="pt-3 mt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-text-muted">Monthly videos</span>
                  <span className="text-[11px] font-medium text-text-primary">{used} / {total}</span>
                </div>
                <div className="w-full h-1.5 bg-bg-input rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${(used / total) * 100}%` }} />
                </div>
                <div className="text-[10px] text-text-muted mt-1">{total - used} videos remaining</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Quick actions</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Analyze new video',   icon: <Sparkles size={14} />, primary: true },
              { label: 'Browse history',       icon: <Clock size={14} />,    primary: false },
              { label: 'Export transcripts',   icon: <Download size={14} />, primary: false },
            ].map((a) => (
              <button key={a.label} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                a.primary
                  ? 'bg-accent hover:bg-accent-hover text-bg-primary'
                  : 'bg-bg-input hover:bg-bg-card-hover border border-border text-text-secondary hover:text-text-primary'
              }`}>
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
