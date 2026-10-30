import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in route:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex flex-col bg-bg-base items-center justify-center p-4 text-center">
          <div className="max-w-md w-full rounded-md border border-border-default bg-surface-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary lowercase">something went wrong</h2>
            <p className="mt-2 text-sm text-text-secondary">
              an unexpected error occurred while loading this page.
            </p>
            {this.state.error && (
              <pre className="mt-4 p-3 bg-bg-base rounded border border-border-default text-xs font-mono text-text-muted overflow-auto max-h-40 text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="min-h-[44px] rounded-md bg-accent-jargon px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-accent-jargon-lo active:bg-accent-jargon-lo"
              >
                try again
              </button>
              <a
                href="/home"
                className="min-h-[44px] rounded-md border border-border-default bg-surface-card px-4 flex items-center justify-center text-sm font-medium text-text-secondary transition-colors hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:text-text-primary active:bg-bg-base"
              >
                go to home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
