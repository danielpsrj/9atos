import { describe, it, expect } from 'vitest';
import { buildFlashcardSession } from './flashcard';
import type { GameRule } from './types';

function rule(overrides: Partial<GameRule> = {}): GameRule {
  return {
    id: 'r1',
    pergunta: 'Pergunta?',
    respostaCerta: 'Resposta certa',
    justificativa: null,
    dica: null,
    distratores: ['a', 'b', 'c'],
    topicoId: 't1',
    ...overrides,
  };
}

describe('buildFlashcardSession', () => {
  it('produces exactly one card per input rule, in input order', () => {
    const rules = [
      rule({ id: 'a', pergunta: 'Q1' }),
      rule({ id: 'b', pergunta: 'Q2' }),
      rule({ id: 'c', pergunta: 'Q3' }),
    ];
    const session = buildFlashcardSession(rules, 'sess-1');
    expect(session.items).toHaveLength(3);
    expect(session.items.map((i) => i.regraId)).toEqual(['a', 'b', 'c']);
    expect(session.items.map((i) => i.front)).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('maps front=pergunta and back=respostaCerta', () => {
    const session = buildFlashcardSession(
      [rule({ pergunta: 'What?', respostaCerta: 'This.' })],
      's',
    );
    expect(session.items).toHaveLength(1);
    expect(session.items[0]?.front).toBe('What?');
    expect(session.items[0]?.back).toBe('This.');
  });

  it('includes justificativa and dica when present', () => {
    const session = buildFlashcardSession(
      [rule({ justificativa: 'Because.', dica: 'A hint.' })],
      's',
    );
    expect(session.items[0]?.justificativa).toBe('Because.');
    expect(session.items[0]?.dica).toBe('A hint.');
  });

  it('omits justificativa and dica cleanly when null', () => {
    const session = buildFlashcardSession([rule({ justificativa: null, dica: null })], 's');
    const item = session.items[0];
    expect(item).toBeDefined();
    expect('justificativa' in (item ?? {})).toBe(false);
    expect('dica' in (item ?? {})).toBe(false);
  });

  it('produces an empty session for an empty rule list', () => {
    const session = buildFlashcardSession([], 's');
    expect(session.items).toHaveLength(0);
    expect(session.type).toBe('flashcard');
    expect(session.id).toBe('s');
  });
});
