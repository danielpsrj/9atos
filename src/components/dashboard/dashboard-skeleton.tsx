import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

// Dashboard skeleton (issue #49, NFR-07). A loading placeholder that matches
// the final Overview layout dimensions exactly — the header (title + the two
// gamification/goal widgets) and a grid of notebook cards (tag pill, title +
// 72px ring row, study-mode select, full-width Study button) — so swapping from
// skeleton to content causes zero layout shift. The visual skeleton is
// aria-hidden; a single role="status" carries the translated loading label for
// screen readers. A server component: the Skeleton primitive is a plain div,
// so no client JS is required.
export function DashboardSkeleton() {
  const t = useTranslations('Overview');

  return (
    <div className="flex flex-col gap-6" role="status" aria-label={t('loading')}>
      {/* Header skeleton: title bar left, two icon+text widgets right. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <Skeleton className="h-7 w-40" aria-hidden />
        <div className="flex items-center gap-6" aria-hidden>
          {/* Streak widget: icon + text bar. */}
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
          {/* Goal widget: icon + text bar. */}
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </header>

      {/* Section header skeleton: title bar left, "New Notebook" button right. */}
      <div className="flex items-center justify-between gap-4" aria-hidden>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Notebook grid skeleton: three cards matching the NotebookCard layout. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10"
          >
            {/* Area tag pill. */}
            <Skeleton className="h-6 w-24 self-start rounded-full" />
            {/* Title + 72px ring row. */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="size-[72px] shrink-0 rounded-full" />
            </div>
            {/* Study-mode select + Study button. */}
            <div className="mt-auto flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
