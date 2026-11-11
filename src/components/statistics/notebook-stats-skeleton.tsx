import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

// Notebook statistics skeleton (issue #61). A loading placeholder that matches
// the final per-notebook statistics layout dimensions exactly — the memory-stage
// section (three stat cards + a donut) and the per-game section (a plays chart
// and a usage chart) — so swapping from skeleton to content causes zero layout
// shift. The visual skeleton is aria-hidden; a single role="status" carries the
// translated loading label for screen readers. A server component: the Skeleton
// primitive is a plain div, so no client JS is required.
export function NotebookStatsSkeleton() {
  const t = useTranslations('Statistics');

  return (
    <div className="flex flex-col gap-6" role="status" aria-label={t('loading')}>
      {/* Memory-stage section skeleton: heading, three stat cards, donut row. */}
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-6 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-9 w-16" />
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Skeleton className="size-40 rounded-full" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-3 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-game section skeleton: heading, a plays card, a usage card. */}
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-6 w-40" />
        <div className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-36 w-full" />
        </div>
      </div>
    </div>
  );
}
