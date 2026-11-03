import { describe, it, expect } from 'vitest';
import { buildMultipleChoiceSession, seededShuffle } from './multiple-choice';
import type { GameRule } from './types';

function rule(overrides: Partial<GameRule> = {}): GameRule {
  return {
    id: 'r1',
    pergunta: 'Q?',
    respostaCerta: 'correct',
    justificativa: null,
    dica: null,
    distratores: ['d1', 'd2', 'd3'],
    topicoId: 't1',
    ...overrides,
  };
}

describe('buildMultipleChoiceSession', () => {
  it('never duplicates the correct answer among the options', () => {
    const rules = [
      rule({ id: 'a', respostaCerta: 'A-correct', distratores: ['x', 'y', 'z'] }),
      rule({ id: 'b', respostaCerta: 'B-correct', distratores: ['p', 'q', 'r'] }),
    ];
    const session = buildMultipleChoiceSession(rules, 'sess');
    for (const item of session.items) {
      const correctCount = item.options.filter((o) => o === item.options[item.correctIndex]).length;
      expect(correctCount).toBe(1);
      // The correct answer appears exactly once.
      expect(item.options.filter((o) => o === (item.options[item.correctIndex] ?? '')).length).toBe(
        1,
      );
    }
  });

  it('has an identical option count for every question in a session', () => {
    const rules = [
      rule({ id: 'a', distratores: ['x', 'y', 'z'] }),
      rule({ id: 'b', distratores: ['p'] }), // short on distractors
      rule({ id: 'c', distratores: [] }), // zero distractors
    ];
    const session = buildMultipleChoiceSession(rules, 'sess');
    const counts = session.items.map((i) => i.options.length);
    expect(new Set(counts).size).toBe(1); // all the same
    expect(counts[0]).toBe(4); // 1 correct + 3 distractors
  });

  it('borrows only from the same topic', () => {
    // Topic t1 has rich distractors; topic t2 has a rule with none.
    const rules = [
      rule({
        id: 'rich',
        topicoId: 't1',
        respostaCerta: 'R',
        distratores: ['a', 'b', 'c', 'd', 'e'],
      }),
      rule({ id: 'poor', topicoId: 't2', respostaCerta: 'P', distratores: [] }),
    ];
    const session = buildMultipleChoiceSession(rules, 'sess');
    const poor = session.items.find((i) => i.regraId === 'poor');
    // The poor rule's options must NOT contain topic t1's distractors (a–e).
    if (poor) {
      for (const opt of poor.options) {
        expect(['a', 'b', 'c', 'd', 'e']).not.toContain(opt);
      }
    }
  });

  it('produces a valid question for a rule with zero distractors (via borrowing)', () => {
    const rules = [
      rule({ id: 'sib', topicoId: 't1', respostaCerta: 'SIB', distratores: ['s1', 's2', 's3'] }),
      rule({ id: 'zero', topicoId: 't1', respostaCerta: 'ZERO', distratores: [] }),
    ];
    const session = buildMultipleChoiceSession(rules, 'sess');
    const zero = session.items.find((i) => i.regraId === 'zero');
    expect(zero).toBeDefined();
    if (zero) {
      expect(zero.options).toHaveLength(4);
      expect(zero.options[zero.correctIndex]).toBe('ZERO');
    }
  });

  it('is deterministic: same session id → same option order', () => {
    const rules = [
      rule({ id: 'a', distratores: ['x', 'y', 'z'] }),
      rule({ id: 'b', distratores: ['p', 'q', 'r'] }),
    ];
    const s1 = buildMultipleChoiceSession(rules, 'fixed-id');
    const s2 = buildMultipleChoiceSession(rules, 'fixed-id');
    expect(s1.items.map((i) => i.options)).toEqual(s2.items.map((i) => i.options));
    expect(s1.items.map((i) => i.correctIndex)).toEqual(s2.items.map((i) => i.correctIndex));
  });

  it('different session ids produce (generally) different option orders', () => {
    const rules = [rule({ id: 'a', distratores: ['x', 'y', 'z', 'w', 'v'] })];
    const s1 = buildMultipleChoiceSession(rules, 'id-1');
    const s2 = buildMultipleChoiceSession(rules, 'id-2');
    // With 5 options the chance of an identical order is negligible.
    expect(s1.items[0]?.options).not.toEqual(s2.items[0]?.options);
  });
});

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 'seed');
    const b = seededShuffle([1, 2, 3, 4, 5], 'seed');
    expect(a).toEqual(b);
  });

  it('preserves all elements (a permutation)', () => {
    const shuffled = seededShuffle([1, 2, 3, 4, 5, 6, 7], 's');
    expect([...shuffled].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    seededShuffle(input, 's');
    expect(input).toEqual(copy);
  });
});
