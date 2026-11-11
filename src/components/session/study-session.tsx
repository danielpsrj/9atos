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

  // Start the session on mount.
  useEffect(() => {
    let cancelled = false;
    async function start() {
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

  // The total number of items in the session (for the progress bar). Matching
  // sessions count pairs; the other games count items.
  const total =
    session === null
      ? 0
      : session.type === 'matching'
        ? session.pairs.length
        : session.items.length;

  // The number of completed items (for the progress bar). Matching counts
  // matched pairs; the other games count the current index.
  const completed = session?.type === 'matching' ? matchedIds.size : currentIndex;

  // Record a grade without advancing. Used by the MC game's feedback phase (the
  // grade is recorded when the user answers; the advance happens when the user
  // clicks "next").
  const recordGrade = useCallback((regraId: string, qualidade: number) => {
    setGrades((prev) => [...prev, { regraId, qualidade }]);
  }, []);

  // Advance to the next item (or finish the session). Used by the MC game's
  // "next" button after the feedback phase.
  const advance = useCallback(() => {
    if (currentIndex + 1 >= total) {
      setPhase('results');
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, total]);

  // Record a grade and advance to the next item (or finish the session). Used
  // by the one-item-at-a-time games (flashcard, cloze) and the timer expiry.
  const handleGrade = useCallback(
    (regraId: string, qualidade: number) => {
      recordGrade(regraId, qualidade);
      if (currentIndex + 1 >= total) {
        setPhase('results');
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [recordGrade, currentIndex, total],
  );

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
      } catch {
        // Sync failure is non-fatal for the UI; the grades are already shown.
      }
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [phase, session, usuarioId, grades, game]);

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
        onToggleMode={() => {
          setZenMode((z) => !z);
        }}
        onExit={() => {
          router.push('/');
        }}
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
