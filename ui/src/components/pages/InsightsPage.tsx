import { useState, useEffect } from 'react';
import {
  Sparkles,
  Star,
  Quote,
  List,
  BookOpen,
  MessageCircle,
  Map,
  ChevronRight,
  Play,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import type { InsightsData } from '../../api/types';
import { getInsightsData } from '../../api/insights';

const TYPE_ICONS: Record<string, JSX.Element> = {
  'quick-summary':  <Sparkles size={18} />,
  'chapters':       <List size={18} />,
  'takeaways':      <Star size={18} />,
  'quotes':         <Quote size={18} />,
  'qa':             <MessageCircle size={18} />,
  'study-guides':   <BookOpen size={18} />,
};

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8 animate-pulse">
        <div className="h-7 w-32 bg-bg-card rounded mb-2" />
        <div className="h-4 w-64 bg-bg-card rounded mb-7" />
        <div className="grid grid-cols-3 gap-3 mb-7">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-bg-card border border-border rounded-xl h-28" />)}
        </div>
        <div className="bg-bg-card border border-border rounded-xl h-48" />
      </div>
    </main>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    let mounted = true;
    getInsightsData().then(d => { if (mounted) setData(d); });
    return () => { mounted = false; };
  }, []);

  if (!data) return <PageSkeleton />;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8">

        <div className="mb-7">
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1">Insights</h1>
          <p className="text-text-secondary text-[13px]">AI-generated summaries, takeaways, and analyses across all your videos.</p>
        </div>

        {/* Insight type grid */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          {data.types.map((t) => (
            <button key={t.key} className="bg-bg-card border border-border hover:border-opacity-60 rounded-xl p-4 text-left cursor-pointer group transition-all hover:bg-bg-card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: t.color + '18', color: t.color }}>
                  {TYPE_ICONS[t.key]}
                </div>
                <ChevronRight size={14} className="text-text-muted/40 group-hover:text-text-muted transition-colors" />
              </div>
              <div className="text-[14px] font-semibold text-text-primary mb-0.5">{t.label}</div>
              <div className="text-[11px] text-text-muted mb-2">{t.description}</div>
              <div className="text-[20px] font-bold" style={{ color: t.color }}>{t.count}</div>
            </button>
          ))}
        </div>

        {/* Recent insights */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-5">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Recent insights</span>
            </div>
            <button className="text-[11px] text-accent hover:text-accent-hover cursor-pointer font-medium flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>

          <div className="divide-y divide-border">
            {data.recent.map((video, i) => (
              <div key={i} className="px-5 py-4">
                {/* Video header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-[60px] h-[34px] rounded-md bg-bg-input overflow-hidden flex-shrink-0">
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-text-primary">{video.title}</div>
                    <div className="text-[10px] text-text-muted">{video.channel} · {video.ago}</div>
                  </div>
                </div>
                {/* Insight chips */}
                <div className="flex flex-wrap gap-2">
                  {video.items.map((item, j) => (
                    <button key={j} className="flex items-center gap-1.5 bg-bg-input hover:bg-bg-card-hover border border-border rounded-lg px-3 py-1.5 cursor-pointer transition-colors">
                      <Lightbulb size={11} className="text-accent" />
                      <span className="text-[11px] font-medium text-text-secondary">{item.label}</span>
                      {'count' in item && <span className="text-[10px] text-text-muted ml-0.5">({item.count})</span>}
                    </button>
                  ))}
                </div>
                {/* Summary preview */}
                {video.items[0]?.type === 'summary' && 'preview' in video.items[0] && (
                  <p className="mt-2 text-[11px] text-text-muted leading-relaxed line-clamp-2">{video.items[0].preview}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Generate new */}
        <div className="bg-gradient-to-r from-accent/8 to-transparent border border-accent/20 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Map size={15} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Generate new insights</span>
            </div>
            <p className="text-[11px] text-text-muted">Analyze a new video or regenerate insights for an existing one.</p>
          </div>
          <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-primary font-semibold px-4 py-2 rounded-lg text-[13px] transition-colors cursor-pointer flex-shrink-0">
            <Play size={13} fill="currentColor" />
            Analyze video
          </button>
        </div>

      </div>
    </main>
  );
}
