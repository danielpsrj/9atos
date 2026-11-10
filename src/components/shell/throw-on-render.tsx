'use client';

// Test-only component (issue #48). Throws unconditionally during client
// rendering so the e2e suite can verify the ErrorBoundary catches the render
// error and shows the themed fallback with a retry action. Only rendered by the
// /__error-test route, which is not linked from the nav.
export function ThrowOnRender(): React.ReactNode {
  throw new Error('Intentional render error for the ErrorBoundary e2e test.');
}
