import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff, FolderPlus, Mail, Search, SquareCheckBig, User, Sparkles, Youtube } from 'lucide-react';

interface LoginPageProps {
  mode?: 'login' | 'signup';
  onSubmit: (input: {
    mode: 'login' | 'signup';
    email: string;
    password: string;
    displayName: string;
    confirmPassword: string;
    agree: boolean;
  }) => Promise<void>;
  onSwitchMode: () => void;
  onHome: () => void;
}

function BrandMark({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" onClick={onHome} className="flex items-center gap-3 text-left cursor-pointer">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0f1d34] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_36px_rgba(0,0,0,0.18)]">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#ff1f1f] text-white">
          <Youtube size={15} fill="currentColor" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary">AI Summarizer</span>
      </div>
    </button>
  );
}

function FeatureRow({
  icon,
  title,
  description,
  tone = 'teal',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: 'teal' | 'violet' | 'red' | 'amber';
}) {
  const toneClass =
    tone === 'violet'
      ? 'border-violet-500/15 bg-violet-500/10 text-violet-300'
      : tone === 'red'
        ? 'border-red-500/15 bg-red-500/10 text-red-300'
        : tone === 'amber'
          ? 'border-amber-500/15 bg-amber-500/10 text-amber-300'
          : 'border-accent/15 bg-accent/10 text-accent';

  return (
    <div className="flex gap-4">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-[15px] font-semibold text-text-primary">{title}</div>
        <p className="mt-1 max-w-[28rem] text-[13px] leading-6 text-text-secondary">{description}</p>
      </div>
    </div>
  );
}

