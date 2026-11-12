'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SessionChrome } from '@/components/session/session-chrome';
import { SessionSkeleton } from '@/components/session/session-skeleton';
import { FlashcardGame } from '@/components/session/flashcard-game';
import { MatchingGame } from '@/components/session/matching-game';
import { MultipleChoiceGame } from '@/components/session/multiple-choice-game';
import { ClozeGame } from '@/components/session/cloze-game';
import { ResultsSummary } from '@/components/session/results-summary';
import {
  type GameSession,
  type MatchColumnEntry,
  type MatchPair,
  type SessionResult,
} from '@/lib/games';
import { clearSessionState, loadSessionState, saveSessionState } from '@/lib/session-persistence';

// Study session (issues #37–#43). The client-side session flow: start a session
// via the API, render the session chrome (progress bar, Exit, Zen/timer toggle)
// around the game, collect grades as the user plays, and on completion show the
// results summary and fire exactly one sync (idempotent per sessionId). All four
// games plug into the same chrome: flashcard (#38), matching (#39), multiple
// choice (#40), and cloze (#41). Zen Mode is the default (AD-12): the session
// starts untimed. The timer countdown (#43) applies to the one-item-at-a-time
// games (flashcard, MC, cloze); matching has no single "current card" to time.
type Phase = 'loading' | 'playing' | 'results';

type StartResponse = GameSession & { usuarioId: string };

