import {
  Settings,
  User,
  Bell,
  Shield,
  Globe,
  CreditCard,
  Trash2,
  ChevronRight,
  Check,
  Moon,
  Keyboard,
} from 'lucide-react';
import { useState } from 'react';

type Section = 'account' | 'notifications' | 'language' | 'privacy' | 'billing' | 'shortcuts';

const SECTIONS = [
  { key: 'account' as Section, label: 'Account', icon: <User size={15} /> },
  { key: 'notifications' as Section, label: 'Notifications', icon: <Bell size={15} /> },
  { key: 'language' as Section, label: 'Language & region', icon: <Globe size={15} /> },
  { key: 'privacy' as Section, label: 'Privacy & data', icon: <Shield size={15} /> },
  { key: 'billing' as Section, label: 'Billing & plan', icon: <CreditCard size={15} /> },
  { key: 'shortcuts' as Section, label: 'Keyboard shortcuts', icon: <Keyboard size={15} /> },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-accent' : 'bg-bg-input border border-border'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
      <div>
        <div className="text-[13px] text-text-primary font-medium">{label}</div>
        {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('account');
  const [notifs, setNotifs] = useState({ email: true, browser: false, weekly: true });
  const [privacy, setPrivacy] = useState({ analytics: true, history: true });
  const [language, setLanguage] = useState('en');

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-8 py-8">

        <div className="mb-7">
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1">Settings</h1>
          <p className="text-text-secondary text-[13px]">Manage your account, preferences, and billing.</p>
        </div>

        <div className="flex gap-5">
          {/* Sidebar nav */}
          <div className="w-[180px] flex-shrink-0">
            <nav className="space-y-0.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors cursor-pointer text-left ${
                    active === s.key ? 'bg-bg-card border border-border text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                  }`}
                >
                  <span className={active === s.key ? 'text-accent' : 'text-text-muted'}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content panel */}
          <div className="flex-1 bg-bg-card border border-border rounded-xl px-6 py-5 min-h-[400px]">

            {active === 'account' && (
              <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-5">Account</h2>
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center text-xl font-bold text-bg-primary flex-shrink-0">
                    RS
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-text-primary mb-0.5">Researcher Pro</div>
                    <div className="text-[12px] text-text-muted mb-2">researcher.pro@example.com</div>
                    <button className="text-[11px] text-accent hover:text-accent-hover cursor-pointer font-medium">Change avatar</button>
                  </div>
                </div>
                <Row label="Display name" sub="Shown in your profile and exports">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-text-secondary">Researcher Pro</span>
                    <ChevronRight size={14} className="text-text-muted" />
                  </div>
                </Row>
                <Row label="Email address" sub="researcher.pro@example.com">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-accent bg-accent/10 px-2 py-0.5 rounded font-medium">Verified</span>
                    <ChevronRight size={14} className="text-text-muted" />
                  </div>
                </Row>
                <Row label="Password" sub="Last changed 3 months ago">
                  <ChevronRight size={14} className="text-text-muted cursor-pointer hover:text-text-secondary" />
                </Row>
                <Row label="Two-factor authentication" sub="Adds an extra layer of security">
                  <button className="text-[12px] font-medium text-text-secondary hover:text-text-primary border border-border px-3 py-1.5 rounded-lg cursor-pointer transition-colors">Enable</button>
                </Row>
                <div className="mt-4 pt-4 border-t border-border">
                  <button className="flex items-center gap-2 text-[12px] text-danger hover:text-red-400 cursor-pointer transition-colors font-medium">
                    <Trash2 size={13} />
                    Delete account
                  </button>
                </div>
              </div>
            )}

            {active === 'notifications' && (
              <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-5">Notifications</h2>
                <Row label="Email notifications" sub="Receive updates and analysis results by email">
                  <Toggle checked={notifs.email} onChange={(v) => setNotifs(n => ({ ...n, email: v }))} />
                </Row>
                <Row label="Browser notifications" sub="Get notified when analysis finishes">
                  <Toggle checked={notifs.browser} onChange={(v) => setNotifs(n => ({ ...n, browser: v }))} />
                </Row>
                <Row label="Weekly digest" sub="Summary of your activity every Monday">
                  <Toggle checked={notifs.weekly} onChange={(v) => setNotifs(n => ({ ...n, weekly: v }))} />
                </Row>
              </div>
            )}

            {active === 'language' && (
              <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-5">Language & region</h2>
                <div className="mb-4">
                  <div className="text-[12px] text-text-muted mb-2 font-medium">Interface language</div>
                  <div className="space-y-1.5">
                    {[{ code: 'en', label: 'English' }, { code: 'ru', label: 'Русский' }, { code: 'de', label: 'Deutsch' }].map((l) => (
                      <button
                        key={l.code}
                        onClick={() => setLanguage(l.code)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${language === l.code ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-input'}`}
                      >
                        <span className="text-[13px] text-text-primary">{l.label}</span>
                        {language === l.code && <Check size={14} className="text-accent" />}
                      </button>
                    ))}
                  </div>
                </div>
                <Row label="Transcript default language" sub="Used when auto-detect is off">
                  <div className="flex items-center gap-2 text-[12px] text-text-secondary cursor-pointer hover:text-text-primary">
                    Auto-detect <ChevronRight size={13} />
                  </div>
                </Row>
              </div>
            )}

            {active === 'privacy' && (
              <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-5">Privacy & data</h2>
                <Row label="Usage analytics" sub="Help us improve with anonymous usage data">
                  <Toggle checked={privacy.analytics} onChange={(v) => setPrivacy(p => ({ ...p, analytics: v }))} />
                </Row>
                <Row label="Save watch history" sub="Keep a record of analyzed videos">
                  <Toggle checked={privacy.history} onChange={(v) => setPrivacy(p => ({ ...p, history: v }))} />
                </Row>
                <Row label="Audio file retention" sub="Temporary audio files are auto-deleted after processing">
                  <span className="text-[11px] text-accent font-medium">Auto-deleted ✓</span>
                </Row>
                <div className="mt-4 pt-4 border-t border-border">
                  <button className="text-[12px] text-danger hover:text-red-400 cursor-pointer transition-colors font-medium">
                    Clear all history and data
                  </button>
                </div>
              </div>
            )}

            {active === 'billing' && (
              <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-5">Billing & plan</h2>
                <div className="bg-gradient-to-r from-accent/8 to-transparent border border-accent/30 rounded-xl p-4 mb-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-bold text-text-primary">Researcher Pro</span>
                      <span className="text-[9px] bg-pro-badge/20 text-pro-badge px-1.5 py-0.5 rounded font-bold tracking-wide">PRO</span>
                    </div>
                    <div className="text-[11px] text-text-muted">Renews Jun 12, 2026 · $19/month</div>
                  </div>
                  <button className="text-[12px] text-text-secondary hover:text-text-primary border border-border px-3 py-1.5 rounded-lg cursor-pointer transition-colors">Manage</button>
                </div>
                <Row label="Videos analyzed" sub="This billing period"><span className="text-[13px] font-bold text-text-primary">42 / 500</span></Row>
                <Row label="Next billing date" sub="Auto-renews unless cancelled"><span className="text-[12px] text-text-secondary">Jun 12, 2026</span></Row>
                <Row label="Payment method" sub="Visa ending in 4242"><ChevronRight size={14} className="text-text-muted cursor-pointer" /></Row>
                <div className="mt-4 pt-4 border-t border-border">
                  <button className="text-[12px] text-danger hover:text-red-400 cursor-pointer transition-colors font-medium">Cancel subscription</button>
                </div>
              </div>
            )}

            {active === 'shortcuts' && (
              <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-5">Keyboard shortcuts</h2>
                <div className="space-y-0">
                  {[
                    { action: 'Open Summarizer', keys: ['⌘', 'K'] },
                    { action: 'Paste & analyze', keys: ['⌘', 'V', '↵'] },
                    { action: 'Copy transcript', keys: ['⌘', 'Shift', 'C'] },
                    { action: 'Export', keys: ['⌘', 'E'] },
                    { action: 'Go to History', keys: ['⌘', 'H'] },
                    { action: 'Toggle auto-scroll', keys: ['⌘', 'Shift', 'S'] },
                    { action: 'Search transcript', keys: ['⌘', 'F'] },
                  ].map((s) => (
                    <div key={s.action} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <span className="text-[13px] text-text-primary">{s.action}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <kbd key={i} className="bg-bg-input border border-border text-text-secondary text-[11px] font-mono px-1.5 py-0.5 rounded min-w-[24px] text-center">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
