import { createFileRoute } from '@tanstack/react-router';
import Whiteboard from '@/components/learning/Whiteboard';
export const Route = createFileRoute('/tutor')({
  head: () => ({ meta: [
    { title: 'StudySmart — AI Visual Whiteboard' },
    { name: 'description', content: 'Draw, upload reports and get live visual AI explanations.' },
    { property: 'og:title', content: 'StudySmart — AI Visual Whiteboard' },
    { property: 'og:description', content: 'Draw, upload reports and get live visual AI explanations.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() {
  return <Whiteboard />;
}
