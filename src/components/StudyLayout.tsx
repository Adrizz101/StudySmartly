import { useEffect, useState, type ReactNode } from 'react';
import { FocusModeContext } from '@/components/focus-mode-context';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Sidebar, TopBar } from '@/components/Sidebar';
import type { ViewKey } from '@/types';
import { AnimatedRoute } from '@/components/animated-route';
import StudyAcademy from '@/components/StudyAcademy';
import SpotlightTour from '@/components/SpotlightTour';

export function StudyLayout({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    const openAcademy = () => setAcademyOpen(true);
    const openMobileNavigation = () => setMobileOpen(true);
    const closeMobileNavigation = () => setMobileOpen(false);
    window.addEventListener('studysmartly:open-academy', openAcademy);
    window.addEventListener('studysmartly:open-mobile-nav', openMobileNavigation);
    window.addEventListener('studysmartly:close-mobile-nav', closeMobileNavigation);
    return () => {
      window.removeEventListener('studysmartly:open-academy', openAcademy);
      window.removeEventListener('studysmartly:open-mobile-nav', openMobileNavigation);
      window.removeEventListener('studysmartly:close-mobile-nav', closeMobileNavigation);
    };
  }, []);
  useEffect(() => {
    setFocusMode(false);
  }, [pathname]);

  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);

  useEffect(() => {
    if (focusMode) setMobileOpen(false);
  }, [focusMode]);

  const section = pathname.split('/')[1];
  const view: ViewKey = section === 'schedule' || section === 'planner' || section === 'flashcards' || section === 'tutor' || section === 'studio' || section === 'exams' || section === 'transcriber' || section === 'settings' ? section : 'dashboard';
  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode }}>
      <div className="flex min-h-screen bg-bg">
        {academyOpen && <StudyAcademy onClose={() => setAcademyOpen(false)} />}
        <SpotlightTour />
        <div className={focusMode ? 'hidden' : 'contents'}>
          <Sidebar current={view} onNavigate={(next) => navigate({ to: next === 'dashboard' ? '/' : `/${next}` })} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={focusMode ? 'hidden' : 'contents'}>
            <TopBar view={view} onMenuClick={() => {
              if (window.matchMedia('(min-width: 1024px)').matches) setSidebarCollapsed((value) => !value);
              else setMobileOpen(true);
            }} />
          </div>
          <main className={focusMode ? 'study-content study-content--focus mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6' : 'study-content mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6'}><AnimatedRoute>{children}</AnimatedRoute></main>
        </div>
      </div>
    </FocusModeContext.Provider>
  );
}