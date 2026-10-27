import { createFileRoute } from '@tanstack/react-router';
import Settings from '@/components/study/Settings';
export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [
    { title: 'StudySmart — Settings' },
    { name: 'description', content: 'Manage your profile, theme, timer and study connectors.' },
    { property: 'og:title', content: 'StudySmart — Settings' },
    { property: 'og:description', content: 'Manage your profile, theme, timer and study connectors.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() {
  return <Settings />;
}
