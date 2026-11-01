import { Button } from '@/components/ui/button';
import { ViewKey } from '@/types';
import { LayoutDashboard, Calendar, Bot, FileText, Mic, Settings, Menu, X, PenTool, ClipboardCheck, LogOut, BrainCircuit, Layers3 } from 'lucide-react';
import { useApp } from '@/store';
import { supabase } from '@/integrations/supabase/client';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { trackEvent } from '@/lib/analytics';

const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'schedule', label: 'Smart Schedule', icon: Calendar },
  { key: 'planner', label: 'Adaptive Planner', icon: BrainCircuit },
  { key: 'flashcards', label: 'Spaced Repetition', icon: Layers3 },
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
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile, collapsed, onToggleCollapse }: SidebarProps) {
  const compact = collapsed && !mobileOpen;
  const { settings } = useApp();

  const content = (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-3 py-5 border-b border-border ${compact ? 'justify-center px-2' : 'px-4'}`}>
        <img src="/favicon.jpg" alt="" aria-hidden="true" className="w-10 h-10 rounded-xl object-cover shrink-0" />
        {!compact && <span className="font-bold text-lg text-text whitespace-nowrap">StudySmartly</span>}
      </div>

      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${compact ? 'px-2' : 'px-3'}`}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <Button variant="source"
              key={item.key}
              onClick={() => {
                // Navigate immediately; analytics must never make the UI wait for auth.
                onNavigate(item.key);
                onCloseMobile();

                const featureNames: Record<ViewKey, string> = {
                  dashboard: 'Dashboard',
                  schedule: 'Smart_Schedule',
                  planner: 'Adaptive_Planner',
                  flashcards: 'Spaced_Repetition',
                  tutor: 'AI_Whiteboard',
                  studio: 'Presentation_Studio',
                  exams: 'PYQ_Exam_Arena',
                  transcriber: 'Lecture_Transcriber',
                  settings: 'Settings',
                };
                void supabase.auth.getSession()
                  .then(({ data, error }) => {
                    if (error) console.warn('[ANALYTICS] Account lookup returned an error:', error);
                    trackEvent('feature_usage', {
                      account_id: data.session?.user?.id ?? null,
                      student_segment: 'high_school_student',
                      feature_name: featureNames[item.key],
                    });
                  })
                  .catch((error) => {
                    console.warn('[ANALYTICS] Could not retrieve the signed-in account:', error);
                    trackEvent('feature_usage', {
                      account_id: null,
                      student_segment: 'high_school_student',
                      feature_name: featureNames[item.key],
                    });
                  });
              }}
              title={compact ? item.label : undefined}
              aria-label={item.label}
              className={`w-full flex items-center ${compact ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                active
                  ? 'bg-accent-600 text-study-white shadow-md'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              }`}
            >
              <Icon size={19} className={active ? 'text-study-white' : ''} />
              {!compact && item.label}
            </Button>
          );
        })}
      </nav>

      <div className={`py-4 border-t border-border space-y-2 ${compact ? 'px-2' : 'px-3'}`}>
        {!compact && <div className="flex items-center justify-between px-3">
          <span className="text-xs text-text-dim">
            {settings.userName ? `Hi, ${settings.userName}` : 'Welcome back'}
          </span>
        </div>}
        <Button
          variant="source"
          onClick={() => supabase.auth.signOut()}
          title={compact ? 'Sign Out' : undefined}
          aria-label="Sign Out"
          className={`w-full flex items-center ${compact ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-xl text-sm text-text-muted hover:bg-surface-hover hover:text-text`}
        >
          <LogOut size={17} />
          {!compact && 'Sign Out'}
        </Button>
        {!compact && <>
          <div className="text-[10px] text-text-dim px-3 leading-relaxed">
            AI study companion. Not a substitute for your own work.
          </div>
          <div className="flex gap-3 px-3 text-[11px] text-text-muted"><a href="/privacy" className="underline">Privacy</a><a href="/terms" className="underline">Terms</a></div>
        </>}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className={`hidden lg:flex shrink-0 glass border-r border-border h-screen sticky top-0 sidebar-shell ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        <div className="flex flex-col w-full min-w-0">
          <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} px-2 pt-2`}>
            <Button variant="source" size="icon" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse}>
              <Menu size={19} />
            </Button>
          </div>
          <div className="min-h-0 flex-1">{content}</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-study-black/60 backdrop-blur-sm animate-fadeIn" aria-label="Close menu" onClick={onCloseMobile} />
          <aside className="relative w-[min(18rem,88vw)] max-w-full glass h-full animate-slideIn shadow-2xl">
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
          className="p-2 rounded-lg hover:bg-surface-hover text-text-muted"
        >
          <Menu size={22} />
        </Button>
        <h2 className="text-base lg:text-lg font-semibold text-text">{label}</h2>
      </div>
      <PomodoroTimer />
    </header>
  );
}