function ProjectPreviewTile({ title, count, tone }: { title: string; count: string; tone: 'teal' | 'violet' | 'red' | 'amber' }) {
  const dotClass =
    tone === 'violet'
      ? 'bg-violet-400'
      : tone === 'red'
        ? 'bg-red-400'
        : tone === 'amber'
          ? 'bg-amber-400'
          : 'bg-accent';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full ${dotClass}`} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-text-primary">{title}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">{count}</div>
        </div>
      </div>
    </div>
  );
}

function ProjectPreview() {
  return (
    <div className="rounded-[26px] border border-accent/30 bg-[linear-gradient(180deg,rgba(7,18,36,0.92),rgba(7,13,25,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
      <div className="rounded-[22px] border border-white/10 bg-[rgba(10,17,32,0.82)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold text-text-primary">
            <Sparkles size={15} className="text-accent" />
            AI Research Hub
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-text-secondary">
            All projects
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <ProjectPreviewTile title="Projects" count="12" tone="teal" />
          <ProjectPreviewTile title="Research items" count="86" tone="violet" />
          <ProjectPreviewTile title="YouTube summaries" count="47" tone="red" />
          <ProjectPreviewTile title="Notes" count="124" tone="amber" />
        </div>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-bg-primary/50 p-3">
          <div className="text-[12px] font-semibold text-text-primary">Recent projects</div>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-text-primary">AI Research Hub</div>
                <div className="text-[11px] text-text-muted">Updated 2h ago</div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-text-primary">Content Strategy Q2</div>
                <div className="text-[11px] text-text-muted">Updated 5h ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export default function LoginPage({ mode = 'login', onSubmit, onSwitchMode, onHome }: LoginPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isSignup) {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }

      if (password.trim().length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      if (!agree) {
        setError('Please accept the terms to continue.');
        return;
      }
    }

    setSubmitting(true);

    try {
      await onSubmit({
        mode: isSignup ? 'signup' : 'login',
        email,
        password,
        displayName: fullName,
        confirmPassword,
        agree,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.16),transparent_24%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#070d18_0%,#081122_58%,#050b14_100%)] text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 rounded-[28px] border border-white/10 bg-[rgba(6,11,22,0.86)] px-5 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <BrandMark onHome={onHome} />
            <div className="flex items-center gap-2 text-[14px]">
              <span className="text-text-secondary">{isSignup ? 'Already have an account?' : 'New here?'}</span>
              <button
                type="button"
                onClick={onSwitchMode}
                className="font-medium text-accent transition-colors hover:text-accent-hover"
              >
                {isSignup ? 'Log in' : 'Create account'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(7,13,25,0.86)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="absolute inset-0 opacity-80">
              <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
              <div className="absolute bottom-[-8%] left-[15%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            </div>

            <div className="relative z-10 flex h-full flex-col gap-8">
              <div className="max-w-2xl">
                <h1 className="max-w-xl text-[42px] font-semibold leading-[1.05] tracking-[-0.04em] text-text-primary sm:text-[56px]">
                  {isSignup ? 'Start organizing research in projects' : 'Welcome back to your research workspace'}
                </h1>
                <p className="mt-5 max-w-xl text-[17px] leading-8 text-text-secondary">
                  {isSignup
                    ? 'Bring your research, notes, transcripts, and YouTube summaries together in one place. Stay focused, organized, and make progress faster.'
                    : 'Sign in to access your projects, notes, transcripts, and AI tools, all in one intelligent hub.'}
                </p>
              </div>

              <div className="grid gap-5 lg:max-w-2xl">
                <FeatureRow
                  icon={<FolderPlus size={22} />}
                  title="Projects"
                  description="Keep all your work organized in projects built for deep focus and clarity."
                  tone="teal"
                />
                <FeatureRow
                  icon={<Search size={22} />}
                  title="Research"
                  description="Save links, PDFs, and sources. Take notes and find insights when you need them."
                  tone="violet"
                />
                <FeatureRow
                  icon={<Youtube size={22} />}
                  title="YouTube Summaries"
                  description="Summarize videos and capture key takeaways instantly with AI."
                  tone="red"
                />
                <FeatureRow
                  icon={<SquareCheckBig size={22} />}
                  title="Notes / Tasks"
                  description="Write, capture, and connect ideas. Turn insights into action."
                  tone="amber"
                />
              </div>

              <div className="max-w-2xl">
                <ProjectPreview />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[rgba(7,13,25,0.9)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-6 lg:p-8">
            <div className="mx-auto flex h-full max-w-[540px] flex-col justify-start gap-6">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/18 bg-accent/10 text-accent">
                  <User size={22} />
                </div>
                <div>
                  <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-text-primary">
                    {isSignup ? 'Create your account' : 'Log in'}
                  </h2>
                  <p className="mt-2 text-[16px] leading-7 text-text-secondary">
                    {isSignup ? 'Get started for free. No credit card required.' : 'Welcome back! Please log in to continue.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-4 py-4 text-[16px] font-medium text-[#111827] transition-colors hover:bg-white"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4285F4]">
                  G
                </div>
                {isSignup ? 'Continue with Google' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-4 text-[14px] text-text-muted">
                <div className="h-px flex-1 bg-white/10" />
                <span>{isSignup ? 'or sign up with email' : 'or log in with email'}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[14px] text-red-200">
                  {error}
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                {isSignup && (
                  <AuthField label="Full name">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 transition-colors focus-within:border-accent/50 focus-within:bg-white/10">
                      <User size={18} className="shrink-0 text-text-muted" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Enter your full name"
                        className="auth-input w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
                      />
                    </div>
                  </AuthField>
                )}

                <AuthField label="Email">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 transition-colors focus-within:border-accent/50 focus-within:bg-white/10">
                    <Mail size={18} className="shrink-0 text-text-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@domain.com"
                      className="auth-input w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
                    />
                  </div>
                </AuthField>

                <AuthField label="Password">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 transition-colors focus-within:border-accent/50 focus-within:bg-white/10">
                    <span className="shrink-0 text-text-muted">🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={isSignup ? 'Create a strong password' : 'Enter your password'}
                      className="auth-input w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isSignup && <div className="mt-2 text-[12px] text-accent">At least 8 characters</div>}
                </AuthField>

                {isSignup && (
                  <AuthField label="Confirm password">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 transition-colors focus-within:border-accent/50 focus-within:bg-white/10">
                      <span className="shrink-0 text-text-muted">🔒</span>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirm your password"
                        className="auth-input w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </AuthField>
                )}

                {isSignup && (
                  <label className="flex items-start gap-3 text-[14px] text-text-secondary">
                    <button
                      type="button"
                      onClick={() => setAgree((current) => !current)}
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-[6px] border transition-colors ${
                        agree ? 'border-accent bg-accent text-bg-primary' : 'border-white/15 bg-white/5 text-transparent'
                      }`}
                      aria-label="Agree to terms"
                    >
                      ✓
                    </button>
                    <span>
                      I agree to the <span className="text-accent">Terms of Service</span> and{' '}
                      <span className="text-accent">Privacy Policy</span>.
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#18ddc4_0%,#21e7cf_100%)] px-5 py-4 text-[16px] font-semibold text-bg-primary shadow-[0_18px_50px_rgba(0,212,170,0.24)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Please wait...' : isSignup ? 'Create free account' : 'Log in'}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>

              {isSignup && (
                <div className="flex items-center justify-center gap-2 text-[14px] text-text-muted">
                  <span className="text-accent">🛡</span>
                  No credit card required
                </div>
              )}

              <div className="border-t border-white/10 pt-5 text-center text-[14px] text-text-secondary">
                {isSignup ? 'Already have an account?' : 'New here?'}
                <button
                  type="button"
                  onClick={onSwitchMode}
                  className="ml-2 font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  {isSignup ? 'Log in' : 'Create account'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
