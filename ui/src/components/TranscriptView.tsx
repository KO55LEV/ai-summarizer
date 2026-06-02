import { useState } from 'react';
import {
  Check,
  Link as LinkIcon,
  Copy,
  Download,
  Search,
  Globe,
  Edit3,
  ChevronDown,
} from 'lucide-react';
import type { ProcessingState } from '../types/pipeline';

interface TranscriptViewProps {
  url: string;
  state: ProcessingState;
  onChangeUrl: () => void;
}

type Tab = 'transcript' | 'clean' | 'chapters' | 'notes';

const FAKE_TRANSCRIPT = [
  { ts: '00:18', text: "Hello everyone! Today we're talking about Mars colonization and SpaceX's ambitious plan to make humanity multiplanetary." },
  { ts: '00:41', text: "Many people think reaching Mars is simple — just build a rocket and fly. But on the contrary, there are incredible engineering challenges that require entirely new approaches." },
  { ts: '01:08', text: "First principle — propulsion. The Raptor engine burns liquid methane and liquid oxygen, both of which can be produced on Mars using the Sabatier reaction." },
  { ts: '01:36', text: "Second principle — reusability. The Starship is designed to be fully reusable, dramatically reducing cost per kilogram to orbit and beyond." },
  { ts: '02:06', text: "Third principle — in-situ resource utilization. Everything needed to return from Mars — fuel, oxygen, water — can be manufactured on the surface." },
  { ts: '02:37', text: "Fourth principle — life support. Closed-loop systems for air, water, and food are essential for a self-sustaining colony of 1 million people." },
  { ts: '03:05', text: "And finally, the fifth principle — community. Build the right culture, attract the right people, and create an environment where innovation thrives on another world." },
  { ts: '03:44', text: "Elon Musk estimates the first crewed missions could land on Mars as early as 2029, with the first permanent bases established in the 2030s." },
  { ts: '04:12', text: "The total cost to build a self-sustaining city on Mars is estimated at around 100 billion to 10 trillion dollars, spread over decades." },
  { ts: '04:55', text: "Starship's payload capacity — 100-150 tonnes to low Earth orbit — is the key enabler. Previous rockets could never make this economics work." },
];

const PIPELINE_LABELS = [
  'Video fetched',
  'Transcript generated',
  'Language detected',
  'Insights ready',
];

export default function TranscriptView({ url, state, onChangeUrl }: TranscriptViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const handleCopy = () => {
    const text = FAKE_TRANSCRIPT.map(l => `${l.ts}  ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const filtered = searchQuery
    ? FAKE_TRANSCRIPT.filter(l => l.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAKE_TRANSCRIPT;

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[680px] mx-auto px-8 py-8">

        {/* ── Header ──────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent/20 border border-accent/40 flex-shrink-0">
              <Check size={16} className="text-accent" />
            </div>
            <h1 className="text-[26px] font-bold text-text-primary tracking-tight">Transcript ready</h1>
          </div>
          <p className="text-text-secondary text-[13px] ml-11">
            Your transcript has been generated successfully.<br />
            Explore insights, summaries, and key takeaways from this video.
          </p>
        </div>

        {/* ── Pipeline breadcrumb ─────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl px-5 py-3.5 mb-4 flex items-center gap-2">
          {PIPELINE_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center bg-accent/20 border border-accent/40 flex-shrink-0">
                  <Check size={9} className="text-accent" />
                </div>
                <span className="text-[11px] font-medium text-text-primary truncate">{label}</span>
              </div>
              {i < PIPELINE_LABELS.length - 1 && (
                <svg className="flex-shrink-0 ml-auto" width="20" height="10" viewBox="0 0 20 10">
                  <line x1="0" y1="5" x2="14" y2="5" stroke="#1e2d4a" strokeWidth="1.5" />
                  <polygon points="18,5 14,3 14,7" fill="#1e2d4a" />
                </svg>
              )}
            </div>
          ))}
        </div>

        {/* ── URL bar ─────────────────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <LinkIcon size={14} className="text-text-muted flex-shrink-0" />
          <span className="flex-1 text-[12px] text-text-secondary truncate">{url}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[12px] font-medium text-accent">Completed</span>
          </div>
          <div className="w-px h-4 bg-border flex-shrink-0" />
          <button
            onClick={onChangeUrl}
            className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            <Edit3 size={12} />
            Change
          </button>
        </div>

        {/* ── Video card ──────────────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 flex gap-4">
          <div className="w-[200px] h-[112px] bg-bg-input rounded-lg overflow-hidden flex-shrink-0 relative">
            <img
              src={state.videoMeta.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
              {state.videoMeta.duration}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-text-primary mb-2 leading-snug">{state.videoMeta.title}</h3>
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-5 h-5 bg-bg-input rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-text-muted">CF</span>
              </div>
              <span className="text-[12px] text-text-secondary">{state.videoMeta.channel}</span>
              <Check size={12} className="text-blue-400" />
              <span className="text-[11px] text-text-muted ml-1">1.04K subscribers</span>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Duration</div>
                <div className="text-[12px] font-medium text-text-primary">{state.videoMeta.duration}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Transcript source</div>
                <div className="text-[12px] font-medium text-text-primary">Whisper transcript</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Language</div>
                <div className="text-[12px] font-medium text-text-primary">English (en)</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────── */}
        <div className="flex items-center gap-0 mb-3 border-b border-border">
          {(['transcript', 'clean', 'chapters', 'notes'] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = { transcript: 'Transcript', clean: 'Clean text', chapters: 'Chapters', notes: 'Notes' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ── Toolbar ─────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Copy size={13} />
            Copy transcript
          </button>
          <div className="relative">
            <button className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
              <Download size={13} />
              Export
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 bg-bg-card border border-border rounded-lg px-3 py-1.5">
            <Search size={12} className="text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search transcript"
              className="bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none w-[140px]"
            />
          </div>
          <button className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
            <Globe size={12} />
            en
            <ChevronDown size={11} />
          </button>
        </div>

        {/* ── Transcript content ──────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-3">
          <div className="divide-y divide-border">
            {filtered.map((line, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 hover:bg-bg-input/50 transition-colors group">
                <button className="text-[12px] font-mono text-accent font-medium flex-shrink-0 w-[42px] hover:underline cursor-pointer">
                  {line.ts}
                </button>
                <p className="text-[13px] text-text-secondary leading-relaxed flex-1">{line.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="flex items-center justify-between pb-2">
          <p className="text-[11px] text-text-muted">
            Word count: 8,532 &nbsp;•&nbsp; Character count: 56,321
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">Auto-scroll</span>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${autoScroll ? 'bg-accent' : 'bg-bg-input border border-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${autoScroll ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
