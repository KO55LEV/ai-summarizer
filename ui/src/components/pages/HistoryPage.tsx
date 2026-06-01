import { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Filter,
  ChevronDown,
  Play,
  Sparkles,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import type { VideoRecord } from '../../types';
import type { HistoryItem } from '../../api/types';
import { getHistory } from '../../api/history';

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8 animate-pulse">
        <div className="h-7 w-32 bg-bg-card rounded mb-2" />
        <div className="h-4 w-64 bg-bg-card rounded mb-7" />
        <div className="bg-bg-card border border-border rounded-xl h-96" />
      </div>
    </main>
  );
}


export default function HistoryPage({ onVideoOpen }: { onVideoOpen?: (v: VideoRecord) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getHistory().then(d => { if (mounted) { setItems(d); setLoaded(true); } });
    return () => { mounted = false; };
  }, []);

  if (!loaded) return <PageSkeleton />;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8">

        <div className="mb-7">
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1">History</h1>
          <p className="text-text-secondary text-[13px]">All videos you've analyzed, with transcripts and insights.</p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-bg-card border border-border rounded-xl px-4 py-2.5">
            <Search size={14} className="text-text-muted" />
            <input type="text" placeholder="Search by title, channel or topic…" className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted outline-none" />
          </div>
          <button className="flex items-center gap-1.5 bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-[12px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
            <Filter size={13} />
            Language <ChevronDown size={12} />
          </button>
          <button className="flex items-center gap-1.5 bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-[12px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
            <Clock size={13} />
            Date <ChevronDown size={12} />
          </button>
        </div>

        {/* List */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] items-center gap-4 px-5 py-2.5 border-b border-border">
            <span className="text-[11px] font-medium text-text-muted">Video</span>
            <span className="text-[11px] font-medium text-text-muted">Source</span>
            <span className="text-[11px] font-medium text-text-muted">Insights</span>
            <span className="text-[11px] font-medium text-text-muted">Date</span>
            <span />
          </div>

          <div className="divide-y divide-border">
            {items.map((v, i) => (
              <div key={i} onClick={() => onVideoOpen?.({ title: v.title, channel: v.channel, duration: v.duration, language: v.language, quality: '1080p', views: '—', age: v.date, url: v.url, thumbnail: v.thumbnail, source: v.source })} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] items-center gap-4 px-5 py-3.5 hover:bg-bg-input/40 transition-colors cursor-pointer group">
                {/* Title + thumbnail */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-[72px] h-[40px] rounded-md bg-bg-input overflow-hidden flex-shrink-0 relative">
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] font-semibold px-1 py-0.5 rounded">
                      {v.duration}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-text-primary truncate leading-snug">{v.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Play size={9} className="text-youtube" fill="currentColor" />
                      <span className="text-[10px] text-text-muted">{v.channel}</span>
                      <span className="text-[10px] font-medium px-1 py-0 rounded bg-bg-input text-text-muted">{v.language}</span>
                    </div>
                  </div>
                </div>

                {/* Source */}
                <div className="flex items-center gap-1.5">
                  {v.source === 'Whisper' ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Whisper</span>
                  ) : (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#4dc8e8]/10 text-[#4dc8e8]">YT Captions</span>
                  )}
                </div>

                {/* Insights count */}
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-accent" />
                  <span className="text-[12px] text-text-secondary">{v.insights} generated</span>
                </div>

                {/* Date */}
                <span className="text-[11px] text-text-muted">{v.date}</span>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 text-text-muted hover:text-danger cursor-pointer transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                  <button className="p-1 text-text-muted hover:text-accent cursor-pointer transition-colors" title="Open">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-center">
          <button className="text-[12px] text-text-muted hover:text-text-secondary cursor-pointer transition-colors py-2">
            Load older videos…
          </button>
        </div>

      </div>
    </main>
  );
}
