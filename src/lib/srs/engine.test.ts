import { describe, it, expect } from 'vitest';
import { addDays } from 'date-fns';
import { applyReview, type SrsState } from './engine';

// Independent re-derivation of spec §4.1 (NOT copied from engine.ts). Used to
// compute expected outputs so a broken formula in the implementation fails here.
function expectedState(state: SrsState, q: number, now: Date): SrsState {
  const ef = Math.max(1.3, state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  let reps: number;
  let interval: number;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else if (state.reps === 0) {
    reps = 1;
    interval = 1;
  } else if (state.reps === 1) {
    reps = 2;
    interval = 6;
  } else {
    reps = state.reps + 1;
    interval = state.intervaloDias * state.easeFactor;
  }
  return {
    reps,
    easeFactor: ef,
    intervaloDias: interval,
    proximaRevisao: addDays(now, interval),
    historico: [...state.historico, { date: now.toISOString(), grade: q }],
  };
}

const NOW = new Date('2026-01-15T12:00:00.000Z');
const GRADES = [1, 3, 4, 5] as const;

// Initial states per rep stage, with the intervaloDias the algorithm would have
// produced to reach that stage.
function stateForReps(reps: number): SrsState {
  const intervaloDias = reps === 0 ? 0 : reps === 1 ? 1 : 6;
  return { reps, easeFactor: 2.5, intervaloDias, proximaRevisao: NOW, historico: [] };
}

describe('applyReview — table-driven (every grade × every rep stage)', () => {
  for (const q of GRADES) {
    for (const reps of [0, 1, 2, 3]) {
      it(`q=${String(q)} from reps=${String(reps)} matches the spec formula`, () => {
        const state = stateForReps(reps);
        expect(applyReview(state, q, NOW)).toEqual(expectedState(state, q, NOW));
      });
    }
  }
});

describe('applyReview — ease factor', () => {
  it('q=5 (Easy) raises EF by 0.1', () => {
    const s = stateForReps(0);
    expect(applyReview(s, 5, NOW).easeFactor).toBeCloseTo(2.6, 10);
  });

  it('q=4 (Good) leaves EF unchanged', () => {
    const s = stateForReps(0);
    expect(applyReview(s, 4, NOW).easeFactor).toBeCloseTo(2.5, 10);
  });

  it('q=3 (Hard) lowers EF by 0.14', () => {
    const s = stateForReps(0);
    expect(applyReview(s, 3, NOW).easeFactor).toBeCloseTo(2.36, 10);
  });

  it('q=1 (Missed) lowers EF by 0.54', () => {
    const s = stateForReps(0);
    expect(applyReview(s, 1, NOW).easeFactor).toBeCloseTo(1.96, 10);
  });

  it('EF never drops below the 1.3 floor (clamp)', () => {
    // Spec §4.1 fixes the floor at 1.3 — asserted as a literal, independent of
    // the engine's EF_FLOOR constant, so a mutated clamp fails this test.
    const SPEC_FLOOR = 1.3;
    let state: SrsState = {
      reps: 0,
      easeFactor: 1.3,
      intervaloDias: 1,
      proximaRevisao: NOW,
      historico: [],
    };
    for (let i = 0; i < 10; i++) {
      state = applyReview(state, 1, NOW);
      expect(state.easeFactor).toBeGreaterThanOrEqual(SPEC_FLOOR);
    }
    expect(state.easeFactor).toBeCloseTo(SPEC_FLOOR, 10);
  });
});

describe('applyReview — interval and reps', () => {
  it('a lapse (q=1) resets reps to 0 and interval to 1 day', () => {
    const state = stateForReps(3); // deep into the schedule
    const next = applyReview(state, 1, NOW);
    expect(next.reps).toBe(0);
    expect(next.intervaloDias).toBe(1);
    expect(next.proximaRevisao).toEqual(addDays(NOW, 1));
  });

  it('first success (reps 0) schedules 1 day', () => {
    const next = applyReview(stateForReps(0), 4, NOW);
    expect(next.reps).toBe(1);
    expect(next.intervaloDias).toBe(1);
  });

  it('second success (reps 1) schedules 6 days', () => {
    const next = applyReview(stateForReps(1), 4, NOW);
    expect(next.reps).toBe(2);
    expect(next.intervaloDias).toBe(6);
  });

  it('third+ success (reps > 1) multiplies previous interval by EF', () => {
    const state = stateForReps(2); // intervaloDias = 6, EF = 2.5
    const next = applyReview(state, 4, NOW);
    expect(next.reps).toBe(3);
    expect(next.intervaloDias).toBeCloseTo(6 * 2.5, 10);
  });
});

describe('applyReview — history and purity', () => {
  it('appends {date, grade} to historico on every review', () => {
    const state = stateForReps(0);
    const next = applyReview(state, 4, NOW);
    expect(next.historico).toHaveLength(1);
    expect(next.historico[0]).toEqual({ date: NOW.toISOString(), grade: 4 });

    const next2 = applyReview(next, 5, NOW);
    expect(next2.historico).toHaveLength(2);
    expect(next2.historico[1]).toEqual({ date: NOW.toISOString(), grade: 5 });
  });

  it('is pure: same inputs produce identical outputs, no mutation of the input', () => {
    const state = stateForReps(2);
    // Capture the input's field values (Date kept as a reference, not serialized).
    const before = {
      reps: state.reps,
      easeFactor: state.easeFactor,
      intervaloDias: state.intervaloDias,
      proximaRevisao: state.proximaRevisao,
      historicoLength: state.historico.length,
    };
    const a = applyReview(state, 4, NOW);
    const b = applyReview(state, 4, NOW);
    expect(a).toEqual(b);
    // Input state must be untouched (same Date reference, same field values).
    expect(state.reps).toBe(before.reps);
    expect(state.easeFactor).toBe(before.easeFactor);
    expect(state.intervaloDias).toBe(before.intervaloDias);
    expect(state.proximaRevisao).toBe(before.proximaRevisao);
    expect(state.historico).toHaveLength(before.historicoLength);
  });
});

describe('applyReview — game type recording (issue #61)', () => {
  it('records the game type on the historico entry when supplied', () => {
    const state = stateForReps(0);
    const next = applyReview(state, 4, NOW, 'multiple-choice');
    expect(next.historico).toHaveLength(1);
    expect(next.historico[0]).toEqual({
      date: NOW.toISOString(),
      grade: 4,
      game: 'multiple-choice',
    });
  });

  it('omits the game field when not supplied (backward compatible)', () => {
    const state = stateForReps(0);
    const next = applyReview(state, 4, NOW);
    expect(next.historico).toHaveLength(1);
    expect(next.historico[0]).toEqual({ date: NOW.toISOString(), grade: 4 });
    expect(next.historico[0]).not.toHaveProperty('game');
  });

  it('does not alter the SRS schedule when a game type is supplied', () => {
    const withGame = applyReview(stateForReps(2), 4, NOW, 'cloze');
    const withoutGame = applyReview(stateForReps(2), 4, NOW);
    expect(withGame.reps).toBe(withoutGame.reps);
    expect(withGame.easeFactor).toBe(withoutGame.easeFactor);
    expect(withGame.intervaloDias).toBe(withoutGame.intervaloDias);
    expect(withGame.proximaRevisao).toEqual(withoutGame.proximaRevisao);
  });
});
