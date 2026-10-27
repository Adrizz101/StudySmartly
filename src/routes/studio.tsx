import { createFileRoute } from '@tanstack/react-router';
import Studio from '@/components/learning/PresentationStudio';
export const Route = createFileRoute('/studio')({
  head: () => ({ meta: [
    { title: 'StudySmart — Presentation Studio' },
    { name: 'description', content: 'Generate, AI-edit, present and export polished presentations.' },
    { property: 'og:title', content: 'StudySmart — Presentation Studio' },
    { property: 'og:description', content: 'Generate, AI-edit, present and export polished presentations.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() {
  return <Studio />;
}
