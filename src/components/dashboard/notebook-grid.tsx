'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/dashboard/progress-ring';
import type { DashboardNotebook } from '@/lib/dashboard';

// "Your Notebooks" grid (issue #33, FR-11, spec §5.2 Screen 1). A client
// component so each card's progress ring can animate on first render. Renders
// one card per notebook (area tag, title, sapphire progress ring, Study button
// pinned to the card's bottom) on a responsive grid, or a helpful empty state
// with a CTA to the notebooks page when the user has none.
export function NotebookGrid({ cadernos }: Readonly<{ cadernos: DashboardNotebook[] }>) {
  const t = useTranslations('Overview');

  if (cadernos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-secondary/40 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-text-primary">{t('emptyTitle')}</h2>
        <p className="max-w-md text-base text-text-secondary">{t('emptyDescription')}</p>
        <Button asChild>
          <Link href="/notebooks">{t('emptyCta')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cadernos.map((caderno) => (
        <article
          key={caderno.id}
          className="flex flex-col gap-4 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10"
        >
          {/* Top tag: the notebook's dominant area (or a "no area" fallback). */}
          <span className="self-start rounded-full bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary">
            {caderno.areaTag ?? t('noArea')}
          </span>

          {/* Title + progress ring, side by side. */}
          <div className="flex items-center gap-4">
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">
              {caderno.nome}
            </h3>
            <ProgressRing
              percentage={caderno.ringPercentage}
              label={t('ringAria', { percent: caderno.ringPercentage })}
            />
          </div>

          {/* Study button pinned to the card's bottom. */}
          <div className="mt-auto">
            <Button className="w-full" disabled>
              {t('study')}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
