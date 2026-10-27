import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Sidebar, TopBar } from '@/components/Sidebar';
import type { ViewKey } from '@/types';

export function StudyLayout({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const section = pathname.split('/')[1];
  const view: ViewKey = section === 'schedule' || section === 'tutor' || section === 'studio' || section === 'exams' || section === 'transcriber' || section === 'settings' ? section : 'dashboard';
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar current={view} onNavigate={(next) => navigate({ to: next === 'dashboard' ? '/' : `/${next}` })} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar view={view} onMenuClick={() => setMobileOpen(true)} />
        <main className="study-content mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}