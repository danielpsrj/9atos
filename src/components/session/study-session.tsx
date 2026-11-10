'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SessionChrome } from '@/components/session/session-chrome';
import { FlashcardGame } from '@/components/session/flashcard-game';
import { ResultsSummary } from '@/components/session/results-summary';
import type { GameSession, SessionResult } from '@/lib/games';

// Study session (issues #37–#43). The client-side session flow: start a session
// via the API, render the session chrome (progress bar, Exit, Zen/timer toggle)
// around the game, collect grades as the user plays, and on completion show the
// results summary and fire exactly one sync (idempotent per sessionId). The
// flashcard game is the first playable game (#38); the other games (#39–#41)
// plug into the same chrome. Zen Mode is the default (AD-12): the session starts
// untimed. The timer countdown (#43) is layered on top of this flow.
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

  // Record a grade and advance to the next item (or finish the session).
  const handleGrade = useCallback(
    (regraId: string, qualidade: number) => {
      setGrades((prev) => [...prev, { regraId, qualidade }]);
      if (currentIndex + 1 >= total) {
        setPhase('results');
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentIndex, total],
  );

  // Timer countdown (issue #43): in timed mode (not Zen), a per-card countdown
  // runs from the configured seconds. On expiry the current card is auto-graded
  // as Missed (q=1) and the session advances. The countdown resets whenever the
  // card changes or the user (re)enters timed mode, and is paused in Zen Mode.
  useEffect(() => {
    if (zenMode || phase !== 'playing' || session === null) return;
    // The per-card timer applies to the one-item-at-a-time games (flashcard now;
    // MC and cloze later). Matching has no single "current card" to time.
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
  }, [phase, session, usuarioId, grades]);

  if (phase === 'loading') {
    return <p className="py-16 text-center text-base text-text-secondary">{t('starting')}</p>;
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

  // Playing phase: the chrome wraps the current game item.
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <SessionChrome
        completed={currentIndex}
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
      </main>
    </div>
  );
}
