'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Moon, Timer } from 'lucide-react';
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
// completed / total), an Exit button on the left (opens a confirm dialog that
// warns unsynced grades will be lost), and a Zen Mode indicator / descending
// gold timer on the right that the user can toggle. Zen Mode is the default
// (AD-12): sessions start untimed. A presentational component — all state and
// the timer countdown live in the StudySession parent.
interface SessionChromeProps {
  completed: number;
  total: number;
  zenMode: boolean;
  /** Seconds remaining in timed mode (ignored in Zen Mode). */
  timerSeconds: number;
  onToggleMode: () => void;
  onExit: () => void;
}

export function SessionChrome({
  completed,
  total,
  zenMode,
  timerSeconds,
  onToggleMode,
  onExit,
}: SessionChromeProps) {
  const t = useTranslations('Session');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      {/* Thin linear progress bar at the very top of the session. */}
      <div
        className="h-1 w-full bg-bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('cardProgress', { current: completed, total })}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${String(percent)}%` }}
        />
      </div>

      {/* Header row: Exit (left) + Zen/timer (right). */}
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
