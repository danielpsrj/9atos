import type { GameRule, MatchColumnEntry, MatchPair, MatchSession } from './types';
import { seededShuffle } from './multiple-choice';

// Plan §2.4 / spec §5.2 (Screen 2), AD-14: matching builder. Each concept
// (pergunta) is paired with its definition (respostaCerta) — a perfect
// bijection. The two columns are shuffled independently. The ≥4-pair minimum is
// enforced by topping up from a pool of additional rules when the input is short.

/** AD-14: a matching session needs at least this many pairs. */
export const MIN_MATCH_PAIRS = 4;

/**
 * Build a matching session.
 *
 * - `pairs` is the correct concept→definition bijection (one per rule).
 * - `leftColumn` (concepts) and `rightColumn` (definitions) are shuffled
 *   independently, so the mapping is not the trivial identity.
 * - If fewer than `MIN_MATCH_PAIRS` rules are supplied, they are topped up from
 *   `topUpPool` (the rest of the notebook, or the whole knowledge base) until
 *   the minimum is met. Deterministic per session id.
 */
export function buildMatchSession(
  rules: GameRule[],
  sessionId: string,
  topUpPool: GameRule[] = [],
): MatchSession {
  const selected: GameRule[] = [...rules];
  if (selected.length < MIN_MATCH_PAIRS) {
    const existing = new Set(selected.map((r) => r.id));
    for (const candidate of topUpPool) {
      if (selected.length >= MIN_MATCH_PAIRS) break;
      if (!existing.has(candidate.id)) {
        selected.push(candidate);
        existing.add(candidate.id);
      }
    }
  }

  const pairs: MatchPair[] = selected.map((r) => ({
    regraId: r.id,
    concept: r.pergunta,
    definition: r.respostaCerta,
  }));

  const leftColumn: MatchColumnEntry[] = seededShuffle(
    selected.map((r) => ({ regraId: r.id, text: r.pergunta })),
    `${sessionId}:left`,
  );
  const rightColumn: MatchColumnEntry[] = seededShuffle(
    selected.map((r) => ({ regraId: r.id, text: r.respostaCerta })),
    `${sessionId}:right`,
  );

  return { id: sessionId, type: 'matching', leftColumn, rightColumn, pairs };
}
