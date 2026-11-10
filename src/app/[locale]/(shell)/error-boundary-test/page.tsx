import { setRequestLocale } from 'next-intl/server';
import { ThrowOnRender } from '@/components/shell/throw-on-render';

// Test-only route (issue #48). Renders a client component that throws during
// client rendering, so the e2e suite can verify the ErrorBoundary catches the
// render error and shows the themed fallback with a retry action. Not linked
// from the nav; only the e2e test navigates here. (Named without a leading
// underscore — Next.js treats `_`-prefixed segments as private/unroutable.)
export default async function ErrorTestPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ThrowOnRender />;
}
