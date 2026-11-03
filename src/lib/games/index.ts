// Barrel export for the game engine (Phase 3). API routes (Phase 4) import from
// here, never from individual builder files.
export type {
  GameRule,
  GameType,
  SessionResult,
  FlashcardItem,
  FlashcardSession,
  MultipleChoiceItem,
  MultipleChoiceSession,
  MatchColumnEntry,
  MatchPair,
  MatchSession,
  ClozeItem,
  ClozeSession,
  GameSession,
} from './types';

export { buildFlashcardSession } from './flashcard';
export { buildMultipleChoiceSession, seededShuffle } from './multiple-choice';
export { buildMatchSession, MIN_MATCH_PAIRS } from './matching';
export { buildClozeSession, longestWordSpan, validateClozeAnswer } from './cloze';
export { Grade, mapDirectGrades, mapMatchingGrades, mapClozeGrades } from './grade-mapping';
export type { ButtonGrade } from './grade-mapping';
