'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseISO } from 'date-fns';
import type { GameStats } from '@/lib/notebook-stats';

// Per-game usage graph (issue #61). Vertical bars — one per game — showing how
// many times the student used each game within a selectable time window (in
// days). The window is client state (7 / 30 / 90 days); the bar height is the
// number of plays whose date falls in the window. Pure SVG, no external chart
// library.
interface GameUsageGraphProps {
  games: GameStats[];
}

const GAME_LABEL_KEYS = {
  flashcards: 'gameFlashcards',
  match: 'gameMatch',
  'multiple-choice': 'gameMultipleChoice',
  cloze: 'gameCloze',
} as const;

const WINDOWS = [7, 30, 90] as const;

export function GameUsageGraph({ games }: GameUsageGraphProps) {
  const t = useTranslations('Statistics');
  const [windowDays, setWindowDays] = useState<number>(30);

  // Count the plays in the selected window per game.
  const usage = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    return games.map((game) => ({
      game: game.game,
      count: game.plays.filter((play) => parseISO(play.date) >= cutoff).length,
    }));
  }, [games, windowDays]);

  const max = Math.max(1, ...usage.map((u) => u.count));
  const barWidth = 48;
  // The gap is wide enough that the longest game label ("Preencher lacunas",
  // ~100px at text-[10px]) fits under its bar without colliding with its
  // neighbour (issue #73). Slot = barWidth + gap = 112px.
  const gap = 64;
  const chartHeight = 140;
  const width = usage.length * (barWidth + gap) + gap;

  return (
    <article className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('usageTitle')}</h3>
        {/* The selectable time window (in days). */}
        <div className="flex items-center gap-1" role="group" aria-label={t('windowLabel')}>
          {WINDOWS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setWindowDays(days);
              }}
              aria-pressed={windowDays === days}
              className={
                windowDays === days
                  ? 'rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary'
                  : 'rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-bg-primary hover:text-text-primary'
              }
            >
              {t('windowDays', { days })}
            </button>
          ))}
        </div>
      </div>

      <svg
        width={width}
        height={chartHeight + 40}
        viewBox={`0 0 ${String(width)} ${String(chartHeight + 40)}`}
        role="img"
        aria-label={t('usageAria', { days: windowDays })}
        className="overflow-visible"
      >
        {usage.map((entry, i) => {
          const x = gap + i * (barWidth + gap);
          const height = (entry.count / max) * chartHeight;
          return (
            <g key={entry.game}>
              <rect
                x={String(x)}
                y={String(chartHeight - height)}
                width={String(barWidth)}
                height={String(height)}
                fill="var(--primary)"
                rx="3"
              />
              {/* The count above the bar. */}
              <text
                x={String(x + barWidth / 2)}
                y={String(chartHeight - height - 6)}
                textAnchor="middle"
                className="fill-text-primary text-xs font-semibold"
              >
                {String(entry.count)}
              </text>
              {/* The game label below the bar. */}
              <text
                x={String(x + barWidth / 2)}
                y={String(chartHeight + 16)}
                textAnchor="middle"
                className="fill-text-secondary text-[10px]"
              >
                {t(GAME_LABEL_KEYS[entry.game])}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}
