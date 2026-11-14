import { createFileRoute } from '@tanstack/react-router';
import Tutor from '@/components/study/Tutor';

export const Route = createFileRoute('/ai-tutor')({
  head: () => ({ meta: [
    { title: 'StudySmartly — AI Tutor' },
    { name: 'description', content: 'Learn with Socratic guidance, clear explanations, and exam preparation.' },
    { property: 'og:title', content: 'StudySmartly — AI Tutor' },
    { property: 'og:description', content: 'Learn with Socratic guidance, clear explanations, and exam preparation.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});

function Page() {
  return <Tutor />;
}
