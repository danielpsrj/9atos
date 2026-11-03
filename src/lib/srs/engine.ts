import { addDays } from 'date-fns';

// Plan §2.4 / spec §4.1: pure SM-2 variant. No I/O, no Date.now() — `now` is
// injected as a UTC instant. Same inputs always yield the same output (AD-02).

export interface HistoricoEntry {
  /** ISO 8601 UTC instant of the review. */
  date: string;
  /** Response quality grade: 1 (Missed), 3 (Hard), 4 (Good), 5 (Easy). */
  grade: number;
}

export interface SrsState {
  /** Consecutive correct repetitions. */
  reps: number;
  /** Ease factor (initial 2.5, floor 1.3). */
  easeFactor: number;
  /** Interval in days until the next review. */
  intervaloDias: number;
  /** Calculated date of the next review (UTC). */
  proximaRevisao: Date;
  /** Append-only log of past reviews. */
  historico: HistoricoEntry[];
}

/** Ease factor can never drop below this (spec §4.1 restriction). */
export const EF_FLOOR = 1.3;

/**
 * Apply a single review to an SRS state and return the new state.
 *
 * Spec §4.1, line-for-line:
 * - q < 3 (error): reps = 0, interval = 1 day.
 * - q >= 3 (success): reps 0 → 1 day; reps 1 → 6 days; reps > 1 →
 *   previous interval × easeFactor; then reps += 1.
 * - Ease factor: EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02)), floor 1.3.
 * - proximaRevisao = now + interval days.
 * - Append {date, grade} to historico.
 *
 * The interval for reps > 1 uses the CURRENT ease factor (the spec computes the
 * interval before the ease-factor update), matching the original SM-2 ordering.
 */
export function applyReview(state: SrsState, q: number, now: Date): SrsState {
  // Interval + reps (uses the current ease factor, per spec ordering).
  let reps: number;
  let intervaloDias: number;
  if (q < 3) {
    reps = 0;
    intervaloDias = 1;
  } else if (state.reps === 0) {
    intervaloDias = 1;
    reps = 1;
  } else if (state.reps === 1) {
    intervaloDias = 6;
    reps = 2;
  } else {
    intervaloDias = state.intervaloDias * state.easeFactor;
    reps = state.reps + 1;
  }

  // Ease factor update (every grade), clamped to the floor.
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const easeFactor = Math.max(EF_FLOOR, state.easeFactor + efDelta);

  const proximaRevisao = addDays(now, intervaloDias);
  const historico: HistoricoEntry[] = [...state.historico, { date: now.toISOString(), grade: q }];

  return { reps, easeFactor, intervaloDias, proximaRevisao, historico };
}
