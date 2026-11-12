'use client';

import { useTranslations } from 'next-intl';
import type { GameStats } from '@/lib/notebook-stats';

// Per-game correct/wrong-per-play graph (issue #61). For each game, a bar chart
// with one group per play: a sapphire bar for the concepts answered correctly
// and a dark-red bar for the ones answered wrongly. Pure SVG, no external chart
// library. Games with no plays show an empty-state message. A client component
// (the parent dashboard is a server component; this one is presentational).
interface GamePlaysGraphProps {
  games: GameStats[];
}

const GAME_LABEL_KEYS = {
  flashcards: 'gameFlashcards',
  match: 'gameMatch',
  'multiple-choice': 'gameMultipleChoice',
  cloze: 'gameCloze',
} as const;

export function GamePlaysGraph({ games }: GamePlaysGraphProps) {
  const t = useTranslations('Statistics');

  return (
    <div className="flex flex-col gap-4">
      {games.map((game) => (
        <article
          key={game.game}
          className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10"
        >
          <h3 className="text-sm font-semibold text-text-primary">
            {t(GAME_LABEL_KEYS[game.game])}
          </h3>
          {game.plays.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('noPlays')}</p>
          ) : (
            <PlayBars plays={game.plays} />
          )}
        </article>
      ))}
    </div>
  );
}

function PlayBars({
  plays,
}: Readonly<{ plays: { date: string; correct: number; wrong: number }[] }>) {
  const t = useTranslations('Statistics');
  const max = Math.max(1, ...plays.flatMap((p) => [p.correct, p.wrong]));
  const barWidth = 18;
  const gap = 10;
  const chartHeight = 120;
  const width = plays.length * (barWidth * 2 + gap) + gap;

  return (
    <div className="flex flex-col gap-2">
      <svg
        width={width}
        height={chartHeight + 24}
        viewBox={`0 0 ${String(width)} ${String(chartHeight + 24)}`}
        role="img"
        aria-label={t('playsAria', { count: plays.length })}
        className="overflow-visible"
      >
        {plays.map((play, i) => {
          const x = gap + i * (barWidth * 2 + gap);
          const correctHeight = (play.correct / max) * chartHeight;
          const wrongHeight = (play.wrong / max) * chartHeight;
          return (
            <g key={play.date}>
              {/* Correct bar (sapphire). */}
              <rect
                x={String(x)}
                y={String(chartHeight - correctHeight)}
                width={String(barWidth)}
                height={String(correctHeight)}
                fill="var(--primary)"
                rx="2"
              />
              {/* Wrong bar (dark red), next to the correct bar. */}
              <rect
                x={String(x + barWidth)}
                y={String(chartHeight - wrongHeight)}
                width={String(barWidth)}
                height={String(wrongHeight)}
                fill="var(--error)"
                rx="2"
              />
              {/* The play's day label, formatted dd/MM (issue #71). play.date is
                  a yyyy-MM-dd day key, so slice(8,10) is the day and slice(5,7)
                  the month. */}
              <text
                x={String(x + barWidth)}
                y={String(chartHeight + 16)}
                textAnchor="middle"
                className="fill-text-secondary text-[10px]"
              >
                {`${play.date.slice(8, 10)}/${play.date.slice(5, 7)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden />
          {t('correct')}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-error" aria-hidden />
          {t('wrong')}
        </span>
      </div>
    </div>
  );
}
