import { createFileRoute } from '@tanstack/react-router';
import AdaptivePlanner from '@/components/study/AdaptivePlanner';
export const Route = createFileRoute('/planner')({
  head: () => ({ meta: [
    { title: 'StudySmart — Adaptive Study Planner' },
    { name: 'description', content: 'Build an adaptive revision schedule around weak topics and available time.' },
  ] }),
  component: AdaptivePlanner,
});
