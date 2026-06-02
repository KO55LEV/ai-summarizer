import {
  LayoutDashboard,
  Sparkles,
  FileText,
  Lightbulb,
  Download,
  Clock,
  Settings,
  Play,
  Newspaper,
} from 'lucide-react';
import type { NavItem, VideoRecord } from '../types';

const navItems: { key: NavItem; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'summarizer', label: 'Summarizer', icon: <Sparkles size={18} /> },
  { key: 'transcript', label: 'Transcript', icon: <FileText size={18} /> },
  { key: 'insights', label: 'Insights', icon: <Lightbulb size={18} /> },
  { key: 'exports', label: 'Exports', icon: <Download size={18} /> },
  { key: 'history', label: 'History', icon: <Clock size={18} /> },
  { key: 'research', label: 'Research', icon: <Newspaper size={18} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

interface LeftSidebarProps {
  activeNav: NavItem;
  onNavChange: (nav: NavItem) => void;
  onViewAll: () => void;
  onVideoSelect: (idx: number) => void;
  recentVideos: VideoRecord[];
}

export default function LeftSidebar({ activeNav, onNavChange, onViewAll, onVideoSelect, recentVideos }: LeftSidebarProps) {
  return (
    <aside className="w-[230px] flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 bg-youtube rounded-xl flex items-center justify-center flex-shrink-0">
          <Play size={16} fill="white" className="text-white" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-text-primary leading-tight">YouTube Summarizer</div>
          <div className="text-[11px] text-text-muted leading-tight mt-0.5">Research from any video</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavChange(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
              activeNav === item.key
                ? 'bg-accent text-bg-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Recent Videos */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted font-medium">Recent videos</span>
          <button onClick={onViewAll} className="text-xs text-accent hover:text-accent-hover cursor-pointer font-medium">View all</button>
        </div>
        {recentVideos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-[11px] text-text-muted">
            No recent videos yet.
          </div>
        ) : (
          <div className="space-y-1">
            {recentVideos.map((video, i) => (
              <div
                key={`${video.url}-${i}`}
                onClick={() => onVideoSelect(i)}
                className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-bg-card cursor-pointer transition-colors"
              >
                <div className="w-5 h-5 rounded bg-youtube/20 flex items-center justify-center flex-shrink-0">
                  <Play size={9} className="text-youtube" fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-text-primary truncate leading-tight">{video.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-text-muted leading-tight">{video.age}</span>
                    <span className="text-[10px] font-medium px-1 py-0 rounded bg-bg-input text-text-muted truncate max-w-[96px]">
                      {video.source}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User / Pro Badge */}
      <div className="border-t border-border px-4 py-3.5">
        <button
          onClick={() => onNavChange('profile')}
          className="w-full flex items-center gap-2.5 hover:bg-bg-card rounded-lg p-1.5 -mx-1.5 transition-colors cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center text-xs font-bold text-bg-primary flex-shrink-0">
            RS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-text-primary font-medium flex items-center gap-2">
              Researcher Pro
              <span className="text-[9px] bg-pro-badge/20 text-pro-badge px-1.5 py-0.5 rounded font-bold tracking-wide">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-text-muted">Plan renews Jun 12, 2026</div>
          </div>
        </button>
        <div className="mt-2.5">
          <div className="text-[11px] text-text-muted mb-1">42 / 500 videos this month</div>
          <div className="w-full h-1 bg-bg-card rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: '8.4%' }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
