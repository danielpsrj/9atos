'use client';

import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import type { SessionResult } from '@/lib/games';

// Results summary (issue #42, FR-06). Shown after a session completes and the
// single sync has fired. Displays the overall correct % (grades of Good/Easy
// count as correct), the per-rule grades, and the updated next-review dates
// returned by the sync response. A presentational component — the sync call and
// its idempotency guard live in the StudySession parent.
interface ResultsSummaryProps {
  grades: SessionResult[];
  /** The sync response: updated proximaRevisao (ISO string) per rule. */
  nextReviews: { regraId: string; proximaRevisao: string }[];
  locale: string;
}

export function ResultsSummary({ grades, nextReviews, locale }: ResultsSummaryProps) {
  const t = useTranslations('Session');
  const dateLocale = locale === 'en-US' ? enUS : ptBR;

  const correct = grades.filter((g) => g.qualidade >= 4).length;
  const percent = grades.length > 0 ? Math.round((correct / grades.length) * 100) : 0;

  const reviewByRule = new Map(nextReviews.map((r) => [r.regraId, r.proximaRevisao]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text-primary">{t('resultsTitle')}</h1>
        <p className="text-base text-text-secondary">{t('resultsCorrect', { percent })}</p>
        <p role="status" className="text-sm text-primary">
          {t('resultsSynced')}
        </p>
      </header>

      {/* Per-rule grades + updated next-review dates. */}
      <ul className="flex flex-col gap-2">
        {grades.map((g) => {
          const review = reviewByRule.get(g.regraId);
          return (
            <li
              key={g.regraId}
              className="flex items-center justify-between gap-4 rounded-lg bg-bg-secondary px-4 py-3 ring-1 ring-foreground/10"
            >
              <span
                className={
                  g.qualidade >= 4
                    ? 'text-sm font-medium text-primary'
                    : 'text-sm font-medium text-error'
                }
              >
                {t('gradeValue', { grade: g.qualidade })}
              </span>
              {review !== undefined && (
                <span className="text-sm text-text-secondary">
                  {t('nextReview', {
                    date: format(parseISO(review), 'dd MMM yyyy', { locale: dateLocale }),
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Button asChild>
        <Link href="/">{t('resultsBack')}</Link>
      </Button>
    </div>
  );
}
