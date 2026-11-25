import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import type { Language } from '../types';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  language?: Language;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level React Error Boundary providing graceful recovery when an unexpected UI exception occurs.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    // Error captured cleanly by boundary state without logging raw stack traces to users.
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    }
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const hi = this.props.language === 'hi';

    return (
      <main
        role="alert"
        className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full rounded-[24px] bg-slate-900/90 border border-white/20 p-6 space-y-4 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-300/30 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-rose-300" aria-hidden="true" />
          </div>
          <h1 className="font-display text-xl font-semibold text-white">
            {hi ? 'कुछ अनपेक्षित समस्या आ गई है' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {hi
              ? 'ऐप को दोबारा लोड करने के लिए नीचे रीलोड बटन दबाएँ।'
              : 'VayuMitra hit an unexpected display error. Reload to restore live air-quality readings.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-slate-950 text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>{hi ? 'ऐप रीलोड करें' : 'Reload VayuMitra'}</span>
          </button>
        </div>
      </main>
    );
  }
}
