import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Sidebar, TopBar } from '@/components/Sidebar';
import type { ViewKey } from '@/types';

export function StudyLayout({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const section = pathname.split('/')[1];
  const view: ViewKey = section === 'schedule' || section === 'planner' || section === 'tutor' || section === 'studio' || section === 'exams' || section === 'transcriber' || section === 'settings' ? section : 'dashboard';
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar current={view} onNavigate={(next) => navigate({ to: next === 'dashboard' ? '/' : `/${next}` })} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar view={view} onMenuClick={() => {
          if (window.matchMedia('(min-width: 1024px)').matches) setSidebarCollapsed((value) => !value);
          else setMobileOpen(true);
        }} />
        <main key={pathname} className="study-content route-transition mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}