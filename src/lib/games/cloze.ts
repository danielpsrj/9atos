import type { ClozeItem, ClozeSession, GameRule } from './types';

// Plan §2.4 / spec §1, AD-04: cloze builder. The sentence is composed from the
// rule's pergunta (question) and respostaCerta (answer) so there is always
// surrounding context (issue #68). The gap is the answer, masked as a blank at
// the end of the composed sentence. Deterministic, no LLM. The exact answer is
// stored for validation (case/whitespace-insensitive).

const BLANK = '___';

export interface WordSpan {
  /** The masked span text (the words joined by single spaces). */
  span: string;
  /** Start index of the span in the original string. */
  start: number;
  /** End index (exclusive) of the span in the original string. */
  end: number;
  /** Number of words in the span. */
  wordCount: number;
}

/**
 * Find the longest contiguous word span in a text. A word span is a maximal run
 * of consecutive words (single-space separated). The longest such run is the
 * whole text when it is a single phrase; for multi-clause text (separated by
 * punctuation) it is the longest clause. Single-word text yields a 1-word span.
 */
export function longestWordSpan(text: string): WordSpan {
  // Split into clauses on sentence-ending punctuation followed by whitespace
  // (commas/semicolons stay inside a clause). A single-phrase answer yields one
  // clause, so its whole span is the gap.
  const clauses = text
    .split(/(?<=[.!?])\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const source = clauses.length > 0 ? clauses : [text];

  let best: WordSpan = { span: '', start: 0, end: 0, wordCount: 0 };
  for (const clause of source) {
    // The span is the pure words; the masked region (start..end) also covers any
    // trailing sentence punctuation so it isn't left as a visible hint.
    const clean = clause.replace(/[.!?]+$/, '').trim();
    const words = clean.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) continue;
    const spanText = words.join(' ');
    const start = text.indexOf(clean);
    const end = start + clause.trim().length; // includes trailing punctuation
    const wordCount = words.length;
    // Longest by word count; ties broken by earliest occurrence.
    if (wordCount > best.wordCount) {
      best = { span: spanText, start, end, wordCount };
    }
  }
  return best;
}

/**
 * Build a cloze session. The sentence is composed from the rule's `pergunta`
 * (question) and `respostaCerta` (answer) so that even a single-word answer has
 * surrounding context (issue #68). The gap is the answer itself, masked as a
 * blank at the end of the composed sentence. `lastIndexOf` is used so the
 * appended answer is the one masked, even if the question happens to contain it.
 * Deterministic: the same rule always produces the same sentence and gap.
 */
export function buildClozeSession(rules: GameRule[], sessionId: string): ClozeSession {
  const items: ClozeItem[] = rules.map((rule) => {
    const answer = rule.respostaCerta;
    // Compose the sentence from the question and the answer. The question is the
    // context; the answer is appended and then masked as the blank.
    const composed = `${rule.pergunta} ${answer}`.trim();
    const answerIndex = composed.lastIndexOf(answer);
    const sentence =
      answerIndex >= 0
        ? composed.slice(0, answerIndex) + BLANK + composed.slice(answerIndex + answer.length)
        : BLANK;
    return {
      regraId: rule.id,
      sentence,
      gap: answer,
      answer,
    };
  });
  return { id: sessionId, type: 'cloze', items };
}

/**
 * Validate a cloze answer: case-insensitive, whitespace-normalized exact match.
 */
export function validateClozeAnswer(given: string, expected: string): boolean {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(given) === normalize(expected);
}
