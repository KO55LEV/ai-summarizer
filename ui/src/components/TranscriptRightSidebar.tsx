import {
  Sparkles,
  FileText,
  List,
  Star,
  Quote,
  MessageCircle,
  BookOpen,
  ChevronRight,
  Zap,
  HelpCircle,
  Highlighter,
  CreditCard,
  Brain,
  Map,
  BookMarked,
  Lightbulb,
} from 'lucide-react';

const INSIGHTS = [
  {
    icon: <FileText size={15} className="text-[#4dc8e8]" />,
    title: 'Quick Summary',
    description: 'A concise overview of the entire video in plain language.',
  },
  {
    icon: <List size={15} className="text-[#4dc8e8]" />,
    title: 'Chapters',
    description: 'Timeline-based breakdown to help you navigate key moments.',
  },
  {
    icon: <Star size={15} className="text-[#4dc8e8]" />,
    title: 'Key Takeaways',
    description: 'The most important points, clearly and simply.',
  },
  {
    icon: <Quote size={15} className="text-[#4dc8e8]" />,
    title: 'Key Quotes',
    description: 'Notable quotes with timestamps so you can revisit instantly.',
  },
  {
    icon: <MessageCircle size={15} className="text-[#4dc8e8]" />,
    title: 'Ask this video',
    description: 'Ask questions and get answers from the video content.',
  },
  {
    icon: <BookOpen size={15} className="text-[#4dc8e8]" />,
    title: 'Study Guide',
    description: 'Quizzes, flashcards, and a quick review to test your knowledge.',
  },
];

const ACTIONS = [
  { icon: <Sparkles size={13} />, label: 'Summarize Transcript' },
  { icon: <HelpCircle size={13} />, label: 'Q&A' },
  { icon: <Highlighter size={13} />, label: 'Highlights' },
  { icon: <CreditCard size={13} />, label: 'Flash Cards' },
  { icon: <Brain size={13} />, label: 'Quiz' },
  { icon: <Map size={13} />, label: 'Mindmap' },
];

const NOTES = [
  { icon: <Quote size={13} />, label: 'Key Quotes', count: 24 },
  { icon: <Highlighter size={13} />, label: 'Highlights', count: 18 },
  { icon: <BookMarked size={13} />, label: 'Study Guide', count: 0 },
];

export default function TranscriptRightSidebar() {
  return (
    <aside className="w-[260px] flex-shrink-0 border-l border-border bg-bg-secondary h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 py-5">

        {/* ── Insights ──────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Insights</span>
          </div>
          <div className="space-y-0.5">
            {INSIGHTS.map((item) => (
              <button
                key={item.title}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-card-hover transition-colors cursor-pointer group text-left"
              >
                <div className="w-[28px] h-[28px] rounded-md flex items-center justify-center flex-shrink-0 bg-bg-card border border-border group-hover:border-[#2a5070] transition-colors">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-text-primary leading-tight">{item.title}</div>
                  <div className="text-[10px] text-text-muted leading-snug mt-0.5">{item.description}</div>
                </div>
                <ChevronRight size={13} className="text-text-muted/50 flex-shrink-0 mt-1 group-hover:text-text-muted transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* ── Actions ───────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Actions</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTIONS.map((action) => (
              <button
                key={action.label}
                className="flex items-center gap-1.5 bg-bg-card hover:bg-bg-card-hover border border-border rounded-lg px-2.5 py-2 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <span className="text-accent">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Your notes ────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Your notes</span>
          </div>
          <div className="space-y-0.5">
            {NOTES.map((note) => (
              <button
                key={note.label}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-card-hover transition-colors cursor-pointer group"
              >
                <div className="w-[28px] h-[28px] rounded-md flex items-center justify-center flex-shrink-0 bg-bg-card border border-border text-text-muted group-hover:text-accent transition-colors">
                  {note.icon}
                </div>
                <span className="flex-1 text-[12px] font-medium text-text-primary text-left">{note.label}</span>
                <span className="text-[11px] text-text-muted flex-shrink-0">{note.count > 0 ? note.count : ''}</span>
                <ChevronRight size={13} className="text-text-muted/50 flex-shrink-0 group-hover:text-text-muted transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* ── View all ──────────────────────────────── */}
        <button className="w-full text-[11px] text-accent hover:text-accent-hover font-medium text-center py-1.5 cursor-pointer transition-colors">
          View all notes &amp; outputs →
        </button>

      </div>
    </aside>
  );
}
