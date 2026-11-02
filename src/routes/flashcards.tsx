import { createFileRoute } from '@tanstack/react-router';
import FlashcardStudio from '@/components/learning/Flashcards';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const Route = createFileRoute('/flashcards')({
  head:()=>({meta:[{title:'StudySmartly — Spaced Repetition Studio'},{name:'description',content:'Build flashcards and review them with adaptive spaced repetition.'}]}),
  component: Page,
});

function Page() {
  return <ErrorBoundary featureName="Flashcards"><FlashcardStudio /></ErrorBoundary>;
}
