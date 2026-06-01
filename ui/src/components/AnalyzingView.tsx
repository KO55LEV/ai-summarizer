import {
  Sparkles,
  Link as LinkIcon,
  XCircle,
  Check,
  AlertTriangle,
  Globe,
  FileText,
  AudioLines,
  Headphones,
  Languages,
  Zap,
  Loader2,
  Circle,
  Copy,
  Bell,
  Lock,
} from 'lucide-react';
import AudioWaveform from './AudioWaveform';
import type { ProcessingState } from '../types/pipeline';

interface AnalyzingViewProps {
  url: string;
  state: ProcessingState;
  onCancel: () => void;
}

const STEP_ICONS = [
  <Globe size={18} />,
  <FileText size={18} />,
  <AlertTriangle size={18} />,
  <AudioLines size={18} />,
  <Headphones size={18} />,
  <Languages size={18} />,
  <Zap size={18} />,
];

export default function AnalyzingView({ url, state, onCancel }: AnalyzingViewProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url).catch(() => {});
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[680px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-[28px] font-bold text-text-primary mb-2 tracking-tight">
            Analyzing your video
          </h1>
          <p className="text-text-secondary text-[13px] leading-relaxed max-w-[480px] mx-auto">
            We're fetching captions, transcribing audio, and generating insights.
            <br />
            This usually takes 2–6 minutes depending on video length.
          </p>
        </div>

        {/* URL display */}
        <div className="bg-bg-card border border-border rounded-xl p-1.5 mb-3">
          <div className="flex items-center gap-2.5 bg-bg-input rounded-lg px-4 py-2.5">
            <LinkIcon size={16} className="text-text-muted flex-shrink-0" />
            <span className="flex-1 text-[13px] text-text-secondary truncate">{url}</span>
            <button onClick={handleCopy} className="text-text-muted hover:text-text-primary cursor-pointer p-0.5">
              <Copy size={14} />
            </button>
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 bg-accent/80 text-bg-primary font-semibold py-2.5 rounded-lg text-[14px] cursor-not-allowed"
            >
              <Loader2 size={16} className="animate-spin" />
              Analyzing video...
            </button>
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-2 bg-bg-input hover:bg-bg-card-hover text-text-secondary font-semibold py-2.5 rounded-lg transition-colors cursor-pointer border border-border text-[14px]"
            >
              <XCircle size={16} />
              Cancel analysis
            </button>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="bg-bg-card border border-border rounded-xl px-5 py-4 mb-3">
          <div className="flex items-center justify-between">
            {state.steps.map((step, i) => (
              <div key={step.key} className="flex items-center">
                {/* Step node */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.status === 'completed' ? 'bg-accent/20 border-accent text-accent' :
                    step.status === 'running' ? 'bg-accent/30 border-accent text-accent animate-pulse ring-4 ring-accent/10' :
                    step.status === 'warning' ? 'bg-amber-500/20 border-amber-500 text-amber-500' :
                    step.status === 'failed' ? 'bg-danger/20 border-danger text-danger' :
                    'bg-bg-input border-border text-text-muted'
                  }`}>
                    {step.status === 'completed' ? <Check size={16} /> :
                     step.status === 'running' ? STEP_ICONS[i] :
                     step.status === 'warning' ? <AlertTriangle size={14} /> :
                     STEP_ICONS[i]}
                  </div>
                  <div className={`text-[10px] font-medium mt-1.5 text-center max-w-[85px] leading-tight ${
                    step.status === 'completed' || step.status === 'running' ? 'text-text-primary' :
                    step.status === 'warning' ? 'text-amber-500' :
                    'text-text-muted'
                  }`}>
                    {i + 1}. {step.label}
                  </div>
                  <div className="text-[9px] text-text-muted mt-0.5">
                    {step.time || '—'}
                  </div>
                </div>

                {/* Connector */}
                {i < state.steps.length - 1 && (
                  <div className={`w-8 h-[2px] mx-1 mt-[-22px] ${
                    step.status === 'completed' ? 'bg-accent' :
                    step.status === 'warning' ? 'bg-amber-500/50' :
                    'bg-border'
                  } ${step.status === 'completed' ? '' : 'bg-[length:8px_2px] bg-repeat-x'}`}
                  style={step.status !== 'completed' ? { backgroundImage: `repeating-linear-gradient(90deg, ${step.status === 'warning' ? 'rgb(245 158 11 / 0.5)' : 'var(--color-border)'} 0 4px, transparent 4px 8px)`, backgroundColor: 'transparent' } : {}}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Whisper fallback warning */}
        {state.steps[2]?.status === 'warning' || state.steps[2]?.status === 'completed' ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
            <div>
              <span className="text-[12px] font-semibold text-amber-400">Transcript not available on YouTube.</span>
              <span className="text-[12px] text-text-secondary ml-1.5">Falling back to Whisper transcription.</span>
            </div>
          </div>
        ) : null}

        {/* Video metadata card */}
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-3 flex gap-4">
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
            <h3 className="text-[14px] font-semibold text-text-primary mb-1.5 leading-snug">{state.videoMeta.title}</h3>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 bg-bg-input rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-text-muted">CF</span>
              </div>
              <span className="text-[12px] text-text-secondary">{state.videoMeta.channel}</span>
              <Check size={12} className="text-blue-400" />
            </div>
            <div className="text-[11px] text-text-muted mb-3">{state.videoMeta.views} • {state.videoMeta.age}</div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-[13px] font-semibold text-text-primary">{state.videoMeta.duration}</div>
                <div className="text-[10px] text-text-muted">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-[13px] font-semibold text-text-primary">{state.videoMeta.language}</div>
                <div className="text-[10px] text-text-muted">Language</div>
              </div>
              <div className="text-center">
                <div className="text-[13px] font-semibold text-text-primary">{state.videoMeta.quality}</div>
                <div className="text-[10px] text-text-muted">Quality</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live processing */}
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-semibold text-text-primary">Live processing</h4>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] text-accent">
                {state.isComplete ? 'Complete' : state.steps[state.currentStepIndex]?.status === 'running' ? state.steps[state.currentStepIndex].label + '...' : 'Processing...'}
              </span>
            </div>
          </div>

          <div className="flex gap-4">
            {/* Waveform + Logs */}
            <div className="flex-1 min-w-0">
              <AudioWaveform
                isAnimating={!state.isComplete}
                barCount={80}
                height={36}
                color="var(--color-accent)"
                className="mb-3"
              />
              <div className="space-y-1">
                {state.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-text-muted font-mono w-[60px] flex-shrink-0">{log.time}</span>
                    <span className="flex-shrink-0 mt-0.5">
                      {log.status === 'success' ? <Check size={11} className="text-accent" /> :
                       log.status === 'warning' ? <AlertTriangle size={11} className="text-amber-500" /> :
                       log.status === 'running' ? <Circle size={11} className="text-accent" /> :
                       log.status === 'error' ? <XCircle size={11} className="text-danger" /> :
                       <Circle size={11} className="text-text-muted" />}
                    </span>
                    <span className={
                      log.status === 'success' ? 'text-text-primary' :
                      log.status === 'warning' ? 'text-amber-400' :
                      log.status === 'running' ? 'text-accent' :
                      'text-text-secondary'
                    }>{log.message}</span>
                  </div>
                ))}
                {/* Pending future steps */}
                {state.steps.filter(s => s.status === 'pending').map((s) => (
                  <div key={s.key} className="flex items-start gap-2 text-[11px]">
                    <span className="text-text-muted font-mono w-[60px] flex-shrink-0" />
                    <Circle size={11} className="text-text-muted/40 mt-0.5 flex-shrink-0" />
                    <span className="text-text-muted/60">{s.label}...</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Processing meta table */}
            <div className="w-[240px] flex-shrink-0 bg-bg-input rounded-lg p-3 space-y-2.5">
              <MetaRow label="Transcript source" value={state.processingMeta.transcriptSource} accent={state.processingMeta.transcriptSource.includes('Whisper')} />
              <MetaRow label="Language" value={state.processingMeta.languageStatus} />
              <MetaRow label="Est. time remaining" value={state.processingMeta.estimatedTime} />
              <MetaRow label="Job ID" value={state.processingMeta.jobId} mono />
              <div className="border-t border-border pt-2 mt-2 flex items-center gap-2 text-[10px] text-text-muted">
                <Bell size={11} className="flex-shrink-0" />
                <span>You can leave this page. We'll notify you when it's ready.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-2">
          <p className="text-[11px] text-text-muted flex items-center justify-center gap-1.5">
            <Lock size={11} />
            We only access publicly available data. No login or permissions required.
          </p>
        </div>
      </div>
    </main>
  );
}

function MetaRow({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className={`text-[11px] font-medium truncate max-w-[140px] ${accent ? 'text-accent' : 'text-text-primary'} ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
