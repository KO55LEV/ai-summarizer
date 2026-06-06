import { ArrowRight, CheckCircle2, FolderKanban, Play, Sparkles, StickyNote, UploadCloud } from 'lucide-react';
import type { ReactNode } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogIn: () => void;
  onHome: () => void;
}

function BrandMark({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" onClick={onHome} className="flex items-center gap-3 text-left cursor-pointer">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(35,224,207,0.18)_0%,rgba(11,184,166,0.06)_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_36px_rgba(11,184,166,0.18)]">
        <img src="/favicon.svg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="text-[19px] font-semibold tracking-[-0.02em] text-text-primary">AI Summarizer</div>
    </button>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 rounded-[26px] border border-white/10 bg-[rgba(8,15,28,0.88)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-accent/18 bg-accent/10 text-accent">
        {icon}
      </div>
      <div>
        <div className="text-[17px] font-semibold text-text-primary">{title}</div>
        <p className="mt-2 max-w-sm text-[14px] leading-7 text-text-secondary">{description}</p>
      </div>
    </div>
  );
}

function ProjectTile({ title, meta, tone }: { title: string; meta: string; tone: 'teal' | 'blue' | 'violet' }) {
  const toneClass =
    tone === 'blue'
      ? 'from-blue-400/20 to-cyan-400/5 text-blue-300'
      : tone === 'violet'
        ? 'from-violet-400/20 to-fuchsia-400/5 text-violet-300'
        : 'from-teal-400/20 to-emerald-400/5 text-accent';

  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${toneClass} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[13px] font-semibold">✦</div>
        <span className="text-[11px] text-text-muted">•••</span>
      </div>
      <div className="mt-5 text-[14px] font-semibold text-text-primary">{title}</div>
      <div className="mt-1 text-[12px] text-text-muted">{meta}</div>
      <div className="mt-4 h-1.5 rounded-full bg-white/5">
        <div className="h-full w-[62%] rounded-full bg-accent/70" />
      </div>
    </div>
  );
}

