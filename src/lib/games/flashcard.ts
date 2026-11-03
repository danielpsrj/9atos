import type { FlashcardItem, FlashcardSession, GameRule } from './types';

// Plan §2.4 / spec §1: flashcard builder. The simplest game type — validates the
// engine pipeline end-to-end. Input order is preserved (the scheduler already
// ordered by urgency). Optional fields are omitted cleanly when null.

/**
 * Build a flashcard session from an ordered list of rules.
 *
 * - front = pergunta
 * - back = respostaCerta
 * - justificativa / dica are included only when the rule has them (non-null).
 */
export function buildFlashcardSession(rules: GameRule[], sessionId: string): FlashcardSession {
  const items: FlashcardItem[] = rules.map((rule) => {
    const item: FlashcardItem = {
      regraId: rule.id,
      front: rule.pergunta,
      back: rule.respostaCerta,
    };
    if (rule.justificativa !== null) item.justificativa = rule.justificativa;
    if (rule.dica !== null) item.dica = rule.dica;
    return item;
  });
  return { id: sessionId, type: 'flashcard', items };
}
