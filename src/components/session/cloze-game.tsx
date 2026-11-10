'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { ClozeItem } from '@/lib/games';

// Cloze game screen (issue #41, FR-07, AD-04, spec §5.2). Renders the sentence
// with the masked blank (from the deterministic gap engine, 3.5). The user
// types the answer; per-blank feedback: correct = sapphire highlight; incorrect
// = red highlight and the answer is revealed. Validation is exact-match,
// case-insensitive, whitespace-normalized (per 3.5). A presentational component
// — the current item index and grade collection live in the StudySession parent.
interface ClozeGameProps {
  item: ClozeItem;
  /** Called with whether the fill was correct. Records the grade (does not
      advance). */
  onAnswer: (correct: boolean) => void;
  /** Called when the user clicks "next" to advance to the next blank. */
  onNext: () => void;
}

// Normalize a string for exact-match validation: trim, collapse internal
// whitespace, and lowercase (case-insensitive, whitespace-normalized per 3.5).
function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function ClozeGame({ item, onAnswer, onNext }: ClozeGameProps) {
  const t = useTranslations('Session');
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  // Split the sentence on the blank ("___") so the input renders inline at the
  // correct position. The builder replaces the masked span with "___".
  const BLANK = '___';
  const blankIndex = item.sentence.indexOf(BLANK);
  const before = blankIndex >= 0 ? item.sentence.slice(0, blankIndex) : item.sentence;
  const after = blankIndex >= 0 ? item.sentence.slice(blankIndex + BLANK.length) : '';

  function handleCheck() {
    const isCorrect = normalize(value) === normalize(item.answer);
    setChecked(true);
    setCorrect(isCorrect);
    onAnswer(isCorrect);
  }

  const inputClass = checked
    ? correct
      ? 'h-10 w-full rounded-md border border-primary bg-primary/10 px-3 text-sm text-primary'
      : 'h-10 w-full rounded-md border border-error bg-error/10 px-3 text-sm text-error'
    : 'h-10 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none';

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <p className="text-center text-base text-text-primary">
        {before}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !checked) {
              handleCheck();
            }
          }}
          disabled={checked}
          aria-label={t('clozeInstruction')}
          className={inputClass}
        />
        {after}
      </p>
      {!checked ? (
        <Button type="button" onClick={handleCheck} disabled={value.trim().length === 0}>
          {t('clozeCheck')}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p role="status" className={correct ? 'text-sm text-primary' : 'text-sm text-error'}>
            {correct ? t('clozeCorrect') : t('clozeWrong', { answer: item.answer })}
          </p>
          {/* The "next" button appears after the check, so the user can see the
              feedback (correct/incorrect + answer) before advancing. */}
          <Button type="button" onClick={onNext}>
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
