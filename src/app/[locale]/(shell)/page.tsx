import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

// Overview / dashboard (issue #32 header, #33 notebook grid; FR-10, FR-11,
// FR-12). A server component that renders the Screen 1 layout: the header
// (title + gold flame streak widget + target goal widget) above the "Your
// Notebooks" grid of cards with animated sapphire progress rings.
//
// Issue #49 (NFR-07): the data-dependent content (DashboardContent) is wrapped
// in a <Suspense> boundary whose fallback is the DashboardSkeleton. While the
// Prisma queries are in flight the skeleton (matching the final layout
// dimensions) is shown; when the data resolves the real content streams in
// with zero layout shift. The first-run state (#35) replaces the grid when the
// user has no notebooks and no progress.
export default async function OverviewPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
