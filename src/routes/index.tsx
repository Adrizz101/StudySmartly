import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '@/components/study/Dashboard';
export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'StudySmart — Dashboard' },
    { name: 'description', content: 'Manage your courses, schedule, tutor sessions and study documents.' },
    { property: 'og:title', content: 'StudySmart — Dashboard' },
    { property: 'og:description', content: 'Manage your courses, schedule, tutor sessions and study documents.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() {
  const navigate = Route.useNavigate();
  return <Dashboard onNavigate={(view) => navigate({ to: view === 'dashboard' ? '/' : `/${view}` })} />;
}
