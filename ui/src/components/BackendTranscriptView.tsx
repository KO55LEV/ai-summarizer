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
  BookOpen,
  MessageSquareText,
} from 'lucide-react';
import type { TranscriptResponse, VideoMetadata } from '../types';

interface BackendTranscriptViewProps {
  url: string;
  transcript: TranscriptResponse;
  videoMeta: VideoMetadata;
  onChangeUrl: () => void;
}

type Tab = 'transcript' | 'clean' | 'chapters' | 'notes';

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTranscriptLines(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function BackendTranscriptView({ url, transcript, videoMeta, onChangeUrl }: BackendTranscriptViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const transcriptLines = formatTranscriptLines(transcript.transcriptText);
  const filteredLines = searchQuery
    ? transcriptLines.filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
    : transcriptLines;

  const transcriptSource = transcript.sourceFilePath ? 'Whisper transcript' : 'YouTube transcript';
  const transcriptSourceLabel = transcript.sourceFilePath ? 'Whisper fallback' : 'YouTube subtitles';

  const cleanText = transcript.cleanText ?? transcript.transcriptText;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanText).catch(() => {});
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[680px] mx-auto px-8 py-8">
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent/20 border border-accent/40 flex-shrink-0">
              <Check size={16} className="text-accent" />
            </div>
            <h1 className="text-[26px] font-bold text-text-primary tracking-tight">Transcript ready</h1>
          </div>
          <p className="text-text-secondary text-[13px] ml-11">
            Your transcript has been generated successfully.<br />
            Explore the clean text below, then we can wire summary, chapters, and notes next.
          </p>
        </div>

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

        <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 flex gap-4">
          <div className="w-[200px] h-[112px] bg-bg-input rounded-lg overflow-hidden flex-shrink-0 relative">
            <img
              src={videoMeta.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
              {videoMeta.duration}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-text-primary mb-2 leading-snug">{videoMeta.title}</h3>
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-5 h-5 bg-bg-input rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-text-muted">YT</span>
              </div>
              <span className="text-[12px] text-text-secondary">{videoMeta.channel}</span>
              <span className="text-[11px] text-text-muted ml-1">{transcriptSourceLabel}</span>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Duration</div>
                <div className="text-[12px] font-medium text-text-primary">{formatDuration(transcript.durationSeconds)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Transcript source</div>
                <div className="text-[12px] font-medium text-text-primary">{transcriptSource}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Language</div>
                <div className="text-[12px] font-medium text-text-primary">{transcript.language.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0 mb-3 border-b border-border">
          {(['transcript', 'clean', 'chapters', 'notes'] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = {
              transcript: 'Transcript',
              clean: 'Clean text',
              chapters: 'Chapters',
              notes: 'Notes',
            };

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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript"
              className="bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none w-[140px]"
            />
          </div>
          <button className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
            <Globe size={12} />
            {transcript.language}
            <ChevronDown size={11} />
          </button>
        </div>

        {activeTab === 'transcript' && (
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-3">
            <div className="divide-y divide-border">
              {filteredLines.map((line, i) => (
                <div key={`${i}-${line.slice(0, 24)}`} className="flex gap-4 px-4 py-3 hover:bg-bg-input/50 transition-colors group">
                  <div className="text-[12px] font-mono text-accent font-medium flex-shrink-0 w-[42px]">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <p className="text-[13px] text-text-secondary leading-relaxed flex-1">{line}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'clean' && (
          <div className="bg-bg-card border border-border rounded-xl p-4 mb-3">
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary font-sans">{cleanText}</pre>
          </div>
        )}

        {activeTab === 'chapters' && (
          <div className="bg-bg-card border border-border rounded-xl p-5 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Mocked chapters</span>
            </div>
            <p className="text-[13px] text-text-muted leading-relaxed">
              Chapters and summaries are intentionally mocked for now. We will wire them to the transcript in the next pass.
            </p>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="bg-bg-card border border-border rounded-xl p-5 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquareText size={14} className="text-accent" />
              <span className="text-[13px] font-semibold text-text-primary">Mocked notes</span>
            </div>
            <p className="text-[13px] text-text-muted leading-relaxed">
              Notes and AI-generated highlights stay mocked in this first version.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pb-2">
          <p className="text-[11px] text-text-muted">
            Word count: {transcript.wordCount.toLocaleString()} &nbsp;•&nbsp; Character count: {transcript.characterCount.toLocaleString()}
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
