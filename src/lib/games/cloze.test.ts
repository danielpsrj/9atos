import { describe, it, expect } from 'vitest';
import { buildClozeSession, longestWordSpan, validateClozeAnswer } from './cloze';
import type { GameRule } from './types';

function rule(overrides: Partial<GameRule> = {}): GameRule {
  return {
    id: 'r1',
    pergunta: 'Q?',
    respostaCerta: 'answer',
    justificativa: null,
    dica: null,
    distratores: [],
    topicoId: 't1',
    ...overrides,
  };
}

describe('longestWordSpan', () => {
  it('single word → 1-word span', () => {
    const span = longestWordSpan('Democracia');
    expect(span.span).toBe('Democracia');
    expect(span.wordCount).toBe(1);
  });

  it('single phrase (no sentence punctuation) → the whole phrase', () => {
    const span = longestWordSpan('A dignidade da pessoa humana');
    expect(span.span).toBe('A dignidade da pessoa humana');
    expect(span.wordCount).toBe(5);
  });

  it('two clauses → the longer clause wins', () => {
    const span = longestWordSpan('A dignidade da pessoa humana. É um fundamento.');
    expect(span.span).toBe('A dignidade da pessoa humana');
    expect(span.wordCount).toBe(5);
  });

  it('keeps commas inside a clause', () => {
    const span = longestWordSpan('Soberania, cidadania e dignidade. Pluralismo.');
    expect(span.span).toBe('Soberania, cidadania e dignidade');
    expect(span.wordCount).toBe(4);
  });

  it('span region covers the words (plus any trailing punctuation) inside the text', () => {
    const text = 'A dignidade da pessoa humana. É um fundamento.';
    const span = longestWordSpan(text);
    // The masked region starts at the span and may extend over trailing punctuation.
    expect(text.slice(span.start, span.end)).toBe('A dignidade da pessoa humana.');
    expect(span.span).toBe('A dignidade da pessoa humana');
  });
});

describe('buildClozeSession', () => {
  it('single-word answer → the question is the context, the answer is the blank (issue #68)', () => {
    const session = buildClozeSession(
      [rule({ pergunta: 'A capital do Brasil é', respostaCerta: 'Brasília' })],
      's',
    );
    const item = session.items[0];
    expect(item).toBeDefined();
    if (item) {
      expect(item.gap).toBe('Brasília');
      expect(item.sentence).toBe('A capital do Brasil é ___');
      expect(item.answer).toBe('Brasília');
    }
  });

  it('multi-word answer → the whole answer is masked, the question is the context', () => {
    const session = buildClozeSession(
      [
        rule({
          pergunta: 'Quem escreveu Dom Casmurro?',
          respostaCerta: 'Machado de Assis',
        }),
      ],
      's',
    );
    const item = session.items[0];
    if (item) {
      expect(item.gap).toBe('Machado de Assis');
      expect(item.sentence).toBe('Quem escreveu Dom Casmurro? ___');
      expect(item.answer).toBe('Machado de Assis');
    }
  });

  it('the sentence always has surrounding context (never just the blank) when the question is present', () => {
    const session = buildClozeSession(
      [rule({ pergunta: 'Qual é o fundamento?', respostaCerta: 'Democracia' })],
      's',
    );
    const item = session.items[0];
    if (item) {
      // The sentence must contain the question as context, not be just "___".
      expect(item.sentence).not.toBe('___');
      expect(item.sentence).toContain('Qual é o fundamento?');
      expect(item.sentence).toContain('___');
      // The gap (the answer) is not left visible in the sentence.
      expect(item.sentence).not.toContain(item.gap);
    }
  });

  it('masks the appended answer even when the question contains it (lastIndexOf)', () => {
    const session = buildClozeSession(
      [rule({ pergunta: 'Brasília é a capital', respostaCerta: 'Brasília' })],
      's',
    );
    const item = session.items[0];
    if (item) {
      // The appended answer (at the end) is masked, not the one inside the question.
      expect(item.sentence).toBe('Brasília é a capital ___');
      expect(item.gap).toBe('Brasília');
    }
  });

  it('is deterministic: same rule → same sentence and gap', () => {
    const r = rule({ pergunta: 'Quem escreveu Dom Casmurro?', respostaCerta: 'Machado de Assis' });
    const s1 = buildClozeSession([r], 'a');
    const s2 = buildClozeSession([r], 'b');
    expect(s1.items[0]?.gap).toBe(s2.items[0]?.gap);
    expect(s1.items[0]?.sentence).toBe(s2.items[0]?.sentence);
  });
});

describe('validateClozeAnswer', () => {
  it('accepts case-insensitive, whitespace-normalized matches', () => {
    expect(
      validateClozeAnswer('a  dignidade   da pessoa humana', 'A dignidade da pessoa humana'),
    ).toBe(true);
    expect(
      validateClozeAnswer('  A DIGNIDADE DA PESSOA HUMANA  ', 'A dignidade da pessoa humana'),
    ).toBe(true);
  });

  it('rejects wrong answers', () => {
    expect(validateClozeAnswer('soberania', 'A dignidade da pessoa humana')).toBe(false);
    expect(validateClozeAnswer('', 'A dignidade da pessoa humana')).toBe(false);
  });
});
