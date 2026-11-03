import type { SessionResult } from './types';

// Plan §2.4 / spec §4, §6, FR-04/06/07: translates each game's interaction
// outcomes into the 4-grade SRS payload (q ∈ {1,3,4,5}) consumed by the sync
// endpoint.
//
// ┌─────────────────────┬──────────────────────────────────────────────────┐
// │ Game type           │ Mapping                                          │
// ├─────────────────────┼──────────────────────────────────────────────────┤
// │ Flashcard / MC      │ Direct: the user's 4-button choice becomes q —   │
// │                     │ Missed→1, Hard→3, Good→4, Easy→5.                │
// │ Matching            │ A pair ever missed (even if replayed then        │
// │                     │ correct) grades 1; a pair never missed grades 4. │
// │ Cloze               │ A correctly filled blank grades 4; an incorrect  │
// │                     │ blank grades 1.                                  │
// └─────────────────────┴──────────────────────────────────────────────────┘

/** The four SRS grades (FR-04). */
export const Grade = {
  Missed: 1,
  Hard: 3,
  Good: 4,
  Easy: 5,
} as const;

export type ButtonGrade = (typeof Grade)[keyof typeof Grade];

/** Flashcard / Multiple choice: the button choice maps directly to the grade. */
export function mapDirectGrades(
  outcomes: { regraId: string; grade: ButtonGrade }[],
): SessionResult[] {
  return outcomes.map(({ regraId, grade }) => ({ regraId, qualidade: grade }));
}

/** Matching: ever-missed → 1, never-missed → 4. */
export function mapMatchingGrades(
  outcomes: { regraId: string; missed: boolean }[],
): SessionResult[] {
  return outcomes.map(({ regraId, missed }) => ({
    regraId,
    qualidade: missed ? Grade.Missed : Grade.Good,
  }));
}

/** Cloze: correct → 4, incorrect → 1. */
export function mapClozeGrades(outcomes: { regraId: string; correct: boolean }[]): SessionResult[] {
  return outcomes.map(({ regraId, correct }) => ({
    regraId,
    qualidade: correct ? Grade.Good : Grade.Missed,
  }));
}
