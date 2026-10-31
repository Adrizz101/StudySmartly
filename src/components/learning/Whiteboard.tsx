import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { ClientOnly } from '@tanstack/react-router';

const DrawingBoard = lazy(() => import('./DrawingBoard'));

class WhiteboardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Whiteboard render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="m-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Failed to render board
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Whiteboard() {
  return (
    <WhiteboardErrorBoundary>
      <ClientOnly fallback={<p>Opening whiteboard…</p>}>
        <Suspense fallback={<p>Opening whiteboard…</p>}>
          <DrawingBoard />
        </Suspense>
      </ClientOnly>
    </WhiteboardErrorBoundary>
  );
}
