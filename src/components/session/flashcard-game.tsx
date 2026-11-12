'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Grade, type FlashcardItem } from '@/lib/games';

// Flashcard game screen (issue #38, spec §5.2). Renders one card at a time:
// the front is the pergunta; clicking flips it (300 ms rotateY, the §2.4
// --duration-slow token, disabled under prefers-reduced-motion) to reveal the
// back — respostaCerta plus the justificativa and dica when present. After the
// reveal, the four grade buttons (Missed/Hard/Good/Easy = q 1/3/4/5) appear;
// grading calls onGrade with the q value and the parent advances to the next
// card. A presentational component — card index and grade collection live in
// the StudySession parent.
interface FlashcardGameProps {
  card: FlashcardItem;
  onGrade: (grade: number) => void;
}

export function FlashcardGame({ card, onGrade }: FlashcardGameProps) {
  const t = useTranslations('Session');
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* The flippable card. The 3D flip uses a rotateY transition on the
          --duration-slow (300 ms) token; the global prefers-reduced-motion rule
          collapses it to ~0 ms so reduced-motion users see the back instantly. */}
      {/* Card size (issue #58): about 50% of the screen in both dimensions,
          not counting the left nav column (w-64 = 256px, so half of the
          remaining width is calc(50vw - 128px)) and 50% of the viewport height.
          The min-w/min-h guarantee the card is always large enough to hold 300
          characters at the standard font size, and the p-[12%] padding keeps at
          least 10% of the card empty (no text) on every side. */}
      <button
        type="button"
        onClick={() => {
          setFlipped(true);
        }}
        className="relative h-[50vh] min-h-[22rem] w-full max-w-[calc(50vw-128px)] min-w-[26rem] [perspective:1200px]"
        aria-label={flipped ? undefined : t('flipHint')}
        disabled={flipped}
      >
        <div
          className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front: the question. The p-[12%] padding keeps at least 10% of the
              card empty (no text) on every side (issue #58). */}
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-bg-secondary p-[12%] ring-1 ring-foreground/10 [backface-visibility:hidden]">
            <p className="text-center text-lg font-medium text-text-primary">{card.front}</p>
          </div>
          {/* Back: the answer + justification + hint (when present). The p-[12%]
              padding keeps at least 10% of the card empty on every side (issue
              #58). */}
          <div className="absolute inset-0 flex flex-col gap-4 overflow-auto rounded-xl bg-bg-secondary p-[12%] ring-1 ring-primary/40 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-base font-medium text-primary">{card.back}</p>
            {card.justificativa !== undefined && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {t('justification')}
                </span>
                <p className="text-sm text-text-secondary">{card.justificativa}</p>
              </div>
            )}
            {card.dica !== undefined && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {t('hint')}
                </span>
                <p className="text-sm text-text-secondary">{card.dica}</p>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Grade buttons appear only after the reveal. The Missed button is set
          apart (issue #59): it means the card was NOT recalled, so it sits on
          its own row with an error-tinted style, while the three success
          buttons (Hard/Good/Easy — recalled, with a difficulty rating) are
          grouped together below it. */}
      {flipped ? (
        <div className="flex w-full max-w-xl flex-col items-center gap-4">
          <Button
            variant="outline"
            className="border-error/40 text-error hover:bg-error/10 hover:text-error"
            onClick={() => {
              onGrade(Grade.Missed);
            }}
          >
            {t('gradeMissed')}
          </Button>
          <div className="grid w-full grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                onGrade(Grade.Hard);
              }}
            >
              {t('gradeHard')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onGrade(Grade.Good);
              }}
            >
              {t('gradeGood')}
            </Button>
            <Button
              onClick={() => {
                onGrade(Grade.Easy);
              }}
            >
              {t('gradeEasy')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{t('flipHint')}</p>
      )}
    </div>
  );
}
