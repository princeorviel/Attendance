import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'कुछ तकनीकी समस्या आ गई है।',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
              ऐप में कोई त्रुटि आई
            </h2>
            <p className="mt-2 text-xs text-slate-600 break-words dark:text-slate-300">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>ऐप रीफ़्रेश करें</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
