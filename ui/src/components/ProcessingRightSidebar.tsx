import {
  Sparkles,
  FileText,
  List,
  Star,
  Quote,
  Check,
  AlertTriangle,
  Circle,
  Loader2,
  Settings,
  Shield,
  Lock,
} from 'lucide-react';
import type { ProcessingState } from '../types/pipeline';

interface ProcessingRightSidebarProps {
  state: ProcessingState;
}

const whatHappensNext = [
  { icon: <FileText size={15} />, title: 'Quick Summary', description: 'AI overview of the entire video' },
  { icon: <List size={15} />, title: 'Chapters', description: 'Timeline breakdown with key moments' },
  { icon: <Star size={15} />, title: 'Key Takeaways', description: 'Top insights and actionable points' },
  { icon: <Quote size={15} />, title: 'Quotes', description: 'Memorable quotes with timestamps' },
];

export default function ProcessingRightSidebar({ state }: ProcessingRightSidebarProps) {
  return (
    <aside className="w-[260px] flex-shrink-0 border-l border-border bg-bg-secondary h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 py-5">
        {/* Live progress */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Live progress</span>
          </div>
          <div className="space-y-2">
            {state.steps.map((step) => (
              <div key={step.key} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  {step.status === 'completed' ? (
                    <div className="w-[18px] h-[18px] bg-accent rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  ) : step.status === 'running' ? (
                    <div className="w-[18px] h-[18px] bg-accent/30 border border-accent rounded-full flex items-center justify-center">
                      <Loader2 size={10} className="text-accent animate-spin" />
                    </div>
                  ) : step.status === 'warning' ? (
                    <div className="w-[18px] h-[18px] bg-amber-500/20 rounded-full flex items-center justify-center">
                      <AlertTriangle size={9} className="text-amber-500" />
                    </div>
                  ) : (
                    <div className="w-[18px] h-[18px] flex items-center justify-center">
                      <Circle size={10} className="text-text-muted/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-medium leading-tight ${
                    step.status === 'completed' || step.status === 'running' ? 'text-text-primary' :
                    step.status === 'warning' ? 'text-amber-400' :
                    'text-text-muted'
                  }`}>{step.label}</div>
                  {step.detail && step.status !== 'pending' && (
                    <div className="text-[10px] text-text-muted leading-snug">{step.detail}</div>
                  )}
                </div>
                <span className={`text-[10px] flex-shrink-0 ${
                  step.status === 'pending' ? 'text-text-muted/50' : 'text-text-muted'
                }`}>
                  {step.time || (step.status === 'pending' ? 'Pending' : '')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* What happens next */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">What happens next</span>
          </div>
          <div className="space-y-1.5">
            {whatHappensNext.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bg-card transition-colors">
                <div className="w-7 h-7 bg-bg-card rounded-md flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-text-primary leading-tight">{item.title}</div>
                  <div className="text-[10px] text-text-muted leading-snug">{item.description}</div>
                </div>
                {/* Skeleton bars */}
                <div className="flex flex-col gap-1 mt-1.5 flex-shrink-0">
                  <div className="w-6 h-[2px] bg-accent/30 rounded-full" />
                  <div className="w-4 h-[2px] bg-accent/20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Processing details */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Processing details</span>
          </div>
          <div className="bg-bg-card rounded-lg p-3 space-y-2">
            <DetailRow label="Model / Base" value={state.processingMeta.model} />
            <DetailRow label="Mode" value={state.processingMeta.mode} />
            <DetailRow label="Audio source" value={state.processingMeta.audioSource} />
            <DetailRow label="Files" value={state.processingMeta.files} />
          </div>
        </div>

        {/* Privacy note */}
        <div className="flex items-center gap-2 p-3 bg-bg-card rounded-lg">
          <Shield size={13} className="text-accent flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] text-text-secondary leading-snug">
              Your data is private and secure. We don't store videos or share your data.
            </div>
          </div>
          <Lock size={12} className="text-text-muted flex-shrink-0" />
        </div>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] text-text-muted">{label}</span>
      <span className="text-[10px] text-text-primary font-medium truncate max-w-[130px]">{value}</span>
    </div>
  );
}
