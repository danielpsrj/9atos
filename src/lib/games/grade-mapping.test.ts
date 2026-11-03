import { describe, it, expect } from 'vitest';
import { Grade, mapClozeGrades, mapDirectGrades, mapMatchingGrades } from './grade-mapping';

describe('mapDirectGrades (flashcard / MC)', () => {
  it('maps each button choice directly to its grade', () => {
    const result = mapDirectGrades([
      { regraId: 'a', grade: Grade.Missed },
      { regraId: 'b', grade: Grade.Hard },
      { regraId: 'c', grade: Grade.Good },
      { regraId: 'd', grade: Grade.Easy },
    ]);
    expect(result).toEqual([
      { regraId: 'a', qualidade: 1 },
      { regraId: 'b', qualidade: 3 },
      { regraId: 'c', qualidade: 4 },
      { regraId: 'd', qualidade: 5 },
    ]);
  });
});

describe('mapMatchingGrades', () => {
  it('yields q=1 for a missed pair and q=4 for clean pairs', () => {
    const result = mapMatchingGrades([
      { regraId: 'clean1', missed: false },
      { regraId: 'missed', missed: true },
      { regraId: 'clean2', missed: false },
    ]);
    const byId = new Map(result.map((r) => [r.regraId, r.qualidade]));
    expect(byId.get('missed')).toBe(1);
    expect(byId.get('clean1')).toBe(4);
    expect(byId.get('clean2')).toBe(4);
  });
});

describe('mapClozeGrades', () => {
  it('yields q=4 for correct blanks and q=1 for incorrect', () => {
    const result = mapClozeGrades([
      { regraId: 'ok', correct: true },
      { regraId: 'bad', correct: false },
    ]);
    const byId = new Map(result.map((r) => [r.regraId, r.qualidade]));
    expect(byId.get('ok')).toBe(4);
    expect(byId.get('bad')).toBe(1);
  });
});

describe('payload shape (spec §6 sync contract)', () => {
  it('every rule appears exactly once in the result payload', () => {
    const result = mapMatchingGrades([
      { regraId: 'a', missed: false },
      { regraId: 'b', missed: true },
      { regraId: 'c', missed: false },
    ]);
    const ids = result.map((r) => r.regraId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3); // no duplicates
  });

  it('each entry has exactly the {regraId, qualidade} shape', () => {
    const result = mapDirectGrades([{ regraId: 'x', grade: Grade.Good }]);
    const entry = result[0];
    expect(entry).toBeDefined();
    if (entry) {
      expect(Object.keys(entry).sort()).toEqual(['qualidade', 'regraId']);
      expect(typeof entry.regraId).toBe('string');
      expect(typeof entry.qualidade).toBe('number');
    }
  });

  it('only emits valid grades (1, 3, 4, 5)', () => {
    const valid = new Set([1, 3, 4, 5]);
    const all = [
      ...mapDirectGrades([
        { regraId: 'a', grade: Grade.Missed },
        { regraId: 'b', grade: Grade.Easy },
      ]),
      ...mapMatchingGrades([
        { regraId: 'c', missed: true },
        { regraId: 'd', missed: false },
      ]),
      ...mapClozeGrades([
        { regraId: 'e', correct: true },
        { regraId: 'f', correct: false },
      ]),
    ];
    for (const entry of all) {
      expect(valid.has(entry.qualidade)).toBe(true);
    }
  });
});
