import { describe, it, expect } from 'vitest';
import pt from '../messages/pt.json';
import en from '../messages/en.json';

// Dictionary snapshot test (issue #30, FR-14): pt-BR and en-US must expose the
// exact same set of translation keys. A key missing from either locale would
// render a raw key (or blank) in the UI, so the two dictionaries are kept in
// lockstep. This test fails if the key sets diverge or a value is not a
// non-empty string.

type Messages = Record<string, unknown>;

// Recursively collect every leaf key path (e.g. "Nav.overview").
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Messages).flatMap(([key, child]) =>
    keyPaths(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

// Resolve a dotted key path against a messages object.
function resolvePath(messages: Messages, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => (acc as Messages)[part], messages);
}

describe('i18n dictionaries (pt-BR / en-US)', () => {
  const ptKeys = keyPaths(pt).sort();
  const enKeys = keyPaths(en).sort();

  it('both locales define the identical set of keys', () => {
    expect(ptKeys).toEqual(enKeys);
  });

  it('every key resolves to a non-empty string in both locales', () => {
    for (const [name, messages] of [
      ['pt-BR', pt],
      ['en-US', en],
    ] as const) {
      for (const path of keyPaths(messages)) {
        const value = resolvePath(messages, path);
        expect(typeof value, `${name}:${path} must be a string`).toBe('string');
        expect((value as string).length, `${name}:${path} must be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('the key set is non-trivial (the shell strings are present)', () => {
    for (const key of [
      'Nav.brand',
      'Nav.overview',
      'Nav.notebooks',
      'Nav.knowledge',
      'Nav.settings',
      'Nav.openNav',
      'Nav.closeNav',
      'Common.backHome',
      'NotFound.title',
      'NotFound.description',
      'Overview.title',
      'Overview.streakDays',
      'Overview.streakAria',
      'Overview.goalProgress',
      'Overview.goalAria',
      'Overview.notebooksTitle',
      'Overview.study',
      'Overview.gameLabel',
      'Overview.gameFlashcards',
      'Overview.gameMatch',
      'Overview.gameMultipleChoice',
      'Overview.gameCloze',
      'Overview.ringAria',
      'Overview.ringPercent',
      'Overview.noArea',
      'Overview.newNotebook',
      'Overview.dialogTitle',
      'Overview.dialogDescription',
      'Overview.nameLabel',
      'Overview.namePlaceholder',
      'Overview.descriptionLabel',
      'Overview.descriptionPlaceholder',
      'Overview.nameRequired',
      'Overview.create',
      'Overview.creating',
      'Overview.createError',
      'Onboarding.title',
      'Onboarding.description',
      'Onboarding.importCta',
      'Onboarding.importHint',
      'Onboarding.seedCta',
      'Onboarding.seedWorking',
      'Onboarding.seedError',
      'Notebooks.title',
      'Knowledge.title',
      'Settings.title',
      'Settings.description',
      'Settings.streakModeLabel',
      'Settings.streakModeSessoes',
      'Settings.streakModeRegras',
      'Settings.thresholdLabel',
      'Settings.thresholdHint',
      'Settings.dailyGoalLabel',
      'Settings.dailyGoalHint',
      'Settings.timerLabel',
      'Settings.timerHint',
      'Settings.zenModeLabel',
      'Settings.zenModeHint',
      'Settings.sessionSizeLabel',
      'Settings.sessionSizeHint',
      'Settings.save',
      'Settings.saving',
      'Settings.saved',
      'Settings.saveError',
      'Settings.errThreshold',
      'Settings.errDailyGoal',
      'Settings.errTimer',
      'Settings.errSessionSize',
      'Session.starting',
      'Session.startError',
      'Session.noDueRules',
      'Session.exit',
      'Session.exitConfirmTitle',
      'Session.exitConfirmBody',
      'Session.exitConfirm',
      'Session.exitCancel',
      'Session.zenMode',
      'Session.timer',
      'Session.timerSeconds',
      'Session.gradeValue',
      'Session.toggleTimer',
      'Session.toggleZen',
      'Session.cardProgress',
      'Session.flipHint',
      'Session.gradeMissed',
      'Session.gradeHard',
      'Session.gradeGood',
      'Session.gradeEasy',
      'Session.justification',
      'Session.hint',
      'Session.matchInstruction',
      'Session.matchCorrect',
      'Session.matchWrong',
      'Session.mcQuestion',
      'Session.clozeInstruction',
      'Session.clozeCheck',
      'Session.clozeCorrect',
      'Session.clozeWrong',
      'Session.timerExpired',
      'Session.resultsTitle',
      'Session.resultsCorrect',
      'Session.resultsSynced',
      'Session.resultsBack',
      'Session.nextReview',
    ]) {
      expect(ptKeys, `pt-BR missing ${key}`).toContain(key);
      expect(enKeys, `en-US missing ${key}`).toContain(key);
    }
  });
});
