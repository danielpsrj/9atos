'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { Settings } from '@/lib/settings';

// Settings form (issue #36, FR-16, AD-10). A client component: it holds the six
// configurable tunables in local state (seeded from the server-read values),
// validates them client-side against the same ranges the server enforces, and
// PATCHes /api/settings on save. Out-of-range values show inline errors and are
// not submitted. Changes take effect on the next session (the server applies
// them at session start, never mid-session). Accessible: every field is labeled
// and errors are announced via role=alert.
interface SettingsFormProps {
  initial: Settings;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const t = useTranslations('Settings');
  const [modoOfensiva, setModoOfensiva] = useState<Settings['modoOfensiva']>(initial.modoOfensiva);
  const [limiarOfensiva, setLimiarOfensiva] = useState(String(initial.limiarOfensiva));
  const [metaDiaria, setMetaDiaria] = useState(String(initial.metaDiaria));
  const [segundosPorCartao, setSegundosPorCartao] = useState(String(initial.segundosPorCartao));
  const [zenModePadrao, setZenModePadrao] = useState(initial.zenModePadrao);
  const [limiteSessao, setLimiteSessao] = useState(String(initial.limiteSessao));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Client-side validation mirroring validateSettingsPatch (src/lib/settings.ts).
  // Returns a field->message map (empty when everything is in range).
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const limiar = Number(limiarOfensiva);
    if (!Number.isInteger(limiar) || limiar < 1) next.limiarOfensiva = t('errThreshold');
    const meta = Number(metaDiaria);
    if (!Number.isInteger(meta) || meta < 1) next.metaDiaria = t('errDailyGoal');
    const segundos = Number(segundosPorCartao);
    if (!Number.isInteger(segundos) || segundos < 5 || segundos > 120) {
      next.segundosPorCartao = t('errTimer');
    }
    const limite = Number(limiteSessao);
    if (!Number.isInteger(limite) || limite < 5 || limite > 50)
      next.limiteSessao = t('errSessionSize');
    return next;
  }

  async function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modoOfensiva,
          limiarOfensiva: Number(limiarOfensiva),
          metaDiaria: Number(metaDiaria),
          segundosPorCartao: Number(segundosPorCartao),
          zenModePadrao,
          limiteSessao: Number(limiteSessao),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSaveError(body?.error?.message ?? t('saveError'));
        return;
      }
      setSaved(true);
    } catch {
      setSaveError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none';

  return (
    <form
      onSubmit={(e) => {
        void handleSave(e);
      }}
      className="flex max-w-xl flex-col gap-6"
      noValidate
    >
      {/* Streak mode (AD-05): sessoes | regras. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="streak-mode" className="text-sm font-medium text-text-primary">
          {t('streakModeLabel')}
        </label>
        <select
          id="streak-mode"
          value={modoOfensiva}
          onChange={(e) => {
            setModoOfensiva(e.target.value as Settings['modoOfensiva']);
          }}
          className={inputClass}
        >
          <option value="sessoes">{t('streakModeSessoes')}</option>
          <option value="regras">{t('streakModeRegras')}</option>
        </select>
      </div>

      {/* Offensive threshold (AD-05): integer >= 1. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="threshold" className="text-sm font-medium text-text-primary">
          {t('thresholdLabel')}
        </label>
        <input
          id="threshold"
          type="number"
          min={1}
          step={1}
          value={limiarOfensiva}
          onChange={(e) => {
            setLimiarOfensiva(e.target.value);
          }}
          aria-invalid={errors.limiarOfensiva !== undefined}
          aria-describedby={
            errors.limiarOfensiva !== undefined ? 'threshold-error' : 'threshold-hint'
          }
          className={inputClass}
        />
        {errors.limiarOfensiva !== undefined ? (
          <p id="threshold-error" role="alert" className="text-sm text-error">
            {errors.limiarOfensiva}
          </p>
        ) : (
          <p id="threshold-hint" className="text-xs text-text-secondary">
            {t('thresholdHint')}
          </p>
        )}
      </div>

      {/* Daily goal (AD-10): integer >= 1. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="daily-goal" className="text-sm font-medium text-text-primary">
          {t('dailyGoalLabel')}
        </label>
        <input
          id="daily-goal"
          type="number"
          min={1}
          step={1}
          value={metaDiaria}
          onChange={(e) => {
            setMetaDiaria(e.target.value);
          }}
          aria-invalid={errors.metaDiaria !== undefined}
          aria-describedby={
            errors.metaDiaria !== undefined ? 'daily-goal-error' : 'daily-goal-hint'
          }
          className={inputClass}
        />
        {errors.metaDiaria !== undefined ? (
          <p id="daily-goal-error" role="alert" className="text-sm text-error">
            {errors.metaDiaria}
          </p>
        ) : (
          <p id="daily-goal-hint" className="text-xs text-text-secondary">
            {t('dailyGoalHint')}
          </p>
        )}
      </div>

      {/* Per-card timer (AD-12): integer 5–120. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="timer" className="text-sm font-medium text-text-primary">
          {t('timerLabel')}
        </label>
        <input
          id="timer"
          type="number"
          min={5}
          max={120}
          step={1}
          value={segundosPorCartao}
          onChange={(e) => {
            setSegundosPorCartao(e.target.value);
          }}
          aria-invalid={errors.segundosPorCartao !== undefined}
          aria-describedby={errors.segundosPorCartao !== undefined ? 'timer-error' : 'timer-hint'}
          className={inputClass}
        />
        {errors.segundosPorCartao !== undefined ? (
          <p id="timer-error" role="alert" className="text-sm text-error">
            {errors.segundosPorCartao}
          </p>
        ) : (
          <p id="timer-hint" className="text-xs text-text-secondary">
            {t('timerHint')}
          </p>
        )}
      </div>

      {/* Zen Mode default (AD-13): boolean. */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="zen-mode" className="text-sm font-medium text-text-primary">
            {t('zenModeLabel')}
          </label>
          <span className="text-xs text-text-secondary">{t('zenModeHint')}</span>
        </div>
        <Switch
          id="zen-mode"
          checked={zenModePadrao}
          onCheckedChange={(checked) => {
            setZenModePadrao(checked);
          }}
        />
      </div>

      {/* Session size limit (AD-10): integer 5–50. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="session-size" className="text-sm font-medium text-text-primary">
          {t('sessionSizeLabel')}
        </label>
        <input
          id="session-size"
          type="number"
          min={5}
          max={50}
          step={1}
          value={limiteSessao}
          onChange={(e) => {
            setLimiteSessao(e.target.value);
          }}
          aria-invalid={errors.limiteSessao !== undefined}
          aria-describedby={
            errors.limiteSessao !== undefined ? 'session-size-error' : 'session-size-hint'
          }
          className={inputClass}
        />
        {errors.limiteSessao !== undefined ? (
          <p id="session-size-error" role="alert" className="text-sm text-error">
            {errors.limiteSessao}
          </p>
        ) : (
          <p id="session-size-hint" className="text-xs text-text-secondary">
            {t('sessionSizeHint')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-text-secondary">
            {t('saved')}
          </span>
        )}
        {saveError !== null && (
          <span role="alert" className="text-sm text-error">
            {saveError}
          </span>
        )}
      </div>
    </form>
  );
}
