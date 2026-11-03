// Plan §2.4 / spec §1, §5.2: type foundation for the game engine (AD-03 — games
// are pure functions of Regra[]). All types are strict-mode clean and compile
// under the extended §2.4 flags (noUncheckedIndexedAccess et al.).

/** The rule shape the engine consumes (the scheduler's output, minus SRS state). */
export interface GameRule {
  id: string;
  pergunta: string;
  respostaCerta: string;
  justificativa: string | null;
  dica: string | null;
  distratores: string[];
  topicoId: string;
}

/** The four game types (spec §1). */
export type GameType = 'flashcard' | 'multiple-choice' | 'matching' | 'cloze';

/**
 * The per-rule grade payload produced after a session and consumed by the sync
 * endpoint (FR-06, spec §6). `qualidade` is the 4-button grade: 1 (Missed),
 * 3 (Hard), 4 (Good), 5 (Easy).
 */
export interface SessionResult {
  regraId: string;
  qualidade: number;
}

// ── Flashcard ────────────────────────────────────────────────────────────────

/** One flashcard. `front` is shown first; `back` is revealed on flip. */
export interface FlashcardItem {
  regraId: string;
  front: string;
  back: string;
  /** Present only when the rule has a justificativa. */
  justificativa?: string;
  /** Present only when the rule has a dica. */
  dica?: string;
}

/** A flashcard session: an ordered list of cards (input order preserved). */
export interface FlashcardSession {
  id: string;
  type: 'flashcard';
  items: FlashcardItem[];
}

// ── Multiple choice ──────────────────────────────────────────────────────────

/** One MC question. `options[correctIndex]` is the correct answer. */
export interface MultipleChoiceItem {
  regraId: string;
  question: string;
  options: string[];
  correctIndex: number;
}

/** An MC session. Every question has the same number of options. */
export interface MultipleChoiceSession {
  id: string;
  type: 'multiple-choice';
  items: MultipleChoiceItem[];
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** One side of a match column. */
export interface MatchColumnEntry {
  regraId: string;
  text: string;
}

/** The correct concept→definition pairing for one rule. */
export interface MatchPair {
  regraId: string;
  concept: string;
  definition: string;
}

/**
 * A matching session. `leftColumn` (concepts) and `rightColumn` (definitions)
 * are shuffled independently; `pairs` holds the correct bijection the UI checks
 * against. At least 4 pairs (AD-14).
 */
export interface MatchSession {
  id: string;
  type: 'matching';
  leftColumn: MatchColumnEntry[];
  rightColumn: MatchColumnEntry[];
  pairs: MatchPair[];
}

// ── Cloze (fill-in-the-blanks) ───────────────────────────────────────────────

/** One cloze item: a sentence with a masked gap and the exact answer. */
export interface ClozeItem {
  regraId: string;
  /** The sentence with the gap rendered as a blank (e.g. "___"). */
  sentence: string;
  /** The masked span — the longest contiguous word span of the answer. */
  gap: string;
  /** The exact answer string for validation (case/whitespace-insensitive). */
  answer: string;
}

/** A cloze session. */
export interface ClozeSession {
  id: string;
  type: 'cloze';
  items: ClozeItem[];
}

/** Union of all session types. */
export type GameSession = FlashcardSession | MultipleChoiceSession | MatchSession | ClozeSession;
