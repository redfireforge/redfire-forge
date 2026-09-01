import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: ReactNode;
}

/**
 * Error boundary specifically for the lazy-loaded DemoShellHost.
 *
 * Without this, any throw inside DemoShellHost (or its chunk import) escapes
 * Suspense and unmounts the entire React tree — leaving just the background
 * colour. This boundary catches those errors, keeps the rest of the app alive,
 * and surfaces the error message so it can be debugged via the browser console.
 */
export class DemoShellErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[DemoShellHost] Crashed — Learning Hub will be disabled for this session.', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // The Demo Hub panel is unavailable but the rest of the app still works.
      // The error is logged to the browser console for diagnosis.
      return (
        <div
          id="demo-hub-error"
          style={{
            display: 'none', // invisible — keeps the mount point intact; error is in console
          }}
          data-error={this.state.error?.message ?? 'unknown'}
        />
      );
    }
    return this.props.children;
  }
}
