'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Moon, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Session chrome (issue #37, FR-09, spec §5.2 Screen 2 header). The persistent
// frame around every game: a thin linear progress bar at the very top (items
// completed / total) with a done/remaining count at its end (issue #59), an
// Exit button on the left (opens a confirm dialog), always-present prev/next
// arrows to browse cards without solving them (issue #59), and a Zen Mode
// indicator / descending gold timer on the right that the user can toggle. Zen
// Mode is the default (AD-12): sessions start untimed. A presentational
// component — all state and the timer countdown live in the StudySession parent.
interface SessionChromeProps {
  completed: number;
  total: number;
  zenMode: boolean;
  /** Seconds remaining in timed mode (ignored in Zen Mode). */
  timerSeconds: number;
  /** Whether the previous-card arrow is enabled (false at the first card). */
  canPrev: boolean;
  /** Whether the next-card arrow is enabled (false at the last card). */
  canNext: boolean;
  onToggleMode: () => void;
  onExit: () => void;
  /** Move to the previous card without solving it (issue #59). */
  onPrev: () => void;
  /** Move to the next card without solving it (issue #59). */
  onNext: () => void;
}

export function SessionChrome({
  completed,
  total,
  zenMode,
  timerSeconds,
  canPrev,
  canNext,
  onToggleMode,
  onExit,
  onPrev,
  onNext,
}: SessionChromeProps) {
  const t = useTranslations('Session');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);

  return (
    <>
      {/* Progress bar + done/remaining count at its end (issue #59). */}
      <div className="flex items-center gap-3 px-4 pt-2">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-bg-secondary"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('cardProgress', { current: completed, total })}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${String(percent)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-text-secondary">
          {t('doneRemaining', { done: completed, remaining })}
        </span>
      </div>

      {/* Header row: Exit (left) + prev/next browse arrows (center, issue #59)
          + Zen/timer (right). */}
      <div className="flex items-center justify-between gap-4 border-b border-border py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          <X aria-hidden />
          {t('exit')}
        </Button>

        {/* Always-present prev/next arrows: browse to the previous/next card
            without solving it (issue #59). Disabled at the boundaries. */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label={t('prevCard')}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!canNext}
            aria-label={t('nextCard')}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        <button
          type="button"
          onClick={onToggleMode}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
          aria-pressed={zenMode}
          aria-label={zenMode ? t('toggleTimer') : t('toggleZen')}
        >
          {zenMode ? (
            <>
              <Moon aria-hidden className="size-4 text-primary" />
              {t('zenMode')}
            </>
          ) : (
            <>
              <Timer aria-hidden className="size-4 text-accent" />
              <span className="tabular-nums text-accent">
                {t('timerSeconds', { seconds: timerSeconds })}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Exit confirmation: explicitly warns that unsynced grades are lost. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exitConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('exitConfirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              {t('exitCancel')}
            </Button>
            <Button variant="destructive" onClick={onExit}>
              {t('exitConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
