import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import {
  Download,
  FileText,
  FileJson,
  File,
  Clock,
  ChevronDown,
  Search,
  CheckCircle,
} from 'lucide-react';
import type { ExportRecord } from '../../api/types';
import { getExports } from '../../api/exports';

const FORMAT_ICONS: Record<string, JSX.Element> = {
  TXT:  <FileText size={14} className="text-[#94a3b8]" />,
  JSON: <FileJson size={14} className="text-[#f59e0b]" />,
  PDF:  <File size={14} className="text-[#ef4444]" />,
  SRT:  <FileText size={14} className="text-[#a78bfa]" />,
};

const TYPE_COLORS: Record<string, string> = {
  transcript: '#4dc8e8',
  full:        '#00d4aa',
  summary:    '#a78bfa',
  subtitles:  '#f59e0b',
};

function PageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8 animate-pulse">
        <div className="h-7 w-32 bg-bg-card rounded mb-2" />
        <div className="h-4 w-64 bg-bg-card rounded mb-7" />
        <div className="grid grid-cols-4 gap-3 mb-7">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-bg-card border border-border rounded-xl h-24" />)}
        </div>
        <div className="bg-bg-card border border-border rounded-xl h-64" />
      </div>
    </main>
  );
}

export default function ExportsPage() {
  const [items, setItems] = useState<ExportRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getExports().then(d => { if (mounted) { setItems(d); setLoaded(true); } });
    return () => { mounted = false; };
  }, []);

  if (!loaded) return <PageSkeleton />;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8">

        <div className="mb-7">
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1">Exports</h1>
          <p className="text-text-secondary text-[13px]">Download transcripts, summaries, and structured data in various formats.</p>
        </div>

        {/* Format cards */}
        <div className="grid grid-cols-4 gap-3 mb-7">
          {[
            { fmt: 'TXT', label: 'Plain text', desc: 'Raw transcript', icon: <FileText size={20} />, color: '#94a3b8' },
            { fmt: 'JSON', label: 'Structured JSON', desc: 'Full data with metadata', icon: <FileJson size={20} />, color: '#f59e0b' },
            { fmt: 'PDF', label: 'PDF report', desc: 'Formatted summary', icon: <File size={20} />, color: '#ef4444' },
            { fmt: 'SRT', label: 'Subtitles', desc: 'Timestamped captions', icon: <FileText size={20} />, color: '#a78bfa' },
          ].map((f) => (
            <div key={f.fmt} className="bg-bg-card border border-border rounded-xl p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: f.color + '18', color: f.color }}>
                {f.icon}
              </div>
              <div className="text-[13px] font-semibold text-text-primary mb-0.5">{f.label}</div>
              <div className="text-[11px] text-text-muted">{f.desc}</div>
              <div className="mt-2 text-[11px] font-mono font-bold" style={{ color: f.color }}>.{f.fmt.toLowerCase()}</div>
            </div>
          ))}
        </div>

        {/* Export history */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Export history</span>
              <span className="text-[11px] text-text-muted bg-bg-input px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-bg-input border border-border rounded-lg px-3 py-1.5">
                <Search size={12} className="text-text-muted" />
                <input type="text" placeholder="Search exports" className="bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none w-[140px]" />
              </div>
              <button className="flex items-center gap-1.5 bg-bg-input border border-border rounded-lg px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary cursor-pointer">
                Format <ChevronDown size={12} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {items.map((ex, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-input/40 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-bg-input flex items-center justify-center flex-shrink-0">
                  {FORMAT_ICONS[ex.format]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-text-primary truncate">{ex.title}</div>
                  <div className="text-[10px] text-text-muted">{ex.channel}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: TYPE_COLORS[ex.type] + '18', color: TYPE_COLORS[ex.type] }}>
                    {ex.type}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-text-muted">{ex.format}</span>
                  <span className="text-[11px] text-text-muted w-[50px] text-right">{ex.size}</span>
                  <span className="text-[11px] text-text-muted w-[80px] text-right">{ex.date}</span>
                  <button className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Download size={12} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bulk export CTA */}
        <div className="mt-4 bg-gradient-to-r from-accent/8 to-transparent border border-accent/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={15} className="text-accent" />
            <div>
              <div className="text-[13px] font-semibold text-text-primary">Bulk export</div>
              <div className="text-[11px] text-text-muted">Download all transcripts as a ZIP archive</div>
            </div>
          </div>
          <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-primary font-semibold px-4 py-2 rounded-lg text-[13px] transition-colors cursor-pointer flex-shrink-0">
            <Download size={13} />
            Export all
          </button>
        </div>

      </div>
    </main>
  );
}