export default function LandingPage({ onGetStarted, onLogIn, onHome }: LandingPageProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.14),transparent_26%),radial-gradient(circle_at_80%_12%,rgba(59,130,246,0.10),transparent_26%),linear-gradient(180deg,#07111f_0%,#06101d_50%,#050a14_100%)] text-text-primary">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-white/10 bg-[rgba(7,13,25,0.86)] px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <BrandMark onHome={onHome} />

            <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[14px] text-text-secondary">
              {['Features', 'How it works', 'Use cases', 'Pricing', 'Blog'].map((item) => (
                <a key={item} href="#top" className="transition-colors hover:text-text-primary">
                  {item}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-4 text-[14px]">
              <button
                type="button"
                onClick={onLogIn}
                className="font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#18ddc4_0%,#21e7cf_100%)] px-5 py-3 font-semibold text-bg-primary shadow-[0_18px_40px_rgba(0,212,170,0.18)] transition-transform hover:-translate-y-0.5"
              >
                Get started
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-10 py-10 lg:grid-cols-[0.94fr_1.06fr] lg:items-center lg:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-[13px] font-medium text-accent">
              <Sparkles size={15} />
              AI-Powered Workspace
            </div>

            <h1 className="mt-8 max-w-xl text-[58px] font-semibold leading-[1.02] tracking-[-0.05em] text-text-primary sm:text-[76px]">
              <span className="text-accent">Summarize</span> anything.
              <br />
              Organize everything.
            </h1>

            <p className="mt-8 max-w-xl text-[19px] leading-8 text-text-secondary">
              Your all-in-one AI workspace for research, notes, and productivity. Summarize videos, articles, and docs. Keep everything organized in one place.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#18ddc4_0%,#21e7cf_100%)] px-7 py-4 text-[17px] font-semibold text-bg-primary shadow-[0_18px_50px_rgba(0,212,170,0.22)] transition-transform hover:-translate-y-0.5"
              >
                Get started for free
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                onClick={onLogIn}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-7 py-4 text-[17px] font-medium text-text-primary transition-colors hover:bg-white/10"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20">
                  <Play size={12} fill="currentColor" />
                </span>
                See how it works
              </button>
            </div>

            <div className="mt-10 flex items-center gap-4 text-[15px] text-text-secondary">
              <div className="flex -space-x-2">
                {['AR', 'JM', 'SK', 'MK'].map((label) => (
                  <div
                    key={label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-bg-primary bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-semibold text-bg-primary"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={index}>★</span>
                ))}
              </div>
              <span>4.9 from 1,200+ users</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[30px] border border-accent/30 bg-[rgba(8,15,28,0.88)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="grid min-h-[620px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(10,17,32,0.86)]">
                <aside className="border-r border-white/8 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-accent/10 text-accent">
                      <img src="/favicon.svg" alt="" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-text-primary">AI Summarizer</div>
                      <div className="text-[11px] text-text-muted">Workspace</div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-1">
                    {[
                      { label: 'Dashboard', active: false },
                      { label: 'Projects', active: true },
                      { label: 'Research', active: false },
                      { label: 'Notes', active: false },
                      { label: 'To-do', active: false },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] ${
                          item.active ? 'bg-accent/10 text-accent' : 'text-text-secondary'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {item.label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] text-text-muted">Researcher Pro</div>
                    <div className="mt-1 text-[13px] font-semibold text-text-primary">Premium</div>
                  </div>
                </aside>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[24px] font-semibold text-text-primary">Projects</h2>
                      <p className="mt-1 text-[13px] text-text-secondary">All your research, notes, and summaries in one place.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-text-muted">
                        Search projects...
                      </div>
                      <button className="rounded-2xl bg-accent px-4 py-3 text-[13px] font-semibold text-bg-primary">+ New project</button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <ProjectTile title="AI in Education" meta="12 notes · 5 summaries" tone="teal" />
                    <ProjectTile title="Market Research" meta="8 notes · 3 summaries" tone="blue" />
                    <ProjectTile title="Content Strategy" meta="15 notes · 7 summaries" tone="violet" />
                    <ProjectTile title="Productivity Guide" meta="9 notes · 4 summaries" tone="teal" />
                    <ProjectTile title="YouTube Research" meta="6 notes · 10 summaries" tone="blue" />
                    <ProjectTile title="Personal Notes" meta="4 notes" tone="violet" />
                  </div>

                  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                      <UploadCloud size={14} className="text-accent" />
                      YouTube Summarizer
                    </div>
                    <div className="mt-1 text-[12px] text-text-muted">Summarize any YouTube video in seconds.</div>
                    <div className="mt-4 flex items-center rounded-2xl border border-white/10 bg-bg-primary/60 px-4 py-4 text-[12px] text-text-muted">
                      Paste YouTube link here...
                      <span className="ml-auto text-accent">→</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 rounded-[30px] border border-white/10 bg-[rgba(8,15,28,0.86)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] lg:grid-cols-4 lg:p-6">
          <FeatureCard
            icon={<Sparkles size={24} />}
            title="AI Summaries"
            description="Summarize YouTube videos, articles, and documents in seconds."
          />
          <FeatureCard
            icon={<FolderKanban size={24} />}
            title="Organized Projects"
            description="Keep your research, notes, and summaries organized in projects."
          />
          <FeatureCard
            icon={<StickyNote size={24} />}
            title="Smart Notes"
            description="Take notes, capture ideas, and connect information effortlessly."
          />
          <FeatureCard
            icon={<CheckCircle2 size={24} />}
            title="To-do & Tasks"
            description="Turn insights into action with built-in task and to-do lists."
          />
        </section>

        <section className="py-12 text-center">
          <div className="text-[18px] text-text-secondary">Trusted by researchers, students, creators, and professionals worldwide</div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-[28px] font-semibold text-text-muted/50">
            <span>Google</span>
            <span>Microsoft</span>
            <span>Notion</span>
            <span>YouTube</span>
            <span>OpenAI</span>
          </div>
        </section>
      </div>
    </main>
  );
}
