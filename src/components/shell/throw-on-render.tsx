'use client';

import { useEffect, useState } from 'react';

// Test-only component (issue #48). Throws during CLIENT rendering (after
// hydration) so the ErrorBoundary — a client component — catches the render
// error and shows the themed fallback with a retry action. It must NOT throw
// during SSR (that would be a server 500, not a client render error the
// boundary can catch), so it throws only once the `mounted` flag is set by a
// useEffect (which runs client-side, after hydration). Only rendered by the
// /error-boundary-test route, which is not linked from the nav.
export function ThrowOnRender(): React.ReactNode {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (mounted) {
    throw new Error('Intentional render error for the ErrorBoundary e2e test.');
  }
  return null;
}
