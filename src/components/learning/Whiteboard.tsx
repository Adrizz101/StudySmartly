import { lazy, Suspense } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const DrawingBoard = lazy(() => import('./DrawingBoard'));

export default function Whiteboard() {
  return (
    <ErrorBoundary featureName="AI Whiteboard">
      <ClientOnly fallback={<p>Opening whiteboard…</p>}>
        <Suspense fallback={<p>Opening whiteboard…</p>}>
          <DrawingBoard />
        </Suspense>
      </ClientOnly>
    </ErrorBoundary>
  );
}
