import { lazy, Suspense } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const DrawingBoard = lazy(() => import('./DrawingBoard'));

export default function VisualLearningWorkspace() {
  return (
    <ErrorBoundary featureName="AI Tutor">
      <ClientOnly fallback={<p>Opening visual learning workspace…</p>}>
        <Suspense fallback={<p>Opening visual learning workspace…</p>}>
          <DrawingBoard />
        </Suspense>
      </ClientOnly>
    </ErrorBoundary>
  );
}
