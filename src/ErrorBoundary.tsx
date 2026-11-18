import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: String(error) };
  }

  render() {
    if (this.state.error !== null) {
      return (
        <main className="screen">
          <h1 className="t-title">Something went wrong</h1>
          <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
            Reload the page to try again.
          </p>
          <p className="t-caption" style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
            {this.state.error}
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
