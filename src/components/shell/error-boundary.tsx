'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Error boundary (issue #48, NFR-07). A React error boundary that wraps the
// app shell's main content. If a child throws during rendering (a render error,
// not an API failure — those are handled by toasts + recoverable states), the
// boundary catches it and shows a themed fallback with a retry action instead
// of a white screen. The retry resets the boundary's error state, re-rendering
// the child; a transient error (e.g. a one-off data-shape bug) may then
// succeed.
//
// Must be a class component — React only invokes error-boundary lifecycle
// methods on classes. The fallback UI uses useTranslations via a small inner
// function component (hooks cannot be called in a class render).
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log the render error for diagnostics. The user sees the themed fallback,
    // not a stack trace.
    console.error('ErrorBoundary caught a render error:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

// The themed fallback. A separate function component so it can use the
// useTranslations hook (hooks are illegal in a class component's render).
function ErrorFallback({ onRetry }: { onRetry: () => void }): ReactNode {
  const t = useTranslations('Error');
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl bg-bg-secondary p-8 text-center ring-1 ring-foreground/10"
    >
      <AlertTriangle aria-hidden className="size-10 text-error" />
      <h2 className="text-lg font-semibold text-text-primary">{t('title')}</h2>
      <p className="max-w-md text-sm text-text-secondary">{t('description')}</p>
      <Button onClick={onRetry} variant="outline" size="sm">
        <RotateCcw aria-hidden />
        {t('retry')}
      </Button>
    </div>
  );
}
