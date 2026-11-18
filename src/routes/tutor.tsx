import { createFileRoute } from '@tanstack/react-router';
import Tutor from '@/components/study/Tutor';

export const Route = createFileRoute('/tutor')({
  head: () => ({
    meta: [
      { title: 'StudySmartly — AI Tutor' },
      {
        name: 'description',
        content: 'Learn with StudySmartly AI Tutor: ask questions, explore subjects, and get step-by-step explanations.',
      },
      { property: 'og:title', content: 'StudySmartly — AI Tutor' },
      {
        property: 'og:description',
        content: 'Ask questions and get clear, step-by-step explanations with StudySmartly AI Tutor.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Page,
});

function Page() {
  return <Tutor />;
}
