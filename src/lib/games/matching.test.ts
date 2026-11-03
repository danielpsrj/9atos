import { describe, it, expect } from 'vitest';
import { buildMatchSession, MIN_MATCH_PAIRS } from './matching';
import type { GameRule } from './types';

function rule(overrides: Partial<GameRule> = {}): GameRule {
  return {
    id: 'r1',
    pergunta: 'Concept',
    respostaCerta: 'Definition',
    justificativa: null,
    dica: null,
    distratores: [],
    topicoId: 't1',
    ...overrides,
  };
}

function makeRules(n: number): GameRule[] {
  return Array.from({ length: n }, (_, i) => {
    const label = String(i);
    return rule({
      id: `r${label}`,
      pergunta: `Concept ${label}`,
      respostaCerta: `Definition ${label}`,
    });
  });
}

describe('buildMatchSession', () => {
  it('preserves the bijection: every concept maps to exactly one definition and vice versa', () => {
    const rules = makeRules(5);
    const session = buildMatchSession(rules, 'sess');
    // Each pair's concept and definition come from the same rule.
    for (const pair of session.pairs) {
      const source = rules.find((r) => r.id === pair.regraId);
      expect(source).toBeDefined();
      if (source) {
        expect(pair.concept).toBe(source.pergunta);
        expect(pair.definition).toBe(source.respostaCerta);
      }
    }
    // No concept appears twice, no definition appears twice.
    const concepts = session.pairs.map((p) => p.concept);
    const definitions = session.pairs.map((p) => p.definition);
    expect(new Set(concepts).size).toBe(concepts.length);
    expect(new Set(definitions).size).toBe(definitions.length);
  });

  it('shuffles the two columns independently (not the identity mapping)', () => {
    const rules = makeRules(6);
    const session = buildMatchSession(rules, 'sess');
    // The left and right columns must not be in the same rule order.
    const leftOrder = session.leftColumn.map((e) => e.regraId);
    const rightOrder = session.rightColumn.map((e) => e.regraId);
    expect(leftOrder).not.toEqual(rightOrder);
    // Both columns contain exactly the same set of regraIds.
    expect([...leftOrder].sort()).toEqual([...rightOrder].sort());
  });

  it('tops up to exactly 4 pairs when the input has fewer than 4 rules', () => {
    const input = makeRules(2);
    const pool = makeRules(6); // includes the 2 input rules + 4 more
    const session = buildMatchSession(input, 'sess', pool);
    expect(session.pairs).toHaveLength(MIN_MATCH_PAIRS);
    expect(session.leftColumn).toHaveLength(MIN_MATCH_PAIRS);
    expect(session.rightColumn).toHaveLength(MIN_MATCH_PAIRS);
    // The topped-up rules come from the pool.
    const ids = session.pairs.map((p) => p.regraId);
    expect(ids).toContain('r0');
    expect(ids).toContain('r1');
  });

  it('does not duplicate rules when topping up', () => {
    const input = makeRules(3);
    const pool = makeRules(6);
    const session = buildMatchSession(input, 'sess', pool);
    const ids = session.pairs.map((p) => p.regraId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(MIN_MATCH_PAIRS);
  });

  it('is deterministic per session id', () => {
    const rules = makeRules(5);
    const s1 = buildMatchSession(rules, 'fixed');
    const s2 = buildMatchSession(rules, 'fixed');
    expect(s1.leftColumn).toEqual(s2.leftColumn);
    expect(s1.rightColumn).toEqual(s2.rightColumn);
  });

  it('keeps a session with >=4 rules unchanged in size (no top-up needed)', () => {
    const rules = makeRules(5);
    const session = buildMatchSession(rules, 'sess');
    expect(session.pairs).toHaveLength(5);
  });
});
