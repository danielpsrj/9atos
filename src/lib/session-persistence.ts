import type { GameSession, SessionResult } from '@/lib/games';

// In-progress session persistence (issues #57, #60). The study session is
// entirely client-side state; without persistence, navigating away (the left
// nav, the Exit button) discards the in-progress game and the grades collected
// so far. This module persists the session to localStorage keyed by notebook +
// game, so the user can leave and come back to the exact same game, and the
// grades are only synced (saved as statistics) when the session is completed.
//
// The persisted state is the full client session state: the game items (so the
// exact sampled set is preserved), the current position, the grades collected,
// the phase, and the matching-game selection state. It is cleared once the
// session completes and its single sync has fired.

/** The shape the start API returns (a GameSession plus the resolved user id). */
export type StartResponse = GameSession & { usuarioId: string };

/** The session phase (mirrors the StudySession `Phase` type). */
export type SessionPhase = 'playing' | 'results';

/** The full in-progress session state persisted to localStorage. */
export interface PersistedSessionState {
  session: StartResponse;
  currentIndex: number;
  grades: SessionResult[];
  phase: SessionPhase;
  /** Matching game: the set of matched pair regraIds (as an array). */
  matchedIds: string[];
  /** Matching game: the set of ever-missed pair regraIds (as an array). */
  missedIds: string[];
  zenMode: boolean;
}

const KEY_PREFIX = '9atos:session:';

/** The localStorage key for a notebook + game session. */
export function sessionStorageKey(cadernoId: string, game: string): string {
  return `${KEY_PREFIX}${cadernoId}:${game}`;
}

/**
 * Persist the in-progress session state. Returns false when the write fails
 * (e.g. storage full or unavailable) so the caller can surface a warning.
 */
export function saveSessionState(
  cadernoId: string,
  game: string,
  state: PersistedSessionState,
): boolean {
  try {
    window.localStorage.setItem(sessionStorageKey(cadernoId, game), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a persisted in-progress session state, or null when there is none (or
 * the stored value is malformed). Only a 'playing' phase is restorable — a
 * 'results' phase means the session already completed and was synced.
 */
export function loadSessionState(cadernoId: string, game: string): PersistedSessionState | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(cadernoId, game));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<PersistedSessionState>;
    if (candidate.session === undefined) return null;
    if (candidate.phase !== 'playing') return null;
    return candidate as PersistedSessionState;
  } catch {
    return null;
  }
}

/** Clear the persisted session state (called once the session completes). */
export function clearSessionState(cadernoId: string, game: string): void {
  try {
    window.localStorage.removeItem(sessionStorageKey(cadernoId, game));
  } catch {
    // Ignore — clearing is best-effort.
  }
}
