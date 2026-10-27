import { Button } from '@/components/ui/button';
import { ViewKey } from '@/types';
import { LayoutDashboard, Calendar, Bot, FileText, Mic, Settings, BookOpen, Menu, X, PenTool, ClipboardCheck } from 'lucide-react';
import { useApp } from '@/store';
import { PomodoroTimer } from '@/components/PomodoroTimer';

const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'schedule', label: 'Smart Schedule', icon: Calendar },
  { key: 'tutor', label: 'AI Whiteboard', icon: PenTool },
  { key: 'studio', label: 'Presentation Studio', icon: FileText },
  { key: 'exams', label: 'PYQ Exam Arena', icon: ClipboardCheck },
  { key: 'transcriber', label: 'Lecture Transcriber', icon: Mic },
  { key: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  current: ViewKey;
  onNavigate: (v: ViewKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const { settings } = useApp();

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center shadow-lg">
          <BookOpen className="text-study-white" size={22} />
        </div>
        <div>
          <h1 className="font-bold text-text text-lg leading-none">StudySmart</h1>
          <p className="text-xs text-text-dim mt-0.5">Student OS</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <Button variant="source"
              key={item.key}
              onClick={() => { onNavigate(item.key); onCloseMobile(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                active
                  ? 'bg-accent-600 text-study-white shadow-md'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              }`}
            >
              <Icon size={19} className={active ? 'text-study-white' : ''} />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs text-text-dim">
            {settings.userName ? `Hi, ${settings.userName}` : 'Welcome back'}
          </span>
        </div>
        <div className="text-[10px] text-text-dim px-3 leading-relaxed">
          AI study companion. Not a substitute for your own work.
        </div>
        <div className="flex gap-3 px-3 text-[11px] text-text-muted"><a href="/privacy" className="underline">Privacy</a><a href="/terms" className="underline">Terms</a></div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 glass border-r border-border h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-study-black/60 backdrop-blur-sm animate-fadeIn" aria-label="Close menu" onClick={onCloseMobile} />
          <aside className="relative w-72 glass h-full animate-slideIn shadow-2xl">
            <Button variant="source"
              aria-label="Close menu" onClick={onCloseMobile}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-surface-hover text-text-muted"
            >
              <X size={20} />
            </Button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

interface TopBarProps {
  view: ViewKey;
  onMenuClick: () => void;
}

export function TopBar({ view, onMenuClick }: TopBarProps) {
  const label = NAV_ITEMS.find((n) => n.key === view)?.label ?? '';
  return (
    <header className="sticky top-0 z-20 glass border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="source"
          aria-label="Open menu" onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-surface-hover text-text-muted"
        >
          <Menu size={22} />
        </Button>
        <h2 className="text-base lg:text-lg font-semibold text-text">{label}</h2>
      </div>
      <PomodoroTimer />
    </header>
  );
}