export function StudySession() {
  const t = useTranslations('Session');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cadernoId = searchParams.get('cadernoId') ?? '';
  const game = searchParams.get('game') ?? 'flashcards';

  const [session, setSession] = useState<StartResponse | null>(null);
  const [usuarioId, setUsuarioId] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grades, setGrades] = useState<SessionResult[]>([]);
  // The set of regraIds that have been graded (issue #59). Drives the
  // done/remaining count: a card counts as "done" once it has been graded,
  // regardless of the current browse position (the prev/next arrows let the
  // user move between cards without solving them).
  const [gradedIds, setGradedIds] = useState<ReadonlySet<string>>(new Set());
  const [zenMode, setZenMode] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  // The configured per-card seconds (from settings, AD-12); defaults to 30.
  const [cardSeconds, setCardSeconds] = useState(30);
  const [phase, setPhase] = useState<Phase>('loading');
  const [nextReviews, setNextReviews] = useState<{ regraId: string; proximaRevisao: string }[]>([]);
  // Idempotency guard: ensures the sync fires exactly once per session.
  const syncedRef = useRef(false);

  // Matching game state (#39): the matched pairs, the current selection, the
  // beam/error animation targets, and the set of ever-missed pairs (for the
  // q=1 vs q=4 grade).
  const [matchedIds, setMatchedIds] = useState<ReadonlySet<string>>(new Set());
  const [missedIds, setMissedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<MatchColumnEntry | null>(null);
  const [selectedRight, setSelectedRight] = useState<MatchColumnEntry | null>(null);
  const [beamPair, setBeamPair] = useState<MatchPair | null>(null);
  const [errorPair, setErrorPair] = useState<{
    left: MatchColumnEntry;
    right: MatchColumnEntry;
  } | null>(null);

  // Fetch the configured per-card timer seconds (AD-12) so timed mode honors
  // the user's settings (issue #43). Defaults to 30 s when the fetch fails.
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = (await res.json()) as { segundosPorCartao: number };
        if (!cancelled) setCardSeconds(data.segundosPorCartao);
      } catch {
        // Keep the default.
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  // Start the session on mount — or restore an in-progress one (issues #57,
  // #60). If a 'playing' session was persisted for this notebook + game, resume
  // it exactly where the user left off (same sampled items, position, grades,
  // matching selections, and Zen/timer mode) instead of calling the start API,
  // which would re-sample a fresh set and discard the collected grades.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      // Restore a persisted in-progress session, if any.
      const persisted = loadSessionState(cadernoId, game);
      if (persisted !== null) {
        if (cancelled) return;
        setSession(persisted.session);
        setUsuarioId(persisted.session.usuarioId);
        setCurrentIndex(persisted.currentIndex);
        setGrades(persisted.grades);
        // Rebuild the graded-card set from the persisted grades (issue #59):
        // the done/remaining count and the completion check depend on it.
        setGradedIds(new Set(persisted.grades.map((g) => g.regraId)));
        setMatchedIds(new Set(persisted.matchedIds));
        setMissedIds(new Set(persisted.missedIds));
        setZenMode(persisted.zenMode);
        setPhase('playing');
        return;
      }
      try {
        const res = await fetch('/api/study/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cadernoId, gameType: game }),
        });
        if (!res.ok) {
          if (!cancelled) setStartError(t('startError'));
          return;
        }
        const data = (await res.json()) as StartResponse;
        if (cancelled) return;
        setSession(data);
        setUsuarioId(data.usuarioId);
        setPhase('playing');
      } catch {
        if (!cancelled) setStartError(t('startError'));
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadernoId, game]);

  // Persist the in-progress session on every change while playing (issues #57,
  // #60). The full state (sampled items, position, grades, matching selections,
  // Zen/timer mode) is written to localStorage so the user can leave and come
  // back to the exact same game. Cleared once the session completes and syncs.
  useEffect(() => {
    if (phase !== 'playing' || session === null) return;
    saveSessionState(cadernoId, game, {
      session,
      currentIndex,
      grades,
      phase: 'playing',
      matchedIds: [...matchedIds],
      missedIds: [...missedIds],
      zenMode,
    });
  }, [phase, session, cadernoId, game, currentIndex, grades, matchedIds, missedIds, zenMode]);

  // The total number of items in the session (for the progress bar). Matching
  // sessions count pairs; the other games count items.
  const total =
    session === null
      ? 0
      : session.type === 'matching'
        ? session.pairs.length
        : session.items.length;

  // The number of completed items (for the progress bar + done/remaining count,
  // issue #59). Matching counts matched pairs; the other games count the cards
  // that have been graded (not the browse position — the prev/next arrows let
  // the user move between cards without solving them).
  const completed = session?.type === 'matching' ? matchedIds.size : gradedIds.size;

  // Record a grade without advancing. Used by the MC game's feedback phase (the
  // grade is recorded when the user answers; the advance happens when the user
  // clicks "next"). Also marks the card as graded (issue #59) so the
  // done/remaining count and the completion check reflect it. A card is graded
  // at most once (first grade wins): browsing back to an already-graded card
  // with the prev/next arrows and re-answering it does not create a duplicate
  // entry in the sync payload.
  const recordGrade = useCallback(
    (regraId: string, qualidade: number) => {
      if (gradedIds.has(regraId)) return; // Already graded: first grade wins.
      setGrades((prev) => [...prev, { regraId, qualidade }]);
      setGradedIds((prev) => new Set(prev).add(regraId));
    },
    [gradedIds],
  );

  // Advance to the next item (clamped to the last card). Used by the MC game's
  // "next" button after the feedback phase. Completion is driven by the graded
  // count (the effect below), not by the index, so browsing with the prev/next
  // arrows never ends the session early (issue #59).
  const advance = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
  }, [total]);

  // Record a grade and advance to the next item. Used by the one-item-at-a-time
  // games (flashcard, cloze) and the timer expiry.
  const handleGrade = useCallback(
    (regraId: string, qualidade: number) => {
      recordGrade(regraId, qualidade);
      setCurrentIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
    },
    [recordGrade, total],
  );

  // Browse to the previous/next card WITHOUT solving it (issue #59). The
  // prev/next arrows in the session chrome call these; they only move the
  // browse position, so no grade is recorded and the done count is unchanged.
  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);
  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(Math.max(0, total - 1), i + 1));
  }, [total]);

  // Finish the session once every card has been graded (issue #59). Completion
  // is driven by the graded count, not the browse position, so the user can
  // freely move between cards with the prev/next arrows and the session ends
  // only when all cards are solved. Matching is handled by its own effect
  // (all pairs matched), so it is excluded here.
  useEffect(() => {
    if (phase !== 'playing' || session === null) return;
    if (session.type === 'matching') return;
    if (gradedIds.size < total) return;
    setPhase('results');
  }, [phase, session, gradedIds, total]);

  // Matching game: handle a concept/definition selection. When both sides are
  // selected, check the pair: correct → beam + match; wrong → error flash +
  // mark as missed. The session ends when every pair is matched.
  const handleMatchSelect = useCallback(
    (side: 'left' | 'right', entry: MatchColumnEntry) => {
      if (session?.type !== 'matching') return;
      const left = side === 'left' ? entry : selectedLeft;
      const right = side === 'right' ? entry : selectedRight;
      if (side === 'left') setSelectedLeft(entry);
      else setSelectedRight(entry);
      if (left === null || right === null) return;

      // Both sides selected: check the pair.
      const isCorrect = left.regraId === right.regraId;
      if (isCorrect) {
        // Correct pair: draw the beam, then match it.
        const pair = session.pairs.find((p) => p.regraId === left.regraId) ?? null;
        setBeamPair(pair);
        setMatchedIds((prev) => new Set(prev).add(left.regraId));
        setSelectedLeft(null);
        setSelectedRight(null);
        // Clear the beam after the animation (150 ms draw + 250 ms fade).
        window.setTimeout(() => {
          setBeamPair(null);
        }, 400);
      } else {
        // Wrong pair: flash the error and mark both as missed.
        setErrorPair({ left, right });
        setMissedIds((prev) => new Set(prev).add(left.regraId).add(right.regraId));
        setSelectedLeft(null);
        setSelectedRight(null);
        window.setTimeout(() => {
          setErrorPair(null);
        }, 400);
      }
    },
    [session, selectedLeft, selectedRight],
  );

  // When all matching pairs are matched, finish the session: grade each pair
  // (ever-missed → 1, never-missed → 4) and move to the results phase.
  useEffect(() => {
    if (session?.type !== 'matching') return;
    if (matchedIds.size < session.pairs.length) return;
    const results: SessionResult[] = session.pairs.map((p) => ({
      regraId: p.regraId,
      qualidade: missedIds.has(p.regraId) ? 1 : 4,
    }));
    setGrades(results);
    setPhase('results');
  }, [matchedIds, session, missedIds]);

  // Timer countdown (issue #43): in timed mode (not Zen), a per-card countdown
  // runs from the configured seconds. On expiry the current card is auto-graded
  // as Missed (q=1) and the session advances. The countdown resets whenever the
  // card changes or the user (re)enters timed mode, and is paused in Zen Mode.
  // It applies only to the one-item-at-a-time games (matching has no single
  // "current card" to time).
  useEffect(() => {
    if (zenMode || phase !== 'playing' || session === null) return;
    if (session.type === 'matching') return;
    const current = session.items[currentIndex];
    if (current === undefined) return;
    setTimerSeconds(cardSeconds);
    const interval = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          handleGrade(current.regraId, 1); // Missed on expiry
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [zenMode, phase, session, currentIndex, cardSeconds, handleGrade]);

  // Fire the single sync when the session reaches the results phase.
  useEffect(() => {
    if (phase !== 'results' || syncedRef.current || session === null) return;
    syncedRef.current = true;
    const sessionId = session.id;
    let cancelled = false;
    async function sync() {
      try {
        const res = await fetch('/api/study/session/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuarioId,
            sessionId,
            resultados: grades,
            // The game type (issue #61): recorded on each historico entry so the
            // per-game statistics can group plays by game.
            game,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { regraId: string; proximaRevisao: string }[];
        if (!cancelled) setNextReviews(data);
        // The session completed and its grades were synced: clear the persisted
        // in-progress state so a later visit starts a fresh session (issues
        // #57, #60).
        clearSessionState(cadernoId, game);
      } catch {
        // Sync failure is non-fatal for the UI; the grades are already shown.
        // The persisted state is kept so the user can retry the sync by
        // revisiting the session.
      }
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [phase, session, usuarioId, grades, game, cadernoId]);

  // Loading (issue #49, NFR-07): a skeleton mirroring the playing-phase layout
  // (chrome + game area) so the swap to the real session causes no layout shift.
  if (phase === 'loading') {
    return <SessionSkeleton />;
  }

  if (startError !== null || session === null) {
    return (
      <p role="alert" className="py-16 text-center text-base text-error">
        {startError ?? t('startError')}
      </p>
    );
  }

  if (total === 0) {
    return <p className="py-16 text-center text-base text-text-secondary">{t('noDueRules')}</p>;
  }

  // Results phase: the summary + the single sync (fired by the effect above).
  if (phase === 'results') {
    return <ResultsSummary grades={grades} nextReviews={nextReviews} locale={locale} />;
  }

  // Playing phase: the chrome wraps the current game.
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <SessionChrome
        completed={completed}
        total={total}
        zenMode={zenMode}
        timerSeconds={timerSeconds}
        // The prev/next browse arrows apply to the one-item-at-a-time games
        // (issue #59); matching has no single "current card" to browse, so the
        // arrows are disabled there.
        canPrev={session.type !== 'matching' && currentIndex > 0}
        canNext={session.type !== 'matching' && currentIndex < total - 1}
        onToggleMode={() => {
          setZenMode((z) => !z);
        }}
        onExit={() => {
          router.push('/');
        }}
        onPrev={handlePrev}
        onNext={handleNext}
      />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {session.type === 'flashcard' &&
          (() => {
            const current = session.items[currentIndex];
            return current !== undefined ? (
              <FlashcardGame
                key={current.regraId}
                card={current}
                onGrade={(q) => {
                  handleGrade(current.regraId, q);
                }}
              />
            ) : null;
          })()}
        {session.type === 'matching' && (
          <MatchingGame
            leftColumn={session.leftColumn}
            rightColumn={session.rightColumn}
            matchedIds={matchedIds}
            onSelect={handleMatchSelect}
            selectedLeft={selectedLeft}
            selectedRight={selectedRight}
            beamPair={beamPair}
            errorPair={errorPair}
          />
        )}
        {session.type === 'multiple-choice' &&
          (() => {
            const current = session.items[currentIndex];
            return current !== undefined ? (
              <MultipleChoiceGame
                key={current.regraId}
                item={current}
                onAnswer={(_index, correct) => {
                  recordGrade(current.regraId, correct ? 4 : 1);
                }}
                onNext={advance}
              />
            ) : null;
          })()}
        {session.type === 'cloze' &&
          (() => {
            const current = session.items[currentIndex];
            return current !== undefined ? (
              <ClozeGame
                key={current.regraId}
                item={current}
                onAnswer={(correct) => {
                  recordGrade(current.regraId, correct ? 4 : 1);
                }}
                onNext={advance}
              />
            ) : null;
          })()}
      </main>
    </div>
  );
}
