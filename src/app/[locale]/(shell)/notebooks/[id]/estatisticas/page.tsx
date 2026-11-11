import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { NotebookStatsContent } from '@/components/statistics/notebook-stats-content';
import { NotebookStatsSkeleton } from '@/components/statistics/notebook-stats-skeleton';

// Notebook statistics page (issue #61). The per-notebook statistics screen,
// reachable from the notebook card on the Overview and from the Notebooks page.
// A dashboard layout with a slot per graph: the memory-stage breakdown (the
// headline graph) first, then the per-game graphs. The Suspense boundary streams
// the skeleton while the statistics query is in flight.
export default async function NotebookStatsPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string; id: string }>;
}>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Statistics');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
        <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
      </div>
      <Suspense fallback={<NotebookStatsSkeleton />}>
        <NotebookStatsContent cadernoId={id} />
      </Suspense>
    </div>
  );
}
