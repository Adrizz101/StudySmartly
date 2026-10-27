import { createFileRoute } from '@tanstack/react-router';
import Schedule from '@/components/study/Schedule';
export const Route = createFileRoute('/schedule')({
  head: () => ({ meta: [
    { title: 'StudySmart — Smart Schedule' },
    { name: 'description', content: 'Organize courses, events and syllabus schedules.' },
    { property: 'og:title', content: 'StudySmart — Smart Schedule' },
    { property: 'og:description', content: 'Organize courses, events and syllabus schedules.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() {
  return <Schedule />;
}
