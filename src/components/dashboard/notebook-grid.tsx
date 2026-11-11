'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/dashboard/progress-ring';
import type { DashboardNotebook } from '@/lib/dashboard';

// The four game types and their wire values (the ?game= query param).
const GAME_TYPES = [
  { value: 'flashcards', key: 'gameFlashcards' },
  { value: 'match', key: 'gameMatch' },
  { value: 'multiple-choice', key: 'gameMultipleChoice' },
  { value: 'cloze', key: 'gameCloze' },
] as const;

// One notebook card (issue #33, FR-11, spec §5.2 Screen 1). Holds the selected
// game type in local state; the Study button starts a session of that type.
function NotebookCard({ caderno }: Readonly<{ caderno: DashboardNotebook }>) {
  const t = useTranslations('Overview');
  const [game, setGame] = useState<string>('flashcards');

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
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

      {/* Study mode selector + Study button pinned to the card's bottom
          (Phase 7): the user picks a game type, then starts a session. */}
      <div className="mt-auto flex flex-col gap-2">
        <label htmlFor={`game-${caderno.id}`} className="text-xs text-text-secondary">
          {t('gameLabel')}
        </label>
        <select
          id={`game-${caderno.id}`}
          value={game}
          onChange={(e) => {
            setGame(e.target.value);
          }}
          className="h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
        >
          {GAME_TYPES.map((g) => (
            <option key={g.value} value={g.value}>
              {t(g.key)}
            </option>
          ))}
        </select>
        <Button asChild className="w-full">
          <Link href={`/study?cadernoId=${encodeURIComponent(caderno.id)}&game=${game}`}>
            {t('study')}
          </Link>
        </Button>
        {/* Per-notebook statistics (issue #61): the learning dashboard for this
            notebook, reachable from the card. */}
        <Link
          href={`/notebooks/${encodeURIComponent(caderno.id)}/estatisticas`}
          className="text-center text-xs font-medium text-text-secondary underline-offset-2 hover:text-primary hover:underline"
        >
          {t('statistics')}
        </Link>
      </div>
    </article>
  );
}

// "Your Notebooks" grid (issue #33, FR-11, spec §5.2 Screen 1). A client
// component so each card's progress ring can animate on first render. Renders
// one card per notebook (area tag, title, sapphire progress ring, study-mode
// selector, Study button) on a responsive grid. The first-run / onboarding
// screen (issue #35) is rendered by the Overview page instead of this grid when
// the user has no notebooks.
export function NotebookGrid({ cadernos }: Readonly<{ cadernos: DashboardNotebook[] }>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cadernos.map((caderno) => (
        <NotebookCard key={caderno.id} caderno={caderno} />
      ))}
    </div>
  );
}
