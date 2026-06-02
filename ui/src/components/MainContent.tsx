import { useEffect, useRef, useState } from 'react';
import { Sparkles, Link as LinkIcon, X, Lock, CloudUpload, Gauge } from 'lucide-react';
import {
  CloudFetchIcon,
  TranscriptWaveformIcon,
  InsightSparkleIcon,
  YouTubeLogoIcon,
  CaptionBarsIcon,
  WaveformBarsIcon,
  SummarySparklesIcon,
  CloudDownloadIcon,
} from './icons';
import { analyzeVideo } from '../api';
import type { TranscriptScheduleResponse } from '../types';

interface MainContentProps {
  onStartAnalysis?: (url: string) => Promise<void> | void;
  errorMessage?: string | null;
}

export default function MainContent({ onStartAnalysis, errorMessage }: MainContentProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptScheduleResponse | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const handleAnalyze = async () => {
    if (!youtubeUrl.trim()) return;
    if (onStartAnalysis) {
      setError(null);
      setResult(null);
      setIsLoading(true);
      Promise.resolve(onStartAnalysis(youtubeUrl.trim()))
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        })
        .finally(() => {
          if (mountedRef.current) {
            setIsLoading(false);
          }
        });
      return;
    }
    setError(null);
    setResult(null);
    setIsLoading(true);
    try {
      const response = await analyzeVideo({ youtubeUrl: youtubeUrl.trim() });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setYoutubeUrl(text);
    } catch {
      // clipboard permission denied
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[680px] mx-auto px-8 py-8">

        {/* ── Hero ──────────────────────────────────────── */}
        <div className="text-center mb-6">
          <h1 className="text-[26px] font-bold text-text-primary mb-2 tracking-tight">
            Summarize any YouTube video
          </h1>
          <p className="text-text-secondary text-[13px] leading-relaxed max-w-[480px] mx-auto">
            Paste a YouTube link and we'll automatically fetch captions, detect language,
            and generate a smart summary — even when YouTube has no transcript.
          </p>
        </div>

        {/* ── URL Input ─────────────────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl p-1.5 mb-4">
          <div className="flex items-center gap-2.5 bg-bg-input rounded-lg px-4 py-2.5">
            <LinkIcon size={16} className="text-text-muted flex-shrink-0" />
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube link here (e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
              className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted outline-none"
            />
            {youtubeUrl ? (
              <button onClick={() => setYoutubeUrl('')} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X size={14} />
              </button>
            ) : (
              <X size={14} className="text-text-muted/30" />
            )}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !youtubeUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg-primary font-semibold py-2.5 rounded-lg transition-colors cursor-pointer text-[14px]"
            >
              <Sparkles size={16} />
              {isLoading ? 'Analyzing...' : 'Analyze Video'}
            </button>
            <button
              onClick={handlePaste}
              className="flex-1 flex items-center justify-center gap-2 bg-bg-input hover:bg-bg-card-hover text-text-secondary font-semibold py-2.5 rounded-lg transition-colors cursor-pointer border border-border text-[14px]"
            >
              <LinkIcon size={16} />
              Paste Link
            </button>
          </div>
        </div>

        {/* Error */}
        {(error || errorMessage) && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-2.5 mb-4 text-[13px]">
            {error || errorMessage}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-bg-card border border-accent/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[13px] font-semibold text-accent">
                {result.status === 'completed' ? 'Analysis Complete' : 'Processing...'}
              </span>
            </div>
            {result.status === 'completed' && result.transcript && (
              <div className="space-y-1 text-[13px] text-text-secondary">
                <p>Language: <span className="text-text-primary font-medium">{result.transcript.language}</span></p>
                <p>Duration: <span className="text-text-primary font-medium">{Math.round(result.transcript.durationSeconds / 60)} min</span></p>
                <p>Words: <span className="text-text-primary font-medium">{result.transcript.wordCount.toLocaleString()}</span></p>
              </div>
            )}
            {result.status === 'queued' && result.workflow && (
              <p className="text-[13px] text-text-secondary">
                Workflow queued. ID: <code className="text-accent text-xs">{result.workflow.id}</code>
              </p>
            )}
          </div>
        )}

        {/* ── 3-Step Pipeline ───────────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl px-6 py-5 mb-4">
          <div className="flex items-center">

            {/* Step 1 */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-[#141e33] border border-[#253552]">
                <CloudFetchIcon size={20} className="text-text-secondary" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-primary leading-tight">1. Fetch video</div>
                <p className="text-[11px] text-text-muted leading-snug mt-0.5">We retrieve the video metadata and captions.</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 mx-2">
              <svg width="40" height="10" viewBox="0 0 40 10"><line x1="0" y1="5" x2="32" y2="5" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" opacity=".7" /><polygon points="37,5 32,2.5 32,7.5" fill="#ef4444" opacity=".8" /></svg>
            </div>

            {/* Step 2 */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#0f1f33] border border-[#2a5070]">
                <TranscriptWaveformIcon size={20} className="text-[#4dc8e8]" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-primary leading-tight">2. Get transcript or Whisper fallback</div>
                <p className="text-[11px] text-text-muted leading-snug mt-0.5">We use captions when available, otherwise Whisper generates one.</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 mx-2">
              <svg width="40" height="10" viewBox="0 0 40 10"><line x1="0" y1="5" x2="32" y2="5" stroke="#4dc8e8" strokeWidth="1.5" strokeDasharray="4 3" opacity=".5" /><polygon points="37,5 32,2.5 32,7.5" fill="#4dc8e8" opacity=".6" /></svg>
            </div>

            {/* Step 3 */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0">
                <InsightSparkleIcon size={36} className="text-[#00d4ff]" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-primary leading-tight">3. Generate insights</div>
                <p className="text-[11px] text-text-muted leading-snug mt-0.5">We detect language and create a smart summary with key takeaways.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── How YouTube Summarizer works ───────────────── */}
        <div className="bg-bg-card border border-border rounded-xl px-6 py-6 mb-4">
          <h3 className="text-[15px] font-bold text-text-primary text-center mb-6">
            How YouTube Summarizer works
          </h3>

          <div className="flex items-start justify-center gap-0">
            {/* YouTube Video */}
            <FlowItem
              icon={
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center bg-[#1a1520] border border-[#5c2020]"
                  style={{ boxShadow: '0 0 20px rgba(255,0,0,0.08)' }}>
                  <YouTubeLogoIcon size={36} />
                </div>
              }
              title="YouTube Video"
              description="Any public video"
            />

            <FlowArrow color="#ff6b6b" />

            {/* Captions */}
            <FlowItem
              icon={
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center bg-[#0f1a2e] border border-[#253d5c]"
                  style={{ boxShadow: '0 0 16px rgba(77,200,232,0.06)' }}>
                  <CaptionBarsIcon size={28} className="text-[#4dc8e8]" />
                </div>
              }
              title="Captions if available"
              description="We check for official captions first"
            />

            <FlowArrow color="#4dc8e8" />

            {/* Whisper */}
            <FlowItem
              icon={
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center bg-[#0f1a2e] border border-[#253d5c]"
                  style={{ boxShadow: '0 0 16px rgba(91,156,245,0.06)' }}>
                  <WaveformBarsIcon size={28} className="text-[#5b9cf5]" />
                </div>
              }
              title="Whisper fallback if needed"
              description="If captions are unavailable, we generate one"
            />

            <FlowArrow color="#00d4aa" />

            {/* Actionable summary */}
            <FlowItem
              icon={
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center bg-[#0c1f1f] border border-[#1a5c4a]"
                  style={{ boxShadow: '0 0 24px rgba(0,212,170,0.1)' }}>
                  <SummarySparklesIcon size={28} className="text-[#00d4aa]" />
                </div>
              }
              title="Actionable summary"
              description="Get insights, chapters, quotes, and more."
            />
          </div>
        </div>

        {/* ── Account required ──────────────────────────── */}
        <div className="bg-bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0c1f1f] border border-[#1a5c4a]">
              <CloudDownloadIcon size={22} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h3 className="text-[13px] font-bold text-text-primary">Account required to analyze and save</h3>
                <button className="text-[11px] text-text-muted hover:text-text-secondary cursor-pointer">Why?</button>
              </div>
              <p className="text-[11px] text-text-secondary mb-3 leading-relaxed">
                We use paid AI and transcription services to fetch captions, generate transcripts,
                and create high-quality summaries. An account lets you save your history, exports,
                and preferences securely.
              </p>
              <div className="flex gap-5 mb-3">
                <Pill icon={<Lock size={12} className="text-accent" />} label="Secure & private" sub="Your data is encrypted" />
                <Pill icon={<CloudUpload size={12} className="text-accent" />} label="Save & sync" sub="Access anywhere" />
                <Pill icon={<Gauge size={12} className="text-accent" />} label="Usage included" sub="On all paid plans" />
              </div>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-bg-primary font-semibold py-2 rounded-lg transition-colors cursor-pointer text-[12px]">
                  <Sparkles size={13} />
                  Start free trial
                  <span className="text-[10px] opacity-70 font-normal ml-0.5">No credit card</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 bg-bg-input hover:bg-bg-card-hover text-text-secondary font-semibold py-2 rounded-lg transition-colors cursor-pointer border border-border text-[12px]">
                  <Lock size={13} />
                  Sign in
                  <span className="text-[10px] opacity-70 font-normal ml-0.5">Already have an account?</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="text-center pb-2">
          <p className="text-[10px] text-text-muted flex items-center justify-center gap-1.5">
            <Lock size={10} />
            We only access publicly available data. No login or permissions required.
          </p>
        </div>
      </div>
    </main>
  );
}

/* ═══════════ Sub-components ═══════════ */

function FlowItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center px-1">
      {icon}
      <div className="text-[12px] font-semibold text-text-primary mt-2.5 mb-0.5 leading-tight">{title}</div>
      <p className="text-[10px] text-text-muted leading-relaxed max-w-[130px]">{description}</p>
    </div>
  );
}

function FlowArrow({ color }: { color: string }) {
  return (
    <div className="flex items-center pt-7 px-0.5 flex-shrink-0">
      <svg width="36" height="10" viewBox="0 0 36 10" fill="none">
        <line x1="0" y1="5" x2="28" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity=".55" />
        <polygon points="34,5 28,2.2 28,7.8" fill={color} opacity=".7" />
      </svg>
    </div>
  );
}

function Pill({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <div>
        <div className="font-semibold text-text-primary text-[11px] leading-tight">{label}</div>
        <div className="text-[9px] text-text-muted">{sub}</div>
      </div>
    </div>
  );
}
