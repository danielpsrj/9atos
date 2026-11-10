import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

// Session-start skeleton (issue #49, NFR-07). A loading placeholder shown while
// the session is being started (POST /api/study/session/start). It mirrors the
// playing-phase layout exactly — the SessionChrome (a thin top progress bar +
// a header row with an Exit button on the left and a Zen/timer control on the
// right) above a centered game area — so swapping from skeleton to the real
// chrome + first card causes zero layout shift. The visual skeleton is
// aria-hidden; a single role="status" carries the translated loading label for
// screen readers.
export function SessionSkeleton() {
  const t = useTranslations('Session');

  return (
    <div
      className="flex min-h-screen flex-col bg-bg-primary"
      role="status"
      aria-label={t('starting')}
    >
      {/* Top progress bar (matches SessionChrome's h-1 bar). */}
      <div className="h-1 w-full bg-bg-secondary" aria-hidden>
        <Skeleton className="h-full w-0" />
      </div>

      {/* Header row: Exit placeholder (left) + Zen/timer placeholder (right). */}
      <div
        className="flex items-center justify-between gap-4 border-b border-border py-3"
        aria-hidden
      >
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-7 w-28 rounded-md" />
      </div>

      {/* Centered game-area placeholder (matches the playing-phase <main>). */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6" aria-hidden>
        <Skeleton className="h-64 w-full max-w-md rounded-xl" />
      </main>
    </div>
  );
}
