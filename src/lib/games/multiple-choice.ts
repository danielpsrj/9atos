import type { GameRule, MultipleChoiceItem, MultipleChoiceSession } from './types';

// Plan §2.4 / spec §1, §2.2, AD-03: multiple choice builder with distractor
// borrowing. Each question has 1 correct answer + N distractors. When a rule's
// own distratores are insufficient, we borrow from sibling rules in the same
// topic. The option order is a deterministic seeded shuffle keyed by session id
// (same session id → same option order, AD-03).

/** Default number of distractors per question (total options = 1 + N). */
const DEFAULT_DISTRACTORS = 3;

/** FNV-1a string hash → 32-bit unsigned seed. */
function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — a small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle seeded by a string. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  const rand = mulberry32(hashSeed(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Build a multiple choice session. Every question has exactly
 * `1 + distractorCount` options. The correct answer is never duplicated among
 * the options. Distractor shortage is filled by borrowing from same-topic
 * siblings (AD-03); a rule with zero distractors still yields a valid question.
 */
export function buildMultipleChoiceSession(
  rules: GameRule[],
  sessionId: string,
  distractorCount: number = DEFAULT_DISTRACTORS,
): MultipleChoiceSession {
  // Pool of all distractors per topic, for borrowing.
  const topicPools = new Map<string, string[]>();
  for (const rule of rules) {
    const pool = topicPools.get(rule.topicoId) ?? [];
    for (const d of rule.distratores) pool.push(d);
    topicPools.set(rule.topicoId, pool);
  }

  const items: MultipleChoiceItem[] = rules.map((rule) => {
    const own = rule.distratores.filter((d) => d !== rule.respostaCerta);
    const distractors: string[] = [...own];

    // Borrow from same-topic siblings when short (never the correct answer,
    // never a duplicate).
    if (distractors.length < distractorCount) {
      const pool = (topicPools.get(rule.topicoId) ?? []).filter(
        (d) => d !== rule.respostaCerta && !distractors.includes(d),
      );
      for (const d of pool) {
        if (distractors.length >= distractorCount) break;
        distractors.push(d);
      }
    }

    const options = seededShuffle([rule.respostaCerta, ...distractors], `${sessionId}:${rule.id}`);
    const correctIndex = options.indexOf(rule.respostaCerta);
    return { regraId: rule.id, question: rule.pergunta, options, correctIndex };
  });

  return { id: sessionId, type: 'multiple-choice', items };
}
