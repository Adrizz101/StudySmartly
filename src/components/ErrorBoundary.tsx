import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps { children: ReactNode; featureName?: string; }
interface ErrorBoundaryState { hasError: boolean; }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState { return { hasError: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[' + (this.props.featureName ?? 'Application') + '] Render failure:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section role="alert" className="glass surface-elevated m-3 sm:m-5 rounded-2xl border border-red-400/25 p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400"><AlertTriangle size={23} /></div>
          <h2 className="text-lg font-semibold text-text">Feature failed to load</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
            {(this.props.featureName ?? 'This section') + ' encountered an unexpected error. Your other StudySmartly sections are still available.'}
          </p>
          <Button className="mt-5 min-h-11" onClick={() => window.location.reload()}><RefreshCw size={16} /> Reload</Button>
        </section>
      );
    }
    return this.props.children;
  }
}
