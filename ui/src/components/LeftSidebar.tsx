import {
  LayoutDashboard,
  Sparkles,
  Newspaper,
  Shield,
  FolderKanban,
  ListTodo,
  StickyNote,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavItem } from '../types';

type NavEntry = {
  key: NavItem;
  label: string;
  icon: ReactNode;
  helper?: string;
};

interface LeftSidebarProps {
  activeNav: NavItem;
  onNavChange: (nav: NavItem) => void;
  onOpenAdmin?: () => void;
  onLogout: () => void;
  onHome: () => void;
  isAdmin: boolean;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

function deriveFallbackInitials(userName?: string, userEmail?: string): string {
  const source = (userName?.trim() || userEmail?.trim() || 'AI').toUpperCase();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }

  return source.slice(0, 2);
}

export default function LeftSidebar({
  activeNav,
  onNavChange,
  onOpenAdmin,
  onLogout,
  onHome,
  isAdmin,
  userName,
  userEmail,
  userInitials,
}: LeftSidebarProps) {
  const displayName = userName?.trim() || 'Researcher Pro';
  const displayEmail = userEmail?.trim() || 'researcher.pro@example.com';
  const initials = (userInitials?.trim() || deriveFallbackInitials(userName, userEmail)).slice(0, 2);
  const navEntries: NavEntry[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    {
      key: 'projects',
      label: 'Projects',
      icon: <FolderKanban size={18} />,
      helper: 'Shared workspaces',
    },
    { key: 'summarizer', label: 'Summarizer', icon: <Sparkles size={18} /> },
    {
      key: 'research',
      label: 'Research',
      icon: <Newspaper size={18} />,
      helper: 'Briefings and topics',
    },
    {
      key: 'todo',
      label: 'To-do',
      icon: <ListTodo size={18} />,
      helper: 'Daily and project tasks',
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: <StickyNote size={18} />,
      helper: 'Inbox and drafts',
    },
  ];

  return (
    <aside className="w-[250px] flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onHome}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(0,212,170,0.08),rgba(19,28,48,0.92))] px-4 py-4 text-left shadow-[0_0_0_1px_rgba(0,212,170,0.05)]"
        >
          <img src="/favicon.svg" alt="" className="h-10 w-10 flex-shrink-0 rounded-xl shadow-lg shadow-black/20" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-text-primary leading-tight">Ai Summarizer</div>
            <div className="text-[11px] text-text-muted leading-tight mt-0.5">Research, notes, and project workspaces</div>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 pb-3 space-y-4 overflow-y-auto">
        <div className="space-y-1">
          {navEntries.map((item) => {
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavChange(item.key)}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-all cursor-pointer ${
                  active
                    ? 'border-accent/30 bg-accent/10 text-text-primary shadow-[0_0_0_1px_rgba(0,212,170,0.12)]'
                    : 'border-transparent text-text-secondary hover:border-border hover:bg-bg-card hover:text-text-primary'
                }`}
              >
                <span className={active ? 'text-accent' : 'text-text-muted'}>{item.icon}</span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className={`block truncate ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                    {item.helper && (
                      <span className="mt-0.5 block text-[10px] leading-tight text-text-muted">{item.helper}</span>
                    )}
                  </span>
                  {active && <ChevronRight size={14} className="text-accent flex-shrink-0" />}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User / Pro Badge */}
      <div className="border-t border-border px-4 py-3.5">
        <button
          onClick={() => onNavChange('profile')}
          className="w-full rounded-2xl border border-accent/70 bg-[linear-gradient(180deg,rgba(9,17,31,0.98),rgba(11,17,32,0.96))] p-3 text-left shadow-[0_0_0_1px_rgba(80,220,255,0.08)] transition-colors hover:border-accent/90 hover:bg-[linear-gradient(180deg,rgba(12,22,39,0.99),rgba(11,17,32,0.98))]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#25d6e6] text-[15px] font-semibold text-bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-[14px] font-semibold text-text-primary">{displayName}</div>
                <span className="rounded-md bg-pro-badge/20 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-pro-badge">
                  PRO
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-text-muted">{displayEmail}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-text-muted">Plan renews Jun 12, 2026</div>
        </button>
        <div className="mt-2.5">
          <div className="text-[11px] text-text-muted mb-1">42 / 500 videos this month</div>
          <div className="w-full h-1 bg-bg-card rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: '8.4%' }} />
          </div>
        </div>
        {isAdmin && onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-bg-input px-3 py-2.5 text-[12px] text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
          >
            <span className="flex items-center gap-2">
              <Shield size={14} className="text-accent" />
              Admin
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Open</span>
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-border bg-bg-input px-3 py-2.5 text-[12px] text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
        >
          <span className="flex items-center gap-2">
            <LogOut size={14} className="text-accent" />
            Logout
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">End session</span>
        </button>
      </div>
    </aside>
  );
}
