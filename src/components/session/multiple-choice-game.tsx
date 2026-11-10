'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { MultipleChoiceItem } from '@/lib/games';

// Multiple choice game screen (issue #40, FR-07, spec §5.2). Renders each
// question with its options (correct + distractors, shuffled by the engine).
// Instant feedback on selection: correct = sapphire highlight; wrong = red
// highlight and the justification is revealed. The session advances to the next
// question after the feedback. A presentational component — the current
// question index and grade collection live in the StudySession parent.
interface MultipleChoiceGameProps {
  item: MultipleChoiceItem;
  /** Called with the selected option index and whether it was correct. Records
      the grade (does not advance). */
  onAnswer: (selectedIndex: number, correct: boolean) => void;
  /** Called when the user clicks "next" to advance to the next question. */
  onNext: () => void;
}

export function MultipleChoiceGame({ item, onAnswer, onNext }: MultipleChoiceGameProps) {
  const t = useTranslations('Session');
  const [selected, setSelected] = useState<number | null>(null);

  // Once an option is selected, lock the choices and show the feedback.
  const answered = selected !== null;
  const isCorrect = selected !== null && selected === item.correctIndex;

  function optionClass(index: number): string {
    const base =
      'w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-150';
    if (!answered) {
      return `${base} border-border bg-bg-secondary text-text-primary hover:border-primary/40`;
    }
    if (index === item.correctIndex) {
      // The correct answer: sapphire highlight.
      return `${base} border-primary bg-primary/10 text-primary`;
    }
    if (index === selected) {
      // The wrong selection: red highlight.
      return `${base} border-error bg-error/10 text-error`;
    }
    // The other options: dimmed.
    return `${base} border-border bg-bg-secondary text-text-secondary opacity-60`;
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <p className="text-center text-base font-medium text-text-primary">{item.question}</p>
      <div className="flex flex-col gap-2">
        {item.options.map((option, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            disabled={answered}
            onClick={() => {
              setSelected(index);
              onAnswer(index, index === item.correctIndex);
            }}
            className={optionClass(index)}
          >
            {option}
          </Button>
        ))}
      </div>
      {/* The justification is revealed after a wrong selection. */}
      {answered && !isCorrect && item.justificativa !== undefined && (
        <div className="flex flex-col gap-1 rounded-lg bg-bg-secondary p-4 ring-1 ring-error/40">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {t('justification')}
          </span>
          <p className="text-sm text-text-secondary">{item.justificativa}</p>
        </div>
      )}
      {/* The "next" button appears after the answer, so the user can see the
          feedback (correct/wrong highlight + justification) before advancing. */}
      {answered && (
        <Button type="button" onClick={onNext}>
          {t('next')}
        </Button>
      )}
    </div>
  );
}
