'use client';

import { useTranslations } from 'next-intl';
import type { MatchColumnEntry, MatchPair } from '@/lib/games';

// Matching game screen (issue #39, FR-07, FR-08, AD-14, spec §5.2 Screen 2).
// Two dynamic columns: left = concepts (pergunta), right = definitions
// (respostaCerta). Click-to-select: select a concept, then a definition. A
// correct pair draws an electrical beam in sapphire (#64FFDA) that temporarily
// connects the two cards, then both fade out (150 ms draw + 250 ms fade, the
// §2.4 tokens, disabled under prefers-reduced-motion). A wrong pair flashes a
// dark red (#F87171) highlight (150 ms in / 250 ms out) and increments the
// error counter (feeds the SRS payload as q=1 at the end). The session ends
// when every pair is matched. A presentational component — pair state, the
// error counter, and grade collection live in the StudySession parent.
interface MatchingGameProps {
  leftColumn: MatchColumnEntry[];
  rightColumn: MatchColumnEntry[];
  /** The set of regraIds already matched (removed from the columns). */
  matchedIds: ReadonlySet<string>;
  /** Called when the user selects a concept or definition. */
  onSelect: (side: 'left' | 'right', entry: MatchColumnEntry) => void;
  /** The currently selected concept (left) or definition (right), if any. */
  selectedLeft: MatchColumnEntry | null;
  selectedRight: MatchColumnEntry | null;
  /** The pair that just matched (for the beam animation), if any. */
  beamPair: MatchPair | null;
  /** The pair that just failed (for the error flash), if any. */
  errorPair: { left: MatchColumnEntry; right: MatchColumnEntry } | null;
}

export function MatchingGame({
  leftColumn,
  rightColumn,
  matchedIds,
  onSelect,
  selectedLeft,
  selectedRight,
  beamPair,
  errorPair,
}: MatchingGameProps) {
  const t = useTranslations('Session');

  // The visible (unmatched) entries for each column.
  const visibleLeft = leftColumn.filter((e) => !matchedIds.has(e.regraId));
  const visibleRight = rightColumn.filter((e) => !matchedIds.has(e.regraId));

  function isBeamEntry(entry: MatchColumnEntry): boolean {
    return beamPair !== null && entry.regraId === beamPair.regraId;
  }
  function isErrorEntry(entry: MatchColumnEntry): boolean {
    return (
      errorPair !== null &&
      (errorPair.left.regraId === entry.regraId || errorPair.right.regraId === entry.regraId)
    );
  }
  function isSelected(entry: MatchColumnEntry, side: 'left' | 'right'): boolean {
    if (side === 'left') return selectedLeft !== null && selectedLeft.regraId === entry.regraId;
    return selectedRight !== null && selectedRight.regraId === entry.regraId;
  }

  const cardClass = (entry: MatchColumnEntry, side: 'left' | 'right') => {
    const base = 'w-full rounded-lg border px-4 py-3 text-left text-sm transition-all duration-150';
    if (isBeamEntry(entry)) {
      // The beam: sapphire border + glow, then fade out (the parent clears
      // beamPair after the animation).
      return `${base} border-primary bg-primary/10 text-primary match-beam`;
    }
    if (isErrorEntry(entry)) {
      // The error flash: dark red highlight (150 ms in / 250 ms out).
      return `${base} border-error bg-error/10 text-error match-error`;
    }
    if (isSelected(entry, side)) {
      return `${base} border-primary bg-bg-secondary text-text-primary ring-1 ring-primary/40`;
    }
    return `${base} border-border bg-bg-secondary text-text-primary hover:border-primary/40`;
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <p className="text-center text-sm text-text-secondary">{t('matchInstruction')}</p>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column: concepts. */}
        <div className="flex flex-col gap-2" role="list" aria-label="concepts">
          {visibleLeft.map((entry) => (
            <button
              key={entry.regraId}
              type="button"
              role="listitem"
              onClick={() => {
                onSelect('left', entry);
              }}
              className={cardClass(entry, 'left')}
            >
              {entry.text}
            </button>
          ))}
        </div>
        {/* Right column: definitions. */}
        <div className="flex flex-col gap-2" role="list" aria-label="definitions">
          {visibleRight.map((entry) => (
            <button
              key={entry.regraId}
              type="button"
              role="listitem"
              onClick={() => {
                onSelect('right', entry);
              }}
              className={cardClass(entry, 'right')}
            >
              {entry.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
