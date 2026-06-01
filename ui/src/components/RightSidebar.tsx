import {
  Sparkles,
  FileText,
  List,
  Star,
  Quote,
  MessageCircle,
  BookOpen,
  CheckCircle2,
  Shield,
  Lock,
} from 'lucide-react';

const features = [
  {
    icon: <FileText size={15} />,
    title: 'Quick Summary',
    description: 'A concise overview of the entire video in plain language.',
  },
  {
    icon: <List size={15} />,
    title: 'Chapters',
    description: 'Timeline-based breakdown to help you navigate key moments.',
  },
  {
    icon: <Star size={15} />,
    title: 'Key Takeaways',
    description: 'The most important points, clearly and simply.',
  },
  {
    icon: <Quote size={15} />,
    title: 'Key Quotes',
    description: 'Notable quotes with timestamps so you can revisit instantly.',
  },
  {
    icon: <MessageCircle size={15} />,
    title: 'Ask this video',
    description: 'Ask questions and get answers from the video content.',
  },
  {
    icon: <BookOpen size={15} />,
    title: 'Study Guide',
    description: 'Quizzes, flashcards, and a quick review to test your knowledge.',
  },
];

const steps = [
  {
    number: 1,
    color: 'bg-youtube',
    title: 'Check YouTube captions',
    description: 'We look for official captions or transcripts.',
  },
  {
    number: 2,
    color: 'bg-accent',
    title: 'Fallback to Whisper',
    description: 'If none are available, Whisper generates one.',
  },
  {
    number: 3,
    color: 'bg-accent',
    title: 'Detect language',
    description: 'We automatically detect the video language.',
  },
  {
    number: 4,
    color: 'bg-accent',
    title: 'Generate AI insights',
    description: 'We create a smart summary, chapters, quotes, and more.',
  },
];

export default function RightSidebar() {
  return (
    <aside className="w-[260px] flex-shrink-0 border-l border-border bg-bg-secondary h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 py-5">
        {/* What you'll get */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">What you'll get</span>
          </div>
          <div className="space-y-1">
            {features.map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bg-card transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 bg-bg-card group-hover:bg-bg-input rounded-md flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                  {feature.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-text-primary mb-px leading-tight">{feature.title}</div>
                  <div className="text-[10px] text-text-muted leading-snug">{feature.description}</div>
                </div>
                {/* Skeleton bars */}
                <div className="flex flex-col gap-1 mt-1.5 flex-shrink-0">
                  <div className="w-7 h-[2px] bg-border/70 rounded-full" />
                  <div className="w-5 h-[2px] bg-border/50 rounded-full" />
                  <div className="w-8 h-[2px] bg-border/70 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">How it works</span>
          </div>
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.number} className="flex items-start gap-2.5">
                <div className={`w-5 h-5 ${step.color} rounded-full flex items-center justify-center flex-shrink-0 mt-px`}>
                  <span className="text-[10px] font-bold text-white">{step.number}</span>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-text-primary leading-tight">{step.title}</div>
                  <div className="text-[10px] text-text-muted leading-snug">{step.description}</div>
                </div>
              </div>
            ))}
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
