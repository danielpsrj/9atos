import { describe, it, expect, beforeEach } from 'vitest';
import {
  sessionStorageKey,
  saveSessionState,
  loadSessionState,
  clearSessionState,
  type PersistedSessionState,
} from './session-persistence';

// In-memory localStorage mock for the node test environment (the persistence
// helper is a thin, try/catch-wrapped wrapper over window.localStorage).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

function makeState(overrides: Partial<PersistedSessionState> = {}): PersistedSessionState {
  return {
    session: {
      id: 'sess-1',
      type: 'flashcard',
      items: [{ regraId: 'regra-1', front: 'F', back: 'B' }],
      usuarioId: 'usuario-1',
    },
    currentIndex: 0,
    grades: [],
    phase: 'playing',
    matchedIds: [],
    missedIds: [],
    zenMode: true,
    ...overrides,
  };
}

describe('session persistence (issues #57, #60)', () => {
  beforeEach(() => {
    (globalThis as { window: unknown }).window = { localStorage: new MemoryStorage() };
  });

  it('sessionStorageKey namespaces by notebook + game', () => {
    expect(sessionStorageKey('cad-1', 'flashcards')).toBe('9atos:session:cad-1:flashcards');
  });

  it('save then load round-trips the full state', () => {
    const state = makeState({
      currentIndex: 2,
      grades: [{ regraId: 'regra-1', qualidade: 4 }],
      matchedIds: ['regra-1'],
      missedIds: ['regra-2'],
      zenMode: false,
    });
    expect(saveSessionState('cad-1', 'flashcards', state)).toBe(true);
    expect(loadSessionState('cad-1', 'flashcards')).toEqual(state);
  });

  it('load returns null when nothing is stored', () => {
    expect(loadSessionState('cad-1', 'flashcards')).toBeNull();
  });

  it('load returns null for a results-phase state (not restorable)', () => {
    saveSessionState('cad-1', 'flashcards', makeState({ phase: 'results' }));
    expect(loadSessionState('cad-1', 'flashcards')).toBeNull();
  });

  it('load returns null for malformed JSON', () => {
    (window.localStorage as unknown as MemoryStorage).setItem(
      '9atos:session:cad-1:flashcards',
      '{not valid json',
    );
    expect(loadSessionState('cad-1', 'flashcards')).toBeNull();
  });

  it('load returns null when the stored value is not an object', () => {
    (window.localStorage as unknown as MemoryStorage).setItem(
      '9atos:session:cad-1:flashcards',
      '"a string"',
    );
    expect(loadSessionState('cad-1', 'flashcards')).toBeNull();
  });

  it('clear removes the stored state', () => {
    saveSessionState('cad-1', 'flashcards', makeState());
    clearSessionState('cad-1', 'flashcards');
    expect(loadSessionState('cad-1', 'flashcards')).toBeNull();
  });

  it('save returns false when storage throws (quota / unavailable)', () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    (globalThis as { window: unknown }).window = { localStorage: throwing };
    expect(saveSessionState('cad-1', 'flashcards', makeState())).toBe(false);
  });

  it('clear is a no-op (does not throw) when storage throws', () => {
    const throwing = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('storage unavailable');
      },
    };
    (globalThis as { window: unknown }).window = { localStorage: throwing };
    expect(() => {
      clearSessionState('cad-1', 'flashcards');
    }).not.toThrow();
  });
});
