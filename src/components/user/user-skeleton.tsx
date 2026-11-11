import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

// User skeleton (issue #62). A loading placeholder that matches the final User
// page layout dimensions exactly — the header (learner name + the two
// gamification/goal widgets) and a three-card memory-stage grid — so swapping
// from skeleton to content causes zero layout shift. The visual skeleton is
// aria-hidden; a single role="status" carries the translated loading label.
export function UserSkeleton() {
  const t = useTranslations('User');

  return (
    <div className="flex flex-col gap-6" role="status" aria-label={t('loading')}>
      {/* Header skeleton: name bar left, two icon+text widgets right. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <Skeleton className="h-7 w-40" aria-hidden />
        <div className="flex items-center gap-6" aria-hidden>
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </header>

      {/* Section header + three-card memory-stage grid skeleton. */}
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-9 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
