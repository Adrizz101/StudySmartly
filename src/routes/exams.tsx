import { createFileRoute } from '@tanstack/react-router';
import ExamArena from '@/components/learning/ExamArena';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const Route=createFileRoute('/exams')({
  head:()=>({meta:[{title:'StudySmart — PYQ Exam Arena'},{name:'description',content:'Practise past-paper MCQs with independently checked solutions and subject insights.'},{property:'og:title',content:'StudySmart — PYQ Exam Arena'},{property:'og:description',content:'Practise past-paper MCQs with checked solutions and subject insights.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  component: Page,
});

function Page() {
  return <ErrorBoundary featureName="Exam Arena"><ExamArena /></ErrorBoundary>;
}
